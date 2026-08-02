/**
 * Smart collage layout — pure geometry, no I/O.
 *
 * Given N source images (their DISPLAYED dimensions — see `probeImageSize`),
 * a fixed output canvas, and a gap, computes one pixel rectangle per image such
 * that the images tile the WHOLE canvas with no wasted space.
 *
 * The compositor (ffmpeg) fits each image INSIDE its rectangle and centres it
 * — `force_original_aspect_ratio=decrease`, not a cover-crop, whatever this doc
 * used to say. So a rectangle whose aspect differs from its image's is not
 * cropped to fit, it is PADDED with the canvas colour: in smart mode the cells
 * carry each image's own aspect precisely so that padding is zero, which makes
 * the caller's dimensions load-bearing rather than approximate.
 *
 * Two modes:
 *   • "smart"  — justified rows (Google-Photos / Flickr style). Images are
 *                partitioned into rows balanced by aspect ratio; each row is
 *                width-justified to fill the canvas WIDTH. Row heights are the
 *                NATURAL justified heights (availableWidth / Σaspect), so every
 *                cell's width∶height equals its image's aspect ratio exactly —
 *                zero crop, zero letterbox. The overall canvas HEIGHT then
 *                floats to whatever the rows sum to (the target aspect only
 *                steers the row count). Preserves input order. Optional
 *                per-image SIZE HINTS (0 auto / 1 big / 2 medium / 3 small)
 *                bias the row partition so hinted-big images land in taller
 *                (less crowded) rows and hinted-small images pack denser rows
 *                — cells still keep their exact aspect ratios (no crop), and
 *                hint-free input renders identically to all-equal hints.
 *   • "grid"   — uniform ceil(√n)-column grid on the FIXED target canvas; every
 *                cell is identical. The last (partial) row is centred. Cells are
 *                letterboxed by the compositor, so no image is cropped here
 *                either.
 *
 * Because smart mode floats the height, `computeCollageLayout` returns the
 * effective canvas dimensions alongside the rects — the ffmpeg compositor sizes
 * its canvas to those, not to the requested target.
 *
 * This module is intentionally free of any ffmpeg / sharp / network code so it
 * can be unit-tested exhaustively (see __tests__/collage-layout.test.ts). The
 * ffmpeg compositor consumes the returned rects + canvas verbatim.
 */

export interface ImageDim {
  readonly w: number
  readonly h: number
}

export interface Rect {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

export type CollageLayoutMode = "smart" | "grid"

/** Per-image size hint: 0 = auto ("don't care"), 1 = big, 2 = medium, 3 = small. */
export type CollageImageSize = 0 | 1 | 2 | 3

export interface CollageLayoutOpts {
  readonly mode?: CollageLayoutMode
  /** Gap in pixels on the OUTPUT canvas, applied between cells and as the
   *  outer margin. Defaults to 0. */
  readonly gap?: number
  /** Optional per-image size hints, index-aligned with `images` (missing /
   *  out-of-range entries are auto). RELATIVE hints — all-equal hints (or
   *  none) leave the layout byte-identical to the unhinted one. Smart mode
   *  only; grid cells are uniform by design. */
  readonly sizes?: readonly number[]
}

export interface CollageLayoutResult {
  /** One integer-pixel rect per input image, in the SAME order as `images`. */
  readonly rects: Rect[]
  /** Effective output canvas. Equals the target in grid mode; in smart mode the
   *  width matches the target but the height FLOATS to fit the justified rows. */
  readonly canvasW: number
  readonly canvasH: number
}

/** Upper bound on the floated smart-mode canvas: the long edge may not exceed
 *  twice the target's long edge. A collage of extreme-portrait images is
 *  uniformly scaled down to fit (preserving every aspect → no crop) rather than
 *  producing a runaway 10k-px image. */
const SMART_MAX_LONG_EDGE_FACTOR = 2

/** Aspect ratios outside this band would blow up a justified row; clamp them
 *  so a single panoramic/columnar image can't collapse a whole row. */
const MIN_ASPECT = 0.2
const MAX_ASPECT = 5

function safeAspect(d: ImageDim): number {
  const w = d.w > 0 ? d.w : 1
  const h = d.h > 0 ? d.h : 1
  const a = w / h
  if (!Number.isFinite(a) || a <= 0) return 1
  return Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, a))
}

