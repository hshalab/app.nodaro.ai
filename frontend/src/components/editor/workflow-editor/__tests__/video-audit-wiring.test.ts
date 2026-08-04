/**
 * The video-audit data contract, both directions:
 *
 *  IN  — the `analysis` target receives the upstream analysis as an OBJECT
 *        (the route forwards it verbatim to the plugin's schema), never the
 *        stringified form generic text consumers get, and never leaking into
 *        `prompt` (this node has no prompt). Presence/absence of that object is
 *        also what picks the credit family, so an unwired handle must leave it
 *        strictly `undefined`.
 *
 *  OUT — the corrected analysis is indistinguishable from a raw one: same
 *        stringified payload from `extractNodeOutput` on the same `json`/`text`
 *        handles, same preview classification ("data", NOT "video" — the type
 *        string contains "video", so the fallthrough would misclassify it).
 */
import { describe, it, expect, vi } from "vitest"

vi.mock("@/hooks/use-workflow-store", () => ({
  useWorkflowStore: {
    getState: vi.fn(() => ({ characterDefinitions: [], nodes: [], edges: [] })),
    setState: vi.fn(),
  },
}))

vi.mock("@/lib/prompt-builder", () => ({
  buildScenePrompt: vi.fn(() => "mock scene prompt"),
}))

import { resolveNodeInputs } from "../node-input-resolver"
import { extractNodeOutput, detectPreviewItemType } from "../execution-graph"

const ANALYSIS = {
  meta: { durationSec: 72 },
  scenes: [{ sceneNumber: 1, startSec: 0, endSec: 2.1, label: "establishing" }],
}

function makeNode(id: string, type: string, data: Record<string, unknown> = {}): any {
  return { id, type, data: { label: type, ...data }, position: { x: 0, y: 0 } }
}

function edge(source: string, target: string, targetHandle?: string, sourceHandle?: string): any {
  return { id: `${source}->${target}:${targetHandle ?? ""}`, source, target, targetHandle, sourceHandle }
}

describe("video-audit — analysis input resolution", () => {
  it("routes a wired video-analysis into inputs.analysis as an object, not a prompt", () => {
    const va = makeNode("va", "video-analysis", { generatedJson: ANALYSIS })
    const audit = makeNode("aud", "video-audit")
    const inputs = resolveNodeInputs(audit, [va, audit], [edge("va", "aud", "analysis", "json")])

    expect(inputs.analysis).toEqual(ANALYSIS)
    expect(inputs.prompt).toBeUndefined()
  })

  it("accepts another audit's corrected analysis on the same handle (audits chain)", () => {
    const upstreamAudit = makeNode("a1", "video-audit", { generatedJson: ANALYSIS })
    const audit = makeNode("a2", "video-audit")
    const inputs = resolveNodeInputs(audit, [upstreamAudit, audit], [edge("a1", "a2", "analysis", "json")])

    expect(inputs.analysis).toEqual(ANALYSIS)
  })

  it("leaves inputs.analysis undefined when nothing is wired (→ the auto credit family)", () => {
    const upload = makeNode("u1", "upload-video", { url: "https://r2/clip.mp4" })
    const audit = makeNode("aud", "video-audit")
    const inputs = resolveNodeInputs(audit, [upload, audit], [edge("u1", "aud", "video")])

    expect(inputs.analysis).toBeUndefined()
    expect(inputs.videoUrl).toBe("https://r2/clip.mp4")
  })

  it("leaves inputs.analysis undefined when the wired analysis has no result yet", () => {
    const va = makeNode("va", "video-analysis")
    const audit = makeNode("aud", "video-audit")
    const inputs = resolveNodeInputs(audit, [va, audit], [edge("va", "aud", "analysis", "json")])

    expect(inputs.analysis).toBeUndefined()
  })

  it("ignores a non-analysis producer wired into the analysis handle (stale/hand-edited edge)", () => {
    // web-scrape also stores `generatedJson`, but its shape is not a
    // VideoAnalysisResult — forwarding it would buy a schema failure at full
    // price. It must not land in `analysis`, nor fall through into `prompt`.
    const scrape = makeNode("s1", "web-scrape", { generatedJson: [{ url: "https://x" }] })
    const audit = makeNode("aud", "video-audit")
    const inputs = resolveNodeInputs(audit, [scrape, audit], [edge("s1", "aud", "analysis", "json")])

    expect(inputs.analysis).toBeUndefined()
    expect(inputs.prompt).toBeUndefined()
  })

  it("routes the video handle to videoUrl exactly as video-analysis does", () => {
    const upload = makeNode("u1", "upload-video", { url: "https://r2/clip.mp4" })
    const audit = makeNode("aud", "video-audit")
    const va = makeNode("va", "video-analysis")

    expect(resolveNodeInputs(audit, [upload, audit], [edge("u1", "aud", "video")]).videoUrl).toBe(
      resolveNodeInputs(va, [upload, va], [edge("u1", "va", "video")]).videoUrl,
    )
  })
})

describe("video-audit — analysis output contract", () => {
  it("emits the same stringified payload as video-analysis on json/text/no handle", () => {
    const audit = makeNode("aud", "video-audit", { generatedJson: ANALYSIS })
    const va = makeNode("va", "video-analysis", { generatedJson: ANALYSIS })

    for (const handle of ["json", "text", undefined]) {
      expect(extractNodeOutput(audit, handle)).toBe(extractNodeOutput(va, handle))
      expect(extractNodeOutput(audit, handle)).toBe(JSON.stringify(ANALYSIS))
    }
  })

  it("emits nothing before it has run", () => {
    expect(extractNodeOutput(makeNode("aud", "video-audit"), "json")).toBeUndefined()
  })

  it("classifies as a data preview, never a video (its type string contains 'video')", () => {
    expect(detectPreviewItemType("video-audit")).toBe("data")
    expect(detectPreviewItemType("video-audit")).toBe(detectPreviewItemType("video-analysis"))
  })

  it("feeds a downstream text consumer identically to a raw analysis", () => {
    const audit = makeNode("aud", "video-audit", { generatedJson: ANALYSIS })
    const va = makeNode("va", "video-analysis", { generatedJson: ANALYSIS })
    const consumer = makeNode("c1", "llm-chat")

    const fromAudit = resolveNodeInputs(consumer, [audit, consumer], [edge("aud", "c1", undefined, "text")])
    const fromAnalysis = resolveNodeInputs(consumer, [va, consumer], [edge("va", "c1", undefined, "text")])

    expect(fromAudit.prompt).toBe(JSON.stringify(ANALYSIS))
    expect(fromAudit.prompt).toBe(fromAnalysis.prompt)
  })
})
