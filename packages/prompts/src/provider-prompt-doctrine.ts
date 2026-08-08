/**
 * Per-provider prompting doctrine — the single source of truth for "how to
 * prompt model family X well". Consumed by:
 *   1. backend/src/prompts/prompt-wizard-system.ts  (enhance/generate system prompts)
 *   2. backend/scripts/gen-skills (provider-prompting block in video node skills)
 *   3. backend/src/lib/mcp/tools/models.ts          (list_models promptTips)
 *   4. compact recipes in MCP tool descriptions point here via get_node_skill
 *
 * Sources, in precedence order (conflicts resolve top-down):
 *   Seedance 2.0:
 *   - Official BytePlus ModelArk "Dreamina Seedance 2.0 series prompt guide"
 *     https://docs.byteplus.com/en/docs/ModelArk/2222480
 *   - Official launch post https://seed.bytedance.com/en/blog/official-launch-of-seedance-2-0
 *   - KIE API docs https://docs.kie.ai/market/bytedance/seedance-2
 *   Kling:
 *   - Official "Kling Video 2.6 Audio User Guide"
 *     https://kling.ai/quickstart/klingai-video-26-audio-user-guide
 *   - fal.ai "Kling 3.0 Prompting Guide" https://blog.fal.ai/kling-3-0-prompting-guide/
 *   - KIE API docs https://docs.kie.ai/market/kling/kling-3-0
 *   - Live KIE-path dialogue probe 2026-07-16 (scripted lines spoken verbatim,
 *     lip-synced, on both kling-2.6 and kling-3.0 with sound=true)
 *   MiniMax Hailuo 3:
 *   - KIE API docs https://docs.kie.ai/market/minimax-h3 (text-to-video /
 *     image-to-video / reference-to-video — the API contract is the doctrine
 *     source: limits, modes, aspect rules, pricing dimensions). No live probe
 *     yet — structure guidance mirrors the platform's ordinal-reference
 *     conventions rather than vendor style claims.
 */
export interface ProviderPromptDoctrine {
  /** MODEL_CATALOG ids this doctrine covers. */
  readonly providers: readonly string[]
  /** Human heading for skill docs, e.g. "Seedance 2.0 (seedance-2, seedance-2-fast)". */
  readonly heading: string
  /** Short bullets for compact surfaces (list_models promptTips). ≤220 chars each. */
  readonly tips: readonly string[]
  /** Full markdown doctrine for system prompts and generated skill docs. */
  readonly doctrine: string
}

