// The Canvas-mode reveal gate must never be able to hang.
//
// This guards a real regression: gating reveal on React Flow's
// `useNodesInitialized` alone left the Multi-Reference Control canvas invisible
// indefinitely — all eight of its nodes measured correctly in the DOM, but the
// store flag never turned true. Nothing failed; the canvas simply never
// appeared. If someone later simplifies the gate back to signal-only, these
// tests fail instead of the tutorial.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useRevealDecision, REVEAL_BACKSTOP_MS } from "../use-reveal-decision"

describe("useRevealDecision", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("reveals as soon as the graph reports itself measured", () => {
    const { result } = renderHook(() => useRevealDecision(true, false))
    expect(result.current).toBe(true)
  })

  it("reveals immediately when there are no nodes to measure", () => {
    // Nothing will ever measure, so waiting for a signal would hide an empty
    // canvas behind "Loading" forever.
    const { result } = renderHook(() => useRevealDecision(false, true))
    expect(result.current).toBe(true)
  })

  it("reveals on the deadline when the measurement signal never arrives", () => {
    const { result } = renderHook(() => useRevealDecision(false, false))
    expect(result.current).toBe(false)

    act(() => void vi.advanceTimersByTime(REVEAL_BACKSTOP_MS - 1))
    expect(result.current).toBe(false)

    act(() => void vi.advanceTimersByTime(1))
    expect(result.current).toBe(true)
  })

  it("stays revealed once the signal arrives, even if it flickers off", () => {
    // All-or-nothing signals can drop back to false when a node re-measures.
    // Hiding an already-visible canvas would read as a flash of breakage.
    const { result, rerender } = renderHook(
      ({ measured }) => useRevealDecision(measured, false),
      { initialProps: { measured: true } },
    )
    expect(result.current).toBe(true)

    rerender({ measured: false })
    act(() => void vi.advanceTimersByTime(REVEAL_BACKSTOP_MS))
    expect(result.current).toBe(true)
  })

  it("holds the canvas back while the graph is still measuring", () => {
    // The whole point of the gate: before measurement, React Flow paints edges
    // toward positions no node occupies yet.
    const { result } = renderHook(() => useRevealDecision(false, false))
    act(() => void vi.advanceTimersByTime(200))
    expect(result.current).toBe(false)
  })
})
