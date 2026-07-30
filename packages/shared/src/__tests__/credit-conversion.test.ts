import { describe, it, expect } from "vitest"
import { CREDIT_BASE_USD } from "../model-constants.js"
import { usdToCredits, creditsToUsd } from "../credit-conversion.js"

describe("usdToCredits", () => {
  it("converts exact multiples of the base without rounding up", () => {
    // Stated against the constant, not a literal: this is an INVARIANT of the
    // conversion, so it must hold at whatever CREDIT_BASE_USD currently is.
    for (const multiple of [1, 2, 50, 500]) {
      expect(usdToCredits(multiple * CREDIT_BASE_USD)).toBe(multiple)
    }
  })

  it("rounds fractional cost up to a whole credit", () => {
    expect(usdToCredits(CREDIT_BASE_USD * 1.5)).toBe(2)
    expect(usdToCredits(CREDIT_BASE_USD / 2)).toBe(1)
  })

  it("returns 0 for zero cost", () => {
    expect(usdToCredits(0)).toBe(0)
  })

  // The reason this helper exists rather than a bare ceil(usd / base).
  it("absorbs IEEE-754 division noise (bare ceil would over-charge)", () => {
    // 0.02 here is a LITERAL on purpose: it reproduces the historical bug the
    // guard was written for (0.14 / 0.02 = 7.000000000000001, so a bare ceil
    // charged 8 instead of 7), which stays meaningful after the base moves.
    expect(0.14 / 0.02).toBeGreaterThan(7)
    expect(Math.ceil(0.14 / 0.02)).toBe(8) // the bug
    // The guard's own property: an exact multiple never rounds up, at any base.
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
    expect(creditsToUsd(50)).toBeCloseTo(50 * CREDIT_BASE_USD, 10)
    expect(creditsToUsd(0)).toBe(0)
  })

  it("rejects non-finite input", () => {
    expect(() => creditsToUsd(Number.NaN)).toThrow(/finite/)
  })
})
