---
"@nodaro/shared": minor
---

Video-analysis credit schedule re-derived for the direct provider lane.

The node is now pinned to the model provider's own API with no fallback, which
is what lets it send real media rather than a link. Its credit schedule,
however, was still generated against the aggregator's resale rates — roughly
30% of list — so every analysis job was priced against a lane it can no longer
reach.

These values are the same structural formula re-run against the rates the node
actually pays. The safety multiplier and USD-per-credit constant are unchanged;
only the token prices moved, so the node's margin is what it always was.

Per-bucket credits (≤60s · ≤180s · ≤360s · ≤600s):

- `fast` — 5·6·15·25 → 14·19·49·81
- `pro` — 6·8·20·33 → 21·27·72·120
- `mixed` / `mixed-fast` — 10·13·35·57 → 34·46·120·200

Consumers read this table for cost previews and credit reservation, so
displayed and charged costs both rise. On cloud the charged price comes from
the `model_pricing` table, which migration 276 updates to match.

Also adds a guard test cross-checking the model catalog's hand-copied pricing
rows against this table — they could previously drift silently, and the catalog
is what a user sees before running anything.
