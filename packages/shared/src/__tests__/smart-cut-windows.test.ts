import { describe, it, expect } from "vitest"
import {
  clampSmartCutWindow,
  SMART_CUT_WINDOW_MIN,
  SMART_CUT_WINDOW_MAX,
  SMART_CUT_WINDOW_DEFAULT,
} from "../smart-cut-windows.js"

describe("smart-cut search windows", () => {
  it("keeps in-range integers untouched", () => {
    for (const n of [1, 4, 8, 12, 24]) expect(clampSmartCutWindow(n)).toBe(n)
  })

  it("clamps to the product bounds instead of erroring", () => {
    expect(clampSmartCutWindow(999)).toBe(SMART_CUT_WINDOW_MAX)
    expect(clampSmartCutWindow(25)).toBe(SMART_CUT_WINDOW_MAX)
    expect(clampSmartCutWindow(0)).toBe(SMART_CUT_WINDOW_MIN)
    expect(clampSmartCutWindow(-5)).toBe(SMART_CUT_WINDOW_MIN)
  })

  it("rounds fractional input (a number <input> can emit one)", () => {
    expect(clampSmartCutWindow(8.4)).toBe(8)
    expect(clampSmartCutWindow(8.6)).toBe(9)
  })

  it('returns undefined — "use the engine default" — for anything non-numeric', () => {
    // Load-bearing: undefined means the field is OMITTED from the request, so
    // the engine applies its own 8/8. Coercing junk to a NUMBER instead would
    // silently run a search width the user never chose.
    for (const v of [undefined, null, NaN, Infinity, "8", "", {}, []]) {
      expect(clampSmartCutWindow(v), String(v)).toBeUndefined()
    }
  })

  it("bounds are coherent and the default sits inside them", () => {
    expect(SMART_CUT_WINDOW_MIN).toBeLessThan(SMART_CUT_WINDOW_MAX)
    expect(SMART_CUT_WINDOW_DEFAULT).toBeGreaterThanOrEqual(SMART_CUT_WINDOW_MIN)
    expect(SMART_CUT_WINDOW_DEFAULT).toBeLessThanOrEqual(SMART_CUT_WINDOW_MAX)
    // The engine route accepts up to 48; the product cap must stay within it
    // or a clamped value would still 400 at the boundary we were protecting.
    expect(SMART_CUT_WINDOW_MAX).toBeLessThanOrEqual(48)
  })
})
