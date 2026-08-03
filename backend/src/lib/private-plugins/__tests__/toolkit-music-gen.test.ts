/**
 * `tk.providers.generateMusic` — the gvp keyframes music lane's toolkit
 * member (ADDITIVE 2026-08-04). Wraps `sunoGenerate` from
 * `providers/kie/suno-client.ts` reduced to ONE track: DESCRIPTION mode
 * pinned (custom mode redefines `prompt` as lyrics — wrong lane for a score
 * brief), instrumental defaulted ON, no duration hint sent (custom-mode-gated
 * upstream; the plugin cuts to length itself), first track wins.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockSunoGenerate } = vi.hoisted(() => ({ mockSunoGenerate: vi.fn() }))
vi.mock("../../../providers/kie/suno-client.js", () => ({
  sunoGenerate: mockSunoGenerate,
}))

import { buildToolkit } from "../toolkit.js"

describe("tk.providers.generateMusic", () => {
  beforeEach(() => {
    mockSunoGenerate.mockReset()
  })

  const track = (over: Record<string, unknown> = {}) => ({
    id: "t1", audioUrl: "https://suno/track-1.mp3", duration: 187.4, ...over,
  })

  it("pins description mode + V5_5, defaults instrumental ON, forwards the style tags, and NEVER sends a duration hint", async () => {
    mockSunoGenerate.mockResolvedValue({ taskId: "suno-task-1", tracks: [track()] })
    const tk = buildToolkit()
    const res = await tk.providers.generateMusic!("tense cinematic chase score", {
      style: "orchestral hybrid, 140 BPM",
      durationSec: 76, // advisory — must not reach the wire
    })
    expect(mockSunoGenerate).toHaveBeenCalledTimes(1)
    const [params, reconcile] = mockSunoGenerate.mock.calls[0]!
    expect(params).toEqual({
      prompt: "tense cinematic chase score",
      model: "V5_5",
      customMode: false,
      instrumental: true,
      style: "orchestral hybrid, 140 BPM",
    })
    expect(params.duration).toBeUndefined()
    expect(reconcile).toBeUndefined() // no onTaskCreated → no reconcileOpts at all
    expect(res).toEqual({ url: "https://suno/track-1.mp3", durationSec: 187.4, taskId: "suno-task-1" })
  })

  it("instrumental: false is honored, and the FIRST track wins when Suno returns two takes", async () => {
    mockSunoGenerate.mockResolvedValue({
      taskId: "suno-task-2",
      tracks: [track({ audioUrl: "https://suno/take-a.mp3" }), track({ audioUrl: "https://suno/take-b.mp3" })],
    })
    const tk = buildToolkit()
    const res = await tk.providers.generateMusic!("ballad with vocals", { instrumental: false })
    expect(mockSunoGenerate.mock.calls[0]![0]).toMatchObject({ instrumental: false })
    expect(res.url).toBe("https://suno/take-a.mp3")
  })

  it("a non-finite reported duration is dropped rather than forwarded", async () => {
    mockSunoGenerate.mockResolvedValue({ taskId: "t", tracks: [track({ duration: Number.NaN })] })
    const tk = buildToolkit()
    const res = await tk.providers.generateMusic!("brief")
    expect(res.durationSec).toBeUndefined()
  })

  it("throws on an empty result so the caller's non-fatal music guard can degrade", async () => {
    mockSunoGenerate.mockResolvedValue({ taskId: "t", tracks: [] })
    const tk = buildToolkit()
    await expect(tk.providers.generateMusic!("brief")).rejects.toThrow(/no track/)
  })

  it("adapts onTaskCreated into ReconcileOpts (void-returning callbacks awaited as promises)", async () => {
    mockSunoGenerate.mockResolvedValue({ taskId: "suno-task-3", tracks: [track()] })
    const seen: string[] = []
    const tk = buildToolkit()
    await tk.providers.generateMusic!("brief", { onTaskCreated: (id) => void seen.push(id) })
    const [, reconcile] = mockSunoGenerate.mock.calls[0]!
    expect(typeof reconcile?.onTaskCreated).toBe("function")
    await reconcile.onTaskCreated("task-xyz")
    expect(seen).toEqual(["task-xyz"])
  })
})