const SEEDANCE_2_DOCTRINE: ProviderPromptDoctrine = {
  providers: ["seedance-2", "seedance-2-fast", "seedance-2-mini", "seedance-2-5"],
  heading: "Seedance 2 (seedance-2, seedance-2-fast, seedance-2-mini, seedance-2-5)",
  tips: [
    "Storyboard complex videos as 'Shot 1: … Shot 2: …' WITHOUT timestamps — timed shots like '(0-3s)' are officially unstable and can break generation.",
    "One camera movement per shot; describe actions per body part with degree ('slowly raises a hand'); express emotion as physical detail, never abstract words.",
    "Native multi-track audio — cue it inline: （background music）, <sound effects>, and quoted dialogue.",
    "References go by ordinal (@Image 1, Video 2) in attachment order; earlier = higher priority. Identity = ONE headshot + ONE full-body (multi-view sheets cause ID drift). 4-5 assets total beats maxing the 9/3/3 caps.",
    "No negative-prompt parameter — put constraints in the prompt: 'keep it subtitle-free, do not generate a watermark, do not generate a logo'.",
    "seedance-2-5 only: one shot runs to 30s (the 2.0 SKUs stop at 15s), so storyboard a whole beat instead of planning a stitch. Ref caps are wider (30/10/10), but 4-5 assets still gives the best identity fidelity.",
  ],
  doctrine: `Prompt structure (front-load what matters most):
precise subject → action details → scene/environment → lighting & color tone → camera movement → visual style → image quality → constraints.

**Shots & pacing**
- Storyboard complex videos as "Shot 1: … Shot 2: … Shot 3: …" in event order. Do NOT attach timestamps (e.g. "(0-3s)") — precise-timing support is officially unstable and forcing durations can break generation; let the model pace naturally.
- Per shot cover, in order: camera move or transition, subject action + expression, spatial/position change, audio for that shot.
- One camera movement type per shot — never ask for push + pan + orbit at once (image instability).
- Prefer slow, gentle, continuous movements over high-burst action (sprints, big jumps, violent rolls morph). Describe actions per body part with quantified degree: "slowly raises a hand", "pushes hard off the ground". Chain actions with inertia: "uses the momentum of the turn to naturally raise an arm".
- Express emotion as externalized physical detail, never abstract words: not "very sad" but "lowering the head, shoulders trembling slightly, eyes reddening, fingers clutching the corner of clothing".

**Generation differences (seedance-2-5 vs the 2.0 SKUs)**
- A single 2.5 shot runs to 30s, where every 2.0 SKU stops at 15s. Plan a complete 4-6 shot beat inside ONE generation instead of splitting it into two clips and stitching — no seam to hide, and continuity holds because it never leaves the model.
- 2.5 also takes far more reference material (30 images / 10 videos / 10 audio vs 9/3/3). Treat that as room for COVERAGE — more distinct characters, locations and props in one shot — not as licence to pile refs onto one identity. The "ONE headshot + ONE full-body, 4-5 assets total" rule above still produces the best likeness on 2.5.
- 2.5 renders at 480p/720p only: there is no 1080p or 4K tier, so route a job that needs one to seedance-2 (which has both) or upscale afterwards.
- With a start frame, 2.5 always derives the output aspect from that frame — an explicit aspect ratio is rejected outright, so compose the frame at the ratio you want.

**References (when reference media is attached)**
- Refer to assets by ordinal in attachment order: "@Image 1", "Video 2", "Audio 1". Asset ORDER is priority — put the most identity-critical asset first. (In the editor, the \`{image:N:label}\` / \`{video:N}\` / \`{audio:N}\` prompt tokens auto-emit this binding — \`{image:1:person}\` resolves to "the person from @image_1" — so a wired reference and its mention stay in sync.)
- Define each subject once, then reuse the label consistently: 'Define the woman in the red dress in Image 1 as the courier' … 'the courier opens the door'. In multi-character scenes bind every character to its image ("the man from Image 1 hands the box to the woman from Image 2") and append: "do not generate duplicate copies of the same character".
- Character identity: ONE close-up headshot + ONE full-body image is ideal. Do NOT attach multi-view/three-view character sheets — the model reads the views as separate people, causing identity drift and twin duplicates.
- 4-5 assets total works best (1-2 character images + 1 scene image + 1 camera-movement video + 1 audio clip). Maxing out the 9-image/3-video/3-audio limits degrades feature priority and adherence.
- Editing/extension instructions name clips directly: "Extend Video 1 backward…", "Remove the chair from Video 1". Saying "reference Video 1" flips the model into reference mode and breaks the edit. Track completion: "Video 1 + [transition description] + followed by Video 2" (≤3 clips, ≤15s total).

**Audio (native multi-track: music + ambience + voice, stereo)**
- Cue the layers separately with the official symbols: full-width parentheses for music （slow jazz piano in the background）, angle brackets for sound effects <rain tapping on glass>, and dialogue as quoted speech: the man says "It's not that bad". Seedance also accepts curly-brace dialogue, but on Nodaro curly braces are reserved for prompt variables — always use quotes for dialogue here.
- Mark the language for non-English/Chinese dialogue ("says in Japanese …").
- With a reference voice attached, also describe the timbre in words: "the low, warm, finely grainy middle-aged male voice of Audio 1".

**Quality & constraints**
- Quality tail: "HD, rich details, cinematic texture, natural colors, stable picture."
- Anti-junk constraints (these official templates ARE negative-form): "keep it subtitle-free", "avoid generating any text or subtitles", "do not generate a watermark", "do not generate a logo". Landscape output is markedly less subtitle-prone than portrait — generate 16:9 and crop when portrait text-safety matters.
- There is NO negative-prompt parameter on Seedance — all constraints belong in the prompt text itself.

**Known weaknesses → workarounds**
- Text rendering is weak: keep on-screen text to short common words; for exact text or logos, attach the artwork as a reference image and instruct "the logo from Image N stays in the corner unchanged".
- More than 4 referenced people gets unstable: group people into composite images of ≤4 first (image generation), then reference those composites.
- Repeated extension degrades quality: prefer high-definition reference assets and avoid stacking many continuations.`,
}

