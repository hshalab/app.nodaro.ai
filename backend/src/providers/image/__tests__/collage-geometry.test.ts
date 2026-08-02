import { describe, it, expect } from "vitest"

import { resolveCollageGeometry, resolveCollageCanvas, toCssColor } from "../collage.js"
import { computeCollageLayout, type ImageDim } from "../collage-layout.js"

/**
 * The geometry the RENDERER and the free layout route both use.
 *
 * Its whole reason to exist is that a client preview and the picture the user
 * pays for cannot disagree, so what is pinned here is the contract that makes
 * that true: identical inputs give identical rects, and the function itself
 * defaults nothing — because its two callers default DIFFERENTLY (the provider
 * 2K/1:1, the HTTP route 4K/4:3) and folding either set inside would rebuild
 * the divergence the sharing removes.
 */

const DIMS: ImageDim[] = [
  { w: 1200, h: 800 },
  { w: 800, h: 1200 },
  { w: 1000, h: 1000 },
]

const BASE = { dims: DIMS, layout: "smart" as const, resolution: "2K" as const, aspectRatio: "4:3", gap: 24 }

describe("resolveCollageGeometry", () => {
  it("is the same computation the layout engine does — no second implementation", () => {
    const { w, h } = resolveCollageCanvas("2K", "4:3")
    const direct = computeCollageLayout(DIMS, w, h, { mode: "smart", gap: 24, sizes: undefined })
    expect(resolveCollageGeometry(BASE)).toEqual(direct)
  })

  it("defaults NOTHING — the resolution it is given is the one it uses", () => {
    // The trap this function exists to close: a preview built at 4K for a
    // render pinned to 2K is exact for a canvas nobody receives.
    const twoK = resolveCollageGeometry({ ...BASE, resolution: "2K" })
    const fourK = resolveCollageGeometry({ ...BASE, resolution: "4K" })
    expect(fourK.canvasW).not.toBe(twoK.canvasW)
  })

  it("honours the aspect ratio it is given, not a house default", () => {
    // In GRID mode both canvas dimensions are honoured exactly. Smart floats
    // the height — there the aspect only steers the row count, so two ratios
    // can legitimately land on the same canvas and would prove nothing here.
    const a = resolveCollageGeometry({ ...BASE, layout: "grid", aspectRatio: "4:3" })
    const b = resolveCollageGeometry({ ...BASE, layout: "grid", aspectRatio: "1:1" })
    expect([a.canvasW, a.canvasH]).not.toEqual([b.canvasW, b.canvasH])
  })

  it("floats the height in smart mode — the caller must not assume the nominal canvas", () => {
    const nominal = resolveCollageCanvas("2K", "4:3")
    const smart = resolveCollageGeometry(BASE)
    expect(smart.canvasW).toBe(nominal.w)
    expect(smart.canvasH).not.toBe(nominal.h)
  })

  it("normalises against the DIMS, so a malformed stored value degrades instead of throwing", () => {
    // This provider is called by a worker reading a job row — a real
    // deserialisation boundary, where `imageSizes` is whatever was persisted
    // rather than whatever the route validated. Walking `dims` and indexing
    // into the hints is what makes a non-array survive; walking the hints
    // themselves would throw and fail the render.
    const malformed = resolveCollageGeometry({ ...BASE, imageSizes: "big" as unknown as number[] })
    expect(malformed).toEqual(resolveCollageGeometry(BASE))
  })

  it("reacts to hints that actually differ", () => {
    // A plumbing guard: the hints must REACH the engine. The vector leans
    // against the unhinted shape (which already gives the landscape image a
    // solo row, so big-on-it is an honest no-op under the fidelity search):
    // shrinking the solo image while growing the pair forces a repartition.
    const flat = resolveCollageGeometry({ ...BASE, imageSizes: [2, 2, 2] })
    const leaning = resolveCollageGeometry({ ...BASE, imageSizes: [3, 1, 1] })
    expect(leaning.rects).not.toEqual(flat.rects)
  })

  it("returns the canvas it actually produced, which is not always the nominal one", () => {
    // Smart floats the height, and the clamp can pull the width in — which is
    // exactly why a caller has to scale by the RETURNED canvasW rather than by
    // the resolution it asked for.
    const portraits: ImageDim[] = Array.from({ length: 8 }, () => ({ w: 800, h: 2000 }))
    const out = resolveCollageGeometry({ ...BASE, dims: portraits })
    expect(out.canvasW).toBeGreaterThan(0)
    expect(out.canvasH).toBeGreaterThan(0)
    for (const r of out.rects) {
      expect(r.x).toBeGreaterThanOrEqual(0)
      expect(r.y).toBeGreaterThanOrEqual(0)
      expect(r.x + r.w).toBeLessThanOrEqual(out.canvasW + 1)
      expect(r.y + r.h).toBeLessThanOrEqual(out.canvasH + 1)
    }
  })
})

describe("toCssColor", () => {
  it("normalises a valid hex the way the ffmpeg twin does", () => {
    expect(toCssColor("#AABBCC")).toBe("#aabbcc")
    expect(toCssColor("aabbcc")).toBe("#aabbcc")
    expect(toCssColor("  #AABBCC  ")).toBe("#aabbcc")
  })

  it("falls back to white on anything invalid — the same fallback, in CSS form", () => {
    // The render paints `white` for these; a preview that painted something
    // else would differ in every gap and letterbox area.
    for (const bad of [undefined, "", "nonsense", "#ABC", "#GGGGGG", "#aabbccdd"]) {
      expect(toCssColor(bad)).toBe("#ffffff")
    }
  })
})
