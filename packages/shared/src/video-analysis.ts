/**
 * Video-analysis node — shared data contract.
 *
 * Single source of truth for the video-analysis node: the backend worker, the
 * frontend, and a future generator all import from here. Two schema layers:
 *   - `windowAnalysisSchema` — what the LLM emits per analysis window
 *     (strict-JSON footer). `scenes` has NO min (a quiet window returning zero
 *     scenes is a VALID result). Model-emitted `oversized`/`slotRefs` are
 *     STRIPPED here — they are validator-computed later (z.object drops unknown
 *     keys by default).
 *   - `videoAnalysisResultSchema` — the merged, validator-computed result across
 *     all windows; requires >=1 scene overall.
 *
 * Entity slots are referenced in scene `visual` text via `{slot:<id>}` tokens
 * (`SLOT_TOKEN_RE`) — a grammar distinct from `NODE_REF_PATTERN` and the
 * `{image:N}` reference tokens. Unresolved tokens UNWRAP to their literal id
 * text, never delete (spec invariant), so a downstream prompt never carries a
 * dangling `{slot:…}` placeholder.
 */
import { z } from "zod"

export const VIDEO_ANALYSIS_MAX_SCENE_SEC = 8
export const VIDEO_ANALYSIS_ENTITY_SOURCES = ["wired-character", "wired-object", "wired-location", "wired-creature"] as const
export type VideoAnalysisEntitySource = (typeof VIDEO_ANALYSIS_ENTITY_SOURCES)[number]
/** Matches {slot:<id>} tokens. Distinct from NODE_REF_PATTERN / {image:N} grammars. */
export const SLOT_TOKEN_RE = /\{slot:([a-z0-9-]+)\}/g

/**
 * Appearance variations (cast-variations spec, 2026-07-24): a slot's canonical
 * `description` IS its default look; `variations` enumerates NON-default looks
 * only (dream vs reality, flashback, disguise…). `"default"` is a reserved
 * variationId — used in scene bindings / ledger keys / routing for unbound
 * scenes, never inside `variations[]`. The closed slug vocabulary is
 * doctrine-enforced (the schema pins only the id charset, like `role`);
 * `alt-1`/`alt-2` are the escape hatches.
 */
export const VIDEO_ANALYSIS_VARIATION_SLUGS = ["dream", "flashback", "disguise", "costume", "transformation", "era", "alt-1", "alt-2"] as const
/** Max NON-default looks per slot. The window layer REJECTS past the cap (schema-forced retry); the cross-window merge FOLDS at the cap. */
export const VIDEO_ANALYSIS_MAX_VARIATIONS = 4
export const VIDEO_ANALYSIS_DEFAULT_VARIATION = "default"

export const slotVariationSchema = z.object({
  variationId: z.string().min(1).regex(/^[a-z0-9-]+$/)
    .refine((id) => id !== VIDEO_ANALYSIS_DEFAULT_VARIATION, { message: `"${VIDEO_ANALYSIS_DEFAULT_VARIATION}" is reserved for the slot's canonical look` }),
  label: z.string().min(1),
  /** Full STANDALONE casting-sheet look restating the slot's invariant identity
   *  core (face, build, age) — the manifest substitutes it wholesale, so a
   *  wardrobe-only delta would silently delete identity from the prompt. */
  description: z.string().min(1),
  /** Per-variation identity reference (auto-cast frame or user sheet). In the
   *  schema from day one: every strip-mode round-trip must carry it. */
  refImageUrl: z.string().url().optional(),
})
export type SlotVariation = z.infer<typeof slotVariationSchema>

export const entitySlotSchema = z.object({
  slotId: z.string().min(1).regex(/^[a-z0-9-]+$/),
  label: z.string().min(1),
  source: z.enum(VIDEO_ANALYSIS_ENTITY_SOURCES),
  role: z.string().min(1),
  description: z.string().min(1),
  /** Auto-cast visual reference — a hosted frame from the analyzed footage
   *  where this entity is clearly visible. Optional/additive: producers may
   *  omit it; consumers use it as an identity reference for recreation. */
  refImageUrl: z.string().url().optional(),
  /** NON-default looks only; present only when at least one exists. */
  variations: z.array(slotVariationSchema).max(VIDEO_ANALYSIS_MAX_VARIATIONS).optional(),
})
export type EntitySlot = z.infer<typeof entitySlotSchema>

/**
 * One concurrent sound layer in a scene. Real footage stacks sound (music bed
 * under dialogue over ambient sfx), so a scene carries an ARRAY of these — an
 * empty array means genuine silence. `content`: speech = verbatim words;
 * music/sfx = gen-ready description. `voice` is speech-only voice-casting.
 */
