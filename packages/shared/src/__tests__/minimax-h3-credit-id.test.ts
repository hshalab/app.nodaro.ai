import { describe, it, expect } from "vitest"
import { buildVideoCreditModelIdentifier } from "../credit-identifiers.js"
import { normalizeMinimaxH3Resolution } from "../model-constants.js"

/**
 * minimax-h3 prices per second at TWO resolution rates (2K default / 768P,
 * 2026-08-03) and has NO -ref identifier dimension. Bare duration composites
 * are the 2K rate — byte-identical to the pre-lever rows, so existing
 * workflows/overrides keep their ids — and only a verified 768P selection
 * appends ":768p". Reference-video input seconds and >5-image surcharges are
 * reserved by the minimax-h3-credits compute hook instead of the identifier.
 */
describe("minimax-h3 credit identifier", () => {
  it("collapses every non-768P resolution onto the bare 2K composite (what KIE renders for those values)", () => {
    for (const res of [undefined, "480p", "720p", "1080p", "2k", "2K", "4k", "garbage"]) {
      expect(buildVideoCreditModelIdentifier("minimax-h3", 8, undefined, "image-to-video", undefined, res)).toBe("minimax-h3:8s")
    }
  })

  it("appends :768p only for a verified 768P selection (case-insensitive)", () => {
    for (const res of ["768P", "768p", " 768P "]) {
      expect(buildVideoCreditModelIdentifier("minimax-h3", 8, undefined, "image-to-video", undefined, res)).toBe("minimax-h3:8s:768p")
    }
    expect(buildVideoCreditModelIdentifier("minimax-h3", 4, undefined, "text-to-video", undefined, "768P")).toBe("minimax-h3:4s:768p")
    expect(buildVideoCreditModelIdentifier("minimax-h3", undefined, undefined, undefined, undefined, "768P")).toBe("minimax-h3:6s:768p")
  })

  it("normalizeMinimaxH3Resolution is the single collapse rule (768p → 768P, everything else → 2K)", () => {
    expect(normalizeMinimaxH3Resolution("768p")).toBe("768P")
    expect(normalizeMinimaxH3Resolution("768P")).toBe("768P")
    expect(normalizeMinimaxH3Resolution(undefined)).toBe("2K")
    expect(normalizeMinimaxH3Resolution("720p")).toBe("2K")
    expect(normalizeMinimaxH3Resolution("garbage")).toBe("2K")
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
