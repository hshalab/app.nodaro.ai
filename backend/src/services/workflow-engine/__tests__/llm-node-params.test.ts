/**
 * Orchestrated runs must forward every LLM knob that single-node Run forwards.
 *
 * This guards a specific, silent failure: `buildSyncHttpBody` used to hand-write
 * `llmModel` + `reasoningEffort` once per LLM node type — eleven copies. Adding
 * a knob to ten of them left the eleventh quietly ignoring the setting during a
 * workflow run while its Run button honoured it. Same node, same config,
 * different output AND different billing, with nothing to catch it.
 *
 * The fix was one `llmNodeParams` helper; this test is what keeps it one.
 */
import { describe, it, expect } from "vitest"
import { buildSyncHttpBody, llmNodeParams } from "../node-executor.js"
import type { SimpleNode } from "../types.js"

/** Every node type whose route accepts LLM params and is dispatched over sync HTTP. */
const LLM_SYNC_NODE_TYPES = [
  "ai-writer",
  "llm-chat",
  "image-to-text",
  "qa-check",
  "image-critic",
  "describe-to-picker",
  "video-composer",
  "after-effects",
  "lottie-overlay",
  "3d-title",
  "motion-graphics",
] as const

const CTX = { userId: "00000000-0000-0000-0000-000000000000" } as never

function bodyFor(type: string, data: Record<string, unknown>) {
  const node = { id: "n1", type, data } as unknown as SimpleNode
  return buildSyncHttpBody(node, {} as never, CTX)
}

describe("llmNodeParams", () => {
  it("carries every knob the routes accept", () => {
    expect(Object.keys(llmNodeParams({}))).toEqual([
      "llmModel",
      "reasoningEffort",
      "advancedMode",
      "temperature",
      "maxTokens",
    ])
  })

  it("passes values through untouched", () => {
    expect(llmNodeParams({ llmModel: "gemini-3.6-flash", advancedMode: true, temperature: 1.1, maxTokens: 999 }))
      .toMatchObject({ llmModel: "gemini-3.6-flash", advancedMode: true, temperature: 1.1, maxTokens: 999 })
  })
})

describe("every LLM node forwards advancedMode in an orchestrated run", () => {
  it.each(LLM_SYNC_NODE_TYPES)("%s", (type) => {
    const body = bodyFor(type, { advancedMode: true, llmModel: "gemini-3.6-flash", reasoningEffort: "high" })
    // The whole point: a node type that stops forwarding this diverges from
    // single-node Run silently, so assert presence rather than truthiness.
    expect(Object.hasOwn(body, "advancedMode"), `${type} must forward advancedMode`).toBe(true)
    expect(body.advancedMode, `${type} must forward the value`).toBe(true)
    expect(body.llmModel).toBe("gemini-3.6-flash")
    expect(body.reasoningEffort).toBe("high")
  })

  it.each(LLM_SYNC_NODE_TYPES)("%s forwards the sampling levers too", (type) => {
    const body = bodyFor(type, { advancedMode: true, temperature: 1.4, maxTokens: 4096 })
    // Without these, Advanced mode's sliders would do nothing in a workflow run
    // even though the toggle reached the route.
    expect(body.temperature, `${type} temperature`).toBe(1.4)
    expect(body.maxTokens, `${type} maxTokens`).toBe(4096)
  })

  it("omits nothing when the node has no LLM config at all", () => {
    const body = bodyFor("qa-check", {})
    expect(Object.hasOwn(body, "advancedMode")).toBe(true)
    expect(body.advancedMode).toBeUndefined()
  })
})
