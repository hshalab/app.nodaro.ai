import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import {
  CLOUD_ONLY_NODE_TYPES,
  cloudOnlyRejectionMessage,
  findCloudOnlyNodeTypes,
} from "../cloud-only-nodes.js"

/**
 * The backend gate (`GET /v1/nodes`) and the frontend gate (the node pickers)
 * read two different files. Nothing stops someone adding a Cloud-only node to
 * one and forgetting the other — and the two failure modes are both silent:
 * a node offered in the picker that 404s on run, or a node the SDK/MCP is told
 * exists that the editor hides.
 *
 * They stay separate files by design (packages/shared is published Apache-2.0
 * and this is edition gating, not public contract), so this test is what makes
 * the pair an invariant instead of a convention.
 */
const FRONTEND_SOURCE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../frontend/src/lib/cloud-only-nodes.ts",
)

function parseFrontendSet(source: string): Set<string> {
  const block = source.match(/CLOUD_ONLY_NODE_TYPES[^=]*=\s*new Set\(\[([\s\S]*?)\]\)/)
  if (!block) throw new Error("could not locate CLOUD_ONLY_NODE_TYPES in the frontend module")
  // Only string literals — comments in the block are ignored by construction.
  const withoutComments = block[1]
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "")
  return new Set([...withoutComments.matchAll(/"([^"]+)"/g)].map((m) => m[1]))
}

describe("cloud-only node gating stays in step across the stack", () => {
  it("the backend set and the frontend set are identical", () => {
    const frontend = parseFrontendSet(readFileSync(FRONTEND_SOURCE, "utf8"))
    expect([...frontend].sort()).toEqual([...CLOUD_ONLY_NODE_TYPES].sort())
  })

  it("parses a non-empty set (guards the parser itself from silently matching nothing)", () => {
    const frontend = parseFrontendSet(readFileSync(FRONTEND_SOURCE, "utf8"))
    expect(frontend.size).toBeGreaterThan(0)
    expect(frontend.has("voice-changer-pro")).toBe(true)
  })
})

describe("findCloudOnlyNodeTypes — the import / MCP / template door", () => {
  it("names every distinct cloud-only type present, once", () => {
    expect(
      findCloudOnlyNodeTypes([
        { type: "generate-image" },
        { type: "video-analysis" },
        { type: "video-analysis" },
        { type: "voice-changer-pro" },
      ]).sort(),
    ).toEqual(["video-analysis", "voice-changer-pro"])
  })

  it("is quiet for ordinary workflows and empty input", () => {
    expect(findCloudOnlyNodeTypes([{ type: "generate-image" }, { type: "text-prompt" }])).toEqual([])
    expect(findCloudOnlyNodeTypes([])).toEqual([])
    expect(findCloudOnlyNodeTypes(undefined)).toEqual([])
  })

  it("ignores malformed entries instead of throwing on them", () => {
    expect(findCloudOnlyNodeTypes([{}, { type: 42 as unknown as string }, { type: "video-audit" }])).toEqual([
      "video-audit",
    ])
  })

  it("the refusal names the offending types and stays singular/plural correct", () => {
    expect(cloudOnlyRejectionMessage(["video-analysis"])).toContain("a node that runs")
    expect(cloudOnlyRejectionMessage(["video-analysis"])).toContain("video-analysis")
    const many = cloudOnlyRejectionMessage(["video-analysis", "video-audit"])
    expect(many).toContain("nodes that run")
    expect(many).toContain("video-audit")
  })
})
