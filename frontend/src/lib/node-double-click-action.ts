/**
 * What double-clicking a node on the canvas does.
 *
 * Two people who use the editor daily want opposite behaviour here, so it is a
 * per-user preference rather than a default to argue about. Toggled from the
 * editor toolbar, persisted on `profiles.node_double_click_action`.
 *
 * `Enter` is deliberately NOT governed by this — it always zooms, in either
 * mode, so both actions stay reachable at once: mouse does one, keyboard the
 * other.
 */
export type NodeDoubleClickAction = "zoom" | "settings"

export const DEFAULT_NODE_DOUBLE_CLICK_ACTION: NodeDoubleClickAction = "settings"

/** The label shown for each mode — the toolbar toggle and its tooltip share it. */
export const NODE_DOUBLE_CLICK_LABEL: Record<NodeDoubleClickAction, string> = {
  zoom: "Enlarge node",
  settings: "Node settings",
}
