---
"@nodaro/shared": minor
---

LLM registry: new `thinkingDefaultOn` capability flag on `LlmModelDef`, set on `claude-opus-5`. It marks a model that reasons even when NO `thinking` parameter is sent, so its reasoning tokens share the `max_tokens` budget on **every** call rather than only effort-bearing ones (Claude Opus 5 flipped this vendor default; Opus 4.8/4.7 and Sonnet 5 still mean "no thinking" when the param is omitted). Consumers floor their output cap on the flag instead of on the requested effort level, which is what keeps Effort=Auto calls from truncating. Also: `claude-opus-4.7`'s description no longer claims "Highest quality, complex tasks" — that superlative rendered in every model picker and steered quality-critical work to the oldest of three Opus entries.
