import { MODEL_CATALOG, buildVideoCreditModelIdentifier, SEEDANCE_2_CONTINUATION_REF_SEC, isMinimaxH3Provider, normalizeMinimaxH3Resolution } from "@nodaro/shared"
import { STATIC_CREDIT_COSTS, PriceNotConfiguredError, getModelCreditBaseCost } from "./credits.js"

/**
 * Money-authoritative closed-form for the `generate-video-pro` node.
 *
 * The pro node stitches multiple KIE Seedance-2-family segments into one
 * long clip when the requested duration exceeds a single segment's max
 * (15s). Below that threshold it behaves exactly like a normal single-shot
 * t2v run (mode "single"); above it, it splits into N segments (mode
 * "multi") and reserves a fee-base PLUS the per-second cost of the segments
 * (the first segment billed at the no-video-ref rate, every subsequent
 * segment billed at the video-ref rate since it re-seeds off the previous
 * segment's tail frames).
 */
export interface GenerateVideoProPricing {
  mode: "single" | "multi"
  clampedDurationSec: number
  segmentCount: number
  totalRawSec: number
  segmentDurations: number[]
  feeBase: number // 0 when single
  noRefPerSec: number
  refPerSec: number
  tailSec: number
  reserveBase: number // pre-markup
  creditIdentifier?: string // single mode only
  /** CONTINUATION billing floor (2026-07-21): 1-based segment the CHILD job
   *  starts paying from — segments below it were delivered and billed by the
   *  parent. Set only by `computeGenerateVideoProContinuationPricing`; the
   *  plugin's `commitBase` twin bills feeBase + segments ≥ this index (all at
   *  the ref rate + one continuation tail each). Absent/1 → classic. */
  billFromSegment?: number
  /** KEYFRAMES render method (2026-08-03) — set ONLY when the run was priced
   *  under it. Scene-decomposed rendering: each segment is generated from its
   *  own start/end anchor frames instead of a continuation tail off the
   *  previous segment, so every segment bills at the NO-ref per-second rate
   *  and the `refPerSec × tailSec × (n−1)` continuation term is gone. Absent
   *  → the classic extend chain, byte-identical. */
  renderMethod?: "keyframes"
  /** KEYFRAMES anchor budget (pre-markup, included in `reserveBase`) —
   *  WORST CASE: 2 anchor images per segment at the anchor image model's base
   *  credit. The engine generates fewer whenever a scene reuses a neighbour's
   *  frame, and its metered commit settles the actual count, so this only ever
   *  refunds DOWN. Absent on extend runs and on keyframes CONTINUATIONS (which
   *  reuse the parent's already-paid-for anchors). */
  anchorReserve?: number
  /** SCENE-SET continue (2026-08-04, keyframes only): the EXACT sorted,
   *  deduped 1-based segments the child regenerates — an arbitrary set, not a
   *  suffix. Set ONLY by `computeGenerateVideoProContinuationPricing` when the
   *  caller passed `segments`; its presence is also the CAPABILITY ECHO the
   *  plugin feature-detects (an older app ignores the arg and returns
   *  suffix-shaped pricing with this field absent → the plugin 503s rather
   *  than dispatching a mispriced run). The plugin's `commitBase` twin bills
   *  feeBase + only the DONE members of this set, each at the no-ref rate.
   *  `billFromSegment` still carries `min(set)` beside it for every consumer
   *  that reasons about the adopted prefix. */
  billSegments?: number[]
}

/** Image model the keyframes engine generates scene anchors with. Priced
 *  through the DB-aware `getModelCreditBaseCost` so an admin reprice of the
 *  row moves the anchor reserve automatically (hard-fails, never silently
 *  under-reserves). */
const KEYFRAME_ANCHOR_MODEL = "nano-banana-pro"
/** Worst-case anchors per segment (start + end frame). */
const ANCHORS_PER_SEGMENT = 2

/**
 * Keyframes reserve for a set of segment durations: every segment at the
 * NO-ref per-second rate (each is generated from its own anchors — nothing
 * re-seeds off a previous segment's tail), with no continuation-tail term.
 * Per-segment `ceil` so a continuation of a keyframes run bills exactly the
 * parent's terms for the segments it re-renders.
 */
function keyframesSegmentsBase(durations: number[], noRefPerSec: number): number {
  return durations.reduce((sum, d) => sum + Math.ceil(d * noRefPerSec), 0)
}

