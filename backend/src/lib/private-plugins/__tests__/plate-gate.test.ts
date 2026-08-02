/**
 * Identity-plate gate (gvp stage 3) — the exact-same-frame guarantee.
 * A plate must be EXACTLY 2x the source dims and pixel-aligned; anything a
 * provider could plausibly do wrong (resolution snap, crop, shift) rejects.
 */
import { describe, it, expect } from "vitest"
import sharp from "sharp"
import { assertExact2xAligned, PLATE_ALIGN_MIN_PSNR_DB } from "../plate-gate.js"

const W = 64
const H = 36

/** Checkerboard over a gradient, slightly blurred to natural-image edge
 *  sharpness — razor-edge synthetic content loses far more in a resample
 *  round trip than any real video frame (real plates measure 40-44 dB), while
 *  a crop/shift still collapses the PSNR on the blurred structure. */
async function sourcePng(): Promise<Buffer> {
  const raw = Buffer.alloc(W * H * 3)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3
      const board = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0 ? 200 : 40
      raw[i] = board
      raw[i + 1] = Math.round((x / W) * 255)
      raw[i + 2] = Math.round((y / H) * 255)
    }
  }
  return sharp(raw, { raw: { width: W, height: H, channels: 3 } }).blur(1.2).png().toBuffer()
}

describe("assertExact2xAligned", () => {
  it("passes a true 2x upscale of the same frame and reports dims + PSNR", async () => {
    const src = await sourcePng()
    const ups = await sharp(src).resize(W * 2, H * 2, { kernel: "lanczos3" }).png().toBuffer()
    const gate = await assertExact2xAligned(src, ups)
    expect(gate.width).toBe(W * 2)
    expect(gate.height).toBe(H * 2)
    expect(gate.format).toBe("png")
    expect(gate.alignPsnrDb).toBeGreaterThanOrEqual(PLATE_ALIGN_MIN_PSNR_DB)
  })

  it("rejects non-exact-2x dimensions (resolution snap)", async () => {
    const src = await sourcePng()
    const snapped = await sharp(src).resize(W * 2, H * 2 + 2, { fit: "fill" }).png().toBuffer()
    await expect(assertExact2xAligned(src, snapped)).rejects.toThrow(/not an exact 2x/)
  })

  it("rejects a cropped-then-stretched result (right dims, wrong frame)", async () => {
    const src = await sourcePng()
    const cropped = await sharp(src)
      .extract({ left: 8, top: 4, width: W - 16, height: H - 8 })
      .resize(W * 2, H * 2, { fit: "fill" })
      .png()
      .toBuffer()
    await expect(assertExact2xAligned(src, cropped)).rejects.toThrow(/misaligned/)
  })

  it("rejects unreadable input", async () => {
    const src = await sourcePng()
    await expect(assertExact2xAligned(src, Buffer.from("not an image"))).rejects.toThrow()
  })
})
