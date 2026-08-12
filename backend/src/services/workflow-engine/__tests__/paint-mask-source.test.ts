/**
 * paint-mask — source-node contract.
 *
 * The node never executes: the hand-painted `data.maskUrl` IS its output.
 * These tests pin the three legs that make that work end-to-end in the
 * backend engine:
 *   1. classification — isSourceNode("paint-mask") so the orchestrator never
 *      enqueues a job for it (payload-builder would throw "Unknown node type");
 *   2. extraction — extractSourceNodeOutput surfaces { maskUrl } and
 *      getPrimaryOutput routes the `mask` source handle to it;
 *   3. resolution — a downstream node's `mask` target handle receives the
 *      painted URL with NO execution state present (the source-node path).
 */
import { describe, it, expect } from "vitest"
import { isSourceNode } from "../execution-graph.js"
import { extractSourceNodeOutput, getPrimaryOutput } from "../output-extractor.js"
import { resolveNodeInputs } from "../input-resolver.js"
import type { SimpleNode, SimpleEdge, NodeExecutionState } from "../types.js"

function node(id: string, type: string, data: Record<string, unknown> = {}): SimpleNode {
  return { id, type, data: { label: id, ...data } }
}

function edge(
  source: string,
  target: string,
  sourceHandle?: string | null,
  targetHandle?: string | null,
): SimpleEdge {
  return {
    id: `${source}->${target}`,
    source,
    target,
    sourceHandle: sourceHandle ?? null,
    targetHandle: targetHandle ?? null,
  }
}

describe("paint-mask source-node contract", () => {
  it("is classified as a source node (never enqueued)", () => {
    expect(isSourceNode("paint-mask")).toBe(true)
  })

  it("extractSourceNodeOutput surfaces the painted maskUrl", () => {
    const out = extractSourceNodeOutput(node("p", "paint-mask", { maskUrl: "https://r2/painted.png" }))
    expect(out).toEqual({ maskUrl: "https://r2/painted.png" })
  })

  it("extractSourceNodeOutput returns undefined when nothing painted yet", () => {
    expect(extractSourceNodeOutput(node("p", "paint-mask"))).toBeUndefined()
    expect(extractSourceNodeOutput(node("p", "paint-mask", { maskUrl: "  " }))).toBeUndefined()
  })

  it("getPrimaryOutput routes the 'mask' handle (and default) to maskUrl", () => {
    const out = { maskUrl: "https://r2/painted.png" }
    expect(getPrimaryOutput(out, "paint-mask", "mask")).toBe("https://r2/painted.png")
    expect(getPrimaryOutput(out, "paint-mask", undefined)).toBe("https://r2/painted.png")
  })

  it("resolves into a downstream mask target with NO execution state (source-node path)", () => {
    const src = node("p", "paint-mask", { maskUrl: "https://r2/painted.png" })
    const target = node("t", "modify-image")
    const edges = [edge("p", "t", "mask", "mask")]
    const states: Record<string, NodeExecutionState> = {}

    const result = resolveNodeInputs(target, edges, states, [src, target])
    expect(result.maskUrl).toBe("https://r2/painted.png")
  })

  it("wired painted mask into a generic image input routes as an image URL", () => {
    const src = node("p", "paint-mask", { maskUrl: "https://r2/painted.png" })
    const target = node("t", "upscale-image")
    const edges = [edge("p", "t", "mask", "image")]
    const states: Record<string, NodeExecutionState> = {}

    const result = resolveNodeInputs(target, edges, states, [src, target])
    expect(result.imageUrl).toBe("https://r2/painted.png")
  })
})
