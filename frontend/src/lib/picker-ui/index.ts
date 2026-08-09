/**
 * The picker-ui SEAM — the single import path for everything that moved into
 * the private `@nodaroai/picker-ui` package (animated previews, rich pickers,
 * the @-mention prompt editor, the parameter-picker registry).
 *
 * Two lanes, chosen at build time (see ./rich-or-stub.ts):
 *   - RICH: the private package is installed (first-party builds) — vite
 *     aliases the switch file to `@nodaroai/picker-ui`.
 *   - STUB: community/self-host builds without registry access — plain
 *     functional fallbacks (text tiles, per-field selects, TagTextarea).
 *
 * App code imports ONLY from here (`@/lib/picker-ui`); the stub module is
 * also the seam's type contract for shared code. Wiring DATA for both lanes
 * comes from `@nodaro/prompts` (`picker-wiring.ts`) — single source of truth.
 */
// Bare specifier resolved by vite/vitest alias (pickerUiAlias in
// vite.config.ts) → the private package in rich builds, ./stub otherwise;
// tsc resolves it via tsconfig `paths` → always the stub (the type contract).
export * from "picker-ui-impl"

// Lane-switched styles: package CSS in rich builds, empty in community.
import "picker-ui-impl-styles.css"
