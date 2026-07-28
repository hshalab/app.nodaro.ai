---
"@nodaro/shared": minor
---

Reprice video-analysis against MEASURED provider cost — the previous schedule was below cost.

Job `f3ed1390` (mixed + combine, 35.9s) reported `provider_cost` **$1.353385**
against 34 credits of revenue (**$0.68**). The run cost **1.99× what it charged**,
where the formula intends a 2× margin — so every analysis at the old schedule was
underwater, not merely thin.

Two constants were wrong, both in the same direction:

- **The per-window output-token estimate: 4,000 → 11,200.** ~11.2k is the highest
  combined thinking+answer actually observed, and Gemini bills thinking as output.
  The old value was described as carrying "deliberate headroom" while sitting below
  even the measured typical.
- **The grader + combine-refine passes** were assumed to be "roughly a quarter" of
  roll spend and left inside `SAFETY`. Measured against this run they are **1.78×**
  of it. Now an explicit `PLAN_OVERHEAD` factor rather than an unstated hope, so
  `SAFETY` is margin again instead of silently absorbing a modelling gap.

Per-bucket credits (≤60s · ≤180s · ≤360s · ≤600s):

- `gemini-3-flash` — 6·7·18·30 → **21·24·68·112**
- `gemini-3.6-flash` (`fast`) — 14·19·49·81 → **54·63·175·291**
- `gemini-3.1-pro` (`pro`) — 21·27·72·120 → **84·96·269·448**
- `mixed` / `mixed-fast` — 34·46·120·200 → **137·158·443·739**

No rate changed; this is compute that was always being spent and never billed.

**The roll plan is the real lever, not the price.** Six rolls per window is
essentially all of this cost: one `pro` roll at 3fps prices at ~18 credits against
137 for the 6-roll mixed plan, while seeing 3× the frames. This schedule makes the
current plan honest; moving to a direct high-fps single pass would bring it back
below even the old numbers, and should be repriced again when it lands.
