import { describe, it, expect, vi, beforeEach } from "vitest"
import Fastify, { type FastifyInstance } from "fastify"

// ---------------------------------------------------------------------------
// Mocks — hoisted before any route import
// ---------------------------------------------------------------------------

vi.mock("@/lib/supabase.js", () => ({
  supabase: { from: vi.fn() },
}))

vi.mock("@/lib/config.js", () => ({
  config: { EDITION: "community" },
  isCloud: () => false,
  isCommunity: () => true,
  isBusiness: () => false,
  hasAdmin: () => false,
  hasCredits: () => false,
}))

vi.mock("@/lib/default-project.js", () => ({
  ensureDefaultProject: vi.fn(),
}))

import { onboardingRoutes } from "../onboarding.js"
import { supabase } from "../../lib/supabase.js"
import { ensureDefaultProject } from "../../lib/default-project.js"

const TEST_USER_ID = "00000000-0000-4000-8000-000000000001"
const mockFrom = supabase.from as ReturnType<typeof vi.fn>
const mockEnsureDefaultProject = ensureDefaultProject as ReturnType<typeof vi.fn>

// ---------------------------------------------------------------------------
// Builder helpers for the two supabase call shapes the route makes
// ---------------------------------------------------------------------------

/** profiles claim: .update().eq().is().select() resolving to { data, error } */
function profilesClaimBuilder(result: { data: unknown; error: unknown }) {
  return {
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        is: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue(result),
        }),
        // resetSeedClaim path: .update().eq() awaited directly
        then: (resolve: (v: { error: null }) => void) => resolve({ error: null }),
      }),
    }),
  }
}

/** workflows insert: .insert().select().single() resolving to { data, error } */
function workflowsInsertBuilder(result: { data: unknown; error: unknown }) {
  return {
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue(result),
      }),
    }),
  }
}

let app: FastifyInstance

beforeEach(async () => {
  vi.clearAllMocks()
  app = Fastify({ logger: false })
  app.addHook("preHandler", async (req) => {
    const body = req.body as Record<string, unknown> | undefined
    if (body?.userId && typeof body.userId === "string") {
      req.userId = body.userId
    }
  })
  await app.register(onboardingRoutes)
})

describe("POST /v1/onboarding/seed-demo", () => {
  it("returns 401 without auth", async () => {
    const res = await app.inject({ method: "POST", url: "/v1/onboarding/seed-demo", payload: {} })
    expect(res.statusCode).toBe(401)
  })

  it("seeds the demo workflow when the claim wins", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles") {
        return profilesClaimBuilder({ data: [{ id: TEST_USER_ID }], error: null })
      }
      return workflowsInsertBuilder({ data: { id: "wf-1" }, error: null })
    })
    mockEnsureDefaultProject.mockResolvedValue({
      projectId: "proj-1",
      project: {},
      created: false,
    })

    const res = await app.inject({
      method: "POST",
      url: "/v1/onboarding/seed-demo",
      payload: { userId: TEST_USER_ID },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ seeded: true, workflowId: "wf-1", projectId: "proj-1" })

    // The inserted workflow carries the demo content into the default project.
    const workflowsBuilder = mockFrom.mock.results.find(
      (r, i) => mockFrom.mock.calls[i][0] === "workflows",
    )?.value as { insert: ReturnType<typeof vi.fn> }
    const inserted = workflowsBuilder.insert.mock.calls[0][0]
    expect(inserted.project_id).toBe("proj-1")
    expect(inserted.user_id).toBe(TEST_USER_ID)
    expect(Array.isArray(inserted.nodes)).toBe(true)
    expect(inserted.nodes.length).toBeGreaterThan(0)
    expect(inserted.settings).toEqual({ demoSeed: true })
  })

  it("no-ops with seeded:false when the user was already seeded", async () => {
    mockFrom.mockImplementation(() =>
      profilesClaimBuilder({ data: [], error: null }),
    )

    const res = await app.inject({
      method: "POST",
      url: "/v1/onboarding/seed-demo",
      payload: { userId: TEST_USER_ID },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ seeded: false })
    expect(mockEnsureDefaultProject).not.toHaveBeenCalled()
  })

  it.each(["PGRST204", "42703"])(
    "degrades to seeded:false while migration 306 has not applied yet (%s)",
    async (code) => {
      mockFrom.mockImplementation(() =>
        profilesClaimBuilder({ data: null, error: { code, message: "column missing" } }),
      )

      const res = await app.inject({
        method: "POST",
        url: "/v1/onboarding/seed-demo",
        payload: { userId: TEST_USER_ID },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ seeded: false })
    },
  )

  it("releases the claim when the workflow insert fails", async () => {
    const resetEq = vi.fn().mockResolvedValue({ error: null })
    let updateCall = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          update: vi.fn().mockImplementation(() => {
            updateCall += 1
            if (updateCall === 1) {
              // claim
              return {
                eq: vi.fn().mockReturnValue({
                  is: vi.fn().mockReturnValue({
                    select: vi.fn().mockResolvedValue({
                      data: [{ id: TEST_USER_ID }],
                      error: null,
                    }),
                  }),
                }),
              }
            }
            // reset
            return { eq: resetEq }
          }),
        }
      }
      return workflowsInsertBuilder({ data: null, error: { message: "insert failed" } })
    })
    mockEnsureDefaultProject.mockResolvedValue({
      projectId: "proj-1",
      project: {},
      created: false,
    })

    const res = await app.inject({
      method: "POST",
      url: "/v1/onboarding/seed-demo",
      payload: { userId: TEST_USER_ID },
    })

    expect(res.statusCode).toBe(500)
    expect(resetEq).toHaveBeenCalledWith("id", TEST_USER_ID)
  })
})
