/**
 * The model catalog hand-copies video-analysis credit values that already live
 * in `VIDEO_ANALYSIS_BUCKET_CREDITS`. Nothing cross-checked the two, so a
 * reprice could update the table (and the DB migration) while the catalog kept
 * quoting the old numbers — and the catalog is what the model browser shows a
 * user BEFORE they run anything.
 *
 * This is the guard that was missing.
 */
import { describe, it, expect } from "vitest"
import { MODEL_CATALOG } from "../model-catalog.js"
import {
  VIDEO_ANALYSIS_BUCKET_CREDITS,
  VIDEO_ANALYSIS_DURATION_BUCKETS,
  VIDEO_ANALYSIS_MAX_DURATION_SEC,
} from "../video-analysis-pricing.js"

/** Every `video-analysis:*` pricing row declared anywhere in the catalog. */
const catalogRows = Object.values(MODEL_CATALOG)
  .flatMap((m) => (m.pricing ?? []) as ReadonlyArray<{ identifier: string; credits: number }>)
  .filter((r) => r.identifier.startsWith("video-analysis:"))

describe("model catalog video-analysis pricing", () => {
  it("declares at least one row (guard is actually wired to something)", () => {
    expect(catalogRows.length).toBeGreaterThan(0)
  })

  it("every bucketed catalog row matches VIDEO_ANALYSIS_BUCKET_CREDITS exactly", () => {
    const bucketed = catalogRows.filter((r) => /:\d+s$/.test(r.identifier))
    expect(bucketed.length).toBeGreaterThan(0)
    for (const row of bucketed) {
      expect(
        row.credits,
        `catalog "${row.identifier}" = ${row.credits} but the table says ${VIDEO_ANALYSIS_BUCKET_CREDITS[row.identifier]}`,
      ).toBe(VIDEO_ANALYSIS_BUCKET_CREDITS[row.identifier])
    }
  })

  it("every bare (no-duration) catalog row equals its max-duration ceiling", () => {
    // A bare id means "duration unknown", which the route prices at the ceiling.
    const bare = catalogRows.filter((r) => !/:\d+s$/.test(r.identifier))
    expect(bare.length).toBeGreaterThan(0)
    for (const row of bare) {
      const ceiling = VIDEO_ANALYSIS_BUCKET_CREDITS[`${row.identifier}:${VIDEO_ANALYSIS_MAX_DURATION_SEC}s`]
      expect(ceiling, `no ceiling row for ${row.identifier}`).toBeDefined()
      expect(row.credits, `catalog "${row.identifier}" must equal its ${VIDEO_ANALYSIS_MAX_DURATION_SEC}s ceiling`).toBe(ceiling)
    }
  })

  it("catalog covers every bucket it claims a model supports", () => {
    const byModel = new Map<string, Set<number>>()
    for (const r of catalogRows) {
      const m = /^video-analysis:(.+):(\d+)s$/.exec(r.identifier)
      if (!m) continue
      if (!byModel.has(m[1]!)) byModel.set(m[1]!, new Set())
      byModel.get(m[1]!)!.add(Number(m[2]))
    }
    for (const [model, buckets] of byModel) {
      expect([...buckets].sort((a, b) => a - b), `${model} bucket coverage`)
        .toEqual([...VIDEO_ANALYSIS_DURATION_BUCKETS])
    }
  })
})