const KLING_AUDIO_DOCTRINE: ProviderPromptDoctrine = {
  providers: ["kling", "kling-3.0", "kling-3-omni"],
  heading: "Kling 2.6 / 3.0 / 3 Omni (kling, kling-3.0, kling-3-omni)",
  tips: [
    "Kling speaks scripted dialogue natively with lip sync — quote the line and enable sound: [Anna: warm calm voice]: \"We made it.\" On kling/kling-3.0 audio raises the credit cost; kling-3-omni includes it.",
    "Structure prompts as Scene → character/element → Motion → Audio → style. Put ALL sound in one 'Audio:' block: dialogue in quotes, then SFX and ambience described plainly ('rain tapping on glass, no music').",
    "Give each speaker a stable label + voice description and reuse it exactly — [Detective: low raspy voice, tired] — pronouns or renamed speakers break voice binding in multi-character scenes.",
    "Tone words in the bracket steer delivery (whispering, crying, fast urgent voice); pace with 'Immediately' / 'after a pause'. 2.6 voices are English/Chinese only; 3.0 adds dialects and code-switching.",
    "kling-3.0 wired references become @element_name mentions (handled automatically by the editor); multi-shot mode forces sound ON. Kling 2.6 prompts cap at 1000 chars — keep the Audio block tight.",
    "Say what should NOT sound: 'no background music, no other sounds' — otherwise Kling invents a music bed under dialogue.",
  ],
  doctrine: `Prompt structure: Scene (setting, light) → Character/Element (who, appearance) → Motion (action, camera) → Audio (dialogue / SFX / ambience / music) → Others (style, emotion).

**Dialogue (native speech + lip sync — verified on the KIE path 2026-07-16)**
- Quote the spoken line and enable the sound toggle; the model bakes the voice AND matching lip movement: the woman says "The quick brown fox jumps over the lazy dog."
- Prefer labeled dialogue with a voice description: [Character label: voice/tone description]: "line". Example: [Exhausted Partner: trembling frustrated voice]: "You never listen to me."
- Keep character labels unique and reuse them verbatim — never switch to pronouns mid-prompt; the label is what binds a voice to a speaker across lines. Kling 2.6 additionally supports [Character@VoiceName] platform-voice binding.
- Tone words inside the bracket steer delivery: whispering, crying voice, controlled serious voice, fast urgent voice. Sequence speech with temporal markers ("Immediately", "after a pause") when two lines must not overlap.
- Languages: Kling 2.6 outputs English/Chinese voices only (other languages are auto-translated to English). Kling 3.0 supports multiple languages, dialects, accents, and code-switching within one scene — mark the language explicitly ("says in Japanese …").

**SFX / ambience / music**
- Put them in the same Audio block, described plainly: "Rain tapping softly on the window, distant thunder, no music."
- State exclusions explicitly — "no background music, no other sounds" — or the model tends to add a bed under dialogue.

**Toggle + cost**
- The audio lever is the node's sound toggle (KIE \`sound\` param). On kling (2.6) and kling-3.0 enabling audio raises the credit cost (the \`:audio\` composite); kling-3.0 generates audio by DEFAULT — pass sound: false for the cheaper silent tier. kling-3-omni (Replicate) includes audio in its flat per-duration rate.
- Multi-shot kling-3.0 (\`multi_shots\`) forces sound ON — budget for the audio rate.

**References & elements (kling-3.0 / omni)**
- Wired references are injected as \`kling_elements\` and MUST be mentioned as @element_name in the prompt — the editor's {image:N} tokens and the server prefixer handle this automatically; when hand-writing prompts, mention every element or it is silently ignored.
- kling-3-omni is image-to-video only (start frame required) and accepts up to 7 reference images; element voice references (element_input_audio_urls, 5-30s clips) bind a voice to an element.

**Limits**
- Kling 2.6 prompts cap at 1000 characters — front-load scene + dialogue and trim style tails first. kling-3.0 accepts long prompts.
- Durations: 2.6 = 5/10s; 3.0/omni = 3-15s. A spoken line needs roughly 1s per 2-3 words — don't script more dialogue than the clip can hold.`,
}

