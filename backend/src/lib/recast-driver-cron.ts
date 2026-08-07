import type { FastifyInstance } from "fastify"
import { config } from "./config.js"

/**
 * 5s tick for the recast driver — sibling of `schedule-cron.ts` and
 * `scheduled-posts-cron.ts`, same in-server lifecycle.
 *
 * WHY THIS EXISTS. Recast's interactive lane used to be driven by the browser:
 * the client bought each cycle, enforced each gate deadline and dispatched the
 * render. A paid run therefore stopped when the tab closed. This ticks the
 * plugin's own driver instead.
 *
 * WHY 5s AND NOT THE 60 ITS SIBLINGS USE. Tick latency lands on every
 * TRANSITION, and an interactive run has fifteen or more of them. At 60s that
 * is a quarter-hour of pure waiting bolted onto a run.
 *
 * KNOWS NOTHING ABOUT RECAST. One URL. All of the logic — which runs owe a
 * step, which step, what it costs — lives in the plugin, where it ships and
 * versions with the rest of recast.
 */

const TICK_MS = 5_000

let intervalId: ReturnType<typeof setInterval> | null = null
/** A step can nest two injects deep with no latency bound; without this a slow
 *  tick is re-entered by the next one. */
let inFlight = false
/** Set when the route answers 404 — the plugin is not loaded (Community), and
 *  retrying that forever is noise, not resilience. */
let unavailable = false

function enabled(): boolean {
  return process.env.RECAST_DRIVER_CRON_ENABLED === "true"
}

export async function driverTick(app: FastifyInstance): Promise<"ran" | "skipped" | "disabled"> {
  if (!enabled() || unavailable) return "disabled"
  if (inFlight) return "skipped"
  inFlight = true
  try {
    const res = await app.inject({
      method: "POST",
      url: "/v1/recast/internal/drive",
      headers: { "x-internal-orchestrator-secret": config.INTERNAL_ORCHESTRATOR_SECRET },
      payload: {},
    })
    if (res.statusCode === 404) {
      unavailable = true
      console.log("[recast-driver] route not found — recast plugin not loaded; cron disabled")
    } else if (res.statusCode < 200 || res.statusCode >= 300) {
      // Covers 5xx AND anything else non-2xx (e.g. a 403 from a desynced
      // internal secret) — all transient-shaped, none of them a reason to
      // latch off the way a 404 is.
      console.error(`[recast-driver] tick failed: ${res.statusCode}`)
    }
    return "ran"
  } catch (err) {
    console.error("[recast-driver] tick threw:", err)
    return "ran"
  } finally {
    inFlight = false
  }
}

export function startRecastDriverCron(app: FastifyInstance): void {
  if (intervalId) return
  if (!enabled()) {
    console.log("[recast-driver] disabled (set RECAST_DRIVER_CRON_ENABLED=true to enable)")
    return
  }
  console.log(`[recast-driver] started, ticking every ${TICK_MS / 1000}s`)
  intervalId = setInterval(() => { void driverTick(app) }, TICK_MS)
}

export function stopRecastDriverCron(): void {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
}

/** Test hook — clears the module-level latches. */
export function resetRecastDriverCronForTests(): void {
  stopRecastDriverCron()
  inFlight = false
  unavailable = false
}
