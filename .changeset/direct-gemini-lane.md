---
"@nodaro/shared": minor
---

LLM model registry can now declare a direct Google Gemini serving lane.

`LlmModelDef` gains two optional fields, so which upstream serves a Gemini
model is registry data rather than a decision baked into the client:

- `directGeminiModel` — the model's id on Google's own API. Stated, never
  derived: Google carries `-preview` suffixes on unreleased models, so the id
  routinely differs from both `id` and `kieSlugOrModel` (`gemini-3.1-pro` →
  `gemini-3.1-pro-preview`).
- `preferDirect` — try the direct lane first, with KIE as the fallback. Absent
  (while `directGeminiModel` is set) means KIE first and direct only on
  failure. Mutually exclusive with `preferKie`.

Lane choice is a cost decision, not just a routing one: the two lanes bill the
same model at materially different unit rates. `gemini-3.1-pro` is declared
direct-first (premium tier, lowest call volume); `gemini-3-flash` and
`gemini-3.6-flash` stay KIE-first with direct as a reliability backstop,
because `gemini-3.6-flash` backs five feature defaults plus the
video-analysis fast tier and so carries the highest volume.

`getLlmModel` also resolves a model by its direct Google id, so cost and usage
reconciliation can look models up by whichever id appeared on the wire.

Both fields are optional and unset on every non-Google model, so existing
consumers are unaffected.
