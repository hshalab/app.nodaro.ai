/**
 * Nodaro Cloud provider HTTP client (community cloud-connect, Phase 4a).
 *
 * Thin layer the NodaroCloud* providers share: create a generation job on the
 * connected cloud via its public /v1 routes, then poll GET /v1/jobs/:id until
 * the job reaches a terminal status. Auth rides `nodaroCloudFetch` (the stored
 * `ndr_app_` instance token — see lib/nodaro-connect.ts); the token resolves
 * to the connected cloud account, whose wallet is billed for the generation.
 *
 * Error mapping: cloud errors (402 insufficient_credits, 403 revoked/scope,
 * 5xx) are rethrown as NodaroCloudError carrying the cloud's own error
 * message, so the instance user sees the real reason a run failed.
 */

import { nodaroCloudFetch } from "../../lib/nodaro-connect.js"
import type { ProgressCallback } from "../provider.interface.js"

/** Poll every 2s for the first few attempts, then 4s (spec: 2-4s interval). */
const POLL_FAST_MS = 2_000
const POLL_SLOW_MS = 4_000
const POLL_FAST_ATTEMPTS = 5
/** Wall-clock budget (~15 min) before giving up on a cloud job. */
const POLL_BUDGET_MS = 15 * 60 * 1_000
/** Consecutive transient poll failures (network / 5xx / 429) tolerated. */
const MAX_TRANSIENT_POLL_FAILURES = 5

/** Error body every cloud route returns: `{ error: { code, message } }`. */
interface CloudErrorBody {
  error?: { code?: string; message?: string }
}

/** Public (sanitized) job shape from the cloud's GET /v1/jobs/:id. */
export interface CloudJob {
  id: string
  status: string
  progress?: number
  output_data?: Record<string, unknown> | null
  error_message?: string | null
}

const TERMINAL_STATUSES: ReadonlySet<string> = new Set([
  "completed",
  "failed",
  "cancelled",
])

export class NodaroCloudError extends Error {
  readonly statusCode?: number
  readonly code?: string

  constructor(message: string, statusCode?: number, code?: string) {
    super(message)
    this.name = "NodaroCloudError"
    this.statusCode = statusCode
    this.code = code
  }
}

async function readCloudErrorBody(res: Response): Promise<CloudErrorBody["error"]> {
  const body = (await res.json().catch(() => null)) as CloudErrorBody | null
  return body?.error ?? undefined
}

/**
 * Build a NodaroCloudError for a non-OK cloud response, preferring the
 * cloud's own error message (the real reason) over a generic fallback.
 */
function cloudError(
  status: number,
  err: CloudErrorBody["error"],
  operation: string,
): NodaroCloudError {
  const fallback =
    status === 402
      ? "Insufficient Nodaro Cloud credits — top up or upgrade your connected account."
      : status === 401 || status === 403
        ? "The Nodaro Cloud connection was rejected — it may have been revoked. Reconnect from Integrations."
        : `${operation} failed (${status})`
  const message = err?.message?.trim() ? err.message : fallback
  return new NodaroCloudError(`Nodaro Cloud: ${message}`, status, err?.code)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * POST a generation request to a cloud route (e.g. /v1/generate-image) and
 * return the created cloud job id. The instance sends the same body the
 * route's Zod schema accepts — identical vocabulary to a direct API caller.
 */
export async function createCloudJob(
  path: string,
  body: Record<string, unknown>,
): Promise<string> {
  const res = await nodaroCloudFetch(path, {
    method: "POST",
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw cloudError(res.status, await readCloudErrorBody(res), `POST ${path}`)
  }
  const json = (await res.json().catch(() => null)) as { jobId?: unknown } | null
  const jobId = typeof json?.jobId === "string" ? json.jobId : undefined
  if (!jobId) {
    throw new NodaroCloudError(
      `Nodaro Cloud: POST ${path} succeeded but returned no jobId`,
      res.status,
    )
  }
  return jobId
}

/**
 * Poll the cloud's GET /v1/jobs/:id until the job is terminal.
 *
 * - `completed` → resolves with the job (caller reads output_data URLs).
 * - `failed` / `cancelled` → throws with the cloud's error_message.
 * - Transient poll errors (network, 5xx, 429) are tolerated up to
 *   MAX_TRANSIENT_POLL_FAILURES consecutive occurrences; auth-ish statuses
 *   (401/403/404) fail fast — the token was revoked or the job vanished.
 * - Gives up after POLL_BUDGET_MS (~15 min).
 */
export async function waitForCloudJob(
  jobId: string,
  onProgress?: ProgressCallback,
): Promise<CloudJob> {
  const startedAt = Date.now()
  let attempt = 0
  let transientFailures = 0

  while (Date.now() - startedAt < POLL_BUDGET_MS) {
    if (attempt > 0) {
      await sleep(attempt <= POLL_FAST_ATTEMPTS ? POLL_FAST_MS : POLL_SLOW_MS)
    }
    attempt += 1

    let job: CloudJob | undefined
    try {
      const res = await nodaroCloudFetch(`/v1/jobs/${jobId}`)
      if (!res.ok) {
        if (res.status === 401 || res.status === 403 || res.status === 404) {
          throw cloudError(res.status, await readCloudErrorBody(res), `GET /v1/jobs/${jobId}`)
        }
        // 5xx / 429: transient — retry within the failure allowance.
        transientFailures += 1
        if (transientFailures > MAX_TRANSIENT_POLL_FAILURES) {
          throw cloudError(res.status, await readCloudErrorBody(res), `GET /v1/jobs/${jobId}`)
        }
        continue
      }
      const json = (await res.json().catch(() => null)) as { data?: CloudJob } | null
      job = json?.data
    } catch (err) {
      if (err instanceof NodaroCloudError) throw err
      // Network-level failure — transient.
      transientFailures += 1
      if (transientFailures > MAX_TRANSIENT_POLL_FAILURES) {
        const message = err instanceof Error ? err.message : String(err)
        throw new NodaroCloudError(
          `Nodaro Cloud: polling job ${jobId} failed repeatedly (${message})`,
        )
      }
      continue
    }

    if (!job) {
      transientFailures += 1
      if (transientFailures > MAX_TRANSIENT_POLL_FAILURES) {
        throw new NodaroCloudError(
          `Nodaro Cloud: job ${jobId} poll returned no data repeatedly`,
        )
      }
      continue
    }
    transientFailures = 0

    if (typeof job.progress === "number" && onProgress) {
      try {
        await onProgress(job.progress)
      } catch {
        // Progress reporting is best-effort — never fail the poll for it.
      }
    }

    if (!TERMINAL_STATUSES.has(job.status)) continue

    if (job.status === "completed") return job
    if (job.status === "cancelled") {
      throw new NodaroCloudError(
        `Nodaro Cloud: generation was cancelled on the cloud (job ${jobId})`,
      )
    }
    throw new NodaroCloudError(
      `Nodaro Cloud: ${job.error_message?.trim() ? job.error_message : `generation failed (job ${jobId})`}`,
    )
  }

  throw new NodaroCloudError(
    `Nodaro Cloud: job ${jobId} did not finish within ${Math.round(POLL_BUDGET_MS / 60_000)} minutes`,
  )
}
