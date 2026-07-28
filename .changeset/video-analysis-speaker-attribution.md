---
"@nodaro/shared": minor
---

Video-analysis speech layers can name the on-screen speaker.

`AudioLayer` gains an optional `speakerSlot` — the `slotId` of the character
saying the words. `voice` already carried a casting note ("male, proud
triumphant shouting") but nothing said whose voice it was, so a recreation had to
guess. Usually one person speaks per scene and the guess is right, which is
exactly why the scenes with two speakers across one cut failed silently.

Additive and optional: consumers that ignore it are unaffected, and it is absent
whenever the analyzer cannot attribute a line — including two cases where it is
deliberately never set. An unseen narrator is never a slot (a slot is something
you see), so its casting stays in `voice`; a visible one-off speaker has no slot
to reference.

Two sanitizers ship with it, mirroring the existing binding pair:
`rewriteSpeakerSlots` follows attribution through cross-window slot unification
(the counterpart to `rewriteSceneBindings`), and `dropUnknownSpeakers` strips
attribution naming a slot that no longer exists or riding a `music`/`sfx` layer
(the counterpart to `dropUnknownBindings`). Attribution deliberately does NOT
count as a slot reference for the orphan sweep — a slot reachable only as a
speaker is a voice with no body, the phantom-narrator defect that sweep exists to
kill.
