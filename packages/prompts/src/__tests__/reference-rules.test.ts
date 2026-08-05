import { describe, it, expect } from "vitest"
import {
  REFERENCE_RULES,
  REFERENCE_RULES_MULTI_PERSON,
  SCENE_FRAME_RULE,
  FILM_STILL_PREFIX,
  CINEMATIC_LOOK_TAIL,
  referenceRulesBlock,
} from "../reference-rules.js"
import { FACTORY_SNIPPETS } from "../factory-snippets/catalog.js"

/**
 * These pin the OUTCOME of a measurement, not a preference — 36 draws on
 * gpt-image-2 against a four-reference brief with wardrobe swapped between two
 * people (see reference-rules.ts for the arms and the counts). Changing any of
 * these strings without re-running that comparison is how the two wordings
 * drifted apart in the first place.
 */
describe("REFERENCE_RULES is the short block — the default follows the population", () => {
  it("keeps the default-deny, the likeness rule and the compose clause", () => {
    expect(REFERENCE_RULES).toContain("Do not use anything from reference images unless specified explicitly.")
    expect(REFERENCE_RULES).toContain("All elements taken from reference images must preserve likeness.")
    expect(REFERENCE_RULES).toContain("Compose them naturally into a single image.")
  })

  it("carries NO face clauses — they are dead weight on a product or a landscape", () => {
    // The default lands on every brief. Tal's volume of real jobs says the
    // short block wins in general; the controlled brief that favoured the face
    // clauses had two faces swapping a garment, which is what MULTI_PERSON is
    // for. Both results stand; this is the one that has to be safe everywhere.
    expect(REFERENCE_RULES).not.toContain("face structure")
    expect(REFERENCE_RULES).not.toContain("blend faces")
  })

  it("MULTI_PERSON adds exactly the two face clauses and nothing else", () => {
    expect(REFERENCE_RULES_MULTI_PERSON).toContain("Do not alter face structure.")
    expect(REFERENCE_RULES_MULTI_PERSON).toContain("Do not blend faces.")
    expect(REFERENCE_RULES_MULTI_PERSON).toContain("Compose them naturally into a single image.")
  })

  it("neither block carries the performance clause — a composite has no scene to perform", () => {
    // That clause belongs to gvp's scene lane, where a subject acts a beat.
    // Here it replaced the compose clause and scored 1/4 against 4/4.
    for (const block of [REFERENCE_RULES, REFERENCE_RULES_MULTI_PERSON]) {
      expect(block).not.toContain("Expression, gaze and pose follow the scene")
    }
  })

  it("does not claim a medium, a genre or a mood", () => {
    // Every arm that described what the picture IS cost reference fidelity —
    // "scene start frame of a video" lost the lead's identity in 3 of 3.
    for (const banned of ["film", "video", "cinematic", "candid", "photo"]) {
      expect(REFERENCE_RULES.toLowerCase()).not.toContain(banned)
      expect(REFERENCE_RULES_MULTI_PERSON.toLowerCase()).not.toContain(banned)
    }
  })
})

describe("SCENE_FRAME_RULE is the short negative, and stays short", () => {
  it("is exactly the sentence that measured free", () => {
    expect(SCENE_FRAME_RULE).toBe("Nobody looks at the camera.")
  })

  it("constrains the eyeline and nothing else", () => {
    // The longer phrasings ("a candid moment, unposed, nobody aware of the
    // camera") fixed the gaze and lost a face. Length IS the failure mode.
    expect(SCENE_FRAME_RULE.split(" ")).toHaveLength(5)
    for (const banned of ["film", "cinematic", "candid", "unposed", "movie"]) {
      expect(SCENE_FRAME_RULE.toLowerCase()).not.toContain(banned)
    }
  })
})

describe("referenceRulesBlock resolves the two toggles independently", () => {
  it("defaults to the rules alone — the eyeline is a creative choice, not a rule", () => {
    expect(referenceRulesBlock()).toBe(REFERENCE_RULES)
    expect(referenceRulesBlock({})).toBe(REFERENCE_RULES)
    expect(referenceRulesBlock()).not.toContain(SCENE_FRAME_RULE)
  })

  it("adds the eyeline rule only when asked", () => {
    const both = referenceRulesBlock({ sceneFrame: true })
    expect(both).toContain(REFERENCE_RULES)
    expect(both).toContain(SCENE_FRAME_RULE)
    expect(both.indexOf(REFERENCE_RULES)).toBeLessThan(both.indexOf(SCENE_FRAME_RULE))
  })

  it("returns EMPTY when everything is off, so a caller can prepend blind", () => {
    expect(referenceRulesBlock({ referenceRules: false })).toBe("")
    expect(referenceRulesBlock({ referenceRules: false, sceneFrame: false })).toBe("")
  })

  it("can emit the eyeline rule alone", () => {
    expect(referenceRulesBlock({ referenceRules: false, sceneFrame: true })).toBe(SCENE_FRAME_RULE)
  })
})

describe("the snippet catalog and the injected default cannot drift", () => {
  const byId = (id: string) => FACTORY_SNIPPETS.find((s) => s.id === id)

  it("Reference Lock IS the default constant, not a hand-kept twin", () => {
    // The bug this closes: the catalog carried its own wording, written without
    // knowledge of gvp's, and scored 0/4 where the merged block scored 4/4.
    expect(byId("reference-lock")?.text).toBe(REFERENCE_RULES)
  })

  it("Scene Frame IS the constant, and is a SEPARATE entry", () => {
    expect(byId("scene-frame")?.text).toBe(SCENE_FRAME_RULE)
    expect(byId("reference-lock")?.text).not.toContain(SCENE_FRAME_RULE)
  })

  it("both sit in the Reference locks category, for images", () => {
    for (const id of ["reference-lock", "scene-frame"]) {
      expect(byId(id)?.category).toBe("Reference locks")
      expect(byId(id)?.target).toBe("prompt")
    }
  })
})

