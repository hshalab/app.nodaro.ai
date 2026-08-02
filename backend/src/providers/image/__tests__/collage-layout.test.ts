import { describe, it, expect } from "vitest"
import { computeCollageLayout, type ImageDim, type Rect } from "../collage-layout.js"
import { buildCollageFfmpegArgs } from "../collage.js"

/** Every rect must sit fully inside the (possibly floated) canvas, allowing 1px
 *  rounding slack. */
function assertInBounds(rects: readonly Rect[], canvasW: number, canvasH: number): void {
  for (const r of rects) {
    expect(r.w).toBeGreaterThan(0)
    expect(r.h).toBeGreaterThan(0)
    expect(Number.isFinite(r.x)).toBe(true)
    expect(Number.isFinite(r.y)).toBe(true)
    expect(r.x).toBeGreaterThanOrEqual(0)
    expect(r.y).toBeGreaterThanOrEqual(0)
    expect(r.x + r.w).toBeLessThanOrEqual(canvasW + 1)
    expect(r.y + r.h).toBeLessThanOrEqual(canvasH + 1)
  }
}

/** Mirror of the layout's internal aspect clamp so no-crop assertions compare
 *  against the same value the layout actually targets. */
const MIN_ASPECT = 0.2
const MAX_ASPECT = 5
function clampAspect(w: number, h: number): number {
  const a = (w > 0 ? w : 1) / (h > 0 ? h : 1)
  if (!Number.isFinite(a) || a <= 0) return 1
  return Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, a))
}

function dims(...pairs: Array<[number, number]>): ImageDim[] {
  return pairs.map(([w, h]) => ({ w, h }))
}

/** Deterministic pseudo-random aspect generator (no Math.random for repeatability). */
function seededDims(n: number, seed: number): ImageDim[] {
  const out: ImageDim[] = []
  let s = seed
  for (let i = 0; i < n; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    const w = 200 + (s % 1400) // 200..1600
    s = (s * 1103515245 + 12345) & 0x7fffffff
    const h = 200 + (s % 1400)
    out.push({ w, h })
  }
  return out
}

/** Aspects kept safely inside the [0.2, 5] clamp band so the no-crop invariant
 *  isn't perturbed by clamping. */
function seededModerateDims(n: number, seed: number): ImageDim[] {
  const out: ImageDim[] = []
  let s = seed
  for (let i = 0; i < n; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    const w = 600 + (s % 1200) // 600..1800
    s = (s * 1103515245 + 12345) & 0x7fffffff
    const h = 600 + (s % 1200)
    out.push({ w, h })
  }
  return out
}

