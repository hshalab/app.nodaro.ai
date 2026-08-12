import { useEffect, useRef } from "react"
import { useUserSettings } from "@/hooks/queries/use-user-settings-queries"
import { useWorkflowStore } from "@/hooks/use-workflow-store"
import { useAuth } from "@/hooks/use-auth"

/**
 * Seed the workflow store's per-user editor preferences from the saved values.
 *
 * These preferences are READ from the Zustand store by a lot of call sites (22
 * for the variable display mode alone), so the store stays the in-memory source
 * of truth and this hook is the one thing that fills it. None of those call
 * sites changed, and none of them pays for a query.
 *
 * It applies a server value only when that value CHANGES — not on every
 * refetch. That distinction is load-bearing, not an optimisation: the toolbar
 * toggle writes the store directly and optimistically, then invalidates the
 * query, so a hook that re-asserted the fetched value on every settle would
 * stomp the user's click a moment after they made it. Exactly that happened —
 * double-click would enlarge once, then the toggle flipped itself back and the
 * next one opened settings, because the server was still reporting the default.
 *
 * Following changes (rather than reading once) is what keeps a change made in
 * another tab, or on the Settings page, propagating without a reload.
 */
export function useSyncEditorPreferences(): void {
  const { user } = useAuth()
  const { data: settings } = useUserSettings(user?.id)
  const setVariableDisplayMode = useWorkflowStore((s) => s.setVariableDisplayMode)
  const setNodeDoubleClickAction = useWorkflowStore((s) => s.setNodeDoubleClickAction)
  // The last values we took FROM the server, so an unchanged refetch is a no-op.
  const applied = useRef<{ variableDisplayMode?: string; nodeDoubleClickAction?: string }>({})

  useEffect(() => {
    if (!settings) return
    if (applied.current.variableDisplayMode !== settings.variableDisplayMode) {
      applied.current.variableDisplayMode = settings.variableDisplayMode
      setVariableDisplayMode(settings.variableDisplayMode)
    }
    if (applied.current.nodeDoubleClickAction !== settings.nodeDoubleClickAction) {
      applied.current.nodeDoubleClickAction = settings.nodeDoubleClickAction
      setNodeDoubleClickAction(settings.nodeDoubleClickAction)
    }
  }, [settings, setVariableDisplayMode, setNodeDoubleClickAction])
}
