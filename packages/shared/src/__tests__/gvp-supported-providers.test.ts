import { describe, it, expect } from "vitest"
import { GVP_SUPPORTED_PROVIDERS, isGvpSupportedProvider, isSeedance2Provider, isMinimaxH3Provider } from "../model-constants.js"

/**
 * Generate/Edit Video Pro provider-selection guard (2026-07-21): the pro
 * nodes offer ONLY these SKUs. The list is intentionally narrower than the
 * SEEDANCE_2_PROVIDERS capability family (mini is a Seedance-2 variant for
 * capability gating but is NOT offered by the pro engine). If a new SKU is
 * blessed for the pro nodes, update this pin together with the docs pages
 * (docs/nodes/ai-video/generate-video-pro.md, edit-video-pro.md).
 *
 * 2026-08-02: `minimax-h3` blessed — the first non-Seedance SKU (full
 * transport analog: shared Seedance-2 input resolver, 9/3/3 reference caps,
 * per-second 4–15s durations, native audio). Every blessed SKU must belong to
 * a transport-capable family, which is what the family test below now checks.
 */
describe("GVP_SUPPORTED_PROVIDERS", () => {
  it("is exactly the blessed pro SKUs", () => {
    expect([...GVP_SUPPORTED_PROVIDERS]).toEqual(["seedance-2", "seedance-2-fast", "minimax-h3"])
  })

  it("every blessed SKU belongs to a transport-capable family", () => {
    for (const p of GVP_SUPPORTED_PROVIDERS) {
      expect(isSeedance2Provider(p) || isMinimaxH3Provider(p)).toBe(true)
    }
    // mini stays in the Seedance family (capabilities) but out of pro selection
    expect(isSeedance2Provider("seedance-2-mini")).toBe(true)
    expect(isGvpSupportedProvider("seedance-2-mini")).toBe(false)
  })

  it("predicate matches the list and rejects outsiders", () => {
    for (const p of GVP_SUPPORTED_PROVIDERS) expect(isGvpSupportedProvider(p)).toBe(true)
    expect(isGvpSupportedProvider("veo3")).toBe(false)
    expect(isGvpSupportedProvider("kling-3.0")).toBe(false)
    expect(isGvpSupportedProvider(undefined)).toBe(false)
  })
})
