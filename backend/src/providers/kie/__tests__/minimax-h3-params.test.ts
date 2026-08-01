import { describe, it, expect } from "vitest"
import { applyMinimaxH3Params, minimaxH3TaskModel } from "../video.js"

const I2V_MODEL = "minimax-h3/image-to-video"
const T2V_MODEL = "minimax-h3/text-to-video"
const R2V_MODEL = "minimax-h3/reference-to-video"

describe("applyMinimaxH3Params — param hygiene", () => {
  it("drops every non-H3 param (resolution / web_search / nsfw_checker / generate_audio) and integerizes duration", () => {
    const input: Record<string, unknown> = {
      prompt: "p",
      duration: "8",
      resolution: "720p",
      web_search: false,
      nsfw_checker: true,
      generate_audio: false,
      first_frame_url: "f",
    }
    applyMinimaxH3Params(input, undefined)
    expect(input.duration).toBe(8)
    expect(input.resolution).toBeUndefined()
    expect(input.web_search).toBeUndefined()
    expect(input.nsfw_checker).toBeUndefined()
    expect(input.generate_audio).toBeUndefined()
  })
})

describe("applyMinimaxH3Params — aspect per mode", () => {
  it("pure t2v REQUIRES a concrete ratio: adaptive/missing coerce to 16:9", () => {
    const adaptive: Record<string, unknown> = { prompt: "p", aspect_ratio: "adaptive" }
    applyMinimaxH3Params(adaptive, undefined)
    expect(adaptive.aspect_ratio).toBe("16:9")

    const missing: Record<string, unknown> = { prompt: "p" }
    applyMinimaxH3Params(missing, undefined)
    expect(missing.aspect_ratio).toBe("16:9")

    const explicit: Record<string, unknown> = { prompt: "p", aspect_ratio: "9:16" }
    applyMinimaxH3Params(explicit, undefined)
    expect(explicit.aspect_ratio).toBe("9:16")
  })

  it("i2v (frames, no refs) has NO aspect param — always deleted", () => {
    const input: Record<string, unknown> = { prompt: "p", first_frame_url: "f", aspect_ratio: "16:9" }
    applyMinimaxH3Params(input, { aspectRatio: "16:9" })
    expect(input.aspect_ratio).toBeUndefined()
    expect(input.first_frame_url).toBe("f")
  })

  it("reference mode forwards documented values (adaptive kept, Auto normalized) and drops junk", () => {
    const adaptive: Record<string, unknown> = { prompt: "p", aspect_ratio: "adaptive" }
    applyMinimaxH3Params(adaptive, { referenceImageUrls: ["r"] })
    expect(adaptive.aspect_ratio).toBe("adaptive")

    const auto: Record<string, unknown> = { prompt: "p", aspect_ratio: "Auto" }
    applyMinimaxH3Params(auto, { referenceImageUrls: ["r"] })
    expect(auto.aspect_ratio).toBe("adaptive")

    const junk: Record<string, unknown> = { prompt: "p", aspect_ratio: "4:5" }
    applyMinimaxH3Params(junk, { referenceImageUrls: ["r"] })
    expect(junk.aspect_ratio).toBeUndefined() // KIE defaults r2v to adaptive
  })
})

describe("applyMinimaxH3Params — shared resolver semantics (frames fold into refs)", () => {
  it("strict first/last-frame mode when nothing but frames is connected", () => {
    const input: Record<string, unknown> = { prompt: "p", first_frame_url: "f", last_frame_url: "l" }
    applyMinimaxH3Params(input, undefined)
    expect(input.first_frame_url).toBe("f")
    expect(input.last_frame_url).toBe("l")
    expect(input.reference_image_urls).toBeUndefined()
  })

  it("ANY reference flips to reference mode: frames move to the pool tail + binding suffix appended", () => {
    const input: Record<string, unknown> = { prompt: "p", first_frame_url: "f" }
    applyMinimaxH3Params(input, { referenceImageUrls: ["r1", "r2"] })
    expect(input.first_frame_url).toBeUndefined()
    expect(input.reference_image_urls).toEqual(["r1", "r2", "f"])
    expect(String(input.prompt)).toContain("@image_3")
  })

  it("audio refs ride reference mode alongside the folded frame (H3 forbids audio alone)", () => {
    const input: Record<string, unknown> = { prompt: "p", first_frame_url: "f" }
    applyMinimaxH3Params(input, { referenceAudioUrls: ["a"] })
    expect(input.first_frame_url).toBeUndefined()
    expect(input.reference_image_urls).toEqual(["f"])
    expect(input.reference_audio_urls).toEqual(["a"])
  })

  it("caps reference videos/audio at 3 each (the shared resolver's caps)", () => {
    const input: Record<string, unknown> = { prompt: "p" }
    applyMinimaxH3Params(input, {
      referenceImageUrls: ["r"],
      referenceVideoUrls: ["v1", "v2", "v3", "v4"],
      referenceAudioUrls: ["a1", "a2", "a3", "a4"],
    })
    expect(input.reference_video_urls).toEqual(["v1", "v2", "v3"])
    expect(input.reference_audio_urls).toEqual(["a1", "a2", "a3"])
  })
})

describe("minimaxH3TaskModel — per-mode KIE endpoint swap", () => {
  it("keeps the map default when no frames/refs are present (t2v entry path)", () => {
    expect(minimaxH3TaskModel(T2V_MODEL, { prompt: "p" })).toBe(T2V_MODEL)
  })

  it("routes frames to image-to-video", () => {
    expect(minimaxH3TaskModel(I2V_MODEL, { first_frame_url: "f" })).toBe(I2V_MODEL)
    expect(minimaxH3TaskModel(T2V_MODEL, { last_frame_url: "l" })).toBe(I2V_MODEL)
  })

  it("routes ANY reference array to reference-to-video — from both entry paths", () => {
    expect(minimaxH3TaskModel(I2V_MODEL, { reference_image_urls: ["r"] })).toBe(R2V_MODEL)
    expect(minimaxH3TaskModel(T2V_MODEL, { reference_video_urls: ["v"] })).toBe(R2V_MODEL)
    expect(minimaxH3TaskModel(T2V_MODEL, { reference_audio_urls: ["a"], reference_image_urls: ["r"] })).toBe(R2V_MODEL)
  })

  it("ignores empty arrays", () => {
    expect(minimaxH3TaskModel(I2V_MODEL, { reference_image_urls: [], first_frame_url: "f" })).toBe(I2V_MODEL)
  })
})