/** LINEAR scale factor per size hint: big targets ~2× the edge length of a
 *  medium image (≈4× area), small ~½ (≈¼ area). Auto behaves like medium. */
const SIZE_LINEAR_FACTOR: Readonly<Record<number, number>> = {
  0: 1, // auto / "don't care"
  1: 2, // big
  2: 1, // medium (baseline)
  3: 0.5, // small
}

/** Resolve one size hint to its linear factor. Anything that isn't a known
 *  hint (undefined, NaN, out of range) is treated as auto — a hostile/short
 *  `sizes` array can never break the layout. */
function sizeFactor(size: number | undefined): number {
  return (size !== undefined ? SIZE_LINEAR_FACTOR[size] : undefined) ?? 1
}

/**
 * Choose a row count for `n` images on a canvas of the given aspect. A square
 * canvas of square images wants ≈√n rows; a wide canvas wants fewer rows (each
 * holds more), a tall canvas wants more. `rows ≈ √(n / canvasAspect)`.
 */
function chooseRows(n: number, canvasAspect: number): number {
  const raw = Math.round(Math.sqrt(n / Math.max(0.05, canvasAspect)))
  return Math.max(1, Math.min(n, raw))
}

/** Round a canvas dimension DOWN to an even integer (keeps yuv420p / thumbnailer
 *  encoders happy downstream). */
function even(v: number): number {
  const r = Math.round(v)
  return r - (r % 2)
}

/**
 * Emit the pixel rects for a given row partition — natural justified row
 * heights, rect placement, the long-edge safety cap, and even rounding.
 * Shared by the unweighted and size-hinted smart paths so the geometry
 * invariants (no-crop cells, full-width rows, bounded canvas) stay
 * single-sourced.
 */
function emitJustifiedRows(
  rows: readonly number[][],
  aspects: readonly number[],
  targetW: number,
  targetH: number,
  gap: number,
): CollageLayoutResult {
  const n = aspects.length
  const R = rows.length

  // NATURAL justified row heights: for a row width-justified to fill the canvas
  // width, height = availableWidth / Σ(aspect). At this exact height every cell
  // in the row has width∶height == its image's aspect ratio, so nothing is
  // cropped. We do NOT rescale these to a fixed canvas height — the height
  // floats to their sum instead.
  const rowHeights = rows.map((row) => {
    const availW = targetW - gap * (row.length + 1)
    const aspectSum = row.reduce((s, idx) => s + aspects[idx]!, 0)
    return availW / Math.max(0.0001, aspectSum)
  })

  const rects: Rect[] = new Array(n)
  let y = gap
  for (let r = 0; r < R; r++) {
    const row = rows[r]!
    const rowH = rowHeights[r]!
    const availW = targetW - gap * (row.length + 1)
    const aspectSum = row.reduce((s, idx) => s + aspects[idx]!, 0)

    let x = gap
    for (let c = 0; c < row.length; c++) {
      const idx = row[c]!
      const rawW = (availW * aspects[idx]!) / aspectSum
      // Last cell in the row absorbs horizontal rounding so the row edge lands
      // exactly on the canvas width (sub-pixel aspect change only).
      const cellW = c === row.length - 1 ? targetW - gap - x : rawW
      rects[idx] = {
        x: Math.round(x),
        y: Math.round(y),
        w: Math.max(1, Math.round(cellW)),
        h: Math.max(1, Math.round(rowH)),
      }
      x += cellW + gap
    }
    y += rowH + gap
  }

  let canvasW = targetW
  let canvasH = y // gap + Σ(rowH + gap) — the floated height.

  // Safety cap: extreme-portrait inputs can float the height very high. Uniformly
  // scale the whole layout down so the long edge stays bounded. A uniform scale
  // preserves every cell's aspect ratio, so it still never crops.
  const maxLong = Math.max(targetW, targetH) * SMART_MAX_LONG_EDGE_FACTOR
  const long = Math.max(canvasW, canvasH)
  if (long > maxLong) {
    const f = maxLong / long
    for (let i = 0; i < n; i++) {
      const rr = rects[i]!
      rects[i] = {
        x: Math.round(rr.x * f),
        y: Math.round(rr.y * f),
        w: Math.max(1, Math.round(rr.w * f)),
        h: Math.max(1, Math.round(rr.h * f)),
      }
    }
    canvasW *= f
    canvasH *= f
  }

  return { rects, canvasW: even(canvasW), canvasH: even(canvasH) }
}

