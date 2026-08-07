import { describe, it, expect } from "vitest"
import { GVP_ANCHOR_CHOICES, resolveGvpAnchorWire, type GvpAnchorChoice } from "../model-constants.js"

/**
 * The keyframes anchor lever: the node stores a product choice, the plugin
 * wire speaks its own chain-mode vocabulary, and `resolveGvpAnchorWire` is the
 * ONE translation both send paths (canvas Run, DAG payload-builder) share.
 *
 * The invariant these tests defend is that the two vocabularies stay wired
 * together — a choice added to `GVP_ANCHOR_CHOICES` without a matching switch
 * case would otherwise fall through to `undefined` and silently render as
 * "auto", which looks exactly like a working feature until someone compares
 * two renders.
 */
describe("resolveGvpAnchorWire", () => {
  it("sends nothing for auto, so payloads stay byte-identical to pre-lever runs", () => {
    expect(resolveGvpAnchorWire("auto")).toBeUndefined()
    expect(resolveGvpAnchorWire(undefined)).toBeUndefined()
  })

  it("maps each explicit choice to its engine chain mode", () => {
    expect(resolveGvpAnchorWire("start-end")).toBe("upfront")
    expect(resolveGvpAnchorWire("start-only")).toBe("progressive")
    expect(resolveGvpAnchorWire("reference")).toBe("none")
  })

  it("resolves EVERY non-auto choice to a defined mode (totality guard)", () => {
    // Adding a choice to GVP_ANCHOR_CHOICES without extending the switch fails
    // here rather than shipping a dropdown entry that quietly does nothing.
    for (const choice of GVP_ANCHOR_CHOICES) {
      const wire = resolveGvpAnchorWire(choice)
      if (choice === "auto") expect(wire, choice).toBeUndefined()
      else expect(wire, choice).toBeDefined()
    }
  })

  it("only ever emits vocabulary the plugin route's enum accepts", () => {
    // Mirrors `anchorMode: z.enum(["upfront","progressive","none"])` in the
    // plugin's generate-video-pro route — a value outside it is a 400 on every
    // run, so the mapping is pinned here as well as at the call sites.
    const accepted = new Set(["upfront", "progressive", "none"])
    for (const choice of GVP_ANCHOR_CHOICES) {
      const wire = resolveGvpAnchorWire(choice)
      if (wire !== undefined) expect(accepted.has(wire), `${choice} → ${wire}`).toBe(true)
    }
  })

  it("treats unknown/stale stored values as auto rather than guessing", () => {
    // Node data is user-editable JSON and survives across releases; a value
    // this build has never heard of must degrade to the engine default, never
    // to an arbitrary mode that would bill a different render.
    for (const stale of ["", "upfront", "progressive", "none", "start_end", "nonsense"]) {
      expect(resolveGvpAnchorWire(stale), stale).toBeUndefined()
    }
  })

  it("keeps auto first, so the default choice heads the panel dropdown", () => {
    expect(GVP_ANCHOR_CHOICES[0]).toBe("auto")
  })

  it("exposes the choice list as the single runtime source for the type", () => {
    const choices: readonly GvpAnchorChoice[] = GVP_ANCHOR_CHOICES
    expect(new Set(choices).size).toBe(GVP_ANCHOR_CHOICES.length)
  })
})
