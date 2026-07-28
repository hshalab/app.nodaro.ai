/**
 * Media resolution for the direct Gemini lane.
 *
 * This is the piece the KIE lane was hiding: KIE dereferenced our R2 URLs
 * server-side, so nothing in this codebase ever had to. Google will not, so a
 * regression here shows up as a model that silently "can't see" the video —
 * not as an error. Hence the coverage.
 */
import { describe, it, expect, beforeEach, vi } from "vitest"
import type { GoogleGenAI } from "@google/genai"

const safeFetch = vi.fn()
vi.mock("../../safe-fetch.js", () => ({ safeFetch }))

const { blockToGeminiPart, blocksToGeminiParts, __resetGeminiFileCache } = await import("../media.js")

/** Minimal GoogleGenAI stand-in — only the surfaces media.ts actually touches. */
function fakeAi(overrides: { uploadName?: string; states?: string[] } = {}) {
  const upload = vi.fn().mockResolvedValue({
    name: overrides.uploadName ?? "files/abc123",
    uri: "https://generativelanguage.googleapis.com/v1beta/files/abc123",
  })
  const states = overrides.states ?? ["ACTIVE"]
  let i = 0
  const get = vi.fn().mockImplementation(async () => ({ state: states[Math.min(i++, states.length - 1)] }))
  return { files: { upload, get } } as unknown as GoogleGenAI & {
    files: { upload: typeof upload; get: typeof get }
  }
}

function bodyResponse(bytes: Buffer, headers: Record<string, string>) {
  return new Response(new Uint8Array(bytes), { status: 200, headers })
}

beforeEach(() => {
  safeFetch.mockReset()
  __resetGeminiFileCache()
})

describe("pure blocks need no network at all", () => {
  it("maps text straight through", async () => {
    const part = await blockToGeminiPart(fakeAi(), { type: "text", text: "hello" })
    expect(part).toEqual({ text: "hello" })
    expect(safeFetch).not.toHaveBeenCalled()
  })

  it("maps image_base64 to inlineData without re-encoding", async () => {
    const part = await blockToGeminiPart(fakeAi(), {
      type: "image_base64",
      mediaType: "image/png",
      data: "QUJD",
    })
    expect(part).toEqual({ inlineData: { mimeType: "image/png", data: "QUJD" } })
    expect(safeFetch).not.toHaveBeenCalled()
  })
})

describe("small assets inline", () => {
  it("base64-inlines a small image and keeps the served MIME type", async () => {
    const bytes = Buffer.from("tiny-image-bytes")
    safeFetch.mockResolvedValue(
      bodyResponse(bytes, { "content-type": "image/webp", "content-length": String(bytes.length) }),
    )

    const part = await blockToGeminiPart(fakeAi(), { type: "image", url: "https://r2.example/pic.webp" })

    expect(part).toEqual({ inlineData: { mimeType: "image/webp", data: bytes.toString("base64") } })
  })

  it("prefers the caller-declared mimeType over the served header", async () => {
    const bytes = Buffer.from("clip")
    safeFetch.mockResolvedValue(
      bodyResponse(bytes, { "content-type": "application/octet-stream", "content-length": String(bytes.length) }),
    )

    const part = await blockToGeminiPart(fakeAi(), {
      type: "video",
      url: "https://r2.example/a.bin",
      mimeType: "video/mp4",
    })

    expect(part).toMatchObject({ inlineData: { mimeType: "video/mp4" } })
  })

  it("falls back to the URL extension when the server says octet-stream", async () => {
    const bytes = Buffer.from("audio")
    safeFetch.mockResolvedValue(
      bodyResponse(bytes, { "content-type": "application/octet-stream", "content-length": String(bytes.length) }),
    )

    const part = await blockToGeminiPart(fakeAi(), { type: "audio", url: "https://r2.example/voice.mp3" })

    // A wrong MIME fails the whole generate call, so octet-stream must never
    // be forwarded verbatim.
    expect(part).toMatchObject({ inlineData: { mimeType: "audio/mpeg" } })
  })
})

