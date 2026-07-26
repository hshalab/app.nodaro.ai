---
"@nodaro/shared": minor
---

video-analysis: `variationFolds` on `videoAnalysisResultSchema` — the analyzer's cap-fold record (`{slotId, variationId, label}[]`, optional). Folds were already persisted on the raw analysis (outside the schema); adding the field makes them survive strip-mode parses, so validated views (the recast client's blueprint) can render the "folded into default look" note the cast-variations spec (§6) requires as the user's pre-pay defense.