// ---------------------------------------------------------------------------
// Segment-split closed-form. Module-local transcription of the Task 2
// function body (verbatim) — plugin/frontend code is not importable from
// ee/, so this copy is the single implementation this file depends on. Keep
// it IN SYNC with the twin if the split algorithm ever changes.
// ---------------------------------------------------------------------------

const SPLIT = { minSeg: 4, maxSeg: 15, lossSec: 0.3 } as const

interface SplitResult {
  mode: "single" | "multi"
  clampedD: number
  n: number
  s: number
  durations: number[]
}

function computeSplit(requestedSec: number, capSec: number): SplitResult {
  const d = Math.min(Math.max(Math.round(requestedSec), SPLIT.minSeg), capSec)
  if (d <= SPLIT.maxSeg) return { mode: "single" as const, clampedD: d, n: 1, s: d, durations: [d] }
  let n = 2
  while (n * SPLIT.maxSeg < d + SPLIT.lossSec * (n - 1)) n++
  const s = Math.ceil(d + SPLIT.lossSec * (n - 1))
  const base = Math.floor(s / n)
  const durations = new Array<number>(n).fill(base)
  durations[0] += s - base * n
  for (let i = 0; i < n - 1; i++) {
    if (durations[i] > SPLIT.maxSeg) {
      durations[i + 1] += durations[i] - SPLIT.maxSeg
      durations[i] = SPLIT.maxSeg
    }
  }
  return { mode: "multi" as const, clampedD: d, n, s, durations }
}

/**
 * PREFERRED-POINT SPLIT (user lever, 2026-07-21) — TWIN of the plugin's
 * `computePreferredSplit` (engine/split.ts); keep in lock-step. Even
 * segments near a RECOMMENDED length instead of pack-to-cap: n ≈
 * round(total/preferred), adjusted until the even base sits inside
 * [minSeg, maxSeg]; durations are base/base+1 with the remainder on the
 * EARLIEST segments. Can turn a ≤15s request into a MULTI split — that is
 * the point of the lever (more, shorter generations). The classic
 * `computeSplit` above stays byte-identical for lever-less runs.
 */
/** Hard cap on explicit segment counts — mirrors the plugin plan schema's
 *  24-segment ceiling (plan schema + `packScenesToSegments`' merge rule). */
const EXPLICIT_MAX_SEGMENTS = 24

/**
 * EXPLICIT-DURATIONS SPLIT (scene-aligned mode, 2026-08-03) — validates and
 * adopts a caller-supplied per-segment array VERBATIM (spec rule: the array is
 * passed on the wire and never re-derived — the plugin's `packScenesToSegments`
 * produces it, this side only validates and prices it, so quote/reserve/plan
 * drift is impossible by construction). Throws on any violation — never a
 * silent misprice. `clampedD` stays the DELIVERED duration (clamp(round(
 * durationSec))), NEVER the array sum: `node-executor` rewrites
 * `payload.duration` from `clampedDurationSec` and the plugin's drift/planOnly
 * branches consume it as delivered-d.
 */
function explicitSplit(requestedSec: number, segmentDurations: number[], capSec: number): SplitResult {
  const d = Math.min(Math.max(Math.round(requestedSec), SPLIT.minSeg), capSec)
  const n = segmentDurations.length
  if (
    n < 1 ||
    n > EXPLICIT_MAX_SEGMENTS ||
    segmentDurations.some((x) => !Number.isInteger(x) || x < SPLIT.minSeg || x > SPLIT.maxSeg)
  ) {
    throw new Error(
      `explicit segment durations: expected 1..${EXPLICIT_MAX_SEGMENTS} integers in [${SPLIT.minSeg},${SPLIT.maxSeg}]`,
    )
  }
  const s = segmentDurations.reduce((a, b) => a + b, 0)
  const expected = Math.ceil(d + SPLIT.lossSec * (n - 1))
  if (s !== expected) {
    throw new Error(
      `explicit segment durations: sum ${s} != ceil(${d} + ${SPLIT.lossSec}*(${n}-1)) = ${expected} — quote and reserve would drift`,
    )
  }
  if (n === 1) return { mode: "single" as const, clampedD: d, n: 1, s: d, durations: [d] }
  return { mode: "multi" as const, clampedD: d, n, s, durations: [...segmentDurations] }
}