describe("computeCollageLayout — smart mode (justified, floating height)", () => {
  it("returns exactly one rect per image", () => {
    for (const n of [1, 2, 3, 4, 5, 7, 9, 12, 20, 30]) {
      const { rects } = computeCollageLayout(seededDims(n, n * 7 + 1), 2560, 2560, { mode: "smart", gap: 12 })
      expect(rects.length).toBe(n)
    }
  })

  it("keeps every rect inside the returned canvas for many n / aspect / canvas combos", () => {
    const canvases: Array<[number, number]> = [
      [2560, 2560], // 1:1
      [3840, 2160], // 16:9
      [2160, 3840], // 9:16
      [2048, 2560], // 4:5
    ]
    for (const [cw, ch] of canvases) {
      for (let n = 1; n <= 24; n++) {
        for (const seed of [1, 42, 999]) {
          const { rects, canvasW, canvasH } = computeCollageLayout(seededDims(n, seed + n), cw, ch, {
            mode: "smart",
            gap: 10,
          })
          expect(rects.length).toBe(n)
          assertInBounds(rects, canvasW, canvasH)
        }
      }
    }
  })

  it("fixes the canvas WIDTH to the target and floats the HEIGHT (never squashed to fit)", () => {
    // A single square image on a wide 16:9 target must NOT be squashed into the
    // short target height — the height floats up so the square stays a square.
    const { rects, canvasW, canvasH } = computeCollageLayout(dims([1000, 1000]), 2560, 1440, {
      mode: "smart",
      gap: 20,
    })
    expect(canvasW).toBe(2560)
    // Height floats to ≈ width (square image ⇒ square-ish canvas), far above 1440.
    expect(canvasH).toBeGreaterThan(2000)
    const [r] = rects
    // The cell stays square (aspect ≈ 1) — no vertical crop.
    expect(r.w / r.h).toBeCloseTo(1, 1)
  })

  it("gives every cell the SAME aspect ratio as its source image (the no-crop invariant)", () => {
    const canvases: Array<[number, number]> = [
      [2560, 2560],
      [3840, 2160],
      [2160, 3840],
    ]
    for (const [cw, ch] of canvases) {
      for (let n = 2; n <= 20; n++) {
        for (const seed of [3, 77, 500]) {
          const imgs = seededModerateDims(n, seed + n)
          const { rects } = computeCollageLayout(imgs, cw, ch, { mode: "smart", gap: 8 })
          rects.forEach((r, i) => {
            const cellAspect = r.w / r.h
            const imgAspect = clampAspect(imgs[i]!.w, imgs[i]!.h)
            // Within 6% — the only deviation is integer rounding + the last-cell
            // width absorb. A cover-crop would blow this out by 20–40%.
            expect(Math.abs(cellAspect - imgAspect) / imgAspect).toBeLessThan(0.06)
          })
        }
      }
    }
  })

  it("each row spans the full canvas width (widths + gaps ≈ canvasW)", () => {
    const cw = 3000
    const ch = 3000
    const gap = 16
    const { rects, canvasW } = computeCollageLayout(seededDims(11, 5), cw, ch, { mode: "smart", gap })
    const byRow = new Map<number, Rect[]>()
    for (const r of rects) {
      const key = Math.round(r.y)
      const arr = byRow.get(key) ?? []
      arr.push(r)
      byRow.set(key, arr)
    }
    for (const row of byRow.values()) {
      const widthPlusGaps = row.reduce((s, r) => s + r.w, 0) + gap * (row.length + 1)
      expect(widthPlusGaps).toBeGreaterThan(canvasW - 6)
      expect(widthPlusGaps).toBeLessThan(canvasW + 6)
    }
  })

  it("caps a pathologically tall collage by uniformly scaling down (still no crop)", () => {
    // Many extreme-portrait images ⇒ natural height would be enormous. The cap
    // must bound the long edge while preserving each cell's aspect ratio.
    const imgs: ImageDim[] = Array.from({ length: 6 }, () => ({ w: 200, h: 1600 })) // aspect 0.125 → clamps to 0.2
    const { rects, canvasW, canvasH } = computeCollageLayout(imgs, 2560, 2560, { mode: "smart", gap: 10 })
    expect(canvasH).toBeLessThanOrEqual(Math.max(canvasW, 2560) * 2 + 2)
    assertInBounds(rects, canvasW, canvasH)
    // Cells stay tall (aspect ≈ 0.2 after clamp) — scaled, not cropped.
    for (const r of rects) expect(r.w / r.h).toBeCloseTo(0.2, 1)
  })

  it("returns even canvas dimensions", () => {
    for (const n of [2, 3, 5, 8, 13]) {
      const { canvasW, canvasH } = computeCollageLayout(seededDims(n, n + 2), 2560, 1440, { mode: "smart", gap: 12 })
      expect(canvasW % 2).toBe(0)
      expect(canvasH % 2).toBe(0)
    }
  })

  it("is deterministic", () => {
    const a = computeCollageLayout(seededDims(9, 3), 2560, 2560, { mode: "smart", gap: 12 })
    const b = computeCollageLayout(seededDims(9, 3), 2560, 2560, { mode: "smart", gap: 12 })
    expect(a).toEqual(b)
  })

  it("produces integer pixel rects", () => {
    const { rects } = computeCollageLayout(seededDims(6, 2), 2560, 1440, { mode: "smart", gap: 12 })
    for (const r of rects) {
      expect(Number.isInteger(r.x)).toBe(true)
      expect(Number.isInteger(r.y)).toBe(true)
      expect(Number.isInteger(r.w)).toBe(true)
      expect(Number.isInteger(r.h)).toBe(true)
    }
  })
})