const audioLayerSchema = z.object({
  mode: z.enum(["speech", "music", "sfx"]),
  content: z.string().min(1),
  voice: z.string().optional(),
  /**
   * SPEECH ONLY — `slotId` of the on-screen speaker saying these words.
   *
   * `voice` casts a voice ("male, proud triumphant shouting"); this says WHO it
   * belongs to, so a recreation can route the line to the right character
   * instead of guessing. Usually one person speaks per scene and the guess is
   * right, which is exactly why the cases with two speakers over one cut fail
   * silently without this field.
   *
   * Optional by design and deliberately NOT refined against `mode` here: the
   * window schema is the enforced decode grammar, and rejecting a whole roll
   * because the model tagged a music layer would be a hair-trigger failure. A
   * speaker on a non-speech layer, or one naming a slot that no longer exists,
   * is stripped structurally by `dropUnknownSpeakers` — the same
   * unwrap/drop/sweep philosophy the slot-token and binding channels use.
   *
   * An unseen narrator gets NO speaker: a voice with no body is never a slot
   * (doctrine §5), so attribution here would resurrect the phantom-entity
   * defect that `stripOrphanSlots` exists to kill.
   */
  speakerSlot: z.string().optional(),
})
export type AudioLayer = z.infer<typeof audioLayerSchema>

const windowSceneBase = z.object({
  startSec: z.number().min(0),
  endSec: z.number().min(0),
  label: z.string().min(1),
  shotType: z.string().min(1),
  camera: z.string(),
  visual: z.string().min(1),
  transitionOut: z.enum(["cut", "fade", "wipe", "whip"]).optional(),
  // Array of concurrent layers (music + speech + sfx together); [] = silence.
  audio: z.array(audioLayerSchema),
  /** slotId → variationId for slots wearing a NON-default look in this scene
   *  (only slots referenced in the scene; absent key ⇒ the default look).
   *  Rides windowSceneBase so BOTH the window layer and analyzedSceneSchema
   *  inherit it — the out-of-band binding channel (no in-text markers, D6). */
  slotVariations: z.record(z.string(), z.string()).optional(),
})
// .strip() (default) drops model-emitted oversized/slotRefs — validator-computed only.
const windowSceneSchema = windowSceneBase.refine((s) => s.endSec > s.startSec, { message: "endSec must be > startSec" })
export type WindowScene = z.infer<typeof windowSceneSchema>

/** What the MODEL emits per window (strict-JSON footer schema). scenes has NO min. */
export const windowAnalysisSchema = z.object({
  language: z.string().optional(),
  slots: z.array(entitySlotSchema),
  scenes: z.array(windowSceneSchema),
})
export type WindowAnalysis = z.infer<typeof windowAnalysisSchema>

export const analyzedSceneSchema = windowSceneBase.extend({
  sceneNumber: z.number().int().min(1),
  visualResolved: z.string().min(1),
  oversized: z.boolean().optional(),
  slotRefs: z.array(z.string()),
}).refine((s) => s.endSec > s.startSec, { message: "endSec must be > startSec" })
export type AnalyzedScene = z.infer<typeof analyzedSceneSchema>

