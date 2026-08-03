---
"@nodaro/shared": patch
---

`isOversizedScene` no longer flags a scene that sits exactly on the 8s cap.

Scene length is derived by subtracting two decimal timecodes, which does not land on the cap exactly — a real job produced a `12.67 → 20.67` scene whose computed length is `8.000000000000002`, so an in-spec scene was marked `oversized: true` and carried that defect marker into every downstream consumer (the merge layer sets it at `pipeline/merge.ts`, and the recast planner reads it).

The comparison now allows a 1µs tolerance. That is orders of magnitude below any boundary precision the analyzer can resolve, so it cannot mask a genuinely oversized scene — the smallest real overshoot is still ~10000x larger than the tolerance.
