import { describe, it, expect } from "vitest"
import { applySeedance2Params } from "../video.js"
import { KIE_VIDEO_MODELS, KIE_TEXT_TO_VIDEO_MODELS } from "../models.js"

/**
 * Seedance 2.5 rejects every explicit aspect ratio once a START FRAME is
 * present, with a 422:
 *   "Seedance 2.5 first-frame and first-last-frame tasks only support adaptive
 *    aspect ratio"
 *
 * This is UNDOCUMENTED — KIE's schema advertises the full ratio enum
 * unconditionally and only rejects the combination at request time (live probe
 * against api.kie.ai, 2026-08-08). Without the coercion in applySeedance2Params
 * every i2v run from a node with a concrete aspect ratio selected — which is the
 * default in the editor — would hard-fail before generating.
 *
 * Coercion is lossless: with a start frame, "adaptive" IS that frame's aspect.
 */
describe("seedance-2-5 frame-mode aspect coercion", () => {
  const withFrame = (provider: string, aspectRatio: string) => {
    const input: Record<string, unknown> = {
      prompt: "a cat",
      first_frame_url: "https://example.com/frame.jpg",
      aspect_ratio: aspectRatio,
    }
    applySeedance2Params(input, { aspectRatio }, provider)
    return input
  }

  it("coerces an explicit ratio to adaptive when a start frame is wired", () => {
    for (const ar of ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"]) {
      const input = withFrame("seedance-2-5", ar)
      expect(input.aspect_ratio, `aspect ${ar}`).toBe("adaptive")
      // The frame itself must survive — we coerce the ratio, never drop input.
      expect(input.first_frame_url).toBe("https://example.com/frame.jpg")
    }
  })

  it("leaves an explicitly-adaptive request untouched", () => {
    expect(withFrame("seedance-2-5", "adaptive").aspect_ratio).toBe("adaptive")
  })

  it("does NOT coerce for the 2.0 SKUs — the restriction is 2.5-only", () => {
    for (const p of ["seedance-2", "seedance-2-fast", "seedance-2-mini"]) {
      expect(withFrame(p, "16:9").aspect_ratio, p).toBe("16:9")
    }
  })

  it("leaves t2v (no frame) free to use any ratio on seedance-2-5", () => {
    const input: Record<string, unknown> = { prompt: "a cat", aspect_ratio: "21:9" }
    applySeedance2Params(input, { aspectRatio: "21:9" }, "seedance-2-5")
    expect(input.aspect_ratio).toBe("21:9")
    expect(input.first_frame_url).toBeUndefined()
  })

  it("leaves the ratio alone when a frame is demoted into the reference pool", () => {
    // With any reference wired, the resolver moves the frame into
    // reference_image_urls — that is NOT frame mode, so ratios stay legal and
    // coercing would silently discard the user's chosen aspect.
    const input: Record<string, unknown> = {
      prompt: "a cat",
      first_frame_url: "https://example.com/frame.jpg",
      aspect_ratio: "16:9",
    }
    applySeedance2Params(
      input,
      { aspectRatio: "16:9", referenceImageUrls: ["https://example.com/ref.jpg"] },
      "seedance-2-5",
    )
    expect(input.first_frame_url).toBeUndefined()
    expect(input.reference_image_urls).toBeDefined()
    expect(input.aspect_ratio).toBe("16:9")
  })
})

describe("seedance-2-5 KIE model config", () => {
  it("is registered for BOTH i2v and t2v against the same KIE model id", () => {
    expect(KIE_VIDEO_MODELS["seedance-2-5"]?.model).toBe("bytedance/seedance-2-5")
    expect(KIE_TEXT_TO_VIDEO_MODELS["seedance-2-5"]?.model).toBe("bytedance/seedance-2-5")
  })

  it("allows 4-30s on both paths — 30 is the probed ceiling", () => {
    for (const cfg of [KIE_VIDEO_MODELS["seedance-2-5"], KIE_TEXT_TO_VIDEO_MODELS["seedance-2-5"]]) {
      expect(cfg?.allowedDurations?.[0]).toBe(4)
      expect(cfg?.allowedDurations?.[cfg.allowedDurations.length - 1]).toBe(30)
      expect(cfg?.allowedDurations).toHaveLength(27)
    }
  })

  it("defaults to the 720p that PRICING_DEFAULT_RESOLUTION reserves against", () => {
    // These two must agree or an intent-less request bills one tier and renders
    // the other — commit_credits can only refund, never collect.
    for (const cfg of [KIE_VIDEO_MODELS["seedance-2-5"], KIE_TEXT_TO_VIDEO_MODELS["seedance-2-5"]]) {
      expect(cfg?.extraParams?.resolution).toBe("720p")
    }
  })

  it("supports an end frame via last_frame_url", () => {
    expect(KIE_VIDEO_MODELS["seedance-2-5"]?.supportsEndFrame).toBe(true)
    expect(KIE_VIDEO_MODELS["seedance-2-5"]?.endFrameParam).toBe("last_frame_url")
  })
})
