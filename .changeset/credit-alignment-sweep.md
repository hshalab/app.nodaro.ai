---
"@nodaro/shared": patch
---

Re-denominate the credit tables the ×10 migration missed

`SCRAPER_CREDIT_COSTS` was left at the old credit base — every scraper SKU published a tenth of the real price. Values now come from `model_pricing`, and a backend guard (`shared-credit-table-sync.test.ts`) pins them equal to `STATIC_CREDIT_COSTS` so "must stay in sync" is a mechanism rather than a comment.

`TIER_MAX_PIPELINE_COST_CREDITS` was likewise left behind. Because those caps are a share of the tier's grant and the grants moved ×10, the caps had silently tightened tenfold — a basic-tier pipeline would abort at 300 credits out of a 4,500-credit grant. The guard now pins the ratio, not the number.
