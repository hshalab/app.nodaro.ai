import { describe, it, expect } from "vitest"
import { buildRecastWidgetTemplate } from "../recast.js"

describe("recast widget template", () => {
  it("renders the static template with progress, gates, and the deep link", () => {
    const html = buildRecastWidgetTemplate()
    expect(html).toContain("Open in Recast")
    // Per-call data flows via tool-result event, NOT embedded init data.
    expect(html).not.toContain("window.__INIT__")
    expect(html).toContain("mcp-tool-result")
    // Gate rendering + the pick path.
    expect(html).toContain("resolve_recast_gate")
    expect(html).toContain("pendingGate")
    expect(html).toContain("pendingSheetGate")
    expect(html).toContain("pendingAnchorGate")
    expect(html).toContain("pendingMusicGate")
  })

  it("renders the sheet gate as a wide pick-1-of-3 choosing body & wardrobe with the face locked", () => {
    const html = buildRecastWidgetTemplate()
    // The resolve call names the gate — cast picks stay bare (default).
    expect(html).toContain("gate: 'sheet'")
    // Label copy: the user is choosing body & clothes; the face is locked.
    expect(html).toContain("Body & wardrobe")
    expect(html).toContain("The face is locked from your cast pick")
    // Sheets are landscape multi-panel composites — options stack full-width
    // instead of the portrait candidates' 3-up grid.
    expect(html).toContain(".options.wide")
    expect(html).toContain("'options wide'")
  })

  it("polls ONLY the free status verb — never a purchasing verb", () => {
    const html = buildRecastWidgetTemplate()
    expect(html).toContain("get_recast_status")
    expect(html).not.toContain("start_recast")
    expect(html).not.toContain("import_recast_script")
  })

  it("contains no raw HTML assignment in runtime JS (safe DOM only)", () => {
    const html = buildRecastWidgetTemplate()
    const scriptBlocks = html.match(/<script>[\s\S]*?<\/script>/g) ?? []
    for (const block of scriptBlocks) {
      expect(block).not.toMatch(/\.(inner|outer)HTML\s*=|\binsertAdjacentHTML\b|\bdocument\.write\b/)
    }
  })
})
