/**
 * REFERENCE RULES — the two short blocks that decide whether a multi-reference
 * image obeys its references, and whether it looks like a film frame or a
 * posed photograph.
 *
 * Both are MEASURED, on gpt-image-2 at 2K, against one deliberately hard brief:
 * four references (two people, a street-fashion shot, and a composite holding a
 * wine glass, a smartphone, a hotel suite AND two other women's faces), with
 * wardrobe swapped BETWEEN the two people. 36 draws, 2026-08-06. Scored on five
 * criteria: both faces correct and unblended, each person's wardrobe, the
 * props, the location, and one coherent composition.
 *
 * ─── REFERENCE_RULES ───────────────────────────────────────────────────────
 *
 * Two wordings already existed in this codebase and NEITHER was best. Each was
 * written without knowledge of the other:
 *
 *   the `reference-lock` snippet   — default-deny + likeness + compose.
 *                                    **0 of 4** on the hardest criterion (move
 *                                    a garment from one reference to another).
 *                                    Flawless on the other four, which is what
 *                                    made it feel like it worked.
 *   gvp's `referenceRules`         — default-deny + face rules + likeness +
 *                                    "expression, gaze and pose follow the
 *                                    scene". **1 of 4**.
 *   the two MERGED                 — **4 of 4** (Fisher exact vs the snippet,
 *                                    p ≈ 0.03).
 *
 * The arms isolate: swapping the performance clause for the compose clause took
 * it 1/4 → 4/4, and adding the face rules took 0/4 → 4/4. Each half does real
 * work and neither is sufficient alone. The performance clause is dropped here
 * because a composite has no scene to perform — it belongs to gvp's SCENE lane,
 * where a subject must act the beat.
 *
 * ─── SCENE_FRAME_RULE ──────────────────────────────────────────────────────
 *
 * The separate failure Tal reported: everyone faces the lens and the result
 * reads as an artfully posed photograph rather than a frame out of a film.
 * Four fixes were measured against the block above (which is 0/4 on gaze by
 * itself):
 *
 *   "This image is a scene start frame of a video."  0/4 gaze, **0/3 identity**
 *   "Film still from a feature film."                 gaze ✗ (sampled)
 *   "A candid moment, unposed, nobody aware of…"      identity ✗ (sampled)
 *   rewriting the verbs (drinking, not holding)       4/4 gaze, 3/4 identity
 *   **"Nobody looks at the camera."**                 **4/4 gaze, 4/4 identity,
 *                                                     4/4 wardrobe**
 *
 * Only the short negative is free. Everything longer — a medium declaration, a
 * genre label, a mood sentence — competes with the reference bindings and the
 * references lose: the "scene start frame" arm put a woman from INSIDE a
 * reference into the lead role in every draw. This is the same effect gvp's
 * block already recorded on a different brief ("more instruction bought LESS
 * compliance"), now measured twice.
 *
 * KEPT SEPARATE FROM THE RULES, deliberately. A portrait, a piece to camera, or
 * a product shot WANTS the eyeline; suppressing it is a creative choice, not a
 * correctness rule. They are two controls, defaulting independently.
 */

/**
 * Default-deny + likeness + compose. Prepended ahead of the scene when the
 * caller's reference-rules toggle is on.
 *
 * ONE STRING, THREE CONSUMERS — the injected default, the `reference-lock`
 * factory snippet, and gvp/recast's own grounding. They drifted apart once
 * already (the snippet and gvp each carried a different version, and neither
 * knew the other existed), which is the whole reason this is a constant.
 */
export const REFERENCE_RULES =
  "Do not use anything from reference images unless specified explicitly. " +
  "All elements taken from reference images must preserve likeness. " +
  "Compose them naturally into a single image."

/**
 * The same rules PLUS the two face clauses — for briefs that move elements
 * BETWEEN people.
 *
 * NOT THE DEFAULT, and the reason is a genuine conflict in the evidence that
 * should not be quietly resolved by whoever edits this next.
 *
 * The controlled comparison: on a four-reference brief with two faces and a
 * garment crossing from one person to the other, this block moved that garment
 * 4 times in 4 draws and {@link REFERENCE_RULES} moved it 0 in 4 (Fisher exact,
 * p ≈ 0.03). On the other four criteria — faces correct, own wardrobe, props,
 * location, composition — the two were identical, 12/12 both ways.
 *
 * Tal's counter-evidence: across his own volume of real jobs, the shorter block
 * works better IN GENERAL. Both hold. The face clauses earn their place exactly
 * when two faces are in play and elements cross between them; on a single
 * subject, a product or a landscape, "do not alter face structure" is dead
 * weight, and this codebase has already measured twice that more instruction
 * buys less compliance.
 *
 * So the DEFAULT follows the population (the short block) and this is the tool
 * you reach for on the composition case. Settling "in general" properly needs
 * the same method applied across brief TYPES, not more draws of one brief.
 */
export const REFERENCE_RULES_MULTI_PERSON =
  "Do not take anything from the reference images unless specified explicitly. " +
  "Do not alter face structure. Do not blend faces. " +
  "Preserve the likeness of every element taken. " +
  "Compose them naturally into a single image."

