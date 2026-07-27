/**
 * Smart-cut best-pair SEARCH WINDOWS — the shared bound + clamp for
 * generate-video-pro's `smartCutFramesPrev` / `smartCutFramesNext`.
 *
 * What they do: the best-pair matcher (the mode the node calls "legacy-8x8")
 * PSNR-compares the last N frames of a segment against the first M of the
 * next, ends the previous clip ON the best match and starts the next right
 * AFTER its twin — so the duplicated frame plays once and motion stays
 * continuous. N and M are those windows. Absent → the engine's own 8/8
 * default, which is byte-identical to the behavior before they were
 * exposed.
 *
 * Why wider helps: a continuation can re-enact a longer stretch of the
 * previous tail than 8 frames covers, and a match outside the window is
 * simply never found — the boundary silently falls back to the fixed
 * freeze-trims. recast pins 24/24 for exactly this reason.
 *
 * Why a shared clamp: the canvas node (single-node Run) and the orchestrator
 * (workflow Run) are two independent send paths into the same engine route,
 * whose Zod schema rejects out-of-range values. Deriving both from this one
 * function means a stale or hand-edited node value degrades to a legal
 * request instead of 400-ing an entire multi-segment run at finalize time —
 * and the two paths cannot drift apart.
 */

/** Widest window the UI offers. The engine route itself accepts up to 48;
 *  24 is the product cap — it already covers a full second of re-enactment
 *  at 24fps, and every frame added past the real overlap only costs match
 *  time and invites a spurious pairing. */
export const SMART_CUT_WINDOW_MAX = 24
/** Narrowest meaningful window — one frame each side. */
export const SMART_CUT_WINDOW_MIN = 1
/** The engine's default when the field is absent. Documented here so the UI
 *  can show it as the placeholder without hardcoding a second copy. */
export const SMART_CUT_WINDOW_DEFAULT = 8

/**
 * Narrow an arbitrary node value to a legal window, or `undefined` to mean
 * "let the engine use its default". Non-numbers, NaN, and non-integers all
 * collapse to `undefined` rather than to a guessed number: a malformed value
 * should fall back to the proven default, not silently pick a different
 * search width than the user asked for.
 */
export function clampSmartCutWindow(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined
  const n = Math.round(value)
  if (n < SMART_CUT_WINDOW_MIN) return SMART_CUT_WINDOW_MIN
  if (n > SMART_CUT_WINDOW_MAX) return SMART_CUT_WINDOW_MAX
  return n
}
