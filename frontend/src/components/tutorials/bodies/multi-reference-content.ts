// Prose for the Multi-Reference tutorial.
//
// ONLY text that has no home in the workflow lives here. Reference names, the
// prompt, the model settings and the result image are all derived from the
// template snapshot at render time, so republishing the template cannot leave
// this file lying.

/** What each reference position contributes, keyed by its `{image:N}` number. */
export const REFERENCE_ROLES: Record<number, string> = {
  1: "the person",
  2: "the hat",
  3: "the face paint",
  4: "the jacket",
  5: "the place + shirt colour",
}

/** The same idea, phrased as the result's ingredient list. */
export const CONTRIBUTIONS: Record<number, string> = {
  1: "who the person is",
  2: "the hat",
  3: "face paint, right cheek only",
  4: "the jacket",
  5: "the place and the shirt colour",
}

export const DEFAULT_HINT =
  "Hover any pink token in the prompt. The reference it points at lights up on the left, and its job shows here."

/** What the clause around each token is actually doing. */
export const TOKEN_HINTS: Record<number, string> = {
  1: "Person from 1, place from 5, plus an explicit don't. Saying what not to take is as load-bearing as saying what to take.",
  2: "An object from 2, plus a direction none of the five sources supply.",
  3: "A detail from 3, constrained to one side of the face. The other cheek is stated as empty.",
  4: "The whole garment from 4, matched exactly.",
  5: "One attribute only. The shirt's colour is borrowed from 5, not the shirt itself.",
}

export const GROUP_TITLES = {
  a: { title: "Add your references", sub: "Order sets the token number" },
  b: { title: "Write the prompt", sub: "Hover a token to see what it pulls" },
  c: { title: "Generate", sub: "One image, five sources" },
} as const

/** The three closing columns of step 04. */
export const CLOSING_COLUMNS: ReadonlyArray<{ eyebrow: string | null; title?: string; body: string }> = [
  {
    eyebrow: null,
    title: "Make it yours",
    body: "Swap any upload for your own image and run again. The tokens keep working, they point at positions, not at files.",
  },
  {
    eyebrow: "If something lands wrong",
    body: "Check the reference order before rewriting the prompt. Position, not name, is what the number means.",
  },
  {
    eyebrow: "To feel one reference",
    body: "Change it, rerun, compare. One variable at a time is the whole method.",
  },
]