describe("large assets upload via the Files API", () => {
  const big = 20 * 1024 * 1024

  it("uploads, waits for ACTIVE, and returns a fileData part", async () => {
    safeFetch.mockResolvedValue(
      bodyResponse(Buffer.from("x".repeat(1024)), {
        "content-type": "video/mp4",
        "content-length": String(big),
      }),
    )
    const ai = fakeAi({ states: ["PROCESSING", "PROCESSING", "ACTIVE"] })

    const part = await blockToGeminiPart(ai, { type: "video", url: "https://r2.example/big.mp4" })

    expect(part).toEqual({
      fileData: {
        fileUri: "https://generativelanguage.googleapis.com/v1beta/files/abc123",
        mimeType: "video/mp4",
      },
    })
    expect(ai.files.upload).toHaveBeenCalledOnce()
    // Referencing a still-PROCESSING file fails the generate call, so the
    // poll is load-bearing, not defensive decoration.
    expect(ai.files.get).toHaveBeenCalledTimes(3)
  })

  it("throws when the upload lands in FAILED", async () => {
    safeFetch.mockResolvedValue(
      bodyResponse(Buffer.from("x"), { "content-type": "video/mp4", "content-length": String(big) }),
    )
    const ai = fakeAi({ states: ["FAILED"] })

    await expect(
      blockToGeminiPart(ai, { type: "video", url: "https://r2.example/bad.mp4" }),
    ).rejects.toThrow(/processing failed/)
  })

  it("uploads when the server declares no content-length", async () => {
    safeFetch.mockResolvedValue(bodyResponse(Buffer.from("stream"), { "content-type": "video/mp4" }))
    const ai = fakeAi()

    const part = await blockToGeminiPart(ai, { type: "video", url: "https://r2.example/unknown-size.mp4" })

    // Unknown size must take the safe path, not gamble on inlining.
    expect(part).toHaveProperty("fileData")
    expect(ai.files.upload).toHaveBeenCalledOnce()
  })

  it("reuses the cached handle for a repeated URL instead of re-uploading", async () => {
    safeFetch.mockResolvedValue(
      bodyResponse(Buffer.from("x"), { "content-type": "video/mp4", "content-length": String(big) }),
    )
    const ai = fakeAi()
    const block = { type: "video" as const, url: "https://r2.example/same.mp4" }

    const first = await blockToGeminiPart(ai, block)
    const second = await blockToGeminiPart(ai, block)

    expect(second).toEqual(first)
    expect(ai.files.upload).toHaveBeenCalledOnce()
    expect(safeFetch).toHaveBeenCalledOnce()
  })
})

describe("YouTube is a native input", () => {
  it.each([
    "https://www.youtube.com/watch?v=abc",
    "https://youtu.be/abc",
  ])("passes %s through without downloading it", async (url) => {
    const ai = fakeAi()
    const part = await blockToGeminiPart(ai, { type: "video", url })

    expect(part).toEqual({ fileData: { fileUri: url } })
    expect(safeFetch).not.toHaveBeenCalled()
    expect(ai.files.upload).not.toHaveBeenCalled()
  })
})

describe("failures surface rather than degrade", () => {
  it("throws on a non-OK fetch instead of dropping the reference", async () => {
    safeFetch.mockResolvedValue(new Response("nope", { status: 404 }))

    // Silently dropping the media would leave the model answering about a
    // video it never saw — worse than a hard failure.
    await expect(
      blockToGeminiPart(fakeAi(), { type: "video", url: "https://r2.example/gone.mp4" }),
    ).rejects.toThrow(/fetch failed \(404\)/)
  })
})

describe("blocksToGeminiParts", () => {
  it("wraps a plain string message as a single text part", async () => {
    expect(await blocksToGeminiParts(fakeAi(), "just text")).toEqual([{ text: "just text" }])
  })

  it("preserves block order", async () => {
    const bytes = Buffer.from("i")
    safeFetch.mockResolvedValue(
      bodyResponse(bytes, { "content-type": "image/png", "content-length": String(bytes.length) }),
    )

    const parts = await blocksToGeminiParts(fakeAi(), [
      { type: "image", url: "https://r2.example/a.png" },
      { type: "text", text: "describe it" },
    ])

    expect(parts).toHaveLength(2)
    expect(parts[0]).toHaveProperty("inlineData")
    expect(parts[1]).toEqual({ text: "describe it" })
  })
})
