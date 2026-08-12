import { describe, it, expect } from "vitest"
import {
  deriveReferences,
  deriveTutorialGraph,
  tokenizePrompt,
} from "../derive-tutorial-data"
import type { WorkflowNode, WorkflowEdge } from "@/types/nodes"

const upload = (id: string, label: string, url?: string) =>
  ({
    id,
    type: "upload-image",
    position: { x: 0, y: 0 },
    data: { label, ...(url ? { url } : {}) },
  }) as unknown as WorkflowNode

const edge = (source: string, target = "gen", targetHandle = "references") =>
  ({ id: `e-${source}`, source, target, targetHandle }) as unknown as WorkflowEdge

describe("deriveReferences", () => {
  // The whole lesson is that the number is a POSITION, set by the order the
  // connections were made. If this ever sorted by id or label the tutorial
  // would teach the wrong rule while still looking correct.
  it("numbers references by edge order, not by node id or label", () => {
    const nodes = [upload("node_12", "Ryan"), upload("node_7", "Jessica"), upload("node_3", "Emily")]
    const edges = [edge("node_12"), edge("node_7"), edge("node_3")]
    expect(deriveReferences(nodes, edges, "gen").map((r) => [r.position, r.name])).toEqual([
      [1, "Ryan"],
      [2, "Jessica"],
      [3, "Emily"],
    ])
  })

  it("renumbers when the edge order changes", () => {
    const nodes = [upload("a", "First"), upload("b", "Second")]
    expect(deriveReferences(nodes, [edge("b"), edge("a")], "gen").map((r) => r.name)).toEqual([
      "Second",
      "First",
    ])
  })

  it("ignores edges into other nodes and other handles", () => {
    const nodes = [upload("a", "Wanted"), upload("b", "OtherNode"), upload("c", "OtherHandle")]
    const edges = [edge("a"), edge("b", "somewhere-else"), edge("c", "gen", "mask")]
    expect(deriveReferences(nodes, edges, "gen").map((r) => r.name)).toEqual(["Wanted"])
  })

  it("skips edges whose source node is missing from the snapshot", () => {
    expect(deriveReferences([upload("a", "A")], [edge("ghost"), edge("a")], "gen")).toHaveLength(1)
  })

  it("prefers a generated result thumbnail over the raw url", () => {
    const node = {
      id: "a",
      type: "upload-image",
      position: { x: 0, y: 0 },
      data: {
        label: "A",
        url: "https://cdn/full.png",
        generatedResults: [{ url: "https://cdn/r.png", thumbnailUrl: "https://cdn/t.jpg" }],
      },
    } as unknown as WorkflowNode
    expect(deriveReferences([node], [edge("a")], "gen")[0].imageUrl).toBe("https://cdn/t.jpg")
  })

  it("falls back to a positional name when a node has no label", () => {
    const node = { id: "a", type: "upload-image", position: { x: 0, y: 0 }, data: {} } as unknown as WorkflowNode
    expect(deriveReferences([node], [edge("a")], "gen")[0].name).toBe("Reference 1")
  })
})

describe("deriveTutorialGraph", () => {
  const gen = {
    id: "gen",
    type: "generate-image",
    position: { x: 0, y: 0 },
    data: {
      prompt: "{image:1} wears {image:2}",
      provider: "gpt-image-2",
      resolution: "2K",
      aspectRatio: "16:9",
      generatedResults: [{ url: "https://cdn/out.png" }],
    },
  } as unknown as WorkflowNode

  it("reads the prompt, result and model chips off the consuming node", () => {
    const graph = deriveTutorialGraph([gen, upload("a", "A")], [edge("a")])
    expect(graph.prompt).toBe("{image:1} wears {image:2}")
    expect(graph.resultImageUrl).toBe("https://cdn/out.png")
    expect(graph.modelChips).toEqual(["GPT Image 2", "2K", "16:9"])
    expect(graph.references).toHaveLength(1)
  })

  it("omits chips the node does not define rather than rendering blanks", () => {
    const bare = {
      id: "gen",
      type: "generate-image",
      position: { x: 0, y: 0 },
      data: { prompt: "x", provider: "flux" },
    } as unknown as WorkflowNode
    expect(deriveTutorialGraph([bare], []).modelChips).toEqual(["Flux"])
  })

  it("returns an empty graph when the snapshot has no such node", () => {
    const graph = deriveTutorialGraph([upload("a", "A")], [])
    expect(graph).toEqual({
      references: [],
      prompt: "",
      resultImageUrl: null,
      modelChips: [],
      consumerNodeId: null,
    })
  })
})

describe("tokenizePrompt", () => {
  it("splits tokens out while preserving the text exactly", () => {
    const prompt = "Put {image:1} beside {image:12}."
    const parts = tokenizePrompt(prompt)
    expect(parts.map((p) => p.text).join("")).toBe(prompt)
    expect(parts.filter((p) => p.token !== null).map((p) => p.token)).toEqual([1, 12])
  })

  it("leaves a prompt with no tokens as a single run", () => {
    expect(tokenizePrompt("just words")).toEqual([{ text: "just words", token: null }])
  })

  it("does not treat malformed tokens as references", () => {
    const parts = tokenizePrompt("{image:} and {img:1} and {image:2}")
    expect(parts.filter((p) => p.token !== null).map((p) => p.token)).toEqual([2])
  })

  it("produces no empty runs for a prompt that is only a token", () => {
    expect(tokenizePrompt("{image:3}")).toEqual([{ text: "{image:3}", token: 3 }])
  })
})
