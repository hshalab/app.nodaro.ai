---
"@nodaro/shared": patch
---

Default the qa-check feature to Gemini 3.6 Flash (`LLM_FEATURE_DEFAULTS["qa-check"]`), replacing Claude Sonnet 4.6. Explicit `llmModel` selections are unaffected; the default now bills the economy tier id `qa-check:economy` (still 1 credit).