function computeSmart(
  images: readonly ImageDim[],
  targetW: number,
  targetH: number,
  gap: number,
  sizes?: readonly number[],
): CollageLayoutResult {
  const n = images.length
  const aspects = images.map(safeAspect)
  // The target aspect only steers the PREFERRED row count — it does not squash
  // the result. A wide target ⇒ fewer, taller rows; a tall target ⇒ more rows.
  const rowCount = chooseRows(n, targetW / targetH)

  // Size hints are RELATIVE: only when at least two images resolve to
  // DIFFERENT factors is there anything to express. All-auto / all-equal
  // hints render identically to no hints at all.
  const factors = images.map((_, i) => sizeFactor(sizes?.[i]))
  const hinted = factors.some((f) => f !== factors[0])

  const unhinted =
    selectPartition(aspects, aspects.map(() => 1), rowCount, targetW, targetH, gap) ??
    partitionByBudget(aspects, rowCount)
  if (!hinted) return emitJustifiedRows(unhinted, aspects, targetW, targetH, gap)

  // The hinted selection is anchored to the unhinted layout twice over: its
  // per-image heights are the reference the direction filter checks against,
  // and it is the fallback when no candidate honours every hint.
  const baseHeights = effectiveImageHeights(unhinted, aspects, targetW, targetH, gap)
  const rows =
    selectPartition(aspects, factors, rowCount, targetW, targetH, gap, baseHeights) ?? unhinted
  return emitJustifiedRows(rows, aspects, targetW, targetH, gap)
}

/**
 * Partition indices [0..n) into exactly `rowCount` non-empty contiguous rows,
 * balancing the BUDGET sum per row (budget = aspect × linear size factor; the
 * unhinted path passes the aspects verbatim, i.e. all factors 1).
 * Uses an adaptive target (remaining budget / remaining rows) and a
 * balance-point close: a row closes when its sum sits at least as close to
 * the target as it would after absorbing the next image. A "leave one image
 * per remaining row" guard keeps any row from being starved.
 *
 * GREEDY — used only as the candidate generator above `EXHAUSTIVE_MAX_IMAGES`
 * and as the last-resort fallback: its balance-point close sits on a
 * knife-edge for near-equal aspects (the tie flips on sub-percent jitter),
 * which is exactly what `selectPartition`'s scored search exists to avoid.
 */