export const videoAnalysisResultSchema = z.object({
  meta: z.object({
    durationSec: z.number().positive(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    aspectRatio: z.string(),
    title: z.string().optional(),
    language: z.string().optional(),
  }),
  slots: z.array(entitySlotSchema),
  scenes: z.array(analyzedSceneSchema).min(1),
  /** CAST VARIATIONS (§4 cap handling): looks the analyzer's merge FOLDED into
   *  the default at VIDEO_ANALYSIS_MAX_VARIATIONS — recorded, never silent. In
   *  the wire schema so strip-mode consumers (the recast client's validated
   *  blueprint view) keep it: the §6 "folded into default look" note is the
   *  user's only pre-pay defense against a wrong split. */
  variationFolds: z.array(z.object({
    slotId: z.string(),
    variationId: z.string(),
    label: z.string(),
  })).optional(),
})
export type VideoAnalysisResult = z.infer<typeof videoAnalysisResultSchema>

export function deriveSlotRefs(visual: string): string[] {
  const out: string[] = []
  for (const m of visual.matchAll(SLOT_TOKEN_RE)) if (!out.includes(m[1])) out.push(m[1])
  return out
}

export function rewriteSlotTokens(visual: string, renames: Record<string, string>): string {
  return visual.replace(SLOT_TOKEN_RE, (whole, id: string) => (renames[id] ? `{slot:${renames[id]}}` : whole))
}

/** Unresolved tokens unwrap to their literal id text — never deleted (spec invariant). */
export function unwrapUnresolvedTokens(text: string, validIds: Set<string>): { text: string; unresolved: string[] } {
  const unresolved: string[] = []
  const out = text.replace(SLOT_TOKEN_RE, (whole, id: string) => {
    if (validIds.has(id)) return whole
    if (!unresolved.includes(id)) unresolved.push(id)
    return id
  })
  return { text: out, unresolved }
}

/**
 * Rewrite a scene's `slotVariations` after cross-window slot/variation
 * unification: slot keys map through `slotRenames`, then each variation value
 * maps through `variationRenames[<new slotId>]`. Absent renames pass through.
 */
export function rewriteSceneBindings(
  sv: Record<string, string> | undefined,
  slotRenames: Record<string, string>,
  variationRenames?: Record<string, Record<string, string>>,
): Record<string, string> | undefined {
  if (!sv) return undefined
  const out: Record<string, string> = {}
  for (const [slotId, variationId] of Object.entries(sv)) {
    const newSlot = slotRenames[slotId] ?? slotId
    out[newSlot] = variationRenames?.[newSlot]?.[variationId] ?? variationId
  }
  return out
}

/**
 * Drop bindings whose (slotId, variationId) no longer exists after a merge —
 * the unwrap-rule mirror: never persist a dangling binding, and report what
 * was dropped so the caller can warn. `"default"` is always valid for a known
 * slot. `kept` is undefined when nothing survives (no `{}` materialization).
 */
export function dropUnknownBindings(
  sv: Record<string, string> | undefined,
  validBySlot: Map<string, Set<string>>,
): { kept?: Record<string, string>; dropped: Array<{ slotId: string; variationId: string }> } {
  if (!sv) return { dropped: [] }
  const kept: Record<string, string> = {}
  const dropped: Array<{ slotId: string; variationId: string }> = []
  for (const [slotId, variationId] of Object.entries(sv)) {
    const valid = validBySlot.get(slotId)
    if (valid && (variationId === VIDEO_ANALYSIS_DEFAULT_VARIATION || valid.has(variationId))) kept[slotId] = variationId
    else dropped.push({ slotId, variationId })
  }
  return { kept: Object.keys(kept).length > 0 ? kept : undefined, dropped }
}

/**
 * Rewrite speech attribution after cross-window slot unification — the
 * `rewriteSceneBindings` counterpart for the `audio` channel. Slot unification
 * renames a loser id to its survivor and rewrites `{slot:…}` tokens and
 * variation bindings; an un-rewritten `speakerSlot` would be left pointing at an
 * id that no longer exists. Copy-on-write: returns the input array untouched
 * when no layer names a renamed slot.
 */
export function rewriteSpeakerSlots(audio: AudioLayer[], slotRenames: Record<string, string>): AudioLayer[] {
  if (!audio.some((a) => a.speakerSlot !== undefined && slotRenames[a.speakerSlot])) return audio
  return audio.map((a) => {
    const to = a.speakerSlot !== undefined ? slotRenames[a.speakerSlot] : undefined
    return to ? { ...a, speakerSlot: to } : a
  })
}

/**
 * Strip attribution that no scene can honour — the `dropUnknownBindings` mirror
 * for the `audio` channel. Two cases, both model sloppiness rather than errors
 * worth failing a roll over:
 *   - a `speakerSlot` on a `music`/`sfx` layer (nobody is speaking)
 *   - a `speakerSlot` naming a slot that is not in the final list
 *
 * MUST run AFTER the orphan-slot sweep, and attribution must NEVER count as a
 * slot reference for that sweep: a slot reachable only as a speaker is a voice
 * with no body — precisely the invented-narrator entity doctrine §5 forbids. The
 * two passes compose to remove both the phantom slot and the dangling
 * attribution pointing at it.
 */
export function dropUnknownSpeakers(
  audio: AudioLayer[],
  validSlotIds: Set<string>,
): { audio: AudioLayer[]; dropped: string[] } {
  const dropped: string[] = []
  const out = audio.map((a) => {
    if (a.speakerSlot === undefined) return a
    if (a.mode === "speech" && validSlotIds.has(a.speakerSlot)) return a
    dropped.push(a.speakerSlot)
    const { speakerSlot: _drop, ...rest } = a
    return rest
  })
  return { audio: dropped.length > 0 ? out : audio, dropped }
}

/** Substitute {slot:x}: castMap binding wins, else the slot's description, else literal id. */
export function renderAnalyzedScene(scene: { visual: string }, slots: EntitySlot[], castMap?: Record<string, string>): string {
  const byId = new Map(slots.map((s) => [s.slotId, s]))
  return scene.visual.replace(SLOT_TOKEN_RE, (_whole, id: string) => castMap?.[id] ?? byId.get(id)?.description ?? id)
}

export function isOversizedScene(startSec: number, endSec: number): boolean {
  return endSec - startSec > VIDEO_ANALYSIS_MAX_SCENE_SEC
}

const STANDARD_RATIOS: Array<[string, number]> = [
  ["16:9", 16 / 9], ["9:16", 9 / 16], ["1:1", 1], ["4:3", 4 / 3], ["3:4", 3 / 4], ["21:9", 21 / 9],
]
export function aspectRatioFromDims(w: number, h: number): string {
  const r = w / h
  for (const [label, v] of STANDARD_RATIOS) if (Math.abs(r - v) / v < 0.03) return label
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
  const g = gcd(Math.round(w), Math.round(h))
  return `${Math.round(w) / g}:${Math.round(h) / g}`
}