function computePreferredSplit(requestedSec: number, preferredSec: number, capSec: number): SplitResult {
  const d = Math.min(Math.max(Math.round(requestedSec), SPLIT.minSeg), capSec)
  const pref = Math.min(Math.max(Math.round(preferredSec), SPLIT.minSeg), SPLIT.maxSeg)
  let n = Math.max(1, Math.round(d / pref))
  const sOf = (k: number): number => Math.ceil(d + SPLIT.lossSec * (k - 1))
  while (n > 1 && Math.floor(sOf(n) / n) < SPLIT.minSeg) n--
  while (Math.ceil(sOf(n) / n) > SPLIT.maxSeg) n++
  if (n === 1) return { mode: "single" as const, clampedD: d, n: 1, s: d, durations: [d] }
  const s = sOf(n)
  const base = Math.floor(s / n)
  const r = s - base * n
  const durations = new Array<number>(n).fill(base)
  for (let i = 0; i < r; i++) durations[i] += 1
  return { mode: "multi" as const, clampedD: d, n, s, durations }
}

/** User-selectable context-tail bounds (seconds). Floor = the default 2s
 *  (clears KIE's 1.8s r2v minimum); ceiling 5s keeps the reference short
 *  enough to stay a continuation cue rather than replay material, and keeps
 *  the per-join surcharge bounded. The engine cuts EXACTLY what this bills —
 *  transport and formula read the same clamped value. */
export const CONTEXT_TAIL_MIN_SEC = SEEDANCE_2_CONTINUATION_REF_SEC
// Raised 5→15 (Tal 2026-07-22, testing lever) — the plugin route Zod + handler
// transport clamp move together to the same [2,15]. Billing stays exact: the
// engine cuts what this bills. A long tail eats the KIE video-ref budget, so
// it's a testing knob, not a default (default stays 2s).
export const CONTEXT_TAIL_MAX_SEC = 15
export function clampContextTailSec(v: unknown): number {
  const n = typeof v === "number" && Number.isFinite(v) ? v : CONTEXT_TAIL_MIN_SEC
  return Math.min(CONTEXT_TAIL_MAX_SEC, Math.max(CONTEXT_TAIL_MIN_SEC, n))
}

/**
 * Clamp a requested resolution to the provider's catalog resolutions (single
 * source of truth) — an unsupported tier (e.g. a stale 1080p on
 * seedance-2-mini, which only exposes 480p/720p) snaps to the model's top
 * priced tier so every downstream composite lookup is always seeded.
 * Mirrors `seedance2-ref-video-credits.ts` / `packages/shared/src/credit-identifiers.ts`.
 */
function clampResolution(provider: string, resolution: string): string {
  // MiniMax Hailuo 3: its own two-value space ("2K" default / "768P") with its
  // own collapse rule — anything not exactly 768P (incl. a stale Seedance
  // "720p" carried across a provider switch) bills AND renders as 2K.
  if (isMinimaxH3Provider(provider)) return normalizeMinimaxH3Resolution(resolution)
  const supported = MODEL_CATALOG[provider]?.resolutions ?? ["480p", "720p", "1080p"]
  const want = resolution === "4k" ? "4k" : resolution === "1080p" ? "1080p" : resolution === "720p" ? "720p" : "480p"
  return supported.includes(want) ? want : (supported[supported.length - 1] ?? "480p")
}

/**
 * Per-second BASE rate for a (provider, resolution, ref) combination, derived
 * from the seeded 8s composite (the family's per-second rate is linear, so
 * the 8s tier is used as the canonical anchor regardless of the actual
 * segment duration — mirrors `seedance2RefVideoBaseCredits`).
 *
 * `minimax-h3` (2026-08-02; 768P lever 2026-08-03) has a DIFFERENT identifier
 * shape: a two-rate resolution axis (bare = 2K default, ":768p" = cheaper
 * tier) and no `-ref` composites — its r2v rate equals the base rate of the
 * selected tier, and KIE bills reference-VIDEO input as `unit × (input +
 * output)` seconds at that tier's rate (see minimax-h3-credits.ts). Both
 * rates therefore derive from the ONE 8s composite of the selected tier
 * (`minimax-h3:8s` or `minimax-h3:8s:768p`), and the multi-segment reserve
 * formula's `refPerSec × (n−1) × tailSec` term prices each continuation's
 * context-tail input seconds exactly. The per-image surcharge (inputs beyond
 * 5, 27.5 base each) deliberately rides the provider margin, NOT user
 * credits — the same treatment as tailUpscale/identityPlate (a pro segment
 * sends anchor + plate + a few cast refs, typically within the free tier).
 *
 * Hard-fail policy: throws `PriceNotConfiguredError` when the composite is
 * missing — never silently falls back to a wrong (under-)reservation.
 */
