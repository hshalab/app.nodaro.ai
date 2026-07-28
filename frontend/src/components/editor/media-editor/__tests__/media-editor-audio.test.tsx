import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { useMediaEditor } from "../use-media-editor"
import { detectMediaType } from "../utils"

// The editor hook pulls in the upload/api layer; none of it runs in these tests
// (we never reach handleUploadCurrent), but the module graph has to resolve.
vi.mock("@/lib/api", () => ({
  processMedia: vi.fn(),
  uploadFile: vi.fn(),
  StorageExceededError: class extends Error {},
}))
vi.mock("@/hooks/use-file-upload", () => ({
  useFileUpload: () => ({
    upload: vi.fn(),
    isUploading: false,
    uploadError: null,
    clearError: vi.fn(),
    storageExceeded: { exceeded: false, usedBytes: 0, quotaBytes: 0, remainingBytes: 0, tier: "free" },
    clearStorageExceeded: vi.fn(),
  }),
}))

const AUDIO_DURATION = 42.5

/**
 * jsdom has no media pipeline, so <audio>/<video> never fire loadedmetadata.
 * Stand in for it: any media element created during the test resolves with a
 * known duration on the next tick.
 */
function stubMediaElements(opts: { duration?: number; fail?: boolean } = {}) {
  const realCreate = document.createElement.bind(document)
  return vi.spyOn(document, "createElement").mockImplementation(((tag: string, ...rest: unknown[]) => {
    const el = realCreate(tag, ...(rest as []))
    if (tag === "audio" || tag === "video") {
      const media = el as HTMLMediaElement
      Object.defineProperty(media, "duration", {
        configurable: true,
        get: () => opts.duration ?? AUDIO_DURATION,
      })
      Object.defineProperty(media, "src", {
        configurable: true,
        set() {
          setTimeout(() => {
            if (opts.fail) media.onerror?.(new Event("error"))
            else media.onloadedmetadata?.(new Event("loadedmetadata"))
          }, 0)
        },
        get: () => "",
      })
    }
    return el
  }) as typeof document.createElement)
}

function audioFile(name = "clip.mp3", type = "audio/mpeg") {
  return new File([new Uint8Array([1, 2, 3])], name, { type })
}

describe("useMediaEditor — audio", () => {
  let spy: ReturnType<typeof stubMediaElements> | null = null

  beforeEach(() => {
    vi.useRealTimers()
  })

  afterEach(() => {
    spy?.mockRestore()
    spy = null
  })

  // Regression: openEditor only probed image and video, so audio files reached
  // the modal with duration 0. TrimPanel is gated on duration > 0, so "Adjust
  // Audio" rendered nothing but the format dropdown.
  it("probes duration for audio so the trim panel can render", async () => {
    spy = stubMediaElements()
    const { result } = renderHook(() => useMediaEditor({ onComplete: vi.fn() }))

    await act(async () => {
      await result.current.openEditor([audioFile()])
    })

    await waitFor(() => expect(result.current.isOpen).toBe(true))
    expect(result.current.currentFile?.mediaType).toBe("audio")
    expect(result.current.currentFile?.duration).toBeCloseTo(AUDIO_DURATION)
  })

  it("still opens the editor when the audio probe fails", async () => {
    spy = stubMediaElements({ fail: true })
    const { result } = renderHook(() => useMediaEditor({ onComplete: vi.fn() }))

    await act(async () => {
      await result.current.openEditor([audioFile("broken.mp3")])
    })

    await waitFor(() => expect(result.current.isOpen).toBe(true))
    expect(result.current.currentFile?.duration).toBe(0)
  })

  it("treats a non-finite duration as unknown rather than propagating Infinity", async () => {
    spy = stubMediaElements({ duration: Number.NaN })
    const { result } = renderHook(() => useMediaEditor({ onComplete: vi.fn() }))

    await act(async () => {
      await result.current.openEditor([audioFile()])
    })

    await waitFor(() => expect(result.current.isOpen).toBe(true))
    expect(result.current.currentFile?.duration).toBe(0)
  })
})

describe("detectMediaType", () => {
  it("classifies audio by mime type", () => {
    expect(detectMediaType(audioFile("a.mp3", "audio/mpeg"))).toBe("audio")
    expect(detectMediaType(audioFile("a.wav", "audio/wav"))).toBe("audio")
  })

  // Browsers often hand us an empty File.type for these, so the extension
  // fallback is the only thing keeping them out of the image branch.
  it("falls back to the extension for audio types browsers leave untyped", () => {
    for (const name of ["a.flac", "a.ogg", "a.opus", "a.aiff", "a.m4a", "a.aac"]) {
      expect(detectMediaType(new File([""], name, { type: "" }))).toBe("audio")
    }
  })
})
