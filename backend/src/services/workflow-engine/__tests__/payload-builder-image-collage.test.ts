/**
 * Payload-builder tests for the `image-collage` ordering + size-hint seam.
 *
 * The config panel's Connected Images list persists a user ordering as
 * `data.imageOrder` (SOURCE NODE IDS — the `in` handle's parallel order
 * field) and per-input size hints as `data.imageSizeBySource`. buildPayload
 * aligns both to the accumulated wire order via
 * `resolvedInputs.imageUrlsWithSourceIds`. Unlike combine-videos' clipOrder,
 * ONE collage source can contribute SEVERAL images (a List) — a listed
 * source moves ALL its entries as a contiguous block. These tests pin that
 * contract (mirrored in frontend execute-node.ts).
 */
import { describe, it, expect } from "vitest"
import { buildPayload } from "../payload-builder.js"
import type { SimpleNode } from "../types.js"

function node(id: string, data: Record<string, unknown> = {}): SimpleNode {
  return { id, type: "image-collage", data }
}

const A1 = "https://media.nodaro.ai/a1.png"
const B1 = "https://media.nodaro.ai/b1.png"
const L1 = "https://media.nodaro.ai/l1.png"
const L2 = "https://media.nodaro.ai/l2.png"

/** Two single-image producers + one List contributing two images. */
const WIRE = {
  imageUrls: [A1, L1, L2, B1],
  imageUrlsWithSourceIds: [
    { nodeId: "srcA", url: A1 },
    { nodeId: "list", url: L1 },
    { nodeId: "list", url: L2 },
    { nodeId: "srcB", url: B1 },
  ],
}

describe("buildPayload — image-collage ordering + size hints", () => {
  it("keeps wire order when no imageOrder is configured", () => {
    const result = buildPayload(node("c1"), "job1", { ...WIRE }, "usage1")
    expect(result.payload.imageUrls).toEqual([A1, L1, L2, B1])
    expect(result.payload.imageSizes).toBeUndefined()
  })

  it("applies imageOrder with a List source moving as ONE contiguous block", () => {
    const n = node("c1", { imageOrder: ["srcB", "list", "srcA"] })
    const result = buildPayload(n, "job1", { ...WIRE }, "usage1")
    expect(result.payload.imageUrls).toEqual([B1, L1, L2, A1])
  })

  it("appends sources missing from imageOrder in wire order", () => {
    const n = node("c1", { imageOrder: ["srcB"] })
    const result = buildPayload(n, "job1", { ...WIRE }, "usage1")
    expect(result.payload.imageUrls).toEqual([B1, A1, L1, L2])
  })

  it("size hints follow their source through the reorder", () => {
    const n = node("c1", {
      imageOrder: ["list", "srcA", "srcB"],
      imageSizeBySource: { srcA: 1, list: 3 },
    })
    const result = buildPayload(n, "job1", { ...WIRE }, "usage1")
    expect(result.payload.imageUrls).toEqual([L1, L2, A1, B1])
    // list images small (3,3), srcA big (1), srcB unset → auto (0)
    expect(result.payload.imageSizes).toEqual([3, 3, 1, 0])
  })

  it("ignores stale ids (disconnected sources) in imageOrder", () => {
    const n = node("c1", { imageOrder: ["gone", "srcB", "list", "srcA"] })
    const result = buildPayload(n, "job1", { ...WIRE }, "usage1")
    expect(result.payload.imageUrls).toEqual([B1, L1, L2, A1])
  })

  it("leaves order untouched when imageUrlsWithSourceIds is absent or misaligned", () => {
    const n = node("c1", { imageOrder: ["srcB", "srcA"] })
    const noIds = buildPayload(n, "job1", { imageUrls: [A1, B1] }, "usage1")
    expect(noIds.payload.imageUrls).toEqual([A1, B1])
    const misaligned = buildPayload(
      n,
      "job1",
      { imageUrls: [A1, B1], imageUrlsWithSourceIds: [{ nodeId: "srcA", url: A1 }] },
      "usage1",
    )
    expect(misaligned.payload.imageUrls).toEqual([A1, B1])
  })
})
