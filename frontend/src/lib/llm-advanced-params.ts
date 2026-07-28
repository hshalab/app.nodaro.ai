/**
 * The Advanced-mode params every LLM node must send on the CANVAS path.
 *
 * The orchestrated path has `llmNodeParams` in
 * `backend/src/services/workflow-engine/node-executor.ts`; this is its
 * counterpart for single-node Run. They existed asymmetrically once: the
 * orchestrator forwarded `advancedMode` while every canvas wrapper dropped it,
 * so the node badge showed the bumped price, the guard reserved the lower tier,
 * and the request quietly stayed on the aggregator with the user's temperature
 * and effort discarded. One helper on each side, and a test per side.
 */
export interface LlmAdvancedParams {
  advancedMode?: boolean
  temperature?: number
  maxTokens?: number
}

/** Pull the Advanced-mode trio off a node's data for an API call. */
export function llmAdvancedParams(data: Record<string, unknown> | undefined): LlmAdvancedParams {
  return {
    advancedMode: data?.advancedMode === true ? true : undefined,
    temperature: typeof data?.temperature === "number" ? data.temperature : undefined,
    maxTokens: typeof data?.maxTokens === "number" ? data.maxTokens : undefined,
  }
}
