---
"@nodaro/shared": patch
---

Video analysis: the `smart` tier now runs a continuity review over the finished shot list

Every analyzer pass reads one window and describes each shot in isolation, which it does well. Nothing in the pipeline has ever compared shot 4 with shot 11 — so a shot list could be locally correct and globally impossible. That is the failure class behind the reports of characters stepping onto an airless surface without helmets and wearing them in the next shot, props appearing from nowhere, a character asleep then awake then asleep, and dialogue attributed to whichever character was named most recently.

`smart` now adds one reasoning pass over the finished list that emits targeted corrections — scene, field, new value, reason — rather than rewriting it. Corrections are constrained: only descriptive fields can change (never timings, never the scene count), a speaker reassignment must name a character that scene already references, and a rewritten shot description must keep every character reference it had. Every correction, applied or refused, is recorded in the result's `warnings`, so the output is never silently different from what the analyzer produced.

It also consumes the cast-reference refusals added alongside it: when the vision pass looked at a character's own shots and saw somebody who does not match their description, the review is told so.

`smart` rises by 4 credits per duration bucket (**46 / 98 / 211 / 350**). **No other tier changes.** The pass costs the same regardless of tier or video length, and on the economy tiers that flat cost exceeds the entire analysis it would check — charging for it there would have more than doubled them and defeated the reason they exist. It belongs on the tier chosen when the shot list will drive regeneration, where an impossible shot becomes an expensive wrong render rather than a note in a transcript.

Failure posture is enrichment: any failure leaves the analysis exactly as the analyzer produced it.