function partitionByBudget(budgets: readonly number[], rowCount: number): number[][] {
  const n = budgets.length
  if (rowCount >= n) return budgets.map((_, i) => [i])
  if (rowCount <= 1) return [budgets.map((_, i) => i)]

  const total = budgets.reduce((s, b) => s + b, 0)
  const rows: number[][] = []
  let cur: number[] = []
  let curSum = 0
  let assigned = 0
  let target = total / rowCount

  for (let i = 0; i < n; i++) {
    cur.push(i)
    curSum += budgets[i]!

    // The last row always absorbs the tail.
    if (rows.length >= rowCount - 1) continue

    const unopenedRows = rowCount - rows.length - 1
    const imagesRemaining = n - (i + 1)
    const mustClose = imagesRemaining === unopenedRows
    const nextBudget = budgets[i + 1] ?? 0
    const closerNow = Math.abs(curSum - target) <= Math.abs(curSum + nextBudget - target)
    if (mustClose || (imagesRemaining > unopenedRows && closerNow)) {
      rows.push(cur)
      assigned += curSum
      cur = []
      curSum = 0
      target = (total - assigned) / (rowCount - rows.length)
    }
  }
  if (cur.length > 0) rows.push(cur)
  return rows
}

/** Exhaustive-search bound: 2^(n-1) contiguous partitions is trivial through
 *  n=12 (2048 candidates, each scored in O(n)) and explodes past it; larger
 *  inputs (the route caps at 30 images) fall back to the greedy candidate
 *  search. Recast's cast tray sits far below this bound. */
const EXHAUSTIVE_MAX_IMAGES = 12

/** Adoption bar: a candidate displaces the incumbent only on a MEANINGFUL
 *  improvement — at least this absolute drop in score (log-variance units;
 *  0.01 ≈ one row height drifting ~10% relative) AND at least 5% of the
 *  incumbent's score. The ABSOLUTE floor is what makes selection
 *  jitter-stable: same-aspect sets produce families of near-tied partitions
 *  whose scores differ only by gap-accounting noise, and a purely relative
 *  bar collapses to nothing when the incumbent's score is itself near zero —
 *  a ±0.5% dimension jitter then flips WHICH image gets a 4× hero cell.
 *  Under the floor, near-ties always keep the earliest-ranked candidate. */
const MIN_IMPROVEMENT_ABS = 0.01
const MIN_IMPROVEMENT_REL = 0.05

/** A hinted candidate must not move a hinted image AGAINST its request.
 *  Relative-fidelity scoring alone cannot see this: restacking everything
 *  into full-width rows can perfect the RATIOS while growing an image the
 *  user asked to shrink (a two-image mixed pair with S on the landscape used
 *  to grow it 2.3×). Effective heights are compared against the unhinted
 *  layout's with this much slack for rounding and cap rescales. */
const HINT_DIRECTION_TOLERANCE = 0.02

/** Candidates whose floated height overshoots the long-edge cap by more than
 *  this factor are dropped: the cap's uniform rescale would crush the canvas
 *  width below half the target (a 952px-wide "2K" sheet), which serves the
 *  hint worse than not realizing it. */
const MAX_FLOAT_OVERSHOOT = 2

/** Mild shape prior folded into the score: squared log-drift of the floated
 *  canvas aspect from the requested one. Small enough that any genuine
 *  fidelity gain overrides it; big enough that among near-tied partitions the
 *  one shaped like the request wins (a 2560×536 strip stops beating the
 *  balanced grid it ties with on fidelity alone — and six mixed photos stop
 *  collapsing into one 448px-tall strip of thumbnail cells). */
const CANVAS_ASPECT_WEIGHT = 0.05

/** Every way to split [0..n) into non-empty CONTIGUOUS rows — reading order is
 *  part of the layout contract — encoded as break-after-i bitmasks. */
function* contiguousPartitions(n: number): Generator<number[][]> {
  for (let mask = 0; mask < 1 << (n - 1); mask++) {
    const rows: number[][] = [[0]]
    for (let i = 1; i < n; i++) {
      if (mask & (1 << (i - 1))) rows.push([i])
      else rows[rows.length - 1]!.push(i)
    }
    yield rows
  }
}

/** Natural justified height of each ROW (availableWidth / Σaspect) — the same
 *  quantity `emitJustifiedRows` renders, precomputed for scoring. */
