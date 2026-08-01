import { describe, it, expect } from "vitest"
import { STATIC_CREDIT_COSTS } from "../credits.js"

// KIE 36.5 cr/s (docs.kie.ai/market/minimax-h3, 2026-08-01), fixed 2K.
// Nodaro credits = ceil(36.5 × duration / 4) × 10 — at cost, like Seedance-2.
describe("minimax-h3 static credits — per-second, fixed 2K", () => {
  const expected: Record<string, number> = {
    "minimax-h3": 550, // base fallback = 6s (the KIE default duration)
    "minimax-h3:4s": 370,
    "minimax-h3:5s": 460,
    "minimax-h3:6s": 550,
    "minimax-h3:7s": 640,
    "minimax-h3:8s": 730,
    "minimax-h3:9s": 830,
    "minimax-h3:10s": 920,
    "minimax-h3:11s": 1010,
    "minimax-h3:12s": 1100,
    "minimax-h3:13s": 1190,
    "minimax-h3:14s": 1280,
    "minimax-h3:15s": 1370,
  }
  for (const [id, credits] of Object.entries(expected)) {
    it(`${id} = ${credits}`, () => { expect(STATIC_CREDIT_COSTS[id]).toBe(credits) })
  }
})

describe("minimax-h3 has NO resolution or -ref composites (fixed 2K; ref billing is the compute hook)", () => {
  // Proves the no-resolution-lever design: any such id appearing later means
  // someone re-introduced a lever without going through the catalog + identifier
  // + hook chain — and the identifier builder would never emit it.
  const phantom = [
    "minimax-h3:8s:480p",
    "minimax-h3:8s:720p",
    "minimax-h3:8s:1080p",
    "minimax-h3:8s:2k",
    "minimax-h3:8s:4k",
    "minimax-h3:8s-ref",
    "minimax-h3:8s:720p-ref",
    "minimax-h3:8s:2k-ref",
  ]
  for (const id of phantom) {
    it(`${id} is undefined`, () => { expect(STATIC_CREDIT_COSTS[id]).toBeUndefined() })
  }
})
