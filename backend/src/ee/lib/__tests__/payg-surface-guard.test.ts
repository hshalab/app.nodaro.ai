import { describe, it, expect, afterEach, beforeEach, vi } from "vitest"
import type { FastifyReply, FastifyRequest } from "fastify"

// Spend-surface enforcement matrix (decision log D1, 2026-08-12): payg
// accounts spend via developer surfaces only. The guard reads its flag and
// exemption list from process.env directly (see the module comment — partial
// config mocks in route suites), so the tests stub env; deriveJobSource runs
// REAL (it is pure) so origin/header handling is the production logic.

const profileRow: { data: Record<string, unknown> | null } = { data: null }
const singleMock = vi.fn(async () => profileRow)
vi.mock("../../../lib/supabase.js", () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ single: singleMock }) }),
    }),
  },
}))

const { blockPaygOnConsumerSurface, isConsumerSurfaceRequest } = await import(
  "../payg-surface-guard.js"
)

interface FakeReply {
  statusCode?: number
  payload?: { error?: { code?: string; message?: string } }
}

function makeReply(): FastifyReply & FakeReply {
  const reply: FakeReply & { status: (c: number) => unknown; send: (p: unknown) => unknown } = {
    status(code: number) {
      reply.statusCode = code
      return reply
    },
    send(payload: unknown) {
      reply.payload = payload as FakeReply["payload"]
      return reply
    },
  }
  return reply as unknown as FastifyReply & FakeReply
}

function makeReq(over: Partial<FastifyRequest> & { origin?: string | null }): FastifyRequest {
  const { origin, ...rest } = over
  return {
    userId: "user-1",
    authKind: "jwt",
    headers: origin === null ? {} : { origin: origin ?? "https://app.nodaro.ai" },
    body: {},
    ...rest,
  } as unknown as FastifyRequest
}

const PAYG = { tier: null, subscription_tier: null, lifetime_topup_credits: 3300 }
const FREE = { tier: "free", subscription_tier: null, lifetime_topup_credits: 0 }
const PRO = { tier: "pro", subscription_tier: "pro", lifetime_topup_credits: 5000 }

beforeEach(() => {
  vi.stubEnv("PAYG_WEB_BLOCK_ENABLED", "true")
  vi.stubEnv("PAYG_WEB_BLOCK_EXEMPT_USER_IDS", "")
  profileRow.data = null
  singleMock.mockClear()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("isConsumerSurfaceRequest", () => {
  it("browser JWT + web origin → consumer surface", () => {
    expect(isConsumerSurfaceRequest(makeReq({}))).toBe(true)
  })

  it("browser JWT + extension origin → consumer surface", () => {
    expect(
      isConsumerSurfaceRequest(makeReq({ origin: "chrome-extension://abcdefg" }))
    ).toBe(true)
  })

  it("JWT with no Origin (scripted HTTP) → api, not consumer", () => {
    expect(isConsumerSurfaceRequest(makeReq({ origin: null }))).toBe(false)
  })

  it("personal API token passes regardless of a web Origin", () => {
    expect(isConsumerSurfaceRequest(makeReq({ authKind: "api_token" }))).toBe(false)
  })

  it("app OAuth token and internal secret pass", () => {
    expect(isConsumerSurfaceRequest(makeReq({ authKind: "app_token" }))).toBe(false)
    expect(isConsumerSurfaceRequest(makeReq({ authKind: "internal" }))).toBe(false)
  })
})

describe("blockPaygOnConsumerSurface", () => {
  it("blocks payg + JWT + web with 403 subscription_required", async () => {
    const reply = makeReply()
    const blocked = await blockPaygOnConsumerSurface(makeReq({}), reply, PAYG)
    expect(blocked).toBe(true)
    expect(reply.statusCode).toBe(403)
    expect(reply.payload?.error?.code).toBe("subscription_required")
    expect(reply.payload?.error?.message).toContain("requires a subscription")
  })

  it("kill switch off → never blocks", async () => {
    vi.stubEnv("PAYG_WEB_BLOCK_ENABLED", "false")
    const reply = makeReply()
    expect(await blockPaygOnConsumerSurface(makeReq({}), reply, PAYG)).toBe(false)
    expect(reply.statusCode).toBeUndefined()
  })

  it("exempt (grandfathered) user id passes", async () => {
    vi.stubEnv("PAYG_WEB_BLOCK_EXEMPT_USER_IDS", "someone-else, user-1")
    expect(await blockPaygOnConsumerSurface(makeReq({}), makeReply(), PAYG)).toBe(false)
  })

  it("free tier (no purchases) keeps web access", async () => {
    expect(await blockPaygOnConsumerSurface(makeReq({}), makeReply(), FREE)).toBe(false)
  })

  it("active subscriber keeps web access even with lifetime top-ups", async () => {
    expect(await blockPaygOnConsumerSurface(makeReq({}), makeReply(), PRO)).toBe(false)
  })

  it("canceled subscriber with remaining top-ups derives payg → blocked", async () => {
    const canceled = { tier: "free", subscription_tier: null, lifetime_topup_credits: 5000 }
    const reply = makeReply()
    expect(await blockPaygOnConsumerSurface(makeReq({}), reply, canceled)).toBe(true)
    expect(reply.payload?.error?.code).toBe("subscription_required")
  })

  it("payg via API surface (no Origin) passes — that IS the developer lane", async () => {
    expect(await blockPaygOnConsumerSurface(makeReq({ origin: null }), makeReply(), PAYG)).toBe(false)
  })

  it("skips the profile fetch when the caller supplies the row", async () => {
    await blockPaygOnConsumerSurface(makeReq({}), makeReply(), PAYG)
    expect(singleMock).not.toHaveBeenCalled()
  })

  it("fetches a minimal profile when none is supplied (standalone preHandler path)", async () => {
    profileRow.data = { tier: "free", subscription_tier: null, lifetime_topup_credits: 1650 }
    const reply = makeReply()
    expect(await blockPaygOnConsumerSurface(makeReq({}), reply)).toBe(true)
    expect(singleMock).toHaveBeenCalledOnce()
    expect(reply.statusCode).toBe(403)
  })

  it("fails open when the profile row is missing", async () => {
    profileRow.data = null
    expect(await blockPaygOnConsumerSurface(makeReq({}), makeReply())).toBe(false)
  })
})

describe("internal-call flag preservation (D1 v2 threading)", () => {
  it("isConsumerSurfaceRequest stays false for internal calls (no Origin trust)", () => {
    expect(
      isConsumerSurfaceRequest(makeReq({ authKind: "internal", isInternalCall: true } as never))
    ).toBe(false)
  })

  it("isWebFreeModeCandidate is a pure surface predicate — flag gates it", async () => {
    const { isWebFreeModeCandidate } = await import("../payg-surface-guard.js")
    expect(isWebFreeModeCandidate(makeReq({}))).toBe(true)
    vi.stubEnv("PAYG_WEB_BLOCK_ENABLED", "false")
    expect(isWebFreeModeCandidate(makeReq({}))).toBe(false)
  })
})
