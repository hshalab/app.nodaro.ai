/**
 * `tk.providers.videoUpscale` — the gvp tail-restoration lever's toolkit
 * member (2026-08-02). Wraps `videoUpscale` from `providers/router.ts`,
 * narrowing the surface to (url, model, factor) → { url }: reconcile /
 * progress hooks stay app-internal, and the RouteResult's cost field is
 * deliberately not exposed to plugins.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockVideoUpscale } = vi.hoisted(() => ({ mockVideoUpscale: vi.fn() }))
vi.mock("../../../providers/router.js", () => ({ videoUpscale: mockVideoUpscale }))

import { buildToolkit } from "../toolkit.js"

describe("tk.providers.videoUpscale", () => {
  beforeEach(() => {
    mockVideoUpscale.mockReset()
  })

  it("threads (url, model, factor) to the provider router and unwraps { url }", async () => {
    mockVideoUpscale.mockResolvedValue({ url: "https://provider/upscaled.mp4", cost: 0.12 })
    const tk = buildToolkit()

    const result = await tk.providers.videoUpscale("https://r2/tail.mp4", "topaz", "2")

    expect(mockVideoUpscale).toHaveBeenCalledWith("https://r2/tail.mp4", "topaz", "2")
    expect(result).toEqual({ url: "https://provider/upscaled.mp4" }) // cost NOT exposed
  })

  it("propagates provider failures unchanged (the plugin's fallback owns degradation)", async () => {
    mockVideoUpscale.mockRejectedValue(new Error("topaz 502"))
    const tk = buildToolkit()

    await expect(tk.providers.videoUpscale("https://r2/tail.mp4", "topaz", "2")).rejects.toThrow("topaz 502")
  })
})
