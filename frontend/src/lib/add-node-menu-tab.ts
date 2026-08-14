/**
 * Add Node menu mode (the tabs above the popup's search box):
 *  - "common"                  — the curated COMMON view
 *  - "image"/"video"/"audio"   — everything that DEALS WITH that medium, in
 *                                families, with Creative Controls at the foot
 *  - "models"                  — the model-tree browser, plus Generation Settings
 *  - "assets"/"automate"/"publish" — the non-media intent tabs
 *  - "all"                     — every family once, under `TAB · FAMILY` headers
 *
 * Tab membership is a DISPLAY superset ("deals with", not only "produces") and
 * is defined by `node-families.ts`. It is unrelated to the producer sets, which
 * are execution contracts.
 *
 * The last explicit user choice is remembered across sessions; a stored value
 * from an older tab set falls back to "common" rather than crashing the popup.
 */
export const ADD_NODE_MENU_TABS = [
  "common",
  "image",
  "video",
  "audio",
  "models",
  "assets",
  "automate",
  "publish",
  "all",
] as const
export type AddNodeMenuTab = (typeof ADD_NODE_MENU_TABS)[number]

export const ADD_NODE_MENU_TAB_KEY = "nodaro:addNodeMenuTab"

export function readAddNodeMenuTab(): AddNodeMenuTab {
  try {
    const stored = localStorage.getItem(ADD_NODE_MENU_TAB_KEY)
    return (ADD_NODE_MENU_TABS as readonly string[]).includes(stored ?? "")
      ? (stored as AddNodeMenuTab)
      : "common"
  } catch {
    return "common"
  }
}

export function persistAddNodeMenuTab(tab: AddNodeMenuTab): void {
  try {
    localStorage.setItem(ADD_NODE_MENU_TAB_KEY, tab)
  } catch {
    /* ignore */
  }
}

/** The neighbouring tab in display order — `dir` 1 cycles forward (Tab), -1 backward (Shift+Tab). */
export function nextAddNodeMenuTab(tab: AddNodeMenuTab, dir: 1 | -1 = 1): AddNodeMenuTab {
  const n = ADD_NODE_MENU_TABS.length
  const i = ADD_NODE_MENU_TABS.indexOf(tab)
  return ADD_NODE_MENU_TABS[(i + dir + n) % n]
}

/** Session-scoped Creative Controls open/closed state (design: "remembered for
 *  the session"), so it resets on a new tab/window but survives reopening the
 *  popup. */
export const CREATIVE_CONTROLS_OPEN_KEY = "nodaro:addNodeCreativeControlsOpen"

export function readCreativeControlsOpen(): boolean {
  try {
    return sessionStorage.getItem(CREATIVE_CONTROLS_OPEN_KEY) === "1"
  } catch {
    return false
  }
}

export function persistCreativeControlsOpen(open: boolean): void {
  try {
    sessionStorage.setItem(CREATIVE_CONTROLS_OPEN_KEY, open ? "1" : "0")
  } catch {
    /* ignore */
  }
}
