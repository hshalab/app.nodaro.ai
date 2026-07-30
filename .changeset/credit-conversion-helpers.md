---
"@nodaro/shared": minor
---

feat: `usdToCredits(usd)` / `creditsToUsd(credits)` — the single place credit⇄USD arithmetic is written, derived from the existing `CREDIT_BASE_USD`.

Additive only; `CREDIT_BASE_USD` itself is unchanged at `$0.02`, so no consumer behaviour moves. Both helpers carry a milli-credit intermediate rounding guard: a bare `Math.ceil(usd / base)` over-charges a full credit whenever IEEE-754 division lands just above an integer (`0.14 / 0.02 = 7.000000000000001`).

Prefer these over dividing by the constant yourself — the conversion then stays correct and defined in one place.
