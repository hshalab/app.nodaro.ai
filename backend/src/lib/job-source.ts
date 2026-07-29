/**
 * Where did this job come from? — derived ONCE per request, from request
 * context only.
 *
 * Before this existed the only provenance marker was `jobs.mcp_client`, stamped
 * by hand at each insert site. Everything that wasn't MCP — the canvas, the
 * studio client, the CLI, the SDK, a published app, a raw API call — collapsed
 * to `null`, so an operator looking at a job could not tell a CLI run from a
 * browser run from an integration. `9d786dc2` (2026-07-29) was the question
 * that surfaced it.
 *
 * ## Two columns, on purpose
 *
 * `source` is a COARSE, closed vocabulary — the kind of caller. `source_detail`
 * is the SPECIFIC identity: the MCP client name, the browser origin host, the
 * client package + version, the developer-app id.
 *
 * That split is what keeps this from rotting. A host→label lookup table would
 * need a code change (and a deploy) every time a new subdomain ships, and the
 * failure mode is silent: the new surface just reports as something else. Here,
 * a brand-new `person.nodaro.ai` shows up in admin as
 * `web · person.nodaro.ai` the day it launches, with nothing added to this file.
 *
 * ## Precedence, and why it is this order
 *
 * Signals can legitimately co-occur — the MCP server calls our own routes over
 * HTTP, so an MCP-originated request also carries whatever transport headers
 * that hop sets. Precedence resolves that to the ORIGINATING surface:
 *
 *  1. `internal`  — the internal-orchestrator secret. Server-to-server; the
 *                   caller is us. Checked first because the orchestrator's own
 *                   HTTP hop would otherwise look like a plain API call.
 *  2. `mcp`       — `mcp_client` in the body, injected by every MCP tool.
 *  3. `app`       — a developer-app OAuth token (`req.appAuthorization`).
 *                   Beats the client header: what matters is WHICH integration,
 *                   not that it happened to use our SDK to get there.
 *  4. `cli`/`sdk` — the `X-Nodaro-Client` header the published packages send.
 *  5. `web`       — an `Origin` header. Browsers always send it and CORS
 *                   already validates it, so it cannot be spoofed by a page we
 *                   don't serve. Non-browser callers never send it.
 *  6. `api`       — none of the above: a raw HTTP call, or an SDK/CLI old
 *                   enough to predate the header.
 *
 * NOTE `workflow` is deliberately NOT derived here. A job that belongs to an
 * orchestrated run is identified by `workflow_execution_id` being set, which is
 * already a column and already exact. Re-deriving it into `source` would create
 * a second answer to the same question that can disagree with the first — and
 * would erase the more useful fact, which is what triggered the RUN (a schedule,
 * a webhook, MCP, a person clicking Run). `workflow_executions.trigger_type`
 * holds that. Admin should show both: the run's trigger and the job's caller.
 */
import type { FastifyRequest } from "fastify"
import { extractMcpClient } from "./extract-mcp-client.js"

/**
 * Local copy of `request-helpers.firstHeaderValue`, deliberately NOT imported.
 *
 * This module runs on EVERY job insert, and `request-helpers.js` is a module
 * route tests routinely stub with a partial mock (four already do). Importing
 * from it means any test that stubs three of its four exports turns every job
 * insert in that suite into an opaque 500 — which is exactly what happened
 * when this file first shipped. A one-line array unwrap is not worth that
 * coupling; `request-helpers` remains the canonical export for route code.
 */
const firstHeaderValue = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v

/** Coarse caller kind. Closed set — widen only for a genuinely new KIND of
 *  caller, not for a new deployment of an existing one (that's `detail`). */
export const JOB_SOURCES = ["internal", "mcp", "app", "cli", "sdk", "web", "api"] as const
export type JobSource = (typeof JOB_SOURCES)[number]

/** Header the published `@nodaro/sdk` and `@nodaro/cli` send, e.g.
 *  `cli/1.4.0` or `sdk/1.4.0`. Anything else is ignored rather than trusted —
 *  this is a convenience signal from an unauthenticated header, so it may only
 *  ever select among values we already recognise, never invent one. */
export const CLIENT_HEADER = "x-nodaro-client"

export interface DerivedJobSource {
  source: JobSource
  /** Specific identity within `source`; null when there is nothing more to say. */
  sourceDetail: string | null
}

/** Storage cap — matches `extract-mcp-client`'s reasoning: truncate rather than
 *  drop, so an over-long value still yields a usable badge. */
const DETAIL_MAX = 80
const detail = (v: string | null | undefined): string | null =>
  !v ? null : v.length > DETAIL_MAX ? v.slice(0, DETAIL_MAX) : v

/** `https://studio.nodaro.ai:443` → `studio.nodaro.ai`. Returns null for a
 *  malformed Origin rather than storing the raw string, so `source_detail`
 *  stays a clean host we can GROUP BY. */
function originHost(origin: string | undefined): string | null {
  if (!origin || origin === "null") return null
  try {
    return new URL(origin).host || null
  } catch {
    return null
  }
}

/** Parse `X-Nodaro-Client`. Only `cli` and `sdk` are honoured; the version is
 *  kept verbatim as detail. A header claiming anything else is discarded. */
function parseClientHeader(raw: string | undefined): DerivedJobSource | null {
  if (!raw) return null
  const value = raw.trim()
  const name = (value.split("/")[0] ?? "").toLowerCase()
  if (name !== "cli" && name !== "sdk") return null
  return { source: name, sourceDetail: detail(value) }
}

/**
 * Derive the calling surface for a job about to be inserted.
 *
 * Pure with respect to `req` — no DB access, no async — so it is safe to call
 * on the hot path of every job-creating route.
 */
export function deriveJobSource(req: FastifyRequest): DerivedJobSource {
  if (req.isInternalCall) return { source: "internal", sourceDetail: null }

  const mcpClient = extractMcpClient(req.body)
  if (mcpClient) return { source: "mcp", sourceDetail: detail(mcpClient) }

  if (req.appAuthorization?.appId) {
    return { source: "app", sourceDetail: detail(req.appAuthorization.appId) }
  }

  const fromHeader = parseClientHeader(firstHeaderValue(req.headers[CLIENT_HEADER] as string | string[] | undefined))
  if (fromHeader) return fromHeader

  const host = originHost(firstHeaderValue(req.headers.origin))
  if (host) return { source: "web", sourceDetail: detail(host) }

  return { source: "api", sourceDetail: null }
}

/**
 * The two columns as a spreadable row fragment. Kept separate from
 * `deriveJobSource` so the derivation stays testable without column names, and
 * so `insertJob` has exactly one place that knows the schema.
 */
export function jobSourceColumns(req: FastifyRequest): { source: JobSource; source_detail: string | null } {
  const { source, sourceDetail } = deriveJobSource(req)
  return { source, source_detail: sourceDetail }
}
