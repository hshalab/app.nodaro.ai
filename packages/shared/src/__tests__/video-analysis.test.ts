import { describe, it, expect } from "vitest"
import {
  windowAnalysisSchema, videoAnalysisResultSchema,
  deriveSlotRefs, rewriteSlotTokens, unwrapUnresolvedTokens,
  renderAnalyzedScene, isOversizedScene, aspectRatioFromDims,
  entitySlotSchema, analyzedSceneSchema,
  rewriteSceneBindings, dropUnknownBindings,
  rewriteSpeakerSlots, dropUnknownSpeakers,
  VIDEO_ANALYSIS_MAX_VARIATIONS, VIDEO_ANALYSIS_VARIATION_SLUGS, VIDEO_ANALYSIS_DEFAULT_VARIATION,
  type EntitySlot, type AudioLayer,
} from "../video-analysis.js"

const slot: EntitySlot = { slotId: "hero", label: "Protagonist", source: "wired-character", role: "person", description: "tan man, mustache, black tee" }
const baseScene = { startSec: 0, endSec: 4, label: "Hook", shotType: "Medium Close-Up", camera: "slow push-in", visual: "{slot:hero} juggles a ball", audio: [{ mode: "speech" as const, content: "As a kid…", voice: "male, warm" }] }

describe("windowAnalysisSchema", () => {
  it("accepts a zero-scene window (quiet footage is a VALID result)", () => {
    expect(windowAnalysisSchema.safeParse({ slots: [], scenes: [] }).success).toBe(true)
  })
  it("rejects endSec <= startSec", () => {
    expect(windowAnalysisSchema.safeParse({ slots: [slot], scenes: [{ ...baseScene, endSec: 0 }] }).success).toBe(false)
  })
  it("does NOT accept model-emitted oversized/slotRefs (validator-computed)", () => {
    const parsed = windowAnalysisSchema.parse({ slots: [slot], scenes: [{ ...baseScene, oversized: true, slotRefs: ["hero"] }] })
    expect((parsed.scenes[0] as Record<string, unknown>).oversized).toBeUndefined()
    expect((parsed.scenes[0] as Record<string, unknown>).slotRefs).toBeUndefined()
  })
})

describe("videoAnalysisResultSchema", () => {
  it("requires >=1 scene overall", () => {
    const meta = { durationSec: 10, width: 1920, height: 1080, aspectRatio: "16:9" }
    expect(videoAnalysisResultSchema.safeParse({ meta, slots: [], scenes: [] }).success).toBe(false)
  })
})

describe("token helpers", () => {
  it("deriveSlotRefs reads tokens from visual", () => {
    expect(deriveSlotRefs("{slot:hero} kicks; {slot:product-can} glints; {slot:hero} smiles")).toEqual(["hero", "product-can"])
  })
  it("rewriteSlotTokens renames losers to survivors", () => {
    expect(rewriteSlotTokens("{slot:man-2} runs", { "man-2": "hero" })).toBe("{slot:hero} runs")
  })
  it("unwrapUnresolvedTokens unwraps to literal text, never deletes", () => {
    const r = unwrapUnresolvedTokens("{slot:ghost} appears near {slot:hero}", new Set(["hero"]))
    expect(r.text).toBe("ghost appears near {slot:hero}")
    expect(r.unresolved).toEqual(["ghost"])
  })
  it("renderAnalyzedScene substitutes descriptions (uncast) and castMap bindings (cast)", () => {
    expect(renderAnalyzedScene({ visual: "{slot:hero} runs" }, [slot])).toBe("tan man, mustache, black tee runs")
    expect(renderAnalyzedScene({ visual: "{slot:hero} runs" }, [slot], { hero: "the person from @image_1" })).toBe("the person from @image_1 runs")
  })
})

const dreamVariation = {
  variationId: "dream",
  label: "Dream self",
  description: "tan man, mustache — flowing white robe, barefoot, hair loose (dream sequences)",
  refImageUrl: "https://cdn.example/frames/hero-dream.jpg",
}

