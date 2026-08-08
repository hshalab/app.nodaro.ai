---
node_type: image-to-video
generated_at: 2026-08-08T17:46:55.709Z
generated_from: c06705f7f
---

# image-to-video

<!-- AUTO-GEN:START node-data-shape -->
**Type:** `image-to-video`
**Category:** ai
**Credit cost:** 20
**Inputs (target handles):** `startFrame`, `endFrame`, `audio`
**Outputs (source handles):** `video`

**Required data fields:**
- `label: string`
- `provider: ImageToVideoProvider`
- `model: string`
- `duration: number`
- `fieldMappings: FieldMappings`

**Optional data fields:**
- `motion?: "subtle" | "moderate" | "dynamic"`
- `motionEnabled?: boolean`
- `prompt?: string`
- `negativePrompt?: string`
- `generateAudio?: boolean`
- `executionStatus?: "idle" | "running" | "completed" | "failed"`
- `errorMessage?: string`
- `generatedVideoUrl?: string`
- `generatedResults?: GeneratedResult[]`
- `activeResultIndex?: number`
- `aspectRatio?: "16:9" | "9:16" | "1:1" | "4:3" | "3:4" | "4:5" | "5:4" | "21:9" | "9:21" | "adaptive" | "Auto"`
- `multiShot?: boolean`
- `resolution?: string`
- `grokMode?: "fun" | "normal" | "spicy"`
- `videoSize?: "standard" | "high"`
- `seed?: number`
- `cameraFixed?: boolean`
- `shots?: Array<{ prompt: string; duration: number }>`
- `elements?: Array<{ name: string; description: string; type: "image" | "video"; urls: string[] }>`
- `webSearch?: boolean`
- `nsfwChecker?: boolean`
- `videoTrimStart?: number`
- `videoTrimEnd?: number`
- `attachReferenceVideoVariant?: string`
- `loopTrim?: {
    enabled: boolean
    framesToTest?: number
    quality?: "lossless" | "precise"
  }`
- `enableTranslation?: boolean`
- `selectedStartFrameNodeId?: string`
- `selectedEndFrameNodeId?: string`
- `selectedAudioNodeId?: string`
- `currentJobId?: string`
- `currentJobProgress?: number`
- `kieTaskId?: string`
- `connectedImageOrder?: readonly string[]`
- `connectedRefImageOrder?: readonly string[]`
- `referenceOrder?: readonly string[]`
- `suppressedCanonicalCharacterIds?: readonly string[]`
- `suppressedCanonicalLocationIds?: readonly string[]`
- `veoMode?: "frame-to-frame" | "reference"`
- `seedance2InputMode?: "frames" | "references"`
- `extraRefs?: readonly ExtraRef[]`
- `videoPlayState?: "loop" | "paused" | "stopped"`
- `pausedAtTime?: number`

**Default data:**
```json
{
  "label": "Image to Video",
  "provider": "seedance-2-fast",
  "duration": 5,
  "prompt": "",
  "negativePrompt": "",
  "fieldMappings": {}
}
```
<!-- AUTO-GEN:END node-data-shape -->

<!-- AUTO-GEN:START mcp-call -->
**MCP tool:** `animate_image`

**Input parameters:**
- `prompt`
- `image_url`
- `image_asset_id`
- `model`
- `duration`
- `aspect_ratio`
- `resolution`
- `sound`
- `end_frame_url`
- `end_frame_asset_id`
- `reference_image_urls`
- `reference_video_urls`
- `reference_audio_urls`
- `loop_trim`
- `auto_loop_trim`
- `connected_references`
- `reference_order`
<!-- AUTO-GEN:END mcp-call -->

## When to use

Animate a still image into a short video clip (5-15s typical). For multi-shot films, animate sequentially — each shot's end frame anchors the next shot's start frame.

## Common gotchas

- Field name is `generatedVideoUrl`, NOT `generatedImageUrl`. Using the image field name on a video node renders a blank placeholder.
- Seedance 2 (`seedance-2-fast`, `seedance-2`) always runs in multishot mode: pass `multishot: true`, `disable_internal_music: true`, `allow_sfx: true` to the MCP call.
- Veo / Veo 3.1 use fixed 8-second duration — the `duration` config field is ignored; the response is always 8s.

<!-- AUTO-GEN:START examples -->
## Worked example

