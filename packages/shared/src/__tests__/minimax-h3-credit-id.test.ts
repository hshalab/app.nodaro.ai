import { describe, it, expect } from "vitest"
import { buildVideoCreditModelIdentifier } from "../credit-identifiers.js"

/**
 * minimax-h3 has NO resolution lever (fixed 2K) and NO -ref identifier
 * dimension — the composite is duration-only. Reference-video input seconds
 * and >5-image surcharges are reserved by the minimax-h3-credits compute hook
 * instead of the identifier, so the id must stay stable across every
 * resolution / hasVideoRef combination the fuzzer can throw at it.
 */
describe("minimax-h3 credit identifier", () => {
  it("is duration-only and resolution-INVARIANT", () => {
    for (const res of [undefined, "480p", "720p", "1080p", "2k", "4k", "garbage"]) {
      expect(buildVideoCreditModelIdentifier("minimax-h3", 8, undefined, "image-to-video", undefined, res)).toBe("minimax-h3:8s")
    }
  })

  it("ignores hasVideoRef (no -ref dimension — the compute hook bills input seconds)", () => {
    expect(buildVideoCreditModelIdentifier("minimax-h3", 8, undefined, "image-to-video", undefined, undefined, true)).toBe("minimax-h3:8s")
    expect(buildVideoCreditModelIdentifier("minimax-h3", 8, undefined, "text-to-video", undefined, undefined, true)).toBe("minimax-h3:8s")
  })

  it("maps every on-menu second 1:1 to its own tier", () => {
    expect(buildVideoCreditModelIdentifier("minimax-h3", 4)).toBe("minimax-h3:4s")
    expect(buildVideoCreditModelIdentifier("minimax-h3", 5)).toBe("minimax-h3:5s")
    expect(buildVideoCreditModelIdentifier("minimax-h3", 13)).toBe("minimax-h3:13s")
    expect(buildVideoCreditModelIdentifier("minimax-h3", 15)).toBe("minimax-h3:15s")
  })

  it("an OMITTED duration prices the model's own 6s default (not the global 5s) — a duration-less request renders 6s", () => {
    expect(buildVideoCreditModelIdentifier("minimax-h3", undefined)).toBe("minimax-h3:6s")
    expect(buildVideoCreditModelIdentifier("minimax-h3", "not-a-number")).toBe("minimax-h3:6s")
  })

  it("clamps off-menu durations into the tier ladder", () => {
    expect(buildVideoCreditModelIdentifier("minimax-h3", 3)).toBe("minimax-h3:4s")
    expect(buildVideoCreditModelIdentifier("minimax-h3", 20)).toBe("minimax-h3:15s")
  })

  it("sound has no effect (audio is always on and priced in — no :audio addon)", () => {
    expect(buildVideoCreditModelIdentifier("minimax-h3", 8, true)).toBe("minimax-h3:8s")
    expect(buildVideoCreditModelIdentifier("minimax-h3", 8, false)).toBe("minimax-h3:8s")
  })
})
