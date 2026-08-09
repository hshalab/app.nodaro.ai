---
"@nodaro/prompts": minor
---

Add `picker-wiring.ts` — the parameter-picker wiring vocabulary as data:
`SINGLE_PICKER_WIRING` / `MULTI_PICKER_WIRING` / `getPickerWiring` with each
picker node type's value field(s), default, catalog id, entries, grouping, and
per-field option lists (`fieldOptions`) for multi-dim pickers. Extracted from
the app's parameter-picker registry so the app's community fallback, the
first-party rich picker package, and Nodaro Cine all share one definition.
Renderers are deliberately excluded — this is vocabulary, not presentation.