```json
{
  "id": "image-to-video-1",
  "type": "image-to-video",
  "position": {
    "x": 0,
    "y": 0
  },
  "data": {
    "label": "Image to Video",
    "provider": "seedance-2-fast",
    "duration": 5,
    "prompt": "",
    "negativePrompt": "",
    "fieldMappings": {}
  }
}
```
<!-- AUTO-GEN:END examples -->

<!-- AUTO-GEN:START provider-prompting -->
## Provider prompting doctrine

Model-family-specific prompting rules. Apply the section matching the node's `provider`.

### Seedance 2 (seedance-2, seedance-2-fast, seedance-2-mini, seedance-2-5)

Prompt structure (front-load what matters most):
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
- Refer to assets by ordinal in attachment order: "@Image 1", "Video 2", "Audio 1". Asset ORDER is priority — put the most identity-critical asset first. (In the editor, the `{image:N:label}` / `{video:N}` / `{audio:N}` prompt tokens auto-emit this binding — `{image:1:person}` resolves to "the person from @image_1" — so a wired reference and its mention stay in sync.)
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
- Repeated extension degrades quality: prefer high-definition reference assets and avoid stacking many continuations.

### Kling 2.6 / 3.0 / 3 Omni (kling, kling-3.0, kling-3-omni)

Prompt structure: Scene (setting, light) → Character/Element (who, appearance) → Motion (action, camera) → Audio (dialogue / SFX / ambience / music) → Others (style, emotion).

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
- The audio lever is the node's sound toggle (KIE `sound` param). On kling (2.6) and kling-3.0 enabling audio raises the credit cost (the `:audio` composite); kling-3.0 generates audio by DEFAULT — pass sound: false for the cheaper silent tier. kling-3-omni (Replicate) includes audio in its flat per-duration rate.
- Multi-shot kling-3.0 (`multi_shots`) forces sound ON — budget for the audio rate.

**References & elements (kling-3.0 / omni)**
- Wired references are injected as `kling_elements` and MUST be mentioned as @element_name in the prompt — the editor's {image:N} tokens and the server prefixer handle this automatically; when hand-writing prompts, mention every element or it is silently ignored.
- kling-3-omni is image-to-video only (start frame required) and accepts up to 7 reference images; element voice references (element_input_audio_urls, 5-30s clips) bind a voice to an element.

**Limits**
- Kling 2.6 prompts cap at 1000 characters — front-load scene + dialogue and trim style tails first. kling-3.0 accepts long prompts.
- Durations: 2.6 = 5/10s; 3.0/omni = 3-15s. A spoken line needs roughly 1s per 2-3 words — don't script more dialogue than the clip can hold.

### MiniMax Hailuo 3 (minimax-h3)

Prompt structure (front-load what matters most):
precise subject → action details → scene/environment → lighting & color tone → camera movement → visual style → image quality → constraints. Prompts are natural language, 1-7000 characters, across all three modes.

**Modes (picked automatically from the wired inputs)**
- First frame and/or last frame connected, nothing else → exact frame mode (image-to-video): the output opens on the first frame and/or closes on the last. The clip's aspect is inferred from the frame — there is no aspect parameter in this mode.
- ANY reference connected (image, video, or audio) → reference mode (reference-to-video): frames ride along as reference images with a prompt directive binding them to the opening/closing position. Aspect defaults to adaptive (matches the input); a concrete ratio can be forced.
- Nothing visual connected → text-to-video. A concrete aspect ratio is required (21:9 / 16:9 / 4:3 / 1:1 / 3:4 / 9:16 — no adaptive); Nodaro renders 16:9 unless one is picked.

**References (when reference media is attached)**
- Refer to assets by ordinal in attachment order: "@Image 1", "Video 1", "Audio 1". Put the identity-critical asset first. (In the editor, the `{image:N:label}` / `{video:N}` / `{audio:N}` prompt tokens auto-emit this binding, so a wired reference and its mention stay in sync.)
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
- There is NO negative-prompt parameter — all constraints belong in the prompt text itself: "keep it subtitle-free, do not generate a watermark, do not generate a logo, stable picture".

_Generated from `PROVIDER_PROMPT_DOCTRINES` in `@nodaro/shared` — edit there, then `npm run gen:skills`._
<!-- AUTO-GEN:END provider-prompting -->