/**
 * THE FRAMING PREFIX — a sentence fragment that swallows the scene after it.
 *
 * "Extreme wide cinematic film still of" + "The person from reference image A
 * wears…" reads as one phrase, and that is the whole trick. Lead with the SHOT
 * SIZE (see {@link filmStillPrefix}). The same idea as a standalone SENTENCE
 * ("Film still from a feature film." / "This image is a scene start frame of a
 * video.") measured badly-to-catastrophically: the sentence competes with the
 * reference bindings and the references lose — the "scene start frame" arm put
 * a face from INSIDE a reference into the lead role in 3 of 3 draws. The prefix
 * costs nothing because it never makes a separate claim.
 *
 * What it buys is not just the eyeline. Tal's distinction, which is sharper
 * than the binary this was first scored on: a subject may be turned toward the
 * lens and still be IN the scene rather than presenting to the viewer. The
 * prefix also moves staging, depth and the quality of light — things an
 * eyeline rule cannot reach.
 */
export const FILM_STILL_PREFIX = "Cinematic film still of"

/**
 * The prefix with a SHOT SIZE in front — "Extreme wide cinematic film still of
 * …", "Medium close-up cinematic film still of …".
 *
 * Leading with the framing is standard cinematography prompt practice and Tal
 * reports it better again. HONEST STATUS: the POSITION is measured (a prefix
 * costs nothing where a standalone claim cost the lead's identity 3 of 3); the
 * added shot-size and "cinematic" words are his experience, not a controlled
 * arm. Every previous case of adding words to a MIDDLE claim was paid for, so
 * if this ever regresses, suspect the words — and note the prefix position is
 * the safe one, which is why they were put here rather than in a sentence.
 */
export function filmStillPrefix(shotSize?: string): string {
  const shot = shotSize?.trim()
  return shot ? `${shot} cinematic film still of` : FILM_STILL_PREFIX
}

/**
 * The eyeline suppressor. Five words, measured free — it costs nothing on
 * identity, wardrobe or composition, which none of the longer phrasings
 * managed.
 *
 * DO NOT EXPAND THIS. Every attempt to say more about what the picture IS cost
 * reference fidelity; the sentence works BECAUSE it constrains exactly one
 * thing and claims nothing about medium, genre or mood.
 */
export const SCENE_FRAME_RULE = "Nobody looks at the camera."

/**
 * A LOOK TAIL — film stock, lens, light, palette — appended AFTER everything.
 *
 * An example to edit, not a universal: a different film wants a different
 * stock. What generalises is the POSITION.
 *
 * ─── THE ONE RULE ALL OF THIS TURNED OUT TO BE ─────────────────────────────
 *
 * Position decides whether an instruction helps or fights the references:
 *
 *   1. RULES FIRST — default-deny, ahead of the bindings it governs.
 *   2. FRAMING AS A PREFIX that swallows the subject ("Film still of …").
 *   3. LOOK LAST — stock, lens, lighting, palette.
 *   4. A separate CLAIM in the middle competes with the reference bindings,
 *      and the references lose.
 *
 * That is why "This image is a scene start frame of a video." (a standalone
 * claim, mid-prompt) cost the lead's identity in 3 of 3 draws while "Film still
 * of" (a prefix) costs nothing, and why this tail is free at the end. It
 * matches the published guidance independently — Subject → Action →
 * Surroundings → Camera/Lighting → Atmosphere — and gvp's engine had already
 * found rule 3 the hard way: "THE MEDIUM GOES LAST… a rendering directive at
 * the end has nothing after it to argue with."
 *
 * RECAST DOES NOT NEED THIS SNIPPET. `lookDirective` already appends a tail
 * built from the look the ANALYSER observed in the source film — stock, grade,
 * lens, lighting — which beats a hand-written one because it is that film's
 * own look. This exists for the platform's image nodes, which have no analyser.
 */
export const CINEMATIC_LOOK_TAIL =
  "Shot on Super 16mm Kodak 7298 with Canon K35 lenses, soft naturalistic window light mixed with " +
  "dim tungsten practicals and muted fluorescent spill, earthy muted palette with faded greens, " +
  "warm skin tones and gentle shadow fall-off"

/**
 * The rules a caller's toggles resolve to, joined in a stable order and ready
 * to prepend. Returns `""` when everything is off, so the caller can prepend
 * unconditionally.
 */
export function referenceRulesBlock(opts?: {
  /** Default-deny + likeness + compose. Absent = ON. */
  referenceRules?: boolean
  /** Add the two face clauses — for briefs moving elements between people. */
  multiPerson?: boolean
  /** "Nobody looks at the camera." Absent = OFF (a portrait wants the eyeline). */
  sceneFrame?: boolean
}): string {
  const parts: string[] = []
  if (opts?.referenceRules !== false) {
    parts.push(opts?.multiPerson === true ? REFERENCE_RULES_MULTI_PERSON : REFERENCE_RULES)
  }
  if (opts?.sceneFrame === true) parts.push(SCENE_FRAME_RULE)
  return parts.join(" ")
}
