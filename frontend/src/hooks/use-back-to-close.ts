import { useEffect, useRef } from "react"

/**
 * Push a history entry when `open` becomes true so that pressing
 * the mobile back button/gesture closes the modal instead of
 * navigating away from the page.
 *
 * Two hardenings, both load-bearing (surfaced by the paint-mask node,
 * which mounts the modal WITH open=true instead of toggling a prop):
 *
 * 1. `onClose` is read through a ref so effects depend on `open` only.
 *    With `onClose` in the dep array, an inline-arrow callback re-ran the
 *    effect on every parent render while open, and the cleanup's
 *    `history.back()` fired → popstate → onClose() — silently closing
 *    the modal the moment its parent re-rendered.
 *
 * 2. The pushState is deferred by one macrotask. Under React StrictMode
 *    (dev), a component mounting with open=true runs mount → simulated
 *    unmount → remount; a synchronous push meant the simulated unmount's
 *    cleanup called history.back(), whose ASYNC popstate landed after the
 *    remount and read as "user pressed back" — self-closing the modal.
 *    Deferring the push lets the simulated unmount cancel it before any
 *    history mutation happens.
 */
export function useBackToClose(open: boolean, onClose: () => void) {
  const pushed = useRef(false)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return

    let alive = true
    const pushTimer = window.setTimeout(() => {
      if (alive && !pushed.current) {
        // Push a dummy state so "back" has somewhere to go
        window.history.pushState({ modal: true }, "")
        pushed.current = true
      }
    }, 0)

    const handlePopState = () => {
      // Back was pressed — close the modal instead of navigating
      pushed.current = false
      onCloseRef.current()
    }

    window.addEventListener("popstate", handlePopState)
    return () => {
      alive = false
      window.clearTimeout(pushTimer)
      window.removeEventListener("popstate", handlePopState)
      // If the modal closes programmatically (not via back), remove the
      // extra history entry we pushed so the stack stays clean.
      if (pushed.current) {
        pushed.current = false
        window.history.back()
      }
    }
  }, [open])
}
