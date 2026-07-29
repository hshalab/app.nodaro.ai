---
"@nodaro/shared": minor
---

Video analysis: a frame-sampling-rate lever, and cast diagnostics that reach the caller

**Sampling rate is now expressible.** A video content block carries an optional
`fps`, forwarded into the direct Google lane's per-part video metadata. Gemini
samples at 1 frame per second by default and this is the only way to ask for
more. Validated against Google's documented `(0, 24]` range before the clip is
uploaded, rather than after. The proxied lane cannot represent a sampling rate at
all, so it now throws on such a block instead of quietly analysing at the default
— a silent downgrade there is indistinguishable from success.

The rate stays at 1 for analysis, deliberately. Measured across three runs per
rate on a reference clip: raising it produced more scenes but read fine on-screen
detail *worse*, garbling the name tags on two characters' uniforms at 3 fps and
swapping the two characters outright at 6 fps, where every run at 1 fps agreed.
Scene count going up while scene accuracy went down is why the lever ships as a
documented knob rather than a raised default. Source resolution and bitrate turn
out not to affect the token bill at all — a 13× pixel-count range produced
identical counts — so downscaling before analysis is worth doing for upload
latency, never for cost.

**Cast reference refusals are no longer discarded.** `EntitySlot` gains
`refRejectedReason`, present only when the analyzer's vision pass actively
refused every candidate reference frame. The case that matters reads like "the
shots bound to this slot show someone else — cast as X, but on screen: Y": the
analyzer telling you a character's description and their own footage disagree.
That finding previously existed only inside a worker log line, indistinguishable
from five benign reasons a slot has no reference, even though it is the strongest
available signal that a character has been misidentified — and a wrong identity
propagates into every regenerated shot.

**Analysis results can carry diagnostics.** `VideoAnalysisResult` gains an
optional `warnings` array. There was previously no channel for these at all: the
merge layer has always produced warnings and the cast pass has always had
findings, and all of them died in worker logs the caller cannot see. A run that
dropped a duplicated line, folded a cast look, or concluded a character is not
who their description names looked identical to a clean one.

All three fields are additive and optional; existing producers and consumers are
unaffected.
