import { describe, it, expect } from "vitest"
import { hasContiguousSegmentDurations } from "@nodaro/shared"
import { NODE_REGISTRY } from "../node-registry.js"

describe("generate-video-pro node registry", () => {
  it("is discoverable via GET /v1/nodes with video output, fee-base credit cost, and capabilities", () => {
    const d = NODE_REGISTRY.find((n) => n.type === "generate-video-pro")
    expect(d).toBeDefined()
    expect(d?.label).toBe("Generate Video Pro")
    expect(d?.category).toBe("ai-video")
    expect(d?.outputType).toBe("video")
    // Multi-mode fee-base only (STATIC_CREDIT_COSTS["generate-video-pro"] = 100) —
    // the real per-run cost is dynamic (see ee/billing/generate-video-pro-credits.ts).
    expect(d?.creditCost).toBe(100)
    expect(d?.capabilities).toEqual(["long-form", "auto-segmentation", "seamless-stitch"])
  })

  it("serves the duration cap via maxDurationSec (env-configurable, default 120)", () => {
    const d = NODE_REGISTRY.find((n) => n.type === "generate-video-pro")
    // No GENERATE_VIDEO_PRO_MAX_DURATION override in the test environment, so
    // this pins the same default the pricing helper and frontend fallback use
    // (ee/billing/generate-video-pro-credits.ts, GENERATE_VIDEO_PRO_MAX_DURATION_FALLBACK
    // in frontend/src/components/editor/config-panels/video-configs.tsx).
    expect(d?.maxDurationSec).toBe(120)
  })

  it("providers are the DERIVED shared GVP list (every reference-image i2v SKU)", () => {
    const d = NODE_REGISTRY.find((n) => n.type === "generate-video-pro")
    // Single source of truth: packages/shared GVP_SUPPORTED_PROVIDERS, which is
    // derived from catalog capability (i2v + reference-image + durations) since
    // 2026-08-05 rather than hand-kept. Pinned literally here so a catalog edit
    // that changes the offered SKUs surfaces in the discovery API's own test
    // too. Ordering groups each family together with the default first.
    expect(d?.providers).toEqual([
      "seedance-2",
      "seedance-2-fast",
      "seedance-2-mini",
      "minimax-h3",
      "veo3",
      "veo3.1",
      "veo3_lite",
      "gemini-omni-video",
      "grok-i2v",
      "happyhorse-ref2v",
    ])
    // kling-3-omni is deliberately absent: it passes every capability check
    // but has no working dispatch path (VIDEO_PROVIDERS_WITHOUT_DISPATCH).
    expect(d?.providers).not.toContain("kling-3-omni")
  })

  it("names the offered models whose duration menu is SPARSE", () => {
    // Consumers use this to say that such a model renders in fixed clip
    // lengths, so its parts cannot land exactly on the scene cuts. Derived
    // from the catalog, never hand-kept — same rule as `providers` above.
    const d = NODE_REGISTRY.find((n) => n.type === "generate-video-pro")
    expect(d?.sparseProviders).toEqual(["veo3", "veo3.1", "veo3_lite", "gemini-omni-video", "grok-i2v"])
    // Every entry is actually offered, and actually sparse...
    for (const id of d!.sparseProviders!) {
      expect(d!.providers).toContain(id)
      expect(hasContiguousSegmentDurations(id)).toBe(false)
    }
    // ...and nothing contiguous leaked in.
    for (const id of d!.providers!) {
      if (!d!.sparseProviders!.includes(id)) expect(hasContiguousSegmentDurations(id)).toBe(true)
    }
  })

  it("edit-video-pro stays Seedance-only (no minimax-h3 — no v2v mode / -ref axis)", () => {
    const d = NODE_REGISTRY.find((n) => n.type === "edit-video-pro")
    expect(d?.providers).toEqual(["seedance-2", "seedance-2-fast", "seedance-2-mini"])
    expect(d?.providers).not.toContain("minimax-h3")
  })

  it("exposes the expected inputSchema fields", () => {
    const d = NODE_REGISTRY.find((n) => n.type === "generate-video-pro")
    const keys = d?.inputSchema?.fields.map((f) => f.key) ?? []
    expect(keys).toEqual(
      expect.arrayContaining(["prompt", "provider", "duration", "aspectRatio", "resolution", "generateAudio", "noBackgroundMusic", "preferredSegmentSec", "segmentDurations"]),
    )
  })
})