describe("computeCollageLayout — grid mode (fixed canvas)", () => {
  it("returns one rect per image, all in bounds, and keeps the canvas fixed", () => {
    for (let n = 1; n <= 20; n++) {
      const { rects, canvasW, canvasH } = computeCollageLayout(seededDims(n, n), 2560, 2560, { mode: "grid", gap: 12 })
      expect(rects.length).toBe(n)
      // Grid keeps the exact target canvas — it does NOT float.
      expect(canvasW).toBe(2560)
      expect(canvasH).toBe(2560)
      assertInBounds(rects, canvasW, canvasH)
    }
  })

  it("uses uniform cell sizes", () => {
    const { rects } = computeCollageLayout(dims([100, 100], [200, 100], [100, 200], [300, 300]), 2000, 2000, {
      mode: "grid",
      gap: 20,
    })
    const w0 = rects[0]!.w
    const h0 = rects[0]!.h
    for (const r of rects) {
      expect(r.w).toBe(w0)
      expect(r.h).toBe(h0)
    }
  })
})

describe("computeCollageLayout — smart mode with per-image size hints", () => {
  const T = 2560

  it("no hints ≡ all-auto ≡ all-equal hints (byte-identical back-compat)", () => {
    for (const n of [2, 4, 7, 12, 20]) {
      const imgs = seededModerateDims(n, n * 13 + 5)
      const base = computeCollageLayout(imgs, T, T, { mode: "smart", gap: 12 })
      const allAuto = computeCollageLayout(imgs, T, T, { mode: "smart", gap: 12, sizes: new Array<number>(n).fill(0) })
      const allBig = computeCollageLayout(imgs, T, T, { mode: "smart", gap: 12, sizes: new Array<number>(n).fill(1) })
      const allSmall = computeCollageLayout(imgs, T, T, { mode: "smart", gap: 12, sizes: new Array<number>(n).fill(3) })
      expect(allAuto).toEqual(base)
      expect(allBig).toEqual(base)
      expect(allSmall).toEqual(base)
    }
  })

  it("a hinted-big image renders decisively larger than its auto peers (hero row)", () => {
    const imgs = dims([1000, 1000], [1000, 1000], [1000, 1000], [1000, 1000])
    const { rects, canvasW, canvasH } = computeCollageLayout(imgs, T, T, {
      mode: "smart",
      gap: 10,
      sizes: [1, 0, 0, 0],
    })
    assertInBounds(rects, canvasW, canvasH)
    // Big targets 2× linear vs medium — the hero split over-delivers (~3×
    // height / ~9× area here); assert the conservative floor.
    expect(rects[0]!.h).toBeGreaterThan(rects[1]!.h * 2)
    const areas = rects.map((r) => r.w * r.h)
    expect(areas[0]!).toBeGreaterThan(areas[1]! * 4)
  })

  it("a hinted-big among hinted-smalls dominates, smalls pack a dense row", () => {
    const imgs = dims(
      [1000, 1000], [1000, 1000], [1000, 1000],
      [1000, 1000], [1000, 1000], [1000, 1000],
    )
    const { rects, canvasW, canvasH } = computeCollageLayout(imgs, T, T, {
      mode: "smart",
      gap: 10,
      sizes: [1, 3, 3, 3, 3, 3],
    })
    assertInBounds(rects, canvasW, canvasH)
    // Big vs small requests a 4× linear ratio; the hero-over-strip split
    // realizes ~5× — assert a 3× floor.
    expect(rects[0]!.h).toBeGreaterThan(rects[1]!.h * 3)
    // All five smalls share one dense row (equal heights).
    for (let i = 2; i <= 5; i++) expect(rects[i]!.h).toBe(rects[1]!.h)
  })

  it("keeps input order, the no-crop invariant, and geometry guarantees under hints", () => {
    const imgs = seededModerateDims(9, 41)
    const sizes = [1, 0, 3, 0, 1, 3, 0, 0, 3]
    const a = computeCollageLayout(imgs, T, T, { mode: "smart", gap: 8, sizes })
    const b = computeCollageLayout(imgs, T, T, { mode: "smart", gap: 8, sizes })
    expect(a).toEqual(b) // deterministic
    const { rects, canvasW, canvasH } = a
    expect(rects.length).toBe(9)
    assertInBounds(rects, canvasW, canvasH)
    expect(canvasW % 2).toBe(0)
    expect(canvasH % 2).toBe(0)
    rects.forEach((r, i) => {
      expect(Number.isInteger(r.x) && Number.isInteger(r.y)).toBe(true)
      expect(Number.isInteger(r.w) && Number.isInteger(r.h)).toBe(true)
      // Cells keep their image's exact aspect ratio — hints never crop.
      const cellAspect = r.w / r.h
      const imgAspect = clampAspect(imgs[i]!.w, imgs[i]!.h)
      expect(Math.abs(cellAspect - imgAspect) / imgAspect).toBeLessThan(0.06)
    })
    // Reading order is preserved: rects sorted by (y, x) keep index order
    // within each row and rows in input order.
    const order = rects
      .map((r, i) => ({ i, r }))
      .sort((p, q) => (p.r.y - q.r.y) || (p.r.x - q.r.x))
      .map((p) => p.i)
    expect(order).toEqual([...order].sort((x, y) => x - y))
  })

  it("short / garbage size arrays never break the layout (unknown values are auto)", () => {
    const imgs = seededDims(5, 9)
    const base = computeCollageLayout(imgs, T, T, { mode: "smart", gap: 8 })
    // Garbage values coerce to auto → effectively all-equal → identical.
    const garbage = computeCollageLayout(imgs, T, T, {
      mode: "smart",
      gap: 8,
      sizes: [7, -1, Number.NaN, 99, 0],
    })
    expect(garbage).toEqual(base)
    // Shorter than images: missing entries are auto; layout still emits n rects.
    const short = computeCollageLayout(imgs, T, T, { mode: "smart", gap: 8, sizes: [1] })
    expect(short.rects.length).toBe(5)
    assertInBounds(short.rects, short.canvasW, short.canvasH)
  })

  it("grid mode ignores size hints (uniform cells by design)", () => {
    const imgs = dims([100, 100], [200, 100], [100, 200], [300, 300])
    const base = computeCollageLayout(imgs, 2000, 2000, { mode: "grid", gap: 20 })
    const hinted = computeCollageLayout(imgs, 2000, 2000, { mode: "grid", gap: 20, sizes: [1, 3, 0, 2] })
    expect(hinted).toEqual(base)
  })
})

