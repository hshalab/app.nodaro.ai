---
"@nodaro/shared": minor
"@nodaro/sdk": minor
"@nodaro/cli": minor
---

Expose LLM Advanced mode on every programmatic surface, and single-source the
route defaults it seeds from.

Advanced mode pins an LLM call to the vendor's own API — the only lane where
`temperature`, `maxTokens` and the full reasoning-effort range actually take
effect — and bills one credit tier up. It shipped on the canvas and the REST
routes, but the SDK, CLI and MCP tools had no way to send it, so anything built
on top of Nodaro was stuck on the aggregator lane with no signal that the
sampling knobs it was passing were being ignored.

- `@nodaro/shared` — new `LLM_ROUTE_DEFAULTS` / `llmRouteDefaults(feature)`: the
  per-feature `temperature` / `maxTokens` / `structuredOutput` each LLM route
  runs with. Previously these lived as literals inside ten separate routes while
  the config panel displayed a hardcoded 0.7/2048, so a node showed one number
  and ran another — and a single arrow-key press committed the wrong one.
- `@nodaro/sdk` — `promptHelper.*` accepts `advancedMode` / `temperature` /
  `maxTokens`.
- `@nodaro/cli` — `--advanced`, `--temperature`, `--max-tokens` on the prompt
  subcommands.