/**
 * END TO END through the assembler, because the block is only worth anything
 * if it arrives AHEAD of the lettered scene it talks about. "Reference image A"
 * is a hybrid phrase — rules prepended to a legacy assembly would be telling
 * the model to obey bindings that were never lettered.
 */
describe("the block reaches the prompt ahead of the scene it governs", () => {
  const ref = (id: string, url: string) =>
    ({ id, defaultName: id, source: "manual" as const, url })

  it("prepends the measured wording, then the lettered scene", async () => {
    const { buildImagePrompt } = await import("../prompt-builder.js")
    const { prompt } = buildImagePrompt({
      provider: "gpt-image-2",
      prompt: "{image:1:person} wears {image:2:clothes}.",
      connectedReferences: [ref("a", "https://r2/a.png"), ref("b", "https://r2/b.png")],
      referenceFormat: "hybrid",
      referenceLockSnippet: referenceRulesBlock({ sceneFrame: true }),
    })
    expect(prompt.startsWith(REFERENCE_RULES)).toBe(true)
    expect(prompt).toContain(SCENE_FRAME_RULE)
    // The rules come FIRST; the bindings they govern come after.
    expect(prompt.indexOf(SCENE_FRAME_RULE)).toBeLessThan(prompt.indexOf("reference image A"))
    // Line-initial is capitalized by the hybrid scene builder.
    expect(prompt).toContain("The person from reference image A wears the clothes from reference image B.")
  })

  it("leaves the prompt untouched when the caller turned both off", async () => {
    const { buildImagePrompt } = await import("../prompt-builder.js")
    const snippet = referenceRulesBlock({ referenceRules: false })
    const { prompt } = buildImagePrompt({
      provider: "gpt-image-2",
      prompt: "{image:1:person} sits.",
      connectedReferences: [ref("a", "https://r2/a.png")],
      referenceFormat: "hybrid",
      ...(snippet ? { referenceLockSnippet: snippet } : {}),
    })
    expect(prompt).not.toContain("Do not take anything")
    expect(prompt).not.toContain("Nobody looks at the camera")
  })
})


/**
 * THE ONE RULE ALL OF TONIGHT'S ARMS TURNED OUT TO BE: position decides whether
 * an instruction helps or fights the reference bindings.
 *
 *   rules FIRST · framing as a PREFIX · look LAST · never a claim in the middle
 *
 * "This image is a scene start frame of a video." is the middle-claim shape and
 * it cost the lead's identity in 3 of 3 draws. "Film still of" is the prefix
 * shape and costs nothing. The look tail is the last-position shape and costs
 * nothing. gvp found the last one independently: "THE MEDIUM GOES LAST".
 */
describe("the framing prefix and the look tail keep their shapes", () => {
  it("the framing snippet is a PREFIX, not a sentence", () => {
    // A fragment, so it swallows the scene that follows. A full stop here would
    // make it a standalone claim — the shape that lost the references.
    expect(FILM_STILL_PREFIX).toBe("Cinematic film still of")
    expect(FILM_STILL_PREFIX.endsWith(".")).toBe(false)
  })

  it("the look tail names stock, lens, light and palette", () => {
    for (const part of ["16mm", "lenses", "light", "palette"]) {
      expect(CINEMATIC_LOOK_TAIL.toLowerCase()).toContain(part)
    }
    // It is a tail — no trailing full stop, nothing after it to argue with.
    expect(CINEMATIC_LOOK_TAIL.endsWith(".")).toBe(false)
  })
})

describe("multiPerson swaps in the face clauses without touching anything else", () => {
  it("is off by default", () => {
    expect(referenceRulesBlock()).toBe(REFERENCE_RULES)
    expect(referenceRulesBlock()).not.toContain("blend faces")
  })

  it("opts into the measured composition block", () => {
    expect(referenceRulesBlock({ multiPerson: true })).toBe(REFERENCE_RULES_MULTI_PERSON)
  })

  it("still composes with the eyeline rule", () => {
    const both = referenceRulesBlock({ multiPerson: true, sceneFrame: true })
    expect(both).toContain(REFERENCE_RULES_MULTI_PERSON)
    expect(both).toContain(SCENE_FRAME_RULE)
  })

  it("stays silent when the rules are off, whatever multiPerson says", () => {
    expect(referenceRulesBlock({ referenceRules: false, multiPerson: true })).toBe("")
  })
})

describe("filmStillPrefix leads with the shot size", () => {
  it("puts the framing first, then the fixed tail", async () => {
    const { filmStillPrefix } = await import("../reference-rules.js")
    expect(filmStillPrefix("Extreme wide")).toBe("Extreme wide cinematic film still of")
    expect(filmStillPrefix("Medium close-up")).toBe("Medium close-up cinematic film still of")
  })

  it("falls back to the bare prefix when no shot is given", async () => {
    const { filmStillPrefix } = await import("../reference-rules.js")
    expect(filmStillPrefix()).toBe(FILM_STILL_PREFIX)
    expect(filmStillPrefix("   ")).toBe(FILM_STILL_PREFIX)
  })

  it("never ends in a full stop — it must swallow the scene, not stand alone", async () => {
    const { filmStillPrefix } = await import("../reference-rules.js")
    for (const shot of [undefined, "Extreme wide", "Close-up"]) {
      expect(filmStillPrefix(shot).endsWith(".")).toBe(false)
    }
  })
})