describe("computeCollageLayout — near-equal portrait aspects (recast probe regression)", () => {
  // The reported set (2026-08-02): three 896×1200 uploads and one 2448×3264 —
  // aspects 0.7467 vs 0.75, a 0.4% spread — at recast's pinned sheet params
  // (2K long edge, 4:3 target, gap 24). Before the balance-point close, the
  // unhinted greedy split this 3+1 with the tail image at ~9× its peers'
  // area, flipping to 2+2 when the odd aspect moved position; and the hinted
  // candidate search missed the hero split, so L/S presses changed nothing or
  // moved the hinted image OPPOSITE to the request.
  const W = 2560
  const H = 1920
  const GAP = 24
  const probe = dims([896, 1200], [896, 1200], [2448, 3264], [896, 1200])

  it("unhinted: no image renders at a runaway multiple of its peers", () => {
    const { rects, canvasW, canvasH } = computeCollageLayout(probe, W, H, { gap: GAP })
    assertInBounds(rects, canvasW, canvasH)
    const areas = rects.map((r) => r.w * r.h)
    expect(Math.max(...areas) / Math.min(...areas)).toBeLessThan(2)
  })

  it("unhinted: the row structure does not flip on which position holds the odd aspect", () => {
    const signatures = [0, 1, 2, 3].map((pos) => {
      const uniform: Array<[number, number]> = [
        [896, 1200],
        [896, 1200],
        [896, 1200],
      ]
      const d = dims(...uniform.slice(0, pos), [2448, 3264], ...uniform.slice(pos))
      const { rects } = computeCollageLayout(d, W, H, { gap: GAP })
      const perRow = new Map<number, number>()
      for (const r of rects) perRow.set(r.y, (perRow.get(r.y) ?? 0) + 1)
      return [...perRow.values()].sort().join(",")
    })
    expect(new Set(signatures).size).toBe(1)
  })

  it("a size hint never moves its image OPPOSITE to the request", () => {
    const baseAreas = computeCollageLayout(probe, W, H, { gap: GAP }).rects.map((r) => r.w * r.h)
    for (let i = 0; i < probe.length; i++) {
      for (const [hint, grow] of [
        [1, true],
        [3, false],
      ] as const) {
        const sizes = [2, 2, 2, 2]
        sizes[i] = hint
        const { rects, canvasW, canvasH } = computeCollageLayout(probe, W, H, { gap: GAP, sizes })
        assertInBounds(rects, canvasW, canvasH)
        const area = rects[i]!.w * rects[i]!.h
        // Big must never SHRINK the hinted image; small must never GROW it.
        // Same-aspect geometry cannot honour every request (a no-op is legal)
        // — 5% slack covers rounding and canvas-cap rescales.
        if (grow) expect(area).toBeGreaterThan(baseAreas[i]! * 0.95)
        else expect(area).toBeLessThan(baseAreas[i]! * 1.05)
      }
    }
  })

  it("big on the lead image yields a decisive hero row even with same-aspect peers", () => {
    const { rects, canvasW, canvasH } = computeCollageLayout(probe, W, H, { gap: GAP, sizes: [1, 2, 2, 2] })
    assertInBounds(rects, canvasW, canvasH)
    const areas = rects.map((r) => r.w * r.h)
    expect(areas[0]!).toBeGreaterThan(areas[1]! * 2)
  })
})

