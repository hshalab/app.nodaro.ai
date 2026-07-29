---
"@nodaro/shared": minor
---

Video analysis: new `smart` tier, and the existing tiers get much cheaper

The analysis tiers now split across two serving transports, which turns a single
quality/price compromise into an actual choice.

**The existing tiers move to the cheaper transport and the cheaper model
generation.** That transport bills 3–4× less per token and additionally performs no
deep reasoning, so its passes emit roughly a quarter of the output tokens — the two
together drop these tiers by 10–18×. They are also less accurate, which is the
trade being made deliberately: several cheap passes with a grader picking between
them, rather than one expensive good one. Because roughly a third of calls on that
transport come back unusable, the multi-pass structure is what makes them reliable
rather than an extravagance.

**`smart` is new** — a single pass on the native transport with reasoning and frame
sampling turned all the way up. It is the only tier whose accuracy was measured
against a hand-counted edit list, and the only one that does not depend on voting
to be usable. On a reference clip with 18 real shots it reported 16–17 scenes with
**every** scene start landing on a real cut, with no boundary list supplied, and
identified the cast by appearance in every run. Validated across three clips
totalling 138 seconds, two of them at roughly one cut per second.

| tier | ≤60s | ≤180s | ≤360s | ≤600s |
|---|---|---|---|---|
| `fast` | 3 | 4 | 9 | 14 |
| `pro` | 9 | 12 | 30 | 49 |
| `mixed` / `mixed-fast` | 11 | 15 | 38 | 63 |
| `smart` | 42 | 94 | 207 | 346 |

**The measured shot-boundary detector is no longer used by any tier.** It was
over-reporting by 60% on real footage — 29 shots against a hand-counted 18 —
because it read periodic motion as edits: the clip is two figures bounding across a
surface at about one stride per 0.8 s and every footfall registered as a cut. Its
boundaries had a spacing coefficient of variation of 0.06 against 0.85 for the real
edits, a metronome rather than an edit list. That was not cosmetic: told 29 shots
existed when 18 did, a pass exhausted its whole output budget describing shots that
are not there, returned unparseable output, and cost roughly four times normal
before retrying. Removing it is a quality fix for every tier.

**Cast identity now comes from appearance, never from on-screen text.** Reading
name badges off uniforms was the source of a field defect where a character shipped
under a misread name. Across ten configurations exactly one read both badges
correctly; describing the same people by appearance was correct in all ten.

Also: `EntitySlot.refRejectedReason` and `VideoAnalysisResult.warnings` are new and
optional. The vision pass that picks a cast reference frame can refuse every
candidate because the people on screen do not match the casting description — the
strongest available signal that a character has been misidentified, which
previously existed only inside a worker log.
