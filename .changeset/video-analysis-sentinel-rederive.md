---
"@nodaro/shared": patch
---

Re-derive the video-analysis SENTINEL credit rows (`mixed:*`, `smart:*`)

The credit re-denomination re-derived the 12 per-model buckets from the pricing formula but left the 8 sentinel buckets as a mechanical ×10, on the reasoning that sentinels sit outside the plugin's cross-check loop. Being outside the loop makes a row unguarded, not exempt — the same formula computes the sentinels, and a formula that rounds up to a whole credit does not commute with scaling.

These rows were over-charging by 0.1%–5.8%:

| id | was | now |
|---|---|---|
| `mixed:60s` | 110 | 104 |
| `mixed:180s` | 150 | 142 |
| `mixed:360s` | 380 | 372 |
| `mixed:600s` | 630 | 621 |
| `smart:60s` | 460 | 454 |
| `smart:180s` | 980 | 975 |
| `smart:360s` | 2110 | 2105 |
| `smart:600s` | 3500 | 3496 |

The bare `video-analysis` id (the unknown-model/unknown-duration ceiling) follows the table max: 3500 → 3496. `MODEL_CATALOG` and the published docs table are updated to match, and the plugin's cross-check now spans sentinels as well as models so this class of drift fails CI instead of shipping.