describe("computeCollageLayout — stability and hint direction (stress regression)", () => {
  // Property tests distilled from the 2026-08-02 stress harness. The prior
  // selection was greedy (then exhaustive with a purely relative adoption
  // bar), and three classes of failure survived it: ±0.5% dimension jitter
  // flipped WHICH same-aspect image got a 4× hero cell, a hint could move its
  // image OPPOSITE to the request (restacking perfects the RATIOS while
  // growing everything), and mixed six-image sets collapsed into a one-row
  // strip of thumbnail cells.
  const W = 2560
  const H = 1920
  const GAP = 24

  // Deterministic PRNG — no Math.random in tests.
  let seed = 987654
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }
  const fromAspects = (aspects: number[]): ImageDim[] =>
    aspects.map((a) => {
      const h = 1000 + Math.round(rnd() * 500)
      return { w: Math.max(1, Math.round(h * a)), h }
    })
  const jitter = (d: ImageDim[]): ImageDim[] =>
    d.map((x) => ({
      w: Math.max(1, Math.round(x.w * (1 + (rnd() - 0.5) * 0.01))),
      h: Math.max(1, Math.round(x.h * (1 + (rnd() - 0.5) * 0.01))),
    }))
  const areasOf = (d: ImageDim[], sizes?: number[]) =>
    computeCollageLayout(d, W, H, { gap: GAP, ...(sizes ? { sizes } : {}) }).rects.map(
      (r) => r.w * r.h,
    )

  const FAMILIES: Array<{ name: string; aspects: number[] }> = [
    { name: "three same squares", aspects: [1, 1, 1] },
    { name: "five same squares", aspects: [1, 1, 1, 1, 1] },
    { name: "four near-equal portraits", aspects: [0.7467, 0.7467, 0.75, 0.7467] },
    { name: "six photo mix", aspects: [0.5625, 0.75, 1, 1.333, 1.778, 0.5625] },
    { name: "five random moderate", aspects: [0.62, 1.41, 0.98, 1.13, 0.77] },
  ]

  it("±0.5% dimension jitter never swings an unhinted image's area beyond 1.6×", () => {
    for (const fam of FAMILIES) {
      const d = fromAspects(fam.aspects)
      const base = areasOf(d)
      for (let t = 0; t < 20; t++) {
        const ja = areasOf(jitter(d))
        ja.forEach((a, i) => {
          const r = a / base[i]!
          expect(r, `${fam.name} img ${i + 1} trial ${t}`).toBeGreaterThan(1 / 1.6)
          expect(r, `${fam.name} img ${i + 1} trial ${t}`).toBeLessThan(1.6)
        })
      }
    }
  })

  it("a size hint never moves its image opposite to the request, across families", () => {
    for (const fam of FAMILIES) {
      const d = fromAspects(fam.aspects)
      const base = areasOf(d)
      for (let i = 0; i < d.length; i++) {
        for (const [hint, grow] of [
          [1, true],
          [3, false],
        ] as const) {
          const sizes = Array(d.length).fill(2)
          sizes[i] = hint
          const a = areasOf(d, sizes)[i]!
          if (grow) expect(a, `${fam.name} L@${i + 1}`).toBeGreaterThan(base[i]! * 0.95)
          else expect(a, `${fam.name} S@${i + 1}`).toBeLessThan(base[i]! * 1.05)
        }
      }
    }
  })

  it("mixed photo sets keep a usable multi-row shape unhinted (no thumbnail strip)", () => {
    const d = fromAspects([0.5625, 0.75, 1, 1.333, 1.778, 0.5625])
    const { rects, canvasW, canvasH } = computeCollageLayout(d, W, H, { gap: GAP })
    assertInBounds(rects, canvasW, canvasH)
    expect(canvasW / canvasH).toBeLessThan(4)
    expect(new Set(rects.map((r) => r.y)).size).toBeGreaterThan(1)
  })

  it("three same-aspect images lay out FAIR — no arbitrary 4× hero — and jitter keeps it", () => {
    const d = fromAspects([1, 1, 1])
    const base = areasOf(d)
    expect(Math.max(...base) / Math.min(...base)).toBeLessThan(1.1)
    for (let t = 0; t < 10; t++) {
      const ja = areasOf(jitter(d))
      expect(Math.max(...ja) / Math.min(...ja)).toBeLessThan(1.1)
    }
  })
})

