import { describe, it, expect } from "vitest"
import { newShotId, toWire } from "../shots.js"

describe("newShotId", () => {
  it("is short, URL-safe, and unique", () => {
    const ids = new Set(Array.from({ length: 500 }, () => newShotId()))
    expect(ids.size).toBe(500)
    for (const id of ids) {
      expect(id).toMatch(/^[A-Za-z0-9_-]{12}$/)
    }
  })
})

describe("toWire", () => {
  it("maps snake_case row to the camelCase wire shape", () => {
    const wire = toWire({
      id: "abc",
      mode: "single",
      selection_state: { setting: "forest" },
      free_text: "a forest",
      negative_prompt: null,
      assembled_prompt: "a lush forest",
      per_model_prompts: { veo3: "..." },
      models: ["veo3"],
      entity_refs: [{ entitySlug: "kira" }],
      result_urls: ["https://cdn.example/x.mp4"],
      visibility: "public",
      schema_version: 1,
      owner_id: "u1",
      created_at: "2026-08-09T00:00:00Z",
      updated_at: "2026-08-09T00:00:00Z",
    })
    expect(wire).toMatchObject({
      id: "abc",
      selectionState: { setting: "forest" },
      freeText: "a forest",
      assembledPrompt: "a lush forest",
      perModelPrompts: { veo3: "..." },
      entityRefs: [{ entitySlug: "kira" }],
      resultUrls: ["https://cdn.example/x.mp4"],
      visibility: "public",
      schemaVersion: 1,
      ownerId: "u1",
    })
    // nulls become undefined, not null, on the wire
    expect(wire.negativePrompt).toBeUndefined()
  })
})
