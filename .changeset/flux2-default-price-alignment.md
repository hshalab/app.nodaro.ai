---
"@nodaro/shared": patch
---

Correct the advertised Flux 2 Klein and Pro default-resolution prices in the model catalog.

The catalog listed the bare `flux-2-klein` / `flux-2-pro` identifiers at prices that disagreed with the per-megapixel grid entries for the very same resolution sitting on the adjacent line — the bare default said one thing, `flux-2-klein:1MP:0ref` said another. The grid values are the ones that bill, and the seeded pricing rows agree with them, so the bare defaults were the outlier: they were rounded up at the old coarse credit scale and then carried along by the x10 re-denomination, which amplified the rounding error.

Both now read the same value as their own grid entry, so the catalog no longer advertises a price no request can produce.
