---
"@nodaro/shared": minor
---

LLM registry: add **Claude Opus 5** (`claude-opus-5`, KIE messages endpoint, premium tier, full reasoning ladder `low`–`max`, temperature-less, preferKie with direct-Anthropic fallback). It joins every registry-derived surface automatically (model pickers, route Zod enums, `STRUCTURED_VISION_MODELS`, modality caps). Behind-the-scenes older-Opus defaults move to it: `LLM_FEATURE_DEFAULTS["describe-to-picker"]` is now `claude-opus-5` (was `claude-opus-4.7`), and `PIPELINE_PINNABLE_SCRIPT_LLMS` gains `claude-opus-5` as a pinnable film-pipeline script model.
