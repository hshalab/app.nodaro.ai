// Split the generated carousel script into its ten slides.
//
// The LLM writes one block containing "Slide 1: … Slide 2: …", so the slides are
// parsed out rather than stored separately. Parsing means the tutorial follows
// whatever the run actually produced, including a run that wrote nine or eleven.

export interface Slide {
  n: number
  /** The copy written for this slide, minus the "Slide N:" marker. */
  text: string
}

const MARKER = /slide\s*(\d+)\s*[:.\-–]/gi

/**
 * Slides in order. Falls back to one slide per non-empty line when the script
 * carries no markers at all, so a differently-shaped run still shows something
 * rather than nothing.
 */
export function parseSlides(script: string): Slide[] {
  if (!script.trim()) return []

  const marks: Array<{ n: number; start: number; end: number }> = []
  for (const m of script.matchAll(MARKER)) {
    marks.push({ n: Number(m[1]), start: m.index ?? 0, end: (m.index ?? 0) + m[0].length })
  }

  if (marks.length === 0) {
    return script
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((text, i) => ({ n: i + 1, text }))
  }

  return marks.map((mark, i) => ({
    n: mark.n,
    text: script.slice(mark.end, marks[i + 1]?.start ?? script.length).trim(),
  }))
}

/** The slide before and after, for showing one in context. */
export function neighbours(slides: Slide[], n: number): { prev?: Slide; current?: Slide; next?: Slide } {
  const i = slides.findIndex((s) => s.n === n)
  if (i === -1) return {}
  return { prev: slides[i - 1], current: slides[i], next: slides[i + 1] }
}