function perSecRate(provider: string, resolution: string, ref: boolean): number {
  const identifier = isMinimaxH3Provider(provider)
    ? (normalizeMinimaxH3Resolution(resolution) === "768P" ? `${provider}:8s:768p` : `${provider}:8s`)
    : `${provider}:8s:${resolution}${ref ? "-ref" : ""}`
  const composite = STATIC_CREDIT_COSTS[identifier]
  if (composite === undefined) {
    throw new PriceNotConfiguredError(identifier)
  }
  return composite / 8
}

export async function computeGenerateVideoProPricing(args: {
  provider: string
  resolution: string
  durationSec: number
  /** Continuation-tail length per join (seconds), clamped to
   *  [CONTEXT_TAIL_MIN_SEC, CONTEXT_TAIL_MAX_SEC]; omitted → default 2s. */
  tailSec?: number
  /** Recommended segment length (seconds), clamped to [4,15] — even segments
   *  near this point instead of pack-to-cap. Omitted → the classic split,
   *  byte-identical. Money-authoritative: the plugin plans against THIS
   *  split's segmentDurations. */
  preferredSegmentSec?: number
  /** EXPLICIT per-segment durations (scene-aligned split, 2026-08-03) —
   *  validated and priced VERBATIM (ints 4..15, ≤24 entries, sum ===
   *  ceil(clampedD + 0.3×(n−1)); throws otherwise). Takes precedence over
   *  `preferredSegmentSec`. Additive-optional (no contract bump). */
  segmentDurations?: number[]
  /** Render method (2026-08-03): "keyframes" prices the scene-decomposed
   *  shape (every segment at the no-ref rate, no continuation tail, plus the
   *  worst-case anchor budget). Omitted / "extend" → the classic chain,
   *  byte-identical. Additive-optional (no contract bump). */
  renderMethod?: "extend" | "keyframes"
}): Promise<GenerateVideoProPricing> {
  const { provider, durationSec } = args
  const tailSec = clampContextTailSec(args.tailSec)
  const resolution = clampResolution(provider, args.resolution)

  const cap = Number(process.env.GENERATE_VIDEO_PRO_MAX_DURATION || 120)
  const useExplicit = Array.isArray(args.segmentDurations) && args.segmentDurations.length > 0
  const usePreferred =
    !useExplicit && typeof args.preferredSegmentSec === "number" && Number.isFinite(args.preferredSegmentSec)
  const split = useExplicit
    ? explicitSplit(durationSec, args.segmentDurations as number[], cap)
    : usePreferred
      ? computePreferredSplit(durationSec, args.preferredSegmentSec as number, cap)
      : computeSplit(durationSec, cap)

  // Per-second transparency fields — always derived from STATIC_CREDIT_COSTS
  // directly (never the DB-aware getter: there is no per-duration DB row for
  // a synthetic multi-segment run, only the discrete 8s composite). Computed
  // for BOTH modes: multi mode needs them for the reserve formula; single
  // mode surfaces them for display/transparency (e.g. "priced at N cr/sec").
  const noRefPerSec = perSecRate(provider, resolution, false)
  const refPerSec = perSecRate(provider, resolution, true)

  // KEYFRAMES (2026-08-03) — one formula for BOTH modes: nothing re-seeds off
  // a previous segment, so every segment (single or not) bills at the no-ref
  // rate, the continuation-tail term disappears, and the run reserves the
  // worst-case anchor budget on top. Single mode deliberately does NOT set
  // `creditIdentifier`: the flat per-duration composite is the extend-chain
  // price and would under-reserve the anchors, so keyframes always takes the
  // dynamic reserve path. `feeBase` is the same plan-fee row multi uses — the
  // keyframes engine plans scenes for a single segment too.
  if (args.renderMethod === "keyframes") {
    const feeBase = STATIC_CREDIT_COSTS["generate-video-pro"]
    if (feeBase === undefined) {
      throw new PriceNotConfiguredError("generate-video-pro")
    }
    const { creditCost: anchorCost } = await getModelCreditBaseCost(KEYFRAME_ANCHOR_MODEL)
    const anchorReserve = split.n * ANCHORS_PER_SEGMENT * anchorCost
    return {
      mode: split.mode,
      clampedDurationSec: split.clampedD,
      segmentCount: split.n,
      totalRawSec: split.s,
      segmentDurations: split.durations,
      feeBase,
      noRefPerSec,
      refPerSec,
      tailSec,
      reserveBase: feeBase + keyframesSegmentsBase(split.durations, noRefPerSec) + anchorReserve,
      renderMethod: "keyframes",
      anchorReserve,
    }
  }

  if (split.mode === "single") {
    // Single-segment run behaves exactly like a normal t2v run — same
    // identifier + BASE cost path every other video node uses, so it stays
    // DB-override-aware (an admin can reprice the underlying composite and
    // the pro node's single-segment cost follows automatically).
    const creditIdentifier = buildVideoCreditModelIdentifier(
      provider,
      split.clampedD,
      false,
      "text-to-video",
      undefined,
      resolution,
      false,
    )
    const { creditCost } = await getModelCreditBaseCost(creditIdentifier)
    return {
      mode: "single",
      clampedDurationSec: split.clampedD,
      segmentCount: split.n,
      totalRawSec: split.s,
      segmentDurations: split.durations,
      feeBase: 0,
      noRefPerSec,
      refPerSec,
      tailSec,
      reserveBase: creditCost,
      creditIdentifier,
    }
  }

  const feeBase = STATIC_CREDIT_COSTS["generate-video-pro"]
  if (feeBase === undefined) {
    throw new PriceNotConfiguredError("generate-video-pro")
  }

  // First segment billed at the no-ref rate; every subsequent segment + its
  // tail overlap billed at the video-ref rate (re-seeds off the previous
  // segment's tail frames). The DEFAULT path bills the first segment at the
  // maxSeg constant (worst-case padding — pinned by the golden tests); the
  // PREFERRED and EXPLICIT paths bill durations[0] instead: segments can be
  // far shorter than the cap there, the constant would over-pad AND go
  // negative in the ref term (e.g. 10s @ preferred 4 → s−15 < 0), and the
  // engine's commitBase settles on durations[0] — reserve and commit stay
  // aligned.
  const firstSegBillSec = usePreferred || useExplicit ? split.durations[0]! : SPLIT.maxSeg
  const reserveBase =
    feeBase +
    Math.ceil(noRefPerSec * firstSegBillSec) +
    Math.ceil(refPerSec * ((split.n - 1) * tailSec + (split.s - firstSegBillSec)))

  return {
    mode: "multi",
    clampedDurationSec: split.clampedD,
    segmentCount: split.n,
    totalRawSec: split.s,
    segmentDurations: split.durations,
    feeBase,
    noRefPerSec,
    refPerSec,
    tailSec,
    reserveBase,
  }
}

