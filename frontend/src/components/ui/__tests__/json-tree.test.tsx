import { describe, it, expect } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { JsonTree, type JsonNodeLabeler, type JsonValue } from "../json-tree"

const payload: JsonValue = {
  meta: { durationSec: 57.3, language: "en" },
  slots: [{ slotId: "achilles", label: "Achilles" }],
  scenes: [
    { sceneNumber: 1, startSec: 0, endSec: 1.8, label: "establishing", visual: "a wide shot", audio: [] },
    { sceneNumber: 2, startSec: 1.8, endSec: 4.6, label: "intro", visual: "a close-up", audio: [{ mode: "speech", content: "Achilles." }] },
  ],
}

describe("JsonTree", () => {
  it("opens the top-level groups and leaves their ITEMS closed", () => {
    // The point of the default: a 43-scene payload renders as a scannable index,
    // not 43 expanded records. Group leaves are visible, item leaves are not.
    render(<JsonTree value={payload} />)
    expect(screen.getByText("meta")).toBeInTheDocument()
    expect(screen.getByText("57.3")).toBeInTheDocument()       // meta's leaf is open
    expect(screen.queryByText("a wide shot")).not.toBeInTheDocument()  // scene item closed
  })

  it("counts array children so size is visible without expanding", () => {
    render(<JsonTree value={payload} />)
    expect(screen.getByText("(2)")).toBeInTheDocument()
  })

  it("drills into a closed item on click and reveals its leaves", () => {
    render(<JsonTree value={payload} labelFor={sceneLabeler} />)
    fireEvent.click(screen.getByText("#1 · 0–1.8s · establishing"))
    expect(screen.getByText("a wide shot")).toBeInTheDocument()
  })

  it("uses labelFor for container rows and the bare index when it declines", () => {
    render(<JsonTree value={payload} labelFor={sceneLabeler} />)
    expect(screen.getByText("#2 · 1.8–4.6s · intro")).toBeInTheDocument()
    // slots got no label from this labeler, so it falls back to the index.
    expect(screen.getByText("[0]")).toBeInTheDocument()
  })

  it("distinguishes paths that would collide on a naive delimiter", () => {
    // Expansion state is keyed by path. A key containing the delimiter must not
    // let one row's toggle silently open another.
    const tricky: JsonValue = { "a": { "b c": { leaf: 1 } }, "a b": { c: { leaf: 2 } } }
    render(<JsonTree value={tricky} />)
    fireEvent.click(screen.getByText("b c"))
    expect(screen.getByText("1")).toBeInTheDocument()
    expect(screen.queryByText("2")).not.toBeInTheDocument()
  })

  it("renders a bare primitive without crashing", () => {
    render(<JsonTree value={"just text"} />)
    expect(screen.getByText("just text")).toBeInTheDocument()
  })

  it("marks disclosure rows with aria-expanded so the state is exposed", () => {
    render(<JsonTree value={payload} />)
    const meta = screen.getByText("meta").closest("button")!
    expect(meta).toHaveAttribute("aria-expanded", "true")
    fireEvent.click(meta)
    expect(meta).toHaveAttribute("aria-expanded", "false")
  })
})

const sceneLabeler: JsonNodeLabeler = (path, value) => {
  if (path.length !== 2 || path[0] !== "scenes" || value === null || typeof value !== "object") return undefined
  const v = value as Record<string, JsonValue>
  return `#${v.sceneNumber} · ${v.startSec}–${v.endSec}s · ${v.label}`
}
