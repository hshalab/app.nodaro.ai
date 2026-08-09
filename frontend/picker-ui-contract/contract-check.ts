/**
 * Rich-lane contract check — asserts the PRIVATE `@nodaroai/picker-ui`
 * package satisfies the seam's type contract (the stub module).
 *
 * App code always typechecks against the stub (tsc never resolves the
 * private package — community checkouts have no registry access), so the
 * rich lane's type-compatibility is pinned HERE instead: every value the
 * stub exports must exist on the package with an assignable type.
 *
 * Runs via `npm run typecheck:picker-ui` (tsconfig.picker-ui.json) — only in
 * environments where the package is installed (internal CI / first-party dev).
 * It is deliberately OUTSIDE `src/` so the main tsconfig never sees it.
 */
import * as Rich from "@nodaroai/picker-ui"
import * as Stub from "../src/lib/picker-ui/stub"

// Namespace-level assignability: rich must provide every stub VALUE export
// with a compatible type. (Type-only exports are erased from namespaces;
// component/props parity is what shared app code actually depends on.)
// PICKER_UI_MODE is the one deliberate divergence — it IS the lane marker
// ("rich" vs "stub"), so it is exempted from the parity assertion.
type ContractSurface = Omit<typeof Stub, "PICKER_UI_MODE">
const richSatisfiesContract: ContractSurface = Rich
void richSatisfiesContract
