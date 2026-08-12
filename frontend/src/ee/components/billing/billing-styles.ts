import type { CSSProperties } from "react"

/**
 * Shared style vocabulary for the billing page, ported 1:1 from the
 * designer's static mock (billing-design.html). Every value here is copied
 * from the mock's inline styles — do not "improve" them, keep them in sync
 * with the design source.
 */

export const PINK = "#ff2d6f"
export const CYAN = "oklch(0.75 0.13 205)"
export const CYAN_TEXT = "oklch(0.8 0.09 205)"
export const CYAN_BADGE_TEXT = "oklch(0.85 0.06 205)"

/**
 * Plus Jakarta Sans is the mock's sans face. The repo deliberately
 * self-hosts fonts (no phoning home to Google Fonts — see globals.css), and
 * Jakarta is not among the self-hosted faces, so it resolves only if present
 * locally and otherwise falls back to the app's Geist.
 */
export const SANS_FONT =
  "'Plus Jakarta Sans', 'Geist Variable', Helvetica, sans-serif"

/** JetBrains Mono is self-hosted as a variable face in globals.css. */
export const MONO_FONT =
  "'JetBrains Mono Variable', 'JetBrains Mono', monospace"

/** Section card chrome (mock: every <section> on the page). */
export const sectionCard: CSSProperties = {
  border: "1px solid #1e1e24",
  borderRadius: 16,
  background: "#101014",
  padding: "26px 28px",
}

/** Section card followed by another section (mock: margin-bottom:26px). */
export const sectionCardSpaced: CSSProperties = {
  ...sectionCard,
  marginBottom: 26,
}

export const sectionTitle: CSSProperties = {
  fontSize: 19,
  fontWeight: 700,
  margin: 0,
  letterSpacing: "-0.01em",
}

export const sectionIcon: CSSProperties = {
  color: PINK,
  fontSize: 16,
}

export const statLabel: CSSProperties = {
  fontSize: 12.5,
  color: "#7c7c85",
}

export const mutedParagraph: CSSProperties = {
  fontSize: 13,
  color: "#75757e",
  margin: 0,
}

/** Dark input shell used by the "Or load any amount" row. */
export const inputShell: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  background: "#141418",
  border: "1px solid #2a2a32",
  borderRadius: 9,
  padding: "8px 12px",
}

export const monoInput: CSSProperties = {
  background: "transparent",
  border: "none",
  outline: "none",
  color: "#f2f2f4",
  fontFamily: MONO_FONT,
  fontSize: 14,
}

export function formatCredits(value: number): string {
  return value.toLocaleString("en-US")
}

/** Mock date style: "Aug 12". */
export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}