const MINIMAX_H3_DOCTRINE: ProviderPromptDoctrine = {
  providers: ["minimax-h3"],
  heading: "MiniMax Hailuo 3 (minimax-h3)",
  tips: [
    "Natural-language prompts up to 7000 chars. Front-load what matters: subject → action → scene/environment → lighting → camera move → style. One camera movement per shot.",
    "Output 2K (default) or 768P (cheaper tier). Aspect: pure text-to-video needs a concrete ratio (21:9/16:9/4:3/1:1/3:4/9:16); reference runs default to adaptive (match the input).",
    "References go by ordinal in attachment order (@Image 1, Video 1) — earlier = higher priority. Caps: 9 images, 3 videos (2-15s each, ≤15s total), 3 audio clips (≤15s total).",
    "Reference audio drives speech/lip-sync but never rides alone — pair it with an image or video reference. Audio input is free; the first 5 input images are free, extras bill per image.",
    "No negative-prompt parameter — put constraints in the prompt text: 'keep it subtitle-free, do not generate a watermark, do not generate a logo'.",
  ],
  doctrine: `Prompt structure (front-load what matters most):
precise subject → action details → scene/environment → lighting & color tone → camera movement → visual style → image quality → constraints. Prompts are natural language, 1-7000 characters, across all three modes.

**Modes (picked automatically from the wired inputs)**
- First frame and/or last frame connected, nothing else → exact frame mode (image-to-video): the output opens on the first frame and/or closes on the last. The clip's aspect is inferred from the frame — there is no aspect parameter in this mode.
- ANY reference connected (image, video, or audio) → reference mode (reference-to-video): frames ride along as reference images with a prompt directive binding them to the opening/closing position. Aspect defaults to adaptive (matches the input); a concrete ratio can be forced.
- Nothing visual connected → text-to-video. A concrete aspect ratio is required (21:9 / 16:9 / 4:3 / 1:1 / 3:4 / 9:16 — no adaptive); Nodaro renders 16:9 unless one is picked.

**References (when reference media is attached)**
- Refer to assets by ordinal in attachment order: "@Image 1", "Video 1", "Audio 1". Put the identity-critical asset first. (In the editor, the \`{image:N:label}\` / \`{video:N}\` / \`{audio:N}\` prompt tokens auto-emit this binding, so a wired reference and its mention stay in sync.)
- Caps: 9 reference images; 3 reference videos, each 2-15s and ≤15s combined; 3 reference audio clips, ≤15s combined. Reference audio cannot be used alone — it must accompany an image or video reference.
- Define each subject once, then reuse the label consistently ("the woman from @Image 1 … the woman opens the door"). A focused set of 4-5 assets beats maxing every cap.
- Billing note: generated seconds AND reference-video input seconds bill at the same per-second rate; the first 5 input images are free and each extra image adds a small surcharge; audio input is free.

**Audio**
- Audio is always generated — there is no on/off toggle. With reference audio attached, the model syncs speech to the supplied track (the platform's lip-sync surface routes image + voice line through this mode automatically).
- Quoted dialogue in the prompt gives the model the line to perform; describe the voice in words when no reference audio is supplied.

**Duration & pacing**
- 4-15 seconds, integer, default 6. Per-second pricing — a 15s clip costs ~3.7× a 4s clip, so pick the shortest duration that serves the shot.
- One camera movement type per shot; chain actions with physical, quantified detail ("slowly raises a hand", "pushes hard off the ground") rather than abstract emotion words.

**Constraints**
- There is NO negative-prompt parameter — all constraints belong in the prompt text itself: "keep it subtitle-free, do not generate a watermark, do not generate a logo, stable picture".`,
}

export const PROVIDER_PROMPT_DOCTRINES: readonly ProviderPromptDoctrine[] = [
  SEEDANCE_2_DOCTRINE,
  KLING_AUDIO_DOCTRINE,
  MINIMAX_H3_DOCTRINE,
]

const DOCTRINE_BY_PROVIDER: ReadonlyMap<string, ProviderPromptDoctrine> = new Map(
  PROVIDER_PROMPT_DOCTRINES.flatMap((d) => d.providers.map((p) => [p, d] as const)),
)

/** Full doctrine for a provider id, or undefined when none exists. */
export function getPromptDoctrine(providerId: string): ProviderPromptDoctrine | undefined {
  return DOCTRINE_BY_PROVIDER.get(providerId)
}

/** Compact tips for a provider id ([] when none) — used by list_models. */
export function getPromptTips(providerId: string): readonly string[] {
  return DOCTRINE_BY_PROVIDER.get(providerId)?.tips ?? []
}
