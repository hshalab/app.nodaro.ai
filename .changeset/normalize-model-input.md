---
"@nodaro/shared": minor
---

Add `normalizeModelInput` / `normalizeNodeModelParams` — the correcting twin of the existing `validateModelInput`.

Validation is the right answer when a caller is composing a single request and can retry, which is why the MCP verb tools use it. It is the wrong answer at a persistence or execution boundary: rejecting there turns a fixable parameter into a failed workflow run, and an aborted run takes every already-generated, already-billed sibling node down with it.

`normalizeModelInput(modelId, input)` coerces `aspectRatio` / `resolution` / `quality` / `duration` into a combination the model actually accepts and reports every correction in an `adjustments` array so callers can disclose what changed instead of silently substituting. The rules mirror the editor's provider-change snap: a lever the model doesn't expose is dropped, an out-of-range value snaps to the model's default (`defaultResolutionFor`, also newly exported) or its first valid option, and model-specific cross-field constraints are applied last. Equivalent spellings of the same setting canonicalize rather than snap — Flux 2 stores a bare megapixel count (`"1"`) against the catalog's display form (`"1 MP"`), and treating that as invalid would move a correctly-configured node to a different pricing tier.

`normalizeNodeModelParams(nodes)` applies the same rules across a React Flow graph, immutably: untouched nodes come back by reference so a delta/CAS save sees no spurious change. Multi-provider nodes are skipped deliberately — the valid set there is an intersection with no single defensible replacement.

Both derive entirely from `MODEL_CATALOG`, so declaring `aspectRatios` / `resolutions` / `qualities` honestly on a new model entry is all that is needed for it to be covered. A catalog-wide invariant test pins that normalizer output always satisfies `validateModelInput`.
