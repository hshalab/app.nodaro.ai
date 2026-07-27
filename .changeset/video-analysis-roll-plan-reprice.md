---
"@nodaro/shared": minor
---

Video-analysis credit schedule now reflects the real best-of-N roll plan.

`VIDEO_ANALYSIS_BUCKET_CREDITS` was generated from a formula that modelled ONE
provider call per window, while the engine has run several independent passes per
window for many releases and kept the best. Every pass beyond the first was
therefore missing from the published prices, and the `mixed` rows had no formula
behind them at all. The generator now prices the same roll plan the engine
dispatches, so the table is derived end-to-end and a plan change moves the price
with it.

Per-bucket credits (≤60s · ≤180s · ≤360s · ≤600s):

- `gemini-3-flash` — 1·1·2·3 → 2·3·6·9
- `gemini-3.6-flash` — 2·2·5·9 → 5·6·15·25
- `gemini-3.1-pro` — 2·3·7·11 → 6·8·20·33
- `mixed` / `mixed-fast` — 3·4·9·14 → 10·13·35·57

No pricing constants changed; the difference is compute that was always being
spent. Consumers read this table for cost previews and credit reservation, so
displayed and charged costs both rise accordingly.
