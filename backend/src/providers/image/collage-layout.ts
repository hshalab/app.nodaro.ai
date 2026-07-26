/**
 * Smart collage layout — pure geometry, no I/O.
 *
 * Given N source images (natural dimensions), a fixed output canvas, and a
 * gap, computes one pixel rectangle per image such that the images tile the
 * WHOLE canvas with no wasted space. Each image is later cover-cropped into
 * its rectangle by the compositor (ffmpeg), so a rectangle only needs to be
 * proportional-ish to its source to keep cropping minimal.
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
 *                hint-free input renders byte-identically to before.
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

/**
 * Partition image indices [0..n) into exactly `rowCount` non-empty, contiguous
 * rows, balancing the sum of aspect ratios per row (so rows end up with similar
 * heights). Greedy with a "leave one image per remaining row" guard so no row
 * is ever starved.
 */
function partitionIntoRows(aspects: readonly number[], rowCount: number): number[][] {
  const n = aspects.length
  if (rowCount >= n) return aspects.map((_, i) => [i])
  if (rowCount <= 1) return [aspects.map((_, i) => i)]

  const total = aspects.reduce((s, a) => s + a, 0)
  const target = total / rowCount
  const rows: number[][] = []
  let cur: number[] = []
  let curSum = 0

  for (let i = 0; i < n; i++) {
    cur.push(i)
    curSum += aspects[i]!

    // Rows still to open AFTER the current one, and images left after index i.
    const unopenedRows = rowCount - rows.length - 1
    const imagesRemaining = n - (i + 1)

    // Close the current row when either we MUST (to leave one image per still-
    // unopened row) or the row hit its aspect-sum target and enough images
    // remain to fill the rest (one each). The guard keeps the final row open so
    // it absorbs the tail.
    if (
      rows.length < rowCount - 1 &&
      (imagesRemaining === unopenedRows ||
        (curSum >= target && imagesRemaining > unopenedRows))
    ) {
      rows.push(cur)
      cur = []
      curSum = 0
    }
  }
  if (cur.length > 0) rows.push(cur)
  return rows
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
  // The target aspect only steers HOW MANY rows we open — it does not squash the
  // result. A wide target ⇒ fewer, taller rows; a tall target ⇒ more rows.
  const rowCount = chooseRows(n, targetW / targetH)

  // Size hints are RELATIVE: only when at least two images resolve to
  // DIFFERENT factors is there anything to express. All-auto / all-equal
  // hints (and every pre-hints caller) take the original path, so existing
  // collages render byte-identically.
  const factors = images.map((_, i) => sizeFactor(sizes?.[i]))
  const hinted = factors.some((f) => f !== factors[0])
  if (hinted) {
    return computeSmartHinted(aspects, factors, rowCount, targetW, targetH, gap)
  }

  const rows = partitionIntoRows(aspects, rowCount)
  return emitJustifiedRows(rows, aspects, targetW, targetH, gap)
}

/**
 * Partition indices [0..n) into exactly `rowCount` non-empty contiguous rows,
 * balancing the BUDGET sum per row (budget = aspect × linear size factor).
 * Uses an adaptive target (remaining budget / remaining rows) and a
 * balance-point close: a row closes when its sum sits at least as close to
 * the target as it would after absorbing the next image. Big images inflate
 * their budget, so they fill a row's quota with fewer companions — and a row
 * with fewer real aspects justifies TALLER. Same starvation guard as
 * `partitionIntoRows`.
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

/**
 * How faithfully a candidate partition realizes the requested size ratios.
 * An image's rendered scale is its row's justified height, and its requested
 * scale is its linear factor — so per image we take
 * `ln(rowHeight) − ln(factor)` and score the VARIANCE across images
 * (scale-free: the absolute canvas scale is set by the width; only the
 * ratios between images matter). Lower is better; 0 means every image is
 * exactly its requested multiple of every other.
 */
function sizeFidelityScore(
  rows: readonly number[][],
  aspects: readonly number[],
  factors: readonly number[],
  targetW: number,
  gap: number,
): number {
  const devs: number[] = []
  for (const row of rows) {
    const availW = targetW - gap * (row.length + 1)
    const aspectSum = row.reduce((s, idx) => s + aspects[idx]!, 0)
    const rowH = Math.max(1e-6, availW / Math.max(0.0001, aspectSum))
    for (const idx of row) devs.push(Math.log(rowH) - Math.log(factors[idx]!))
  }
  const mean = devs.reduce((s, d) => s + d, 0) / devs.length
  return devs.reduce((s, d) => s + (d - mean) * (d - mean), 0) / devs.length
}

/**
 * Smart layout with per-image size hints. Within a justified row every cell
 * shares the row height (that is what makes it crop-free), so relative size
 * is expressed BETWEEN rows: hinted-big images get rows with fewer
 * companions (taller), hinted-small images pack denser rows (shorter). We
 * try the unhinted row count and its neighbours, partition each by weighted
 * budget, and keep the candidate whose realized row heights best match the
 * requested factors. Geometry emission is shared with the unhinted path —
 * the no-crop invariant is untouched.
 */
function computeSmartHinted(
  aspects: readonly number[],
  factors: readonly number[],
  baseRowCount: number,
  targetW: number,
  targetH: number,
  gap: number,
): CollageLayoutResult {
  const n = aspects.length
  const budgets = aspects.map((a, i) => a * factors[i]!)

  const candidates = [...new Set([baseRowCount, baseRowCount - 1, baseRowCount + 1])].filter(
    (r) => r >= 1 && r <= n,
  )

  // Iteration starts at the unhinted row count, and only a STRICTLY better
  // score moves away from it — ties keep today's shape.
  let bestRows: number[][] | undefined
  let bestScore = Infinity
  for (const rowCount of candidates) {
    const rows = partitionByBudget(budgets, rowCount)
    const score = sizeFidelityScore(rows, aspects, factors, targetW, gap)
    if (score < bestScore - 1e-9) {
      bestScore = score
      bestRows = rows
    }
  }

  return emitJustifiedRows(
    bestRows ?? [aspects.map((_, i) => i)],
    aspects,
    targetW,
    targetH,
    gap,
  )
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
