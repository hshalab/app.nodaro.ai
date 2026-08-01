import { describe, it, expect } from "vitest"
import { MODEL_CATALOG } from "../model-catalog.js"
import {
  IMAGE_TO_VIDEO_PROVIDERS,
  TEXT_TO_VIDEO_PROVIDERS,
  VIDEO_REF_LIMITS_BY_PROVIDER,
  VIDEO_PROVIDERS_REQUIRING_IMAGE,
  getVideoAudioCapability,
  defaultVideoAspectRatio,
  getMaxVideoPromptChars,
  MINIMAX_H3_PROVIDERS,
  isMinimaxH3Provider,
  isSeedance2Provider,
  SEEDANCE_2_PROVIDERS,
  SEEDANCE_LIP_SYNC_PROVIDERS,
  DURATION_PRICED_PROVIDERS,
  VIDEO_DURATION_TIERS,
  PRICING_DEFAULT_DURATION_SEC,
  SEEDANCE_2_R2V_MAX_AUDIO_SEC_BY_PROVIDER,
  GVP_SUPPORTED_PROVIDERS,
} from "../model-constants.js"

describe("minimax-h3 catalog", () => {
  const entry = MODEL_CATALOG["minimax-h3"]

  it("exists with both video modes under ONE id (no t2v twin)", () => {
    expect(entry).toBeDefined()
    expect(entry.kind).toBe("video")
    expect([...entry.modes].sort()).toEqual(["i2v", "t2v"])
  })

  it("declares NO resolutions — fixed 2K output, no lever (pricing is duration-only)", () => {
    expect(entry.resolutions).toBeUndefined()
  })

  it("offers every second 4-15 and the seven-ratio aspect set incl. adaptive + 21:9", () => {
    expect(entry.durations).toEqual([4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])
    expect(entry.aspectRatios).toContain("adaptive")
    expect(entry.aspectRatios).toContain("21:9")
  })

  it("declares the multimodal feature set (end-frame + audio + reference-image)", () => {
    expect(entry.features).toEqual(expect.arrayContaining(["end-frame", "audio", "reference-image"]))
  })
})

describe("minimax-h3 provider wiring", () => {
  it("is registered for BOTH t2v and i2v (unified node dispatches by image presence)", () => {
    expect(IMAGE_TO_VIDEO_PROVIDERS).toContain("minimax-h3")
    expect(TEXT_TO_VIDEO_PROVIDERS).toContain("minimax-h3")
  })

  it("is NOT image-required (real t2v mode exists)", () => {
    expect(VIDEO_PROVIDERS_REQUIRING_IMAGE.has("minimax-h3")).toBe(false)
  })

  it("carries the full 9/3/3 multimodal reference caps", () => {
    expect(VIDEO_REF_LIMITS_BY_PROVIDER["minimax-h3"]).toEqual({ images: 9, videos: 3, audio: 3 })
  })

  it("audio capability: audio_driven and always-on (H3 has NO audio toggle param)", () => {
    const cap = getVideoAudioCapability("minimax-h3")
    expect(cap.mode).toBe("audio_driven")
    expect(cap.alwaysOn).toBe(true)
    expect(cap.field).toBeUndefined()
  })

  it("defaults to the adaptive aspect (r2v native default; t2v coerces at the KIE layer)", () => {
    expect(defaultVideoAspectRatio("minimax-h3")).toBe("adaptive")
  })

  it("prompt cap is the documented 7000 chars", () => {
    expect(getMaxVideoPromptChars("minimax-h3")).toBe(7000)
  })

  it("rides the reference-audio lip-sync surface with a 15s per-clip audio cap", () => {
    expect(SEEDANCE_LIP_SYNC_PROVIDERS.has("minimax-h3")).toBe(true)
    expect(SEEDANCE_2_R2V_MAX_AUDIO_SEC_BY_PROVIDER["minimax-h3"]).toBe(15)
  })

  it("prices per second: one duration tier per allowed second, default-duration 6 for omitted requests", () => {
    expect(DURATION_PRICED_PROVIDERS.has("minimax-h3")).toBe(true)
    const tiers = VIDEO_DURATION_TIERS["minimax-h3"]
    expect(tiers.map((t) => t.maxSeconds)).toEqual([4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])
    expect(PRICING_DEFAULT_DURATION_SEC["minimax-h3"]).toBe(6)
  })
})

describe("minimax-h3 family predicate — exact membership, never prefix-matched", () => {
  it("matches minimax-h3 only", () => {
    expect(isMinimaxH3Provider("minimax-h3")).toBe(true)
    expect([...MINIMAX_H3_PROVIDERS]).toEqual(["minimax-h3"])
  })

  it("does NOT match the unrelated Hailuo 02 id 'minimax' (the prefix trap)", () => {
    expect(isMinimaxH3Provider("minimax")).toBe(false)
    expect(isMinimaxH3Provider(undefined)).toBe(false)
    expect(isMinimaxH3Provider("")).toBe(false)
  })

  it("stays OUT of the Seedance 2 family set (which gates Seedance-specific KIE params + -ref pricing)", () => {
    expect(isSeedance2Provider("minimax-h3")).toBe(false)
    expect(SEEDANCE_2_PROVIDERS.has("minimax-h3")).toBe(false)
  })

  it("is NOT a GVP/EVP SKU (pro engine support is a separate, plugin-gated blessing)", () => {
    expect([...GVP_SUPPORTED_PROVIDERS]).not.toContain("minimax-h3")
  })
})
