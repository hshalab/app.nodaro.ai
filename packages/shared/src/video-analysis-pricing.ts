/**
 * Video-analysis pricing — shared duration-bucket credit model.
 *
 * Single source of truth for the video-analysis node's NON-monetary credit
 * math: duration bucketing, the window-batching constants (also consumed by
 * the backend workers for real chunking, not just pricing), and the
 * composite credit-id builder. The route (charge at generate-time), the
 * worker (re-check + settle), and the frontend node UI (via
 * `buildVideoAnalysisCreditId` + `/v1/credits/model-cost`) all derive from
 * these.
 *
 * The measured-rate constants and the $-derived `videoAnalysisBucketCredits`
 * formula that GENERATE these numbers live PRIVATELY in the
 * `@nodaroai/cloud-plugins` package (`src/plugins/video-analysis/cost.ts`) —
 * never in this public repo. They were first moved out of this package
 * (published Apache-2.0 on npm) per the 2026-07-06 public-flip IP audit S5,
 * then out of the app repo entirely alongside the rest of the video-analysis
 * node. A cross-check test in that private package guards this table so the
 * public numbers can't silently drift from the formula.
 *
 * `VIDEO_ANALYSIS_BUCKET_CREDITS` below is the precomputed OUTPUT of that
 * private formula for every (model × bucket) combination — a plain credit
 * lookup table, not a formula, mirroring the same wire-contract pattern
 * `VIDEO_CLIP_CREDITS` uses in `film-pricing.ts`. It is what the frontend's
 * client-side cost preview (`estimateNodeCredits` in
 * workflow-editor/types.ts) reads instead of calling the formula directly.
 * The formula's own test in `@nodaroai/cloud-plugins`
 * (`src/plugins/video-analysis/__tests__/cost.test.ts`) cross-checks this table
 * against it and fails on drift. There is deliberately NO app-side formula to
 * check against — it was moved private in 2026-07 and the old backend test
 * went with it.
 */

export const VIDEO_ANALYSIS_DURATION_BUCKETS = [60, 180, 360, 600] as const
/** Worker re-check grace: route metadata is integer-rounded, provider durations nominal;
 *  ffprobe floats run 0.05–2 s over. Zero tolerance fails legit videos at 1:00/3:00/6:00/10:00. */
export const VIDEO_ANALYSIS_DURATION_TOLERANCE_SEC = 3
export const VIDEO_ANALYSIS_MAX_DURATION_SEC = 600
const WINDOW_LEN = 150, WINDOW_STRIDE = 145, WINDOW_OVERLAP = 5
export const VIDEO_ANALYSIS_WINDOW = { LEN: WINDOW_LEN, STRIDE: WINDOW_STRIDE, OVERLAP: WINDOW_OVERLAP, SINGLE_MAX: 180 } as const

/**
 * Precomputed credit cost per (model, bucket) — the OUTPUT of the private
 * `videoAnalysisBucketCredits` formula (in `@nodaroai/cloud-plugins`), not a
 * formula itself. Regenerate by running that function for every
 * `VIDEO_ANALYSIS_LLM_MODELS` × duration bucket combination whenever the
 * underlying rate/token constants change (the plugin's cost test guards drift).
 * Keep in sync with
 * `docs/nodes/processing-video/video-analysis.md`.
 */
