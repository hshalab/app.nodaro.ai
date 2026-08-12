// Measure where the reference handles and the consuming node's input sit, and
// return cubic paths fanning one into the other.
//
// The design draws these as fixed SVG coordinates against a 1840x1000 frame.
// This page is fluid, so the coordinates are measured from the live DOM instead
// and recomputed on resize — the SHAPE (many fanning into one point) is the
// thing that carries the meaning, not the exact numbers.

import { useCallback, useLayoutEffect, useRef, useState } from "react"

export interface FanWires {
  width: number
  height: number
  paths: string[]
  /** Where the curves converge — the single input handle. */
  target: { x: number; y: number } | null
  sources: Array<{ x: number; y: number }>
}

const EMPTY: FanWires = { width: 0, height: 0, paths: [], target: null, sources: [] }

export function useFanWires(
  containerRef: React.RefObject<HTMLElement | null>,
  sourceRefs: React.RefObject<Array<HTMLElement | null>>,
  targetRef: React.RefObject<HTMLElement | null>,
  /** Recompute when this changes (e.g. the reference list identity). */
  deps: unknown,
): FanWires {
  const [wires, setWires] = useState<FanWires>(EMPTY)
  const frame = useRef<number | null>(null)

  const measure = useCallback(() => {
    const container = containerRef.current
    const target = targetRef.current
    if (!container || !target) {
      setWires(EMPTY)
      return
    }
    const box = container.getBoundingClientRect()
    const targetBox = target.getBoundingClientRect()

    const handles = (sourceRefs.current ?? []).filter((el): el is HTMLElement => !!el)
    const blank = { width: box.width, height: box.height, paths: [], target: null, sources: [] }
    if (handles.length === 0) {
      setWires(blank)
      return
    }

    const to = {
      x: targetBox.left - box.left,
      y: targetBox.top - box.top + targetBox.height / 2,
    }

    // Draw only while the target genuinely sits to the RIGHT of every handle.
    // Once the layout collapses into a stack the prompt is BELOW the
    // references, and curves drawn backwards across the column read as noise.
    // Ask the geometry rather than guessing at a breakpoint fraction — the
    // columns are fluid, so any fixed ratio is wrong at some width.
    const rightmost = Math.max(...handles.map((el) => el.getBoundingClientRect().right - box.left))
    if (to.x <= rightmost + 8) {
      setWires(blank)
      return
    }

    const sources: Array<{ x: number; y: number }> = []
    const paths: string[] = []
    for (const el of handles) {
      const b = el.getBoundingClientRect()
      const from = { x: b.right - box.left, y: b.top - box.top + b.height / 2 }
      sources.push(from)
      const dx = Math.max(28, (to.x - from.x) * 0.55)
      paths.push(`M ${from.x} ${from.y} C ${from.x + dx} ${from.y}, ${to.x - dx} ${to.y}, ${to.x} ${to.y}`)
    }

    setWires({ width: box.width, height: box.height, paths, target: to, sources })
  }, [containerRef, sourceRefs, targetRef])

  // Coalesce bursts of resize callbacks into one measurement per frame.
  const schedule = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      frame.current = null
      measure()
    })
  }, [measure])

  useLayoutEffect(() => {
    schedule()
    const container = containerRef.current
    if (!container || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(schedule)
    observer.observe(container)
    window.addEventListener("resize", schedule)
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", schedule)
      if (frame.current !== null) cancelAnimationFrame(frame.current)
    }
  }, [containerRef, schedule, deps])

  return wires
}
