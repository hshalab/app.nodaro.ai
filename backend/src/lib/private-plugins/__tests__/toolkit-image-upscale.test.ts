/**
 * `tk.providers.imageUpscale` — the gvp identity-plate lever's toolkit member
 * (stage 3, 2026-08-02). Composition: editImage(topaz-image-upscale) → fetch
 * both images → REAL plate gate (exact 2x dims + pixel alignment) → host the
 * verified bytes on R2. The gate here is the actual implementation — only the
 * network edges (router, fetch, R2) are mocked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import sharp from "sharp"

const { mockEditImage, mockFetchImage, mockUploadBuffer } = vi.hoisted(() => ({
  mockEditImage: vi.fn(),
  mockFetchImage: vi.fn(),
  mockUploadBuffer: vi.fn(),
}))
vi.mock("../../../providers/router.js", () => ({ editImage: mockEditImage, videoUpscale: vi.fn() }))
vi.mock("../plate-gate.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../plate-gate.js")>()),
  fetchImageBuffer: mockFetchImage,
}))
vi.mock("../../storage.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../storage.js")>()),
  uploadBufferToR2: mockUploadBuffer,
}))

import { buildToolkit } from "../toolkit.js"

const W = 48
const H = 28

async function checkerPng(w: number, h: number): Promise<Buffer> {
  const raw = Buffer.alloc(w * h * 3)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3
      const v = (Math.floor(x / 6) + Math.floor(y / 6)) % 2 === 0 ? 220 : 30
      raw[i] = v
      raw[i + 1] = Math.round((x / w) * 255)
      raw[i + 2] = Math.round((y / h) * 255)
    }
  }
  // Blurred to natural-image edge sharpness — see plate-gate.test.ts.
  return sharp(raw, { raw: { width: w, height: h, channels: 3 } }).blur(1.2).png().toBuffer()
}

describe("tk.providers.imageUpscale", () => {
  beforeEach(() => {
    mockEditImage.mockReset()
    mockFetchImage.mockReset()
    mockUploadBuffer.mockReset()
  })

  it("upscales via topaz, passes the real gate, and returns the R2-hosted verified bytes", async () => {
    const src = await checkerPng(W, H)
    const plate = await sharp(src).resize(W * 2, H * 2, { kernel: "lanczos3" }).png().toBuffer()
    mockEditImage.mockResolvedValue({ url: "https://provider/plate.png" })
    mockFetchImage.mockImplementation(async (url: string) =>
      url === "https://r2/anchor.png" ? src : plate)
    mockUploadBuffer.mockResolvedValue("https://cdn/images/plate-x.png")
    const tk = buildToolkit()

    const result = await tk.providers.imageUpscale("https://r2/anchor.png", "topaz-image-upscale")

    expect(mockEditImage).toHaveBeenCalledWith("https://r2/anchor.png", "topaz-image-upscale")
    expect(mockUploadBuffer).toHaveBeenCalledTimes(1)
    const [bytes, key, mime] = mockUploadBuffer.mock.calls[0]
    expect(bytes).toBe(plate) // the VERIFIED bytes, not a re-encode
    expect(key).toMatch(/^images\/plate-[0-9a-f-]+\.png$/)
    expect(mime).toBe("image/png")
    expect(result).toEqual({ url: "https://cdn/images/plate-x.png" })
  })

  it("rejects (and never hosts) when the provider breaks the exact-same-frame guarantee", async () => {
    const src = await checkerPng(W, H)
    // Right dims, wrong frame: cropped then stretched back to exact 2x.
    const badPlate = await sharp(src)
      .extract({ left: 6, top: 4, width: W - 12, height: H - 8 })
      .resize(W * 2, H * 2, { fit: "fill" })
      .png()
      .toBuffer()
    mockEditImage.mockResolvedValue({ url: "https://provider/plate.png" })
    mockFetchImage.mockImplementation(async (url: string) =>
      url === "https://r2/anchor.png" ? src : badPlate)
    const tk = buildToolkit()

    await expect(tk.providers.imageUpscale("https://r2/anchor.png", "topaz-image-upscale"))
      .rejects.toThrow(/misaligned/)
    expect(mockUploadBuffer).not.toHaveBeenCalled()
  })

  it("propagates provider failures unchanged (the plugin's non-fatal guard owns degradation)", async () => {
    mockEditImage.mockRejectedValue(new Error("topaz 502"))
    const tk = buildToolkit()

    await expect(tk.providers.imageUpscale("https://r2/anchor.png", "topaz-image-upscale"))
      .rejects.toThrow("topaz 502")
    expect(mockUploadBuffer).not.toHaveBeenCalled()
  })
})
