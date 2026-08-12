// When Canvas mode is allowed to show itself.
//
// Split out from the component so the decision can be tested without a laid-out
// React Flow — jsdom has no layout, so the measurement signals can never be
// exercised there, but the two ways this can go WRONG can be, and those are the
// ones that have actually bitten.

import { useEffect, useRef, useState } from "react"

/** How long to wait for a measurement signal before revealing anyway. */
export const REVEAL_BACKSTOP_MS = 1500

/**
 * True once the canvas should be visible.
 *
 * Three independent triggers, and the third is the point: a measurement signal
 * that is all-or-nothing across every node can stall on one odd node and never
 * arrive. Gating solely on such a signal left the Multi-Reference Control canvas
 * hidden forever, which is a worse failure than the half-painted frame the gate
 * exists to hide. The deadline makes "permanently invisible" unreachable no
 * matter what a snapshot contains.
 *
 * Latches: an all-or-nothing signal can drop back to false when a node
 * re-measures, and re-hiding a canvas the viewer is already looking at would
 * read as a flash of breakage.
 *
 * @param measured whether the graph reports itself measured
 * @param empty    a graph with no nodes never measures, so it reveals at once
 */
export function useRevealDecision(measured: boolean, empty: boolean): boolean {
  const [expired, setExpired] = useState(false)
  const revealed = useRef(false)

  useEffect(() => {
    const t = window.setTimeout(() => setExpired(true), REVEAL_BACKSTOP_MS)
    return () => window.clearTimeout(t)
  }, [])

  if (measured || empty || expired) revealed.current = true
  return revealed.current
}
