import { describe, it, expect } from "vitest"
import {
  minimaxH3BaseCredits,
  minimaxH3BillableRefImageCount,
  MINIMAX_H3_FREE_INPUT_IMAGES,
} from "../minimax-h3-credits.js"

// perSecBase = STATIC_CREDIT_COSTS["minimax-h3:8s"] / 8 = 730 / 8 = 91.25.
// Extra input image (beyond the first 5) = 11 KIE cr × 2.5 = 27.5 base credits.
describe("minimaxH3BaseCredits", () => {
  it("zero input video + ≤5 images equals the seeded output composite (8s → 730)", () => {
    expect(minimaxH3BaseCredits({ outputDurationSec: 8, inputVideoDurationSec: 0, referenceImageCount: 0 })).toBe(730)
  })

  it("bills unit × (input + output): 8s out + 5s ref video → ceil(91.25 × 13) = 1187", () => {
    expect(minimaxH3BaseCredits({ outputDurationSec: 8, inputVideoDurationSec: 5, referenceImageCount: 0 })).toBe(1187)
  })

  it("first 5 input images are free (boundary: exactly 5 → no surcharge)", () => {
    expect(minimaxH3BaseCredits({ outputDurationSec: 6, inputVideoDurationSec: 0, referenceImageCount: MINIMAX_H3_FREE_INPUT_IMAGES }))
      .toBe(Math.ceil(91.25 * 6)) // 548
  })

  it("each image beyond 5 adds 27.5 base credits: 6s + 9 images → ceil(547.5 + 4×27.5) = 658", () => {
    expect(minimaxH3BaseCredits({ outputDurationSec: 6, inputVideoDurationSec: 0, referenceImageCount: 9 })).toBe(658)
  })

  it("combines both dimensions: 8s out + 5s in + 7 images → ceil(1186.25 + 55) = 1242", () => {
    expect(minimaxH3BaseCredits({ outputDurationSec: 8, inputVideoDurationSec: 5, referenceImageCount: 7 })).toBe(1242)
  })
})

describe("minimaxH3BillableRefImageCount — derived through the SHARED input resolver", () => {
  it("strict frame modes (i2v endpoint) never surcharge: frames alone count 0", () => {
    expect(minimaxH3BillableRefImageCount({ firstFrameUrl: "f" })).toBe(0)
    expect(minimaxH3BillableRefImageCount({ firstFrameUrl: "f", lastFrameUrl: "l" })).toBe(0)
  })

  it("reference mode counts the resolved pool INCLUDING folded frames (6 refs + first frame → 7)", () => {
    expect(minimaxH3BillableRefImageCount({
      referenceImageUrls: ["r1", "r2", "r3", "r4", "r5", "r6"],
      firstFrameUrl: "f",
    })).toBe(7)
  })

  it("caps at the 9-image pool (9 refs + 2 frames → 7 kept refs + 2 frames = 9)", () => {
    expect(minimaxH3BillableRefImageCount({
      referenceImageUrls: ["r1", "r2", "r3", "r4", "r5", "r6", "r7", "r8", "r9"],
      firstFrameUrl: "f",
      lastFrameUrl: "l",
    })).toBe(9)
  })

  it("audio ref + frame flips to reference mode (frame folds into the pool → 1)", () => {
    expect(minimaxH3BillableRefImageCount({
      firstFrameUrl: "f",
      referenceAudioUrls: ["a"],
    })).toBe(1)
  })

  it("ignores blank/non-string entries", () => {
    expect(minimaxH3BillableRefImageCount({
      referenceImageUrls: ["r1", "", 42 as unknown as string, undefined as unknown as string],
      referenceVideoUrls: ["v"],
    })).toBe(1)
  })
})
