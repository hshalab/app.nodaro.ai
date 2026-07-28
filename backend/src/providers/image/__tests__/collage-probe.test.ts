import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import sharp from "sharp"

import { displayDims, probeImageSize } from "../collage.js"

/**
 * THE LAYOUT MUST BE COMPUTED FROM THE PIXELS THE COMPOSITOR WILL RECEIVE.
 *
 * ffmpeg auto-rotates on decode, so a JPEG carrying EXIF orientation 5-8
 * arrives at `scale` transposed — while ffprobe's `stream=width,height`
 * reports the STORED geometry and the rotation appears only in frame side
 * data, which that query never sees. Laying out from stored dimensions
 * therefore gave every phone-portrait photo a cell of the wrong aspect, and
 * because the compositor CONTAINS (`force_original_aspect_ratio=decrease`)
 * rather than covers, the mismatch rendered as visible padding: measured at
 * ~366px of white down each side of a 1317px cell.
 *
 * The fixtures here are generated rather than committed, so the test exercises
 * the real header parse instead of a hand-rolled stub — and no binary blobs
 * enter the repo. Nothing spawns ffmpeg; `collage.ts` keeps its pure functions
 * exported precisely so this module can be asserted without it.
 */

let dir: string

/** A JPEG whose STORED raster is `w × h`, tagged with `orientation`. */
async function jpegWithOrientation(name: string, w: number, h: number, orientation?: number): Promise<string> {
  const path = join(dir, name)
  let img = sharp({ create: { width: w, height: h, channels: 3, background: "#888888" } }).jpeg()
  if (orientation !== undefined) img = img.withMetadata({ orientation })
  await writeFile(path, await img.toBuffer())
  return path
}

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "collage-probe-"))
})
afterAll(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe("displayDims", () => {
  it("transposes exactly the orientations that transpose", () => {
    // 5-8 exchange the axes (±90°); 1-4 are identity, mirror or 180°, none of
    // which changes which side is longer.
    for (const o of [1, 2, 3, 4]) {
      expect(displayDims(1200, 800, o)).toEqual({ w: 1200, h: 800 })
    }
    for (const o of [5, 6, 7, 8]) {
      expect(displayDims(1200, 800, o)).toEqual({ w: 800, h: 1200 })
    }
  })

  it("leaves dimensions alone when there is no orientation tag at all", () => {
    expect(displayDims(1200, 800, undefined)).toEqual({ w: 1200, h: 800 })
  })

  it("ignores a nonsense tag rather than guessing", () => {
    // Encoders do write 0 and other out-of-range values.
    expect(displayDims(1200, 800, 0)).toEqual({ w: 1200, h: 800 })
    expect(displayDims(1200, 800, 99)).toEqual({ w: 1200, h: 800 })
  })
})

describe("probeImageSize", () => {
  it("reports what the DECODER will hand the filter graph, not what is stored", async () => {
    const path = await jpegWithOrientation("portrait.jpg", 1200, 800, 6)
    // Stored 1200×800; displayed — and decoded — 800×1200.
    expect(await probeImageSize(path)).toEqual({ w: 800, h: 1200 })
  })

  it("covers the other transposing orientations, not just the common one", async () => {
    for (const o of [5, 7, 8]) {
      const path = await jpegWithOrientation(`t-${o}.jpg`, 1200, 800, o)
      expect(await probeImageSize(path)).toEqual({ w: 800, h: 1200 })
    }
  })

  it("leaves an ordinary photo untouched", async () => {
    const path = await jpegWithOrientation("plain.jpg", 1200, 800)
    expect(await probeImageSize(path)).toEqual({ w: 1200, h: 800 })
  })

  it("is not fooled by a 180° rotation, which does not exchange the axes", async () => {
    const path = await jpegWithOrientation("upside-down.jpg", 1200, 800, 3)
    expect(await probeImageSize(path)).toEqual({ w: 1200, h: 800 })
  })

  it("still yields a usable square for a file nothing can read", async () => {
    // Both readers fail; the collage must not abort on one bad input — ffmpeg's
    // own decode surfaces the hard error later if the file is truly broken.
    const path = join(dir, "garbage.jpg")
    await writeFile(path, Buffer.from("not an image"))
    expect(await probeImageSize(path)).toEqual({ w: 1, h: 1 })
  })
})
