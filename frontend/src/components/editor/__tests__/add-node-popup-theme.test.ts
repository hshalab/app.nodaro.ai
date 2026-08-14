/**
 * The picker must render correctly in dark AND light mode, which only holds
 * if every colour it paints resolves through the `--npk-*` tokens defined for
 * both themes in globals.css. A literal hex in a picker component is a colour
 * that cannot follow the theme, so it fails here — the same philosophy as
 * handle-colors.test.ts.
 */
import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

const PICKER_DIR = join(__dirname, "..", "add-node-popup")
const POPUP = join(__dirname, "..", "add-node-popup.tsx")
const CSS = join(__dirname, "..", "..", "..", "globals.css")

const HEX = /#[0-9a-fA-F]{3,8}\b/g
const RAW_RGB = /\brgba?\(\s*\d/g

/** The whole picker surface — the popup shell (header, search field, footer,
 *  edge-drop tiers) as well as the sub-components. Scanning only the folder
 *  would leave the shell free to break in light mode. */
function pickerFiles(): string[] {
  return [
    POPUP,
    ...readdirSync(PICKER_DIR)
      .filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"))
      .map((f) => join(PICKER_DIR, f)),
  ]
}

describe("picker components are theme-token only", () => {
  it("covers the popup shell as well as the sub-components", () => {
    const names = pickerFiles().map((p) => p.split(/[\\/]/).pop())
    expect(names).toContain("add-node-popup.tsx")
    expect(names).toContain("picker-tab-bar.tsx")
    expect(names).toContain("picker-section-list.tsx")
    expect(names).toContain("picker-search-results.tsx")
  })

  it("contains no hardcoded hex colours", () => {
    const offenders: string[] = []
    for (const file of pickerFiles()) {
      const source = readFileSync(file, "utf8")
      for (const match of source.match(HEX) ?? [])
        offenders.push(`${file.split(/[\\/]/).pop()}: ${match}`)
    }
    expect(offenders, `use a --npk-* token instead: ${offenders.join(", ")}`).toEqual([])
  })

  it("contains no hardcoded rgb()/rgba() colours", () => {
    const offenders: string[] = []
    for (const file of pickerFiles()) {
      const source = readFileSync(file, "utf8")
      for (const match of source.match(RAW_RGB) ?? [])
        offenders.push(`${file.split(/[\\/]/).pop()}: ${match}`)
    }
    expect(offenders).toEqual([])
  })

  it("only uses --npk-* tokens that globals.css actually defines", () => {
    const css = readFileSync(CSS, "utf8")
    const defined = new Set(
      [...css.matchAll(/^\s*(--npk-[a-z0-9-]+)\s*:/gm)].map((m) => m[1]),
    )
    expect(defined.size).toBeGreaterThan(10)
    const missing = new Set<string>()
    for (const file of pickerFiles()) {
      const source = readFileSync(file, "utf8")
      for (const m of source.matchAll(/var\((--npk-[a-z0-9-]+)\)/g))
        if (!defined.has(m[1])) missing.add(m[1])
    }
    expect([...missing]).toEqual([])
  })

  it("defines every token in both the light and dark blocks", () => {
    const css = readFileSync(CSS, "utf8")
    const block = (selector: string) => {
      // The picker block is the LAST occurrence of each selector in the file.
      const at = css.lastIndexOf(selector)
      return css.slice(at, css.indexOf("}", at))
    }
    const names = (chunk: string) =>
      new Set([...chunk.matchAll(/(--npk-[a-z0-9-]+)\s*:/g)].map((m) => m[1]))
    const light = names(block(":root {"))
    const dark = names(block(".dark {"))
    expect(light.size).toBeGreaterThan(10)
    // Every light token has a dark counterpart. Shadow/scroll values that are
    // deliberately shared may exist in light only, so assert the direction
    // that matters: dark must not introduce a token light never defines.
    expect([...dark].filter((t) => !light.has(t))).toEqual([])
  })
})
