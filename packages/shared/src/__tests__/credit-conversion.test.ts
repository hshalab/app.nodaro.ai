import { describe, it, expect } from "vitest"
import { CREDIT_BASE_USD } from "../model-constants.js"
import { usdToCredits, creditsToUsd } from "../credit-conversion.js"

describe("usdToCredits", () => {
  it("converts exact multiples of the base without rounding up", () => {
    expect(usdToCredits(0.02)).toBe(1)
    expect(usdToCredits(0.04)).toBe(2)
    expect(usdToCredits(1.0)).toBe(50)
  })

  it("rounds fractional cost up to a whole credit", () => {
    expect(usdToCredits(0.021)).toBe(2)
    expect(usdToCredits(0.001)).toBe(1)
  })

  it("returns 0 for zero cost", () => {
    expect(usdToCredits(0)).toBe(0)
  })

  // The reason this helper exists rather than a bare ceil(usd / base).
  it("absorbs IEEE-754 division noise (bare ceil would over-charge)", () => {
    expect(0.14 / 0.02).toBeGreaterThan(7) // 7.000000000000001
    expect(Math.ceil(0.14 / 0.02)).toBe(8) // the bug
    expect(usdToCredits(0.14)).toBe(7) // the fix
    for (const usd of [0.28, 0.56, 1.12, 2.22, 2.24, 4.44, 4.48, 4.94, 4.98]) {
      expect(usdToCredits(usd)).toBe(Math.round(usd / CREDIT_BASE_USD))
    }
  })

  it("rejects non-finite input rather than emitting NaN credits", () => {
    expect(() => usdToCredits(Number.NaN)).toThrow(/finite/)
    expect(() => usdToCredits(Number.POSITIVE_INFINITY)).toThrow(/finite/)
    expect(() => usdToCredits(-0.5)).toThrow(/negative/)
  })
})

describe("creditsToUsd", () => {
  it("is the inverse of the base", () => {
    expect(creditsToUsd(1)).toBeCloseTo(CREDIT_BASE_USD, 10)
    expect(creditsToUsd(50)).toBeCloseTo(1.0, 10)
    expect(creditsToUsd(0)).toBe(0)
  })

  it("rejects non-finite input", () => {
    expect(() => creditsToUsd(Number.NaN)).toThrow(/finite/)
  })
})
