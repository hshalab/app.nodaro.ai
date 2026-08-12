// The entire interactive state of a tutorial: which step is focused and which
// reference is focused. Three values, one place, so a bespoke tutorial body
// never grows its own copy of the rules.

import { useCallback, useState } from "react"

export type TutorialView = "tutorial" | "canvas"

export interface TutorialFocus {
  view: TutorialView
  setView: (view: TutorialView) => void
  /** 0 = overview (nothing focused), else the 1-based step number. */
  step: number
  /** 0 = none, else the `{image:N}` position being hovered. */
  reference: number
  focusStep: (step: number) => void
  clearStep: () => void
  /**
   * Hovering a prompt token focuses BOTH the reference and the step that owns
   * the prompt — the point of the interaction is that the token, the reference
   * image and the explanation light up together.
   */
  focusReference: (reference: number, step: number) => void
  /** Leaving a token releases the reference but KEEPS the step focused, so the
   *  group does not flash back to overview between two adjacent tokens. */
  clearReference: () => void
}

export function useTutorialFocus(initialView: TutorialView = "tutorial"): TutorialFocus {
  const [view, setView] = useState<TutorialView>(initialView)
  const [step, setStep] = useState(0)
  const [reference, setReference] = useState(0)

  const focusStep = useCallback((next: number) => setStep(next), [])

  const clearStep = useCallback(() => {
    setStep(0)
    setReference(0)
  }, [])

  const focusReference = useCallback((nextRef: number, nextStep: number) => {
    setReference(nextRef)
    setStep(nextStep)
  }, [])

  const clearReference = useCallback(() => setReference(0), [])

  return { view, setView, step, reference, focusStep, clearStep, focusReference, clearReference }
}