describe("appearance variations (cast-variations spec §4)", () => {
  it("entitySlotSchema round-trips variations[] including refImageUrl", () => {
    const parsed = entitySlotSchema.parse({ ...slot, variations: [dreamVariation] })
    expect(parsed.variations).toEqual([dreamVariation])
  })
  it("absent variations stays absent (no [] materialization)", () => {
    const parsed = entitySlotSchema.parse(slot)
    expect("variations" in parsed && parsed.variations !== undefined).toBe(false)
  })
  it(`rejects more than VIDEO_ANALYSIS_MAX_VARIATIONS (${4}) — window layer rejects, merge folds`, () => {
    expect(VIDEO_ANALYSIS_MAX_VARIATIONS).toBe(4)
    const five = ["dream", "flashback", "disguise", "era", "alt-1"].map((id) => ({ ...dreamVariation, variationId: id }))
    expect(entitySlotSchema.safeParse({ ...slot, variations: five }).success).toBe(false)
  })
  it("rejects the reserved 'default' variationId inside variations[] (D9)", () => {
    expect(VIDEO_ANALYSIS_DEFAULT_VARIATION).toBe("default")
    expect(entitySlotSchema.safeParse({ ...slot, variations: [{ ...dreamVariation, variationId: "default" }] }).success).toBe(false)
  })
  it("rejects a malformed variationId (slug charset only; vocabulary is doctrine-enforced)", () => {
    expect(entitySlotSchema.safeParse({ ...slot, variations: [{ ...dreamVariation, variationId: "Dream Look" }] }).success).toBe(false)
    expect(VIDEO_ANALYSIS_VARIATION_SLUGS).toContain("dream")
    expect(VIDEO_ANALYSIS_VARIATION_SLUGS).toContain("alt-2")
  })
  it("windowAnalysisSchema scenes round-trip slotVariations; absent stays absent", () => {
    const bound = { ...baseScene, slotVariations: { hero: "dream" } }
    const parsed = windowAnalysisSchema.parse({ slots: [{ ...slot, variations: [dreamVariation] }], scenes: [bound, baseScene] })
    expect(parsed.scenes[0].slotVariations).toEqual({ hero: "dream" })
    expect(parsed.scenes[1].slotVariations).toBeUndefined()
  })
  it("analyzedSceneSchema inherits slotVariations from the same base", () => {
    const parsed = analyzedSceneSchema.parse({
      ...baseScene, sceneNumber: 1, visualResolved: "a man juggles", slotRefs: ["hero"], slotVariations: { hero: "dream" },
    })
    expect(parsed.slotVariations).toEqual({ hero: "dream" })
  })
  it("videoAnalysisResultSchema full-document round-trip with both fields", () => {
    const meta = { durationSec: 10, width: 1920, height: 1080, aspectRatio: "16:9" }
    const doc = {
      meta,
      slots: [{ ...slot, variations: [dreamVariation] }],
      scenes: [{ ...baseScene, sceneNumber: 1, visualResolved: "a man juggles", slotRefs: ["hero"], slotVariations: { hero: "dream" } }],
    }
    expect(videoAnalysisResultSchema.parse(doc)).toEqual(doc)
  })
})

describe("variationFolds (cast-variations §4/§6 — review F5)", () => {
  const meta = { durationSec: 10, width: 1920, height: 1080, aspectRatio: "16:9" }
  const doc = {
    meta,
    slots: [slot],
    scenes: [{ ...baseScene, sceneNumber: 1, visualResolved: "a man juggles", slotRefs: ["hero"] }],
  }
  it("videoAnalysisResultSchema round-trips variationFolds — strip-mode consumers keep the §6 fold note", () => {
    const withFolds = { ...doc, variationFolds: [{ slotId: "hero", variationId: "era", label: "Era" }] }
    expect(videoAnalysisResultSchema.parse(withFolds)).toEqual(withFolds)
  })
  it("absent variationFolds stays absent (no [] materialization)", () => {
    const parsed = videoAnalysisResultSchema.parse(doc)
    expect("variationFolds" in parsed && parsed.variationFolds !== undefined).toBe(false)
  })
})

describe("binding rewrite helpers (merge consumes — spec §4)", () => {
  it("rewriteSceneBindings renames slot keys and per-slot variation values", () => {
    expect(rewriteSceneBindings({ "man-2": "dream", other: "era" }, { "man-2": "hero" }, { hero: { dream: "flashback" } }))
      .toEqual({ hero: "flashback", other: "era" })
  })
  it("rewriteSceneBindings passes undefined through", () => {
    expect(rewriteSceneBindings(undefined, { a: "b" })).toBeUndefined()
  })
  it("dropUnknownBindings drops unknown (slot, variation) pairs and reports them", () => {
    const valid = new Map([["hero", new Set(["dream"])]])
    const r = dropUnknownBindings({ hero: "dream", hero2: "dream", other: "ghost" }, valid)
    expect(r.kept).toEqual({ hero: "dream" })
    expect(r.dropped).toEqual([{ slotId: "hero2", variationId: "dream" }, { slotId: "other", variationId: "ghost" }])
  })
  it("dropUnknownBindings treats 'default' as always valid for a known slot", () => {
    const valid = new Map([["hero", new Set<string>()]])
    const r = dropUnknownBindings({ hero: "default" }, valid)
    expect(r.kept).toEqual({ hero: "default" })
    expect(r.dropped).toEqual([])
  })
  it("dropUnknownBindings returns kept: undefined when nothing survives (no {} materialization)", () => {
    const r = dropUnknownBindings({ ghost: "dream" }, new Map())
    expect(r.kept).toBeUndefined()
    expect(r.dropped).toEqual([{ slotId: "ghost", variationId: "dream" }])
  })
})

