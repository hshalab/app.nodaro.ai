---
"@nodaro/shared": minor
---

LLM registry: add **Gemini 3.6 Flash** (`gemini-3.6-flash`, KIE OpenAI-compat endpoint `gemini-3-6-flash-openai`, economy tier, image+video+audio, `low`/`high` reasoning levels) and **Claude Fable 5** (`claude-fable-5`, KIE messages endpoint, premium tier, full reasoning ladder, temperature-less). Feature defaults for `llm-chat`, `prompt-helper`, `generate-script`, and `translate` move to `gemini-3.6-flash`. Video-analysis `fast` tier is now backed by `gemini-3.6-flash` (bucket credits 2/2/5/9); `gemini-3-flash` becomes an explicit legacy model (`VIDEO_ANALYSIS_LEGACY_MODELS`, new export) so stored raw-model configs keep resolving and pricing unchanged.
