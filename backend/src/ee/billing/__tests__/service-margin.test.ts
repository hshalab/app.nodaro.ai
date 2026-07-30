import { describe, it, expect } from "vitest"
import { effectiveMarkupPercent, serviceMarginPrefixMatches } from "../service-margin.js"

const base = (global_: number, margins: Record<string, number>) => ({
  cost_markup_percent: global_,
  service_margin_percent: margins,
})

describe("serviceMarginPrefixMatches", () => {
  it("matches exact identifiers and composite continuations only", () => {
    expect(serviceMarginPrefixMatches("svc", "svc")).toBe(true)
    expect(serviceMarginPrefixMatches("svc:10s", "svc")).toBe(true)
    expect(serviceMarginPrefixMatches("svc:pro:10s", "svc")).toBe(true)
    // A prefix must end on the : boundary — never a plain string prefix.
    expect(serviceMarginPrefixMatches("svc-other", "svc")).toBe(false)
    expect(serviceMarginPrefixMatches("svcx", "svc")).toBe(false)
    expect(serviceMarginPrefixMatches("sv", "svc")).toBe(false)
  })
})

describe("effectiveMarkupPercent", () => {
  it("falls back to the global markup when no service margin matches", () => {
    expect(effectiveMarkupPercent(base(25, {}), "nano-banana")).toBe(25)
    expect(effectiveMarkupPercent(base(0, { svc: 30 }), "nano-banana")).toBe(0)
  })

  it("uses the service margin for matching identifiers", () => {
    const s = base(25, { svc: 40 })
    expect(effectiveMarkupPercent(s, "svc")).toBe(40)
    expect(effectiveMarkupPercent(s, "svc:10s")).toBe(40)
  })

  it("overrides rather than stacks — the configured number IS the margin", () => {
    // Global 25% + service 10%: the service pays 10%, not 37.5%.
    expect(effectiveMarkupPercent(base(25, { svc: 10 }), "svc")).toBe(10)
  })

  it("a service margin of 0 is a real override, not a fall-through", () => {
    // Configuring 0 for a service exempts it from the global markup.
    expect(effectiveMarkupPercent(base(25, { svc: 0 }), "svc:fast")).toBe(0)
  })

  it("the longest matching prefix wins", () => {
    const s = base(0, { svc: 20, "svc:pro": 50 })
    expect(effectiveMarkupPercent(s, "svc:fast")).toBe(20)
    expect(effectiveMarkupPercent(s, "svc:pro")).toBe(50)
    expect(effectiveMarkupPercent(s, "svc:pro:10s")).toBe(50)
  })

  it("never bleeds a margin onto lookalike identifiers", () => {
    const s = base(15, { svc: 40 })
    expect(effectiveMarkupPercent(s, "svc-turbo")).toBe(15)
    expect(effectiveMarkupPercent(s, "svcx:10s")).toBe(15)
  })
})