describe("computeCollageLayout — guards", () => {
  it("throws on empty image list", () => {
    expect(() => computeCollageLayout([], 2560, 2560, { mode: "smart" })).toThrow()
  })

  it("tolerates degenerate (zero/negative) dims by treating them as square", () => {
    const { rects, canvasW, canvasH } = computeCollageLayout(dims([0, 0], [100, 0], [-5, 100]), 2560, 2560, {
      mode: "smart",
      gap: 10,
    })
    expect(rects.length).toBe(3)
    assertInBounds(rects, canvasW, canvasH)
  })
})

describe("buildCollageFfmpegArgs — compositor (fit, no crop)", () => {
  const base = {
    localPaths: ["/a.png", "/b.png"],
    rects: [
      { x: 0, y: 0, w: 100, h: 100 },
      { x: 100, y: 0, w: 200, h: 100 },
    ],
    canvasW: 300,
    canvasH: 100,
    bgColor: "0xffffff",
    outputPath: "/out.png",
  }

  it("fits each image inside its cell (scale down to fit), never cover-crops", () => {
    const args = buildCollageFfmpegArgs(base)
    const fc = args[args.indexOf("-filter_complex") + 1]!
    // Fit, not fill: scale-down to fit — no crop, no increase (cover) filter.
    expect(fc).toContain("force_original_aspect_ratio=decrease")
    expect(fc).not.toContain("force_original_aspect_ratio=increase")
    expect(fc).not.toMatch(/(^|[;,\[])crop=/)
  })

  it("does NOT use pad (avoids the decrease-rounding overshoot abort)", () => {
    const args = buildCollageFfmpegArgs(base)
    const fc = args[args.indexOf("-filter_complex") + 1]!
    expect(fc).not.toContain("pad=")
  })

  it("builds the solid canvas in the background color so letterbox bars match the gaps", () => {
    const args = buildCollageFfmpegArgs(base)
    expect(args.join(" ")).toContain("color=c=0xffffff:s=300x100")
  })

  it("centres each fitted image within its cell via an overlay expression", () => {
    const args = buildCollageFfmpegArgs(base)
    const fc = args[args.indexOf("-filter_complex") + 1]!
    // Cell 0 at x=0 w=100 → centred: 0+(100-w)/2 ; cell 1 at x=100 w=200.
    expect(fc).toContain("overlay=x=0+(100-w)/2:y=0+(100-h)/2")
    expect(fc).toContain("overlay=x=100+(200-w)/2:y=0+(100-h)/2")
    expect(fc).toContain("[out]")
    expect(args).toContain("-map")
  })
})