function rowHeightsFor(
  rows: readonly number[][],
  aspects: readonly number[],
  targetW: number,
  gap: number,
): number[] {
  return rows.map((row) => {
    const availW = targetW - gap * (row.length + 1)
    const aspectSum = row.reduce((s, idx) => s + aspects[idx]!, 0)
    return Math.max(1e-6, availW / Math.max(0.0001, aspectSum))
  })
}

/** gap + Σ(rowH + gap) — the canvas height `emitJustifiedRows` would float to. */
function floatedHeightOf(rowHeights: readonly number[], gap: number): number {
  return rowHeights.reduce((s, h) => s + h + gap, gap)
}

/** Per-image rendered heights AFTER the long-edge cap's uniform rescale — the
 *  quantity the direction filter compares. Index-aligned with the images. */
function effectiveImageHeights(
  rows: readonly number[][],
  aspects: readonly number[],
  targetW: number,
  targetH: number,
  gap: number,
): number[] {
  const rowHeights = rowHeightsFor(rows, aspects, targetW, gap)
  const floatH = floatedHeightOf(rowHeights, gap)
  const maxLong = Math.max(targetW, targetH) * SMART_MAX_LONG_EDGE_FACTOR
  const scale = floatH > maxLong ? maxLong / floatH : 1
  const out: number[] = new Array(aspects.length)
  rows.forEach((row, r) => {
    for (const idx of row) out[idx] = rowHeights[r]! * scale
  })
  return out
}

/**
 * Choose the row partition — ONE selector for both the unhinted and hinted
 * paths, because they failed in the same way for different callers: a greedy
 * partition sat on a knife-edge (±0.5% dimension jitter flipped WHICH of
 * three same-aspect images ballooned to a 4× hero cell), and a hinted search
 * over too few candidates either missed the layout that honoured the hints or
 * adopted one that moved a hinted image the wrong way.
 *
 * Candidates: every contiguous partition (bounded by `EXHAUSTIVE_MAX_IMAGES`;
 * the greedy triple beyond), ranked so row counts nearest the unhinted
 * preference come first — the stable sort keeps enumeration order within a
 * band, which is what makes "the FIRST image gets the hero row" deterministic
 * on same-aspect sets.
 *
 * Filters: the floated height must not overshoot the cap beyond rescue
 * (`MAX_FLOAT_OVERSHOOT`); and when `baseHeights` is given (the hinted call),
 * no hinted image may move against its request relative to those heights,
 * compared post-rescale. Score: variance across images of
 * `ln(rowHeight) − ln(factor)` — zero when every image renders at exactly its
 * requested multiple of every other; all-1 factors reduce it to "prefer rows
 * of similar height" — plus the canvas-shape prior. Adoption only past
 * `MIN_IMPROVEMENT_*`.
 *
 * Returns undefined when nothing survives the filters; callers fall back
 * (greedy partition for the unhinted call, the unhinted layout — an honest
 * no-op — for the hinted one).
 */
