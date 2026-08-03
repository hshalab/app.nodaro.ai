/**
 * `tk.providers.generateImage` — the gvp keyframes lever's toolkit member
 * (ADDITIVE 2026-08-03). Wraps `generateImage` from `providers/router.ts`,
 * narrowing the surface to (prompt, model, options) → { url, taskId }:
 * option fields map onto the router's snake_case `extraParams` (mirroring
 * `workers/handlers/image-ai.ts`'s composition), an empty extraParams is
 * passed as `undefined`, and the RouteResult's cost fields are deliberately
 * not exposed to plugins.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockGenerateImage } = vi.hoisted(() => ({ mockGenerateImage: vi.fn() }))
// editImage + videoUpscale must exist on the factory too — toolkit.ts imports
// them for the imageUpscale/videoUpscale members (a missing named export
// throws at import binding).
vi.mock("../../../providers/router.js", () => ({
  generateImage: mockGenerateImage,
  editImage: vi.fn(),
  videoUpscale: vi.fn(),
}))

import { buildToolkit } from "../toolkit.js"

describe("tk.providers.generateImage", () => {
  beforeEach(() => {
    mockGenerateImage.mockReset()
  })

  it("forwards prompt/model/refs and maps options onto snake_case extraParams", async () => {
    mockGenerateImage.mockResolvedValue({
      url: "https://provider/anchor.png",
      cost: 0.05,
      kieTaskId: "task-abc",
    })
    const tk = buildToolkit()

    const result = await tk.providers.generateImage!("a castle at dusk", "nano-banana-pro", {
      referenceImageUrls: ["https://r2/ref-1.png", "https://r2/ref-2.png"],
      aspectRatio: "16:9",
      resolution: "2K",
      negativePrompt: "text, watermark",
    })

    expect(mockGenerateImage).toHaveBeenCalledTimes(1)
    const [prompt, model, refs, extraParams, reconcileOpts] = mockGenerateImage.mock.calls[0]
    expect(prompt).toBe("a castle at dusk")
    expect(model).toBe("nano-banana-pro")
    expect(refs).toEqual(["https://r2/ref-1.png", "https://r2/ref-2.png"])
    expect(extraParams).toEqual({
      aspect_ratio: "16:9",
      resolution: "2K",
      negative_prompt: "text, watermark",
    })
    expect(reconcileOpts).toBeUndefined() // no onTaskCreated → no reconcileOpts at all
    expect(result).toEqual({ url: "https://provider/anchor.png", taskId: "task-abc" }) // cost NOT exposed
  })

  it("passes extraParams as undefined when no param-mapping options are set", async () => {
    mockGenerateImage.mockResolvedValue({ url: "https://provider/plain.png", cost: null })
    const tk = buildToolkit()

    const result = await tk.providers.generateImage!("plain prompt", "nano-banana")

    expect(mockGenerateImage).toHaveBeenCalledWith(
      "plain prompt",
      "nano-banana",
      undefined, // no referenceImageUrls
      undefined, // empty extraParams composition → undefined, not {}
      undefined, // no onTaskCreated → no reconcileOpts
    )
    // Image-lane RouteResults carry no kieTaskId today — taskId rides along undefined.
    expect(result).toEqual({ url: "https://provider/plain.png", taskId: undefined })
  })

  it("omits unset option fields from extraParams individually", async () => {
    mockGenerateImage.mockResolvedValue({ url: "https://provider/a.png", cost: null })
    const tk = buildToolkit()

    await tk.providers.generateImage!("p", "nano-banana-pro", { aspectRatio: "9:16" })

    const extraParams = mockGenerateImage.mock.calls[0][3]
    expect(extraParams).toEqual({ aspect_ratio: "9:16" }) // no resolution / negative_prompt keys
  })

  it("adapts onTaskCreated into ReconcileOpts (void-returning plugin callback awaited)", async () => {
    mockGenerateImage.mockResolvedValue({ url: "https://provider/b.png", cost: null })
    const tk = buildToolkit()
    const seen: string[] = []

    await tk.providers.generateImage!("p", "nano-banana-pro", {
      onTaskCreated: (taskId) => {
        seen.push(taskId) // plain void return — the adapter must accept it
      },
    })

    const reconcileOpts = mockGenerateImage.mock.calls[0][4]
    expect(reconcileOpts).toBeDefined()
    await reconcileOpts.onTaskCreated("task-live-123")
    expect(seen).toEqual(["task-live-123"])
  })

  it("propagates provider failures unchanged (the plugin's own guard owns degradation)", async () => {
    mockGenerateImage.mockRejectedValue(new Error("kie 502"))
    const tk = buildToolkit()

    await expect(tk.providers.generateImage!("p", "nano-banana-pro")).rejects.toThrow("kie 502")
  })
})
