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
// REGENERATED 2026-07-31 with the smart-tier re-base (formula inputs moved in
// the plugin: sampling 24→6 fps after a 43-run measurement found 6 equal on
// content and strictly better on cast stability; the system-prompt and
// per-window output-token constants trued-up to directly measured values).
// Net effect: smart drops 27–47% per bucket — the 24 fps token spend was also
// partly paying for media tokens the provider clamped and never counted — and
// the economy rows tick up 3–6% from the prompt-token true-up.
//
// REGENERATED 2026-08-03 — V1 hybrid-smart reprice (task A3), from the
// plugin's own generator (`scripts/gen-va-buckets.mjs`) at
// nodaroai/nodaro-cloud-plugins commit eef077d (branch fix/va-cost-trueup).
// This is the V1 true-up of task P6's provisional judge/refine/frame-judge
// constants, re-derived from a 2026-08-03 staging measurement and approved by
// Tal (the constants themselves, like the rest of the $-derived formula, stay
// private in the plugin repo — never in this public package). `smart` is now
// a HYBRID plan — one native 6fps skeleton pass plus 2 fast + 2 pro donor
// rolls, always refined (`selectionMode` does not apply to `smart`; it always
// refines) — and every multi-roll tier now carries its own explicit
// judge/refine terms instead of an implicit share of a single-pass budget.
// This is the full, honest reprice Tal approved, including the economy tiers
// (fast 33->185 @180s ends a below-cost combine exposure that existed at the
// old price). Net effect, per bucket (every row rises):
//
//   gemini-3-flash    60s   24->180   180s   33->185   360s   86-> 514   600s  143-> 846
//   gemini-3.6-flash  60s   65->203   180s   92->218   360s  237-> 598   600s  395-> 986
//   gemini-3.1-pro    60s   87->215   180s  116->231   360s  305-> 636   600s  509->1050
//   mixed             60s  110->228   180s  149->249   360s  390-> 684   600s  651->1129
//   smart             60s  333->410   180s  470->500   360s 1135->1259   600s 1868->2064
//
// Values are pasted verbatim from the plugin generator's output — never hand
// computed. The plugin's cost test cross-checks every row, sentinels included.
export const VIDEO_ANALYSIS_BUCKET_CREDITS: Record<string, number> = {
  // Legacy fast-tier model (pre-2026-07) — kept for stored raw-id configs.
  "video-analysis:gemini-3-flash:60s": 180,
  "video-analysis:gemini-3-flash:180s": 185,
  "video-analysis:gemini-3-flash:360s": 514,
  "video-analysis:gemini-3-flash:600s": 846,
  // Current fast tier — regenerated from the private formula for its backing
  // model; higher than the legacy fast schedule but still ≤ pro per bucket.
  "video-analysis:gemini-3.6-flash:60s": 203,
  "video-analysis:gemini-3.6-flash:180s": 218,
  "video-analysis:gemini-3.6-flash:360s": 598,
  "video-analysis:gemini-3.6-flash:600s": 986,
  "video-analysis:gemini-3.1-pro:60s": 215,
  "video-analysis:gemini-3.1-pro:180s": 231,
  "video-analysis:gemini-3.1-pro:360s": 636,
  "video-analysis:gemini-3.1-pro:600s": 1050,
  // Mixed tiers (`mixed` + `mixed-fast`) share ONE credit family — they are
  // variants of the same engine plan (plan internals live in the private
  // analysis plugin). Admin-tunable via model_pricing like every other row.
  "video-analysis:mixed:60s": 228,
  "video-analysis:mixed:180s": 249,
  "video-analysis:mixed:360s": 684,
  "video-analysis:mixed:600s": 1129,
  // SMART — the accuracy tier, and since the 2026-08-03 hybrid re-plan a
  // multi-roll plan like the others: one native 6fps skeleton pass plus 2
  // fast + 2 pro donor rolls, always refined (`selectionMode` does not apply
  // here — smart always refines; it never offers a cheaper "choose" path).
  // Priced above the economy tiers because it genuinely costs more to run;
  // the only tier whose accuracy is validated against a hand-counted edit
  // list, re-validated at the current plan before this schedule shipped.
  "video-analysis:smart:60s": 410,
  "video-analysis:smart:180s": 500,
  "video-analysis:smart:360s": 1259,
  "video-analysis:smart:600s": 2064,
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
