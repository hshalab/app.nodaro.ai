// Split the Suno template into its runs.
//
// The template is the same idea run several times over, each run changing one
// thing. Nothing about that is written down in the workflow, so it is derived:
// one run per Suno Generate node, ordered down the canvas, with the style nodes
// feeding it. Deriving means adding a run to the template adds it here too.

import { nodeMedia, nodeField } from "../derive-tutorial-data"
import { nodePicks } from "./person-node-picks"
import type { WorkflowNode, WorkflowEdge } from "@/types/nodes"

export interface SunoInput {
  id: string
  /** Node type, e.g. "music-genre". */
  kind: string
  picks: string[]
}

export interface SunoRun {
  id: string
  inputs: SunoInput[]
  audioUrl: string | null
  prompt: string
  instrumental: boolean
  model: string | null
  /** Every pick across the run's style nodes — what Suno is told to make. */
  styleDescription: string
}

const GENERATOR = "suno-generate"

/** The style-node families the tutorial shows, in the order they read. */
export const INPUT_ORDER = [
  "music-genre",
  "music-mood",
  "instrumentation",
  "voice-character",
  "voice-delivery",
]

function orderOf(kind: string): number {
  const i = INPUT_ORDER.indexOf(kind)
  return i === -1 ? INPUT_ORDER.length : i
}

export function deriveSunoRuns(nodes: WorkflowNode[], edges: WorkflowEdge[]): SunoRun[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))

  const generators = nodes
    .filter((n) => n.type === GENERATOR)
    .sort((a, b) => (a.position?.y ?? 0) - (b.position?.y ?? 0))

  const runs: SunoRun[] = []
  for (const gen of generators) {
    const inputs: SunoInput[] = []
    for (const edge of edges) {
      if (edge.target !== gen.id) continue
      const src = byId.get(edge.source)
      if (!src?.type || !INPUT_ORDER.includes(src.type)) continue
      inputs.push({ id: src.id, kind: src.type, picks: nodePicks(src) })
    }
    inputs.sort((a, b) => orderOf(a.kind) - orderOf(b.kind))

    runs.push({
      id: gen.id,
      inputs,
      audioUrl: nodeMedia(gen),
      prompt: nodeField(gen, "prompt") ?? "",
      instrumental: nodeField(gen, "instrumental") === "true",
      model: nodeField(gen, "model"),
      // The bridge between "what you picked" and "what came out": Suno is sent
      // the picks, joined, and nothing else unless you add a prompt.
      styleDescription: inputs
        .flatMap((i) => i.picks)
        .map((p) => p.toLowerCase())
        .join(", "),
    })
  }

  // A generator fed by exactly the same nodes as the one before it is a second
  // TAKE of that run, not a new lesson — showing it as its own step would claim
  // a change that never happened.
  return runs.filter((run, i) => {
    if (i === 0) return true
    const prev = runs[i - 1].inputs.map((x) => x.id).join(",")
    return run.inputs.map((x) => x.id).join(",") !== prev
  })
}

/** What changed between two consecutive runs, in the reader's terms. */
export function describeChange(previous: SunoRun | undefined, run: SunoRun): string {
  if (!previous) return "The starting point — every option picked from a dropdown."

  const before = new Set(previous.inputs.map((i) => i.kind))
  const after = new Set(run.inputs.map((i) => i.kind))
  const added = [...after].filter((k) => !before.has(k))
  const removed = [...before].filter((k) => !after.has(k))

  const pretty = (kind: string) => kind.replace(/-/g, " ")
  if (added.length) return `Added ${added.map(pretty).join(" and ")}.`
  if (removed.length) return `Dropped ${removed.map(pretty).join(" and ")}.`
  if (run.instrumental !== previous.instrumental) {
    return run.instrumental ? "Switched to instrumental — no vocals." : "Vocals back on."
  }

  const changed = run.inputs.filter((input) => {
    const other = previous.inputs.find((p) => p.kind === input.kind)
    return other && other.picks.join("|") !== input.picks.join("|")
  })
  if (changed.length) return `Changed ${changed.map((c) => pretty(c.kind)).join(", ")}.`
  return "Same options, generated again."
}