/**
 * CONTINUE reserve (2026-07-21, gvp stop/continue) — money-authoritative for
 * a child job that resumes a parent run from `fromSegment` (1-based). The
 * parent plan's durations are KNOWN (embedded in its checkpoint's pricing at
 * the original reservation), so the reserve is exact — no worst-case padding:
 *
 *   fromSegment k > 1:  feeBase + ceil(refPerSec × ((N−k+1)·tailSec + Σ d[k..N]))
 *   fromSegment k = 1:  the fresh-run formula over the same fixed durations
 *                       (segment 1 no-ref; every later one ref + tail)
 *
 * Every NEW segment — including the first — bills at the ref rate + one
 * continuation tail: it re-seeds off the previous footage (the parent prefix
 * for segment k). The returned pricing carries `billFromSegment` so the
 * plugin's `commitBase` twin settles only the new segments; reserve == commit
 * when the run completes fully (refund 0), and every partial path refunds
 * the untouched remainder through the same metered commit.
 *
 * TWIN of the plugin engine's continuation-aware `commitBase`
 * (engine/finalize.ts) — keep in lock-step.
 */
export async function computeGenerateVideoProContinuationPricing(args: {
  provider: string
  resolution: string
  /** The PARENT plan's per-segment durations (from its checkpoint's embedded
   *  pricing — money-authoritative; never recomputed from a split). */
  segmentDurations: number[]
  /** 1-based first segment the child regenerates (and pays for). OPTIONAL
   *  since the scene-SET lever landed — when `segments` is passed it derives
   *  as `min(segments)`; exactly one of the two must be present. */
  fromSegment?: number
  tailSec?: number
  /** Render method (2026-08-03) — "keyframes" bills the re-rendered segments
   *  at the no-ref rate with no continuation tails and NO anchor reserve (the
   *  parent already generated, and paid for, the anchors this continuation
   *  re-uses). Omitted / "extend" → the classic continuation, byte-identical.
   *  Additive-optional (no contract bump). */
  renderMethod?: "extend" | "keyframes"
  /** SCENE-SET continue (2026-08-04): the exact 1-based segments the child
   *  regenerates — KEYFRAMES ONLY (the extend transport chains segments, so a
   *  mid-run member cannot re-render without cascading; passing a set there
   *  throws rather than silently suffix-pricing). Deduped + sorted here; the
   *  echo rides back as `billSegments` (the capability signal). */
  segments?: number[]
}): Promise<GenerateVideoProPricing> {
  const { provider } = args
  const tailSec = clampContextTailSec(args.tailSec)
  const resolution = clampResolution(provider, args.resolution)
  // Wire-path sanitation: the durations arrive from a checkpoint blob — round
  // and bound them to the split's own invariants before money math.
  const durations = args.segmentDurations.map((d) => Math.round(d))
  const n = durations.length
  if (n < 1 || durations.some((d) => !Number.isFinite(d) || d < 1 || d > SPLIT.maxSeg)) {
    throw new Error("continuation pricing: invalid parent segment durations")
  }
  // SCENE-SET validation — before k derives from it. Same wire-path
  // discipline as the durations: round, bound, dedup, sort.
  let billSegments: number[] | undefined
  if (args.segments !== undefined) {
    if (args.renderMethod !== "keyframes") {
      throw new Error('continuation pricing: a segment SET requires renderMethod "keyframes"')
    }
    const set = [...new Set(args.segments.map((s) => Math.round(s)))].sort((a, b) => a - b)
    if (set.length < 1 || set.some((s) => !Number.isFinite(s) || s < 1 || s > n)) {
      throw new Error(`continuation pricing: segments outside 1..${n}`)
    }
    billSegments = set
  }
  if (args.fromSegment === undefined && billSegments === undefined) {
    throw new Error("continuation pricing: one of fromSegment or segments is required")
  }
  const k = args.fromSegment !== undefined ? Math.round(args.fromSegment) : billSegments![0]!
  if (!Number.isFinite(k) || k < 1 || k > n) {
    throw new Error(`continuation pricing: fromSegment ${args.fromSegment} outside 1..${n}`)
  }
  const noRefPerSec = perSecRate(provider, resolution, false)
  const refPerSec = perSecRate(provider, resolution, true)
  const feeBase = STATIC_CREDIT_COSTS["generate-video-pro"]
  if (feeBase === undefined) {
    throw new PriceNotConfiguredError("generate-video-pro")
  }
  const total = durations.reduce((a, b) => a + b, 0)
  // KEYFRAMES continuation: the child re-renders scenes k..N from their OWN
  // anchors — no segment re-seeds off previous footage, so every one bills at
  // the no-ref rate with no continuation tail, and there is no anchor reserve
  // (the parent's anchors are re-used). Per-segment `ceil` matches the fresh
  // keyframes run's terms exactly, so re-rendering a scene costs the same
  // whether it lands in the parent run or a continuation.
  const keyframes = args.renderMethod === "keyframes"
  // SCENE-SET reserve: fee + exactly the set's members at the fresh keyframes
  // per-segment terms — re-rendering a scene costs the same whether it lands
  // in the parent run, a suffix continuation, or a set continuation.
  const reserveBase = billSegments !== undefined
    ? feeBase + keyframesSegmentsBase(billSegments.map((s) => durations[s - 1]!), noRefPerSec)
    : keyframes
      ? feeBase + keyframesSegmentsBase(durations.slice(k - 1), noRefPerSec)
      : k > 1
        ? feeBase + Math.ceil(refPerSec * ((n - k + 1) * tailSec + durations.slice(k - 1).reduce((a, b) => a + b, 0)))
        : feeBase +
          Math.ceil(noRefPerSec * durations[0]!) +
          (n > 1 ? Math.ceil(refPerSec * ((n - 1) * tailSec + (total - durations[0]!))) : 0)
  return {
    mode: "multi",
    clampedDurationSec: total,
    segmentCount: n,
    totalRawSec: total,
    segmentDurations: durations,
    feeBase,
    noRefPerSec,
    refPerSec,
    tailSec,
    reserveBase,
    billFromSegment: k,
    ...(keyframes ? { renderMethod: "keyframes" as const } : {}),
    ...(billSegments !== undefined ? { billSegments } : {}),
  }
}
