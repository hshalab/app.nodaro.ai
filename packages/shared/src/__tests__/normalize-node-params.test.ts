import { describe, it, expect } from "vitest"
import { normalizeNodeModelParams, MODEL_PARAM_NODE_TYPES } from "../normalize-node-params.js"

/**
 * Write-boundary guard for agent/import-authored graphs. The config panel's
 * provider-aware dropdown and its stale-value snap are React effects — they
 * only run for a node whose panel or hover strip is mounted, so a node written
 * straight into workflow JSON never meets either.
 */

const node = (id: string, type: string, data: Record<string, unknown>) => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data,
})

describe("normalizeNodeModelParams", () => {
  it("heals the exact node that aborted the 2026-08-09 run", () => {
    const { nodes, adjustments } = normalizeNodeModelParams([
      node("node_8", "generate-image", { provider: "gpt-image", aspectRatio: "16:9", resolution: "2K" }),
    ])
    const d = nodes[0].data as Record<string, unknown>
    expect(d.aspectRatio).not.toBe("16:9")
    expect(d.resolution).toBeUndefined() // GPT Image 1.5 has no resolution lever
    expect(adjustments.map((a) => a.field).sort()).toEqual(["aspectRatio", "resolution"])
    expect(adjustments[0].nodeId).toBe("node_8")
    expect(adjustments[0].provider).toBe("gpt-image")
  })

  it("leaves the sibling nodes that were already valid completely alone", () => {
    // Same workflow, the five nodes that generated fine — must be untouched,
    // and returned BY REFERENCE so a delta/CAS save sees no spurious change.
    const input = [
      node("a", "generate-image", { provider: "gpt-image-2", aspectRatio: "16:9", resolution: "2K" }),
      node("b", "generate-image", { provider: "grok", aspectRatio: "16:9" }),
    ]
    const { nodes, adjustments } = normalizeNodeModelParams(input)
    expect(adjustments).toEqual([])
    expect(nodes[0]).toBe(input[0])
    expect(nodes[1]).toBe(input[1])
  })

  it("never mutates the caller's node objects", () => {
    const input = [node("n1", "generate-image", { provider: "gpt-image", aspectRatio: "16:9" })]
    const before = JSON.parse(JSON.stringify(input))
    normalizeNodeModelParams(input)
    expect(input).toEqual(before)
  })

  it("ignores node types that carry no catalog-governed params", () => {
    const input = [
      node("t1", "text-prompt", { provider: "gpt-image", aspectRatio: "16:9" }),
      node("v1", "image-to-video", { provider: "veo3", aspectRatio: "21:9" }),
    ]
    const { nodes, adjustments } = normalizeNodeModelParams(input)
    expect(adjustments).toEqual([])
    expect(nodes).toEqual(input)
    expect(MODEL_PARAM_NODE_TYPES.has("image-to-video")).toBe(false)
  })

  it("skips multi-provider nodes rather than guessing an intersection", () => {
    const input = [
      node("m1", "generate-image", {
        providers: ["gpt-image", "gpt-image-2"],
        provider: "gpt-image",
        aspectRatio: "16:9",
      }),
    ]
    const { nodes, adjustments } = normalizeNodeModelParams(input)
    expect(adjustments).toEqual([])
    expect(nodes[0]).toBe(input[0])
  })

  it("survives malformed nodes without throwing", () => {
    const input = [
      { id: "x", type: "generate-image" },
      { id: "y", type: "generate-image", data: null },
      { id: "z", type: "generate-image", data: { provider: 42 } },
      { type: "generate-image", data: { provider: "gpt-image", aspectRatio: "16:9" } },
    ] as Array<{ id?: unknown; type?: unknown; data?: unknown }>
    expect(() => normalizeNodeModelParams(input)).not.toThrow()
    const { adjustments } = normalizeNodeModelParams(input)
    // The last entry has no id but IS healable — it reports under a placeholder.
    expect(adjustments.every((a) => typeof a.nodeId === "string")).toBe(true)
  })

  it("is idempotent — a second pass reports nothing", () => {
    const first = normalizeNodeModelParams([
      node("n1", "generate-image", { provider: "gpt-image", aspectRatio: "16:9", resolution: "2K" }),
    ])
    const second = normalizeNodeModelParams(first.nodes)
    expect(second.adjustments).toEqual([])
  })
})
