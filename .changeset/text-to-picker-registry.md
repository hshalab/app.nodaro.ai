---
"@nodaro/prompts": minor
---

Extend `PICKER_ANALYZER_REGISTRY` from 5 to all 38 picker catalogs — 25 new
flat descriptors (setting, atmosphere, style, mood, color-look, photographer,
aesthetic, era, photo-genre, backdrop, render-quality, composition-effects,
post-process-effects, action-fx, loop-subject, transition, character-fx, pose,
material, held-prop, camera-motion, animal, vehicle, weapon, furniture) and 8
new discriminated ones (lighting, temporal, exposure-settings, music-genre,
music-mood, instrumentation, voice-character, voice-delivery; the sound/voice
pickers synthesize entries across their per-field catalogs with an explicit
dimension tag). Adds `PICKER_ANALYZER_FAMILIES` — the 6-family partition
(scene/look/camera/character/elements/audio) the text-to-picker route uses to
batch analysis calls (a single all-38 legend measures ~53k tokens).