// EVERY row here is RE-DERIVED from the cloud-plugins formula at the current
// credit base — never a mechanical x10 of an older table. The formula ceils USD
// into credits, so a 10x finer base rounds LESS: the 60s flash bucket is 23,
// where x10 of the old 3 would have been 30 (a ~30% over-charge).
//
// That applies to the SENTINEL rows (`mixed:*`, `smart:*`) exactly as much as to
// the per-model rows. They were briefly shipped as a x10 on the reasoning that
// they sit outside the plugin's cross-check loop — but being outside the loop
// makes a row UNGUARDED, not exempt: `videoAnalysisBucketCredits` computes them
// from the same roll plan, so they are formula-derived too (mixed:60s is 104,
// not 110). The plugin's cost test now covers sentinels as well, so this class
// of drift fails CI instead of shipping.
export const VIDEO_ANALYSIS_BUCKET_CREDITS: Record<string, number> = {
  // Legacy fast-tier model (pre-2026-07) — kept for stored raw-id configs.
  "video-analysis:gemini-3-flash:60s": 23,
  "video-analysis:gemini-3-flash:180s": 32,
  "video-analysis:gemini-3-flash:360s": 81,
  "video-analysis:gemini-3-flash:600s": 136,
  // Current fast tier — regenerated from the private formula for its backing
  // model; higher than the legacy fast schedule but still ≤ pro per bucket.
  "video-analysis:gemini-3.6-flash:60s": 61,
  "video-analysis:gemini-3.6-flash:180s": 88,
  "video-analysis:gemini-3.6-flash:360s": 224,
  "video-analysis:gemini-3.6-flash:600s": 374,
  "video-analysis:gemini-3.1-pro:60s": 82,
  "video-analysis:gemini-3.1-pro:180s": 111,
  "video-analysis:gemini-3.1-pro:360s": 291,
  "video-analysis:gemini-3.1-pro:600s": 486,
  // Mixed tiers (`mixed` + `mixed-fast`) share ONE credit family — they are
  // variants of the same engine plan (plan internals live in the private
  // analysis plugin). Admin-tunable via model_pricing like every other row.
  "video-analysis:mixed:60s": 104,
  "video-analysis:mixed:180s": 142,
  "video-analysis:mixed:360s": 372,
  "video-analysis:mixed:600s": 621,
  // SMART — the one native-transport plan: a single pass with reasoning and
  // frame sampling turned all the way up. Priced well above the economy tiers
  // because it genuinely costs more to run, and it is the only tier whose
  // accuracy was measured against a hand-counted edit list.
  "video-analysis:smart:60s": 454,
  "video-analysis:smart:180s": 975,
  "video-analysis:smart:360s": 2105,
  "video-analysis:smart:600s": 3496,
}

/**
 * The credit-id MODEL SEGMENT for an engine identifier: both mixed-tier
 * sentinels share the `mixed` price family (same engine plan); everything
 * else prices under its own identifier. Single source of truth — used by
 * `buildVideoAnalysisCreditId` below, so route/orchestrator/UI callers can
 * never diverge on where a sentinel prices.
 */
export function videoAnalysisCreditSegment(modelOrSentinel: string): string {
  return modelOrSentinel === "mixed-fast" ? "mixed" : modelOrSentinel
}

export function pickVideoAnalysisBucket(durationSec: number): number {
  for (const b of VIDEO_ANALYSIS_DURATION_BUCKETS) if (durationSec <= b) return b
  return VIDEO_ANALYSIS_MAX_DURATION_SEC
}

export function buildVideoAnalysisCreditId(model: string, durationSec?: number): string {
  const bucket = durationSec !== undefined && durationSec > 0
    ? pickVideoAnalysisBucket(Math.min(durationSec, VIDEO_ANALYSIS_MAX_DURATION_SEC))
    : VIDEO_ANALYSIS_MAX_DURATION_SEC // unknown → ceiling composite (the ONLY silent-ceiling path)
  return `video-analysis:${videoAnalysisCreditSegment(model)}:${bucket}s`
}

export function bucketSecondsFromCreditId(creditId: string): number | null {
  const m = /^video-analysis:.+:(\d+)s$/.exec(creditId)
  return m ? Number(m[1]) : null
}

export function videoAnalysisNumWindows(bucketSec: number): number {
  return bucketSec <= VIDEO_ANALYSIS_WINDOW.SINGLE_MAX ? 1 : 1 + Math.ceil((bucketSec - WINDOW_LEN) / WINDOW_STRIDE)
}
