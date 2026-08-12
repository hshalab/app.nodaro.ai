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

import { nodaroCloudFetch, getNodaroConnection, nodaroCloudBase } from "../../lib/nodaro-connect.js"
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
      ? "Insufficient nodaro.ai credits — top up or upgrade your connected account."
      : status === 401 || status === 403
        ? "The nodaro.ai connection was rejected — it may have been revoked. Reconnect from Integrations."
        : `${operation} failed (${status})`
  const message = err?.message?.trim() ? err.message : fallback
  return new NodaroCloudError(`nodaro.ai: ${message}`, status, err?.code)
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
      `nodaro.ai: POST ${path} succeeded but returned no jobId`,
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
          `nodaro.ai: polling job ${jobId} failed repeatedly (${message})`,
        )
      }
      continue
    }

    if (!job) {
      transientFailures += 1
      if (transientFailures > MAX_TRANSIENT_POLL_FAILURES) {
        throw new NodaroCloudError(
          `nodaro.ai: job ${jobId} poll returned no data repeatedly`,
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
        `nodaro.ai: generation was cancelled on the cloud (job ${jobId})`,
      )
    }
    throw new NodaroCloudError(
      `nodaro.ai: ${job.error_message?.trim() ? job.error_message : `generation failed (job ${jobId})`}`,
    )
  }

  throw new NodaroCloudError(
    `nodaro.ai: job ${jobId} did not finish within ${Math.round(POLL_BUDGET_MS / 60_000)} minutes`,
  )
}


// ─── Instance→cloud media handoff ─────────────────────────────────
//
// Local artifacts live in the instance's own storage (MinIO / self-host R2),
// often on localhost or a private network the cloud cannot and will not fetch
// (its safe-fetch guard rejects private hosts — the exact error the founder
// hit live: "imageUrl: URL must use http(s) and must not point to localhost
// or private networks"). Any media INPUT the instance sends to a cloud job is
// therefore re-hosted first: read the bytes locally, push them through the
// cloud's public upload route with the instance token, pass the returned
// public URL.

function isCloudUnreachableUrl(url: string): boolean {
  try {
    const u = new URL(url)
    if (u.protocol !== "http:" && u.protocol !== "https:") return true
    const host = u.hostname
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host === "host.docker.internal" ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
      host.endsWith(".local") ||
      !host.includes(".")
    )
  } catch {
    return true
  }
}

const MIME_TO_UPLOAD_NAME: Record<string, string> = {
  "image/png": "frame.png",
  "image/jpeg": "frame.jpg",
  "image/webp": "frame.webp",
  "image/avif": "frame.avif",
}

/** Pass public URLs through untouched; re-host instance-local ones. */
export async function ensureCloudReachableImageUrl(url: string): Promise<string>
export async function ensureCloudReachableImageUrl(url: string | undefined): Promise<string | undefined>
export async function ensureCloudReachableImageUrl(url: string | undefined): Promise<string | undefined> {
  if (!url || !isCloudUnreachableUrl(url)) return url

  // Plain fetch on purpose: the URL is the instance's OWN storage (often a
  // private host), which the safe-fetch guard would reject by design.
  const local = await fetch(url)
  if (!local.ok) {
    throw new NodaroCloudError(
      `nodaro.ai: failed to read local media for cloud upload (${local.status})`,
    )
  }
  const buffer = Buffer.from(await local.arrayBuffer())
  const mime = local.headers.get("content-type")?.split(";")[0] ?? "image/png"

  const conn = await getNodaroConnection()
  if (!conn?.accessToken) {
    throw new NodaroCloudError("nodaro.ai is not connected")
  }
  const form = new FormData()
  form.append("file", new Blob([buffer], { type: mime }), MIME_TO_UPLOAD_NAME[mime] ?? "frame.png")
  const res = await fetch(`${nodaroCloudBase()}/v1/upload/image`, {
    method: "POST",
    headers: { Authorization: `Bearer ${conn.accessToken}` },
    body: form,
  })
  if (!res.ok) {
    throw new NodaroCloudError(`nodaro.ai: media upload failed (${res.status})`, res.status)
  }
  const json = (await res.json().catch(() => null)) as { url?: string } | null
  if (!json?.url) {
    throw new NodaroCloudError("nodaro.ai: media upload returned no url")
  }
  return json.url
}

/** Array form of ensureCloudReachableImageUrl (order preserved). */
export async function ensureCloudReachableImageUrls(
  urls: string[] | undefined,
): Promise<string[] | undefined> {
  if (!urls?.length) return urls
  return Promise.all(urls.map((u) => ensureCloudReachableImageUrl(u)))
}
