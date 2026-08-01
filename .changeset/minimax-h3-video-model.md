---
"@nodaro/shared": minor
"@nodaro/prompts": minor
---

Add MiniMax Hailuo 3 (`minimax-h3`) — a Seedance-2-class multimodal video model.

`@nodaro/shared`: `minimax-h3` joins the model catalog and every video provider registry (t2v + i2v arrays, reference limits 9 images / 3 videos / 3 audio, always-on `audio_driven` capability, adaptive default aspect, per-second duration tiers 4–15s, the reference-audio lip-sync surface, and the 7000-char prompt cap). New exports: `MINIMAX_H3_PROVIDERS`, `isMinimaxH3Provider`, and `PRICING_DEFAULT_DURATION_SEC` (prices a duration-less request at the model's own default duration — 6s for minimax-h3 — instead of the global 5s fallback, which `buildVideoCreditModelIdentifier` now consults). The model has a FIXED 2K output: no `resolutions` entry, and its credit identifier is duration-only (`minimax-h3:8s`) with no resolution or `-ref` dimension.

`@nodaro/prompts`: new provider prompt doctrine for `minimax-h3` (modes, ordinal reference conventions, always-on audio, per-second pricing guidance) and prompt-wizard capability lines for text-to-video and image-to-video. The existing `resolveSeedance2Inputs` resolver is reused by the new provider unchanged — same caps, same frames-fold-into-references semantics.
