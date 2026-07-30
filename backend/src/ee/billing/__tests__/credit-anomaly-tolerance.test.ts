import { describe, it, expect } from "vitest"
import { CREDIT_BASE_USD, usdToCredits } from "@nodaro/shared"
import { ANOMALY_TOLERANCE_USD, anomalyToleranceCredits } from "../credit-anomaly.js"

describe("anomaly tolerance", () => {
  it("is a dollar tolerance, not a credit count", () => {
    expect(ANOMALY_TOLERANCE_USD).toBeCloseTo(0.02, 10)
  })

  it("equals 1 credit at the current base — preserving today's behaviour", () => {
    expect(CREDIT_BASE_USD).toBe(0.02)
    expect(anomalyToleranceCredits()).toBe(1)
  })

  it("expresses the same dollar amount however the base is denominated", () => {
    // The invariant that survives re-denomination: tolerance x base ~= $0.02.
    expect(anomalyToleranceCredits() * CREDIT_BASE_USD).toBeCloseTo(ANOMALY_TOLERANCE_USD, 10)
  })
})

describe("computeActualCredits float-noise correction", () => {
  // The commit path used a bare ceil, so IEEE-754 division noise billed a full
  // extra credit. Measured at 61 production jobs; 55 were lip-sync at $0.56.
  it("does not over-charge on costs that trip IEEE-754 division", () => {
    expect(Math.ceil(0.56 / 0.02)).toBe(29) // what shipped
    expect(usdToCredits(0.56)).toBe(28) // what it actually costs
  })

  it("is unchanged on costs that divide cleanly", () => {
    for (const [usd, credits] of [[0.02, 1], [0.1, 5], [0.5, 25], [1.0, 50]] as const) {
      expect(usdToCredits(usd)).toBe(credits)
      expect(usdToCredits(usd)).toBe(Math.ceil(usd / 0.02))
    }
  })

  it("still rounds genuinely fractional costs up", () => {
    expect(usdToCredits(0.565)).toBe(29)
    expect(usdToCredits(0.021)).toBe(2)
  })
})
