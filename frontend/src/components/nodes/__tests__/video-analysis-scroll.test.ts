import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

/**
 * A scrollable pane inside a React Flow node MUST carry `nowheel`, or it does not
 * scroll at all.
 *
 * React Flow's `panOnScroll` handler (enabled on our canvas) calls
 * `preventDefault()` + `stopImmediatePropagation()` on every wheel event that is
 * not inside a `.nowheel` subtree, so the canvas pans and the overflow container
 * never receives the event. The failure is silent and easy to misread as "the
 * preview is just short": the video-analysis result tree shipped without it and
 * scrolled only in the expanded modal, which is portaled outside the canvas.
 *
 * Pinned as source text rather than a render assertion because the bug is a missing
 * CLASS NAME — a rendering test would need a real React Flow provider and wheel
 * plumbing to catch what one grep proves.
 */
const nodeSrc = readFileSync(
  resolve(__dirname, "../video-analysis-node.tsx"),
  "utf8",
)

describe("video-analysis result tree scrolling", () => {
  const pane = nodeSrc.split("\n").find((l) => l.includes("overflow-auto") && l.includes("JsonTree") === false && l.includes("rounded-md"))

  it("has an overflow pane at all", () => {
    expect(pane, "no overflow container found — did the tree move?").toBeDefined()
  })

  it("the overflow pane carries nowheel, or the canvas eats the wheel event", () => {
    expect(pane).toContain("nowheel")
  })

  it("carries nodrag so a drag selects text instead of moving the node", () => {
    expect(pane).toContain("nodrag")
  })

  it("fills the node height instead of stopping at a fixed max-height", () => {
    // `max-h-64` capped the tree at 16rem however tall the node was.
    expect(pane).toContain("flex-1")
    expect(pane).toContain("min-h-0")
    expect(pane).not.toContain("max-h-")
  })
})
