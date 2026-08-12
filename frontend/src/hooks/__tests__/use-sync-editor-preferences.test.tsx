// The sync hook must never stomp a preference the user just set.
//
// Guards a real bug: the toolbar toggle writes the store optimistically and
// then invalidates the settings query. When the hook re-asserted the fetched
// value on every settle, the refetch landed a moment later and flipped the
// toggle back — double-click enlarged once, then started opening settings
// instead. It was only visible because the server was reporting a default
// (the column's migration had not run yet), but the race exists regardless.

import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"

const mockUseUserSettings = vi.fn()
const setVariableDisplayMode = vi.fn()
const setNodeDoubleClickAction = vi.fn()

vi.mock("@/hooks/queries/use-user-settings-queries", () => ({
  useUserSettings: (id: string | undefined) => mockUseUserSettings(id),
}))
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }))
vi.mock("@/hooks/use-workflow-store", () => ({
  useWorkflowStore: (selector: (s: unknown) => unknown) =>
    selector({ setVariableDisplayMode, setNodeDoubleClickAction }),
}))

import { useSyncEditorPreferences } from "../use-sync-editor-preferences"

const settings = (nodeDoubleClickAction: string, variableDisplayMode = "raw") => ({
  data: { nodeDoubleClickAction, variableDisplayMode },
})

describe("useSyncEditorPreferences", () => {
  beforeEach(() => vi.clearAllMocks())

  it("seeds the store from the saved values on first load", () => {
    mockUseUserSettings.mockReturnValue(settings("zoom", "annotated"))
    renderHook(() => useSyncEditorPreferences())
    expect(setNodeDoubleClickAction).toHaveBeenCalledWith("zoom")
    expect(setVariableDisplayMode).toHaveBeenCalledWith("annotated")
  })

  it("does NOT re-assert an unchanged value on refetch", () => {
    mockUseUserSettings.mockReturnValue(settings("settings"))
    const { rerender } = renderHook(() => useSyncEditorPreferences())
    expect(setNodeDoubleClickAction).toHaveBeenCalledTimes(1)

    // A refetch produces a NEW object with the SAME values — which is exactly
    // what an invalidate after an optimistic write looks like. Re-applying here
    // is what overwrote the user's click.
    act(() => { mockUseUserSettings.mockReturnValue(settings("settings")) })
    rerender()
    expect(setNodeDoubleClickAction).toHaveBeenCalledTimes(1)
  })

  it("applies a value that genuinely changed (another tab, Settings page)", () => {
    mockUseUserSettings.mockReturnValue(settings("settings"))
    const { rerender } = renderHook(() => useSyncEditorPreferences())

    act(() => { mockUseUserSettings.mockReturnValue(settings("zoom")) })
    rerender()
    expect(setNodeDoubleClickAction).toHaveBeenLastCalledWith("zoom")
    expect(setNodeDoubleClickAction).toHaveBeenCalledTimes(2)
  })

  it("does nothing at all until settings have loaded", () => {
    mockUseUserSettings.mockReturnValue({ data: undefined })
    renderHook(() => useSyncEditorPreferences())
    expect(setNodeDoubleClickAction).not.toHaveBeenCalled()
    expect(setVariableDisplayMode).not.toHaveBeenCalled()
  })
})
