---
"@nodaro/shared": major
---

**BREAKING: `CREDIT_BASE_USD` changes from `0.02` to `0.002`.**

One credit is now worth $0.002 instead of $0.02, so every credit quantity in the platform is ten times larger for the same dollar value. Balances, grants and historical records were migrated ×10 in the same release; nothing changed in what anything costs in dollars.

Anything that converts between credits and USD — or that hardcodes an assumption about a credit's worth — must be re-checked. Use `usdToCredits()` / `creditsToUsd()` rather than dividing by the constant yourself; they carry a rounding guard and will keep working across any future change.

The motivation was rounding: at $0.02 a credit, `ceil()` charged a 1-credit minimum for work costing a fraction of that. Replayed across 12,809 real jobs, the median small job was paying 2.0× its true cost and now pays 1.20×.
