---
"@nodaro/shared": minor
---

Generate Video Pro provider selection is now DERIVED from catalog capability instead of a hand-kept list: `GVP_SUPPORTED_PROVIDERS` is every catalogued video model that does `i2v`, carries the `reference-image` feature, declares segment durations, and has a working dispatch path — 10 SKUs, up from 3.

New exports:

- `GVP_EXTEND_PROVIDERS` / `supportsExtendRender()` — the subset whose transport supports the `extend` render method (a continuation tail sent as a reference video), derived from a new `"video-reference"` catalog feature. Resolves to exactly the family the previous hardcoded gate admitted, so the swap is behaviour-neutral.
- `GVP_END_FRAME_PROVIDERS` / `supportsEndAnchor()` — derived from the `"end-frame"` feature; the keyframes engine's end-anchor gate, replacing a provider-family name check that omitted `minimax-h3`.
- `segmentDurationsFor()`, `minSegmentSecFor()`, `maxSegmentSecFor()`, `hasContiguousSegmentDurations()`, `maxSegmentsFor()` — catalog readers for per-provider segment bounds, replacing the hardcoded `{minSeg: 4, maxSeg: 15}` that was only ever correct for the Seedance 2 family.
- `VIDEO_PROVIDERS_WITHOUT_DISPATCH` — catalogued, priced models with no working dispatch path (`kling-3-omni`). Capability alone is not sufficient to offer a model; this keeps a model that passes every capability check from being advertised when it would fail at the router.
- `GVP_DEFAULT_PROVIDER` — the SKU stale selections snap back to.

`MODEL_CATALOG` gains the `"video-reference"` feature on the Seedance 2 family and `minimax-h3`.