function selectPartition(
  aspects: readonly number[],
  factors: readonly number[],
  baseRowCount: number,
  targetW: number,
  targetH: number,
  gap: number,
  baseHeights?: readonly number[],
): number[][] | undefined {
  const n = aspects.length
  const maxLong = Math.max(targetW, targetH) * SMART_MAX_LONG_EDGE_FACTOR

  const candidates: number[][][] =
    n <= EXHAUSTIVE_MAX_IMAGES
      ? [...contiguousPartitions(n)].sort(
          (a, b) => Math.abs(a.length - baseRowCount) - Math.abs(b.length - baseRowCount),
        )
      : [...new Set([baseRowCount, baseRowCount - 1, baseRowCount + 1])]
          .filter((r) => r >= 1 && r <= n)
          .map((r) =>
            partitionByBudget(
              aspects.map((a, i) => a * factors[i]!),
              r,
            ),
          )

  let bestRows: number[][] | undefined
  let bestScore = Infinity
  for (const rows of candidates) {
    const rowHeights = rowHeightsFor(rows, aspects, targetW, gap)
    const floatH = floatedHeightOf(rowHeights, gap)
    if (floatH > maxLong * MAX_FLOAT_OVERSHOOT) continue

    if (baseHeights) {
      const scale = floatH > maxLong ? maxLong / floatH : 1
      let honoursHints = true
      outer: for (let r = 0; r < rows.length; r++) {
        for (const idx of rows[r]!) {
          const eff = rowHeights[r]! * scale
          const f = factors[idx]!
          if (
            (f > 1 && eff < baseHeights[idx]! * (1 - HINT_DIRECTION_TOLERANCE)) ||
            (f < 1 && eff > baseHeights[idx]! * (1 + HINT_DIRECTION_TOLERANCE))
          ) {
            honoursHints = false
            break outer
          }
        }
      }
      if (!honoursHints) continue
    }

    const devs: number[] = []
    for (let r = 0; r < rows.length; r++) {
      for (const idx of rows[r]!) devs.push(Math.log(rowHeights[r]!) - Math.log(factors[idx]!))
    }
    const mean = devs.reduce((s, d) => s + d, 0) / devs.length
    const variance = devs.reduce((s, d) => s + (d - mean) * (d - mean), 0) / devs.length
    const shapeDrift = Math.log(targetH / floatH)
    const score = variance + CANVAS_ASPECT_WEIGHT * shapeDrift * shapeDrift

    if (
      bestRows === undefined ||
      score < bestScore - Math.max(MIN_IMPROVEMENT_ABS, bestScore * MIN_IMPROVEMENT_REL)
    ) {
      bestScore = score
      bestRows = rows
    }
  }
  return bestRows
}

function computeGrid(
  images: readonly ImageDim[],
  canvasW: number,
  canvasH: number,
  gap: number,
): CollageLayoutResult {
  const n = images.length
  const cols = Math.ceil(Math.sqrt(n))
  const rowCount = Math.ceil(n / cols)
  const cellW = (canvasW - gap * (cols + 1)) / cols
  const cellH = (canvasH - gap * (rowCount + 1)) / rowCount

  const rects: Rect[] = new Array(n)
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols)
    const isLastRow = r === rowCount - 1
    const itemsInRow = isLastRow ? n - r * cols : cols
    // Centre a partial last row.
    const rowLeftPad = isLastRow && itemsInRow < cols
      ? gap + ((cols - itemsInRow) * (cellW + gap)) / 2
      : gap
    const c = i - r * cols
    const x = rowLeftPad + c * (cellW + gap)
    const y = gap + r * (cellH + gap)
    rects[i] = {
      x: Math.round(x),
      y: Math.round(y),
      w: Math.max(1, Math.round(cellW)),
      h: Math.max(1, Math.round(cellH)),
    }
  }
  // Grid keeps the exact requested canvas (uniform cells fill it edge-to-edge).
  return { rects, canvasW, canvasH }
}

/**
 * Compute the collage layout. Returns one integer-pixel rect per input image
 * (SAME order as `images`) plus the effective canvas: grid mode keeps the
 * requested target; smart mode fixes the width and FLOATS the height so every
 * image keeps its exact aspect ratio. Throws on an empty image list.
 */
export function computeCollageLayout(
  images: readonly ImageDim[],
  canvasW: number,
  canvasH: number,
  opts: CollageLayoutOpts = {},
): CollageLayoutResult {
  if (images.length === 0) {
    throw new Error("computeCollageLayout: at least one image is required")
  }
  const gap = Math.max(0, Math.floor(opts.gap ?? 0))
  const mode = opts.mode ?? "smart"
  if (mode === "grid") return computeGrid(images, canvasW, canvasH, gap)
  return computeSmart(images, canvasW, canvasH, gap, opts.sizes)
}
