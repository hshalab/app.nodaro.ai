import { describe, it, expect } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useTutorialFocus } from "../use-tutorial-focus"

describe("useTutorialFocus", () => {
  it("starts in tutorial view with nothing focused", () => {
    const { result } = renderHook(() => useTutorialFocus())
    expect(result.current.view).toBe("tutorial")
    expect(result.current.step).toBe(0)
    expect(result.current.reference).toBe(0)
  })

  it("switches view without disturbing focus", () => {
    const { result } = renderHook(() => useTutorialFocus())
    act(() => result.current.focusStep(3))
    act(() => result.current.setView("canvas"))
    expect(result.current.view).toBe("canvas")
    expect(result.current.step).toBe(3)
  })

  it("focuses and releases a step", () => {
    const { result } = renderHook(() => useTutorialFocus())
    act(() => result.current.focusStep(2))
    expect(result.current.step).toBe(2)
    act(() => result.current.clearStep())
    expect(result.current.step).toBe(0)
  })

  // Hovering a token is a statement about BOTH things at once: this reference,
  // inside this step. Setting only one of them leaves the page half-lit.
  it("focusing a reference also focuses the step that owns the prompt", () => {
    const { result } = renderHook(() => useTutorialFocus())
    act(() => result.current.focusReference(4, 2))
    expect(result.current.reference).toBe(4)
    expect(result.current.step).toBe(2)
  })

  // Moving between two adjacent tokens fires leave-then-enter. If leaving reset
  // the step, the whole column would flash back to overview between them.
  it("releasing a reference keeps the step focused", () => {
    const { result } = renderHook(() => useTutorialFocus())
    act(() => result.current.focusReference(4, 2))
    act(() => result.current.clearReference())
    expect(result.current.reference).toBe(0)
    expect(result.current.step).toBe(2)
  })

  it("leaving the rail releases the reference too, returning to overview", () => {
    const { result } = renderHook(() => useTutorialFocus())
    act(() => result.current.focusReference(1, 2))
    act(() => result.current.clearStep())
    expect(result.current.step).toBe(0)
    expect(result.current.reference).toBe(0)
  })

  it("moving from one reference to another replaces it", () => {
    const { result } = renderHook(() => useTutorialFocus())
    act(() => result.current.focusReference(1, 2))
    act(() => result.current.focusReference(5, 2))
    expect(result.current.reference).toBe(5)
  })
})