describe("speech attribution (speakerSlot)", () => {
  const speech = (content: string, over: Partial<AudioLayer> = {}): AudioLayer => ({ mode: "speech", content, ...over })

  it("rides on speech layers and survives a window round-trip", () => {
    const parsed = windowAnalysisSchema.parse({
      slots: [slot],
      scenes: [{ ...baseScene, audio: [speech("As a kid…", { voice: "male, warm", speakerSlot: "hero" })] }],
    })
    expect(parsed.scenes[0]!.audio[0]!.speakerSlot).toBe("hero")
  })

  it("is NOT refined against mode — a mis-tagged music layer must not fail the whole roll", () => {
    // The window schema IS the enforced decode grammar. Rejecting here would
    // throw away every scene in a window over one stray field; the sanitizer
    // below strips it instead.
    expect(windowAnalysisSchema.safeParse({
      slots: [slot],
      scenes: [{ ...baseScene, audio: [{ mode: "music", content: "synth bed", speakerSlot: "hero" }] }],
    }).success).toBe(true)
  })

  it("rewriteSpeakerSlots follows a slot through cross-window unification", () => {
    // Slot unification renames the loser id and rewrites {slot:…} tokens and
    // variation bindings; attribution has to move with them or it dangles.
    const audio = [speech("hi", { speakerSlot: "man-2" }), speech("ho", { speakerSlot: "other" })]
    expect(rewriteSpeakerSlots(audio, { "man-2": "hero" }).map((a) => a.speakerSlot)).toEqual(["hero", "other"])
  })

  it("rewriteSpeakerSlots is copy-on-write when no layer names a renamed slot", () => {
    const audio = [speech("hi", { speakerSlot: "hero" }), { mode: "music" as const, content: "bed" }]
    expect(rewriteSpeakerSlots(audio, { ghost: "other" })).toBe(audio)
  })

  it("dropUnknownSpeakers strips attribution to a slot that no longer exists", () => {
    const r = dropUnknownSpeakers([speech("hi", { speakerSlot: "ghost" })], new Set(["hero"]))
    expect(r.audio[0]).not.toHaveProperty("speakerSlot")
    expect(r.dropped).toEqual(["ghost"])
  })

  it("dropUnknownSpeakers strips attribution from music/sfx — nobody is speaking", () => {
    const r = dropUnknownSpeakers(
      [{ mode: "sfx", content: "door slam", speakerSlot: "hero" }],
      new Set(["hero"]),
    )
    expect(r.audio[0]).not.toHaveProperty("speakerSlot")
    expect(r.dropped).toEqual(["hero"])
  })

  it("dropUnknownSpeakers keeps a valid speaker and every other layer field", () => {
    const audio = [speech("As a kid…", { voice: "male, warm", speakerSlot: "hero" })]
    const r = dropUnknownSpeakers(audio, new Set(["hero"]))
    expect(r.audio).toBe(audio)          // copy-on-write: untouched input returned as-is
    expect(r.dropped).toEqual([])
  })

  it("attribution alone must NOT keep a slot alive — that is the phantom narrator", () => {
    // A slot referenced only as a speaker is a voice with no body (doctrine §5).
    // deriveSlotRefs reads {slot:…} tokens from `visual` ONLY, so an
    // attribution-only slot stays invisible to the reference sweep and gets
    // dropped — then dropUnknownSpeakers removes the dangling attribution.
    expect(deriveSlotRefs("a lunar plain, no one in frame")).toEqual([])
    const r = dropUnknownSpeakers([speech("that's me!", { speakerSlot: "creator" })], new Set())
    expect(r.audio[0]).not.toHaveProperty("speakerSlot")
    expect(r.dropped).toEqual(["creator"])
  })
})

describe("misc", () => {
  it("isOversizedScene flags > 8s only", () => {
    expect(isOversizedScene(0, 8)).toBe(false)
    expect(isOversizedScene(0, 8.5)).toBe(true)
  })
  it("aspectRatioFromDims snaps to nearest standard, else reduces", () => {
    expect(aspectRatioFromDims(1920, 1080)).toBe("16:9")
    expect(aspectRatioFromDims(1080, 1920)).toBe("9:16")
    expect(aspectRatioFromDims(1000, 1000)).toBe("1:1")
    expect(aspectRatioFromDims(2560, 1080)).toBe("21:9")
    expect(aspectRatioFromDims(1000, 400)).toBe("5:2")
  })
})
