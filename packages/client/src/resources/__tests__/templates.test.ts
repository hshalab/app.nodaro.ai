import { describe, it, expect, vi } from "vitest"
import { createClient, StaticTokenAuth } from "../../index.js"
import type { TemplateBrowseCard, TutorialCategory } from "../../index.js"

function mockOk<T>(body: T) {
  return Promise.resolve({ ok: true, status: 200, json: async () => body } as unknown as Response)
}

function makeClient(fetchMock: ReturnType<typeof vi.fn>) {
  return createClient({
    baseUrl: "https://api.example.com",
    auth: new StaticTokenAuth("t"),
    fetch: fetchMock,
  })
}

const CARD: TemplateBrowseCard = {
  id: "00000000-0000-4000-8000-00000000000a",
  slug: "noir-trailer",
  name: "Noir Trailer",
  description: "A moody trailer flow",
  estimatedCredits: 42,
  category: "video",
  outputTypes: ["video"],
  tags: ["noir"],
  nodeTypesUsed: ["generate-video"],
  providersUsed: ["kling-3-omni"],
  nodeCount: 7,
  complexity: "medium",
  previewMediaUrl: null,
  previewMediaType: null,
  creatorId: "00000000-0000-4000-8000-000000000001",
  creatorDisplayName: "Ada",
  cloneCount: 3,
  favoriteCount: 1,
  createdAt: "2026-07-29T00:00:00Z",
}

describe("templates resource", () => {
  it("browse() GETs /v1/templates/browse with query params and returns the page", async () => {
    const fetchMock = vi.fn().mockReturnValueOnce(mockOk({ data: [CARD], nextCursor: null }))
    const c = makeClient(fetchMock)
    const page = await c.templates.browse({ sort: "popular", search: "noir", limit: 10 })

    const url = String(fetchMock.mock.calls[0][0])
    expect(url).toContain("https://api.example.com/v1/templates/browse?")
    expect(url).toContain("sort=popular")
    expect(url).toContain("search=noir")
    expect(url).toContain("limit=10")
    expect(page.data[0].slug).toBe("noir-trailer")
    expect(page.nextCursor).toBeNull()
  })

  it("get() GETs /v1/templates/:slug (URL-encoded) and returns the template row", async () => {
    const fetchMock = vi.fn().mockReturnValueOnce(
      mockOk({ ...CARD, markdownDescription: null, snapshotNodes: [], snapshotEdges: [], snapshotSettings: {}, listedIn: ["marketplace"] }),
    )
    const c = makeClient(fetchMock)
    const tpl = await c.templates.get("noir-trailer")

    expect(String(fetchMock.mock.calls[0][0])).toBe("https://api.example.com/v1/templates/noir-trailer")
    expect(tpl.snapshotNodes).toEqual([])
    expect(tpl.listedIn).toContain("marketplace")
  })

  it("clone() POSTs projectId + optional name and returns the new workflow id", async () => {
    const fetchMock = vi.fn().mockReturnValueOnce(
      mockOk({ workflowId: "wf-1", projectId: "proj-1" }),
    )
    const c = makeClient(fetchMock)
    const result = await c.templates.clone("noir-trailer", { projectId: "proj-1", name: "My Copy" })

    expect(String(fetchMock.mock.calls[0][0])).toBe("https://api.example.com/v1/templates/noir-trailer/clone")
    const init = fetchMock.mock.calls[0][1] as { method: string; body: string }
    expect(init.method).toBe("POST")
    expect(JSON.parse(init.body)).toEqual({ projectId: "proj-1", name: "My Copy" })
    expect(result.workflowId).toBe("wf-1")
  })
})

describe("tutorials resource", () => {
  it("list() GETs /v1/tutorials and returns grouped categories", async () => {
    const category: TutorialCategory = {
      id: "cat-1",
      name: "Studio Examples",
      slug: "studio-examples",
      sortOrder: 10,
      videos: [],
      flows: [],
    }
    const fetchMock = vi.fn().mockReturnValueOnce(mockOk({ categories: [category] }))
    const c = makeClient(fetchMock)
    const res = await c.tutorials.list()

    expect(String(fetchMock.mock.calls[0][0])).toBe("https://api.example.com/v1/tutorials")
    expect(res.categories[0].slug).toBe("studio-examples")
  })
})
