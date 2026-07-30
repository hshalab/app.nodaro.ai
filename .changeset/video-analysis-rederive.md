---
"@nodaro/shared": patch
---

fix: `VIDEO_ANALYSIS_BUCKET_CREDITS` re-derived at the current credit base rather than scaled.

The generating formula ceils USD into credits, so a finer base rounds less — the 60s `gemini-3-flash` bucket is 23, where a mechanical ×10 of the previous 3 would have given 30. Every formula-covered bucket moves the same way. Values now come from the generator itself, which a CI cross-check pins.
