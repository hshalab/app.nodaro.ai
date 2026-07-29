/**
 * Job provenance derivation.
 *
 * The precedence order is the whole substance of this module — signals
 * legitimately co-occur (the MCP server calls our own HTTP routes, so an
 * MCP-originated request also carries that hop's transport headers), and
 * getting the order wrong means confidently mislabelling the caller. These
 * tests pin the order, not just the individual cases.
 */
import { describe, it, expect } from "vitest"
import type { FastifyRequest } from "fastify"
import { deriveJobSource, jobSourceColumns, JOB_SOURCES } from "../job-source.js"

const req = (over: Partial<{ headers: Record<string, string>; body: unknown; isInternalCall: boolean; appAuthorization: { appId: string; authorizationId: string; scopes: string[] } }> = {}) =>
  ({ headers: {}, body: {}, ...over }) as unknown as FastifyRequest

describe("deriveJobSource", () => {
  it("defaults to api when nothing identifies the caller", () => {
    expect(deriveJobSource(req())).toEqual({ source: "api", sourceDetail: null })
  })

  it("internal orchestrator wins over everything", () => {
    // The orchestrator's own HTTP hop carries an Origin and may carry a body;
    // without this first check a workflow node would read as a browser call.
    const r = req({
      isInternalCall: true,
      body: { mcp_client: "Claude" },
      headers: { origin: "https://app.nodaro.ai", "x-nodaro-client": "cli/1.0.0" },
    })
    expect(deriveJobSource(r)).toEqual({ source: "internal", sourceDetail: null })
  })

  it("mcp beats the transport headers of the MCP server's own hop", () => {
    const r = req({ body: { mcp_client: "Claude" }, headers: { origin: "https://app.nodaro.ai" } })
    expect(deriveJobSource(r)).toEqual({ source: "mcp", sourceDetail: "Claude" })
  })

  it("a developer app beats the client header — which integration matters more than how", () => {
    const r = req({
      appAuthorization: { appId: "app_123", authorizationId: "auth_1", scopes: [] },
      headers: { "x-nodaro-client": "sdk/1.4.0" },
    })
    expect(deriveJobSource(r)).toEqual({ source: "app", sourceDetail: "app_123" })
  })

  it("reads cli and sdk from the client header, keeping the version", () => {
    expect(deriveJobSource(req({ headers: { "x-nodaro-client": "cli/1.4.0" } })))
      .toEqual({ source: "cli", sourceDetail: "cli/1.4.0" })
    expect(deriveJobSource(req({ headers: { "x-nodaro-client": "sdk/2.0.0-beta.1" } })))
      .toEqual({ source: "sdk", sourceDetail: "sdk/2.0.0-beta.1" })
  })

  it("ignores a client header claiming anything we don't recognise", () => {
    // Unauthenticated header: it may only SELECT among known values, never
    // invent one, or any caller could label itself whatever it liked.
    for (const bogus of ["web", "internal", "mcp", "totally-made-up", "cli-ish"]) {
      expect(deriveJobSource(req({ headers: { "x-nodaro-client": `${bogus}/9` } })).source).toBe("api")
    }
  })

  it("stores the ORIGIN HOST for browsers, so a new subdomain needs no code change", () => {
    // The point of the design: person.nodaro.ai has never been mentioned in
    // job-source.ts, and still classifies correctly on the day it launches.
    expect(deriveJobSource(req({ headers: { origin: "https://studio.nodaro.ai" } })))
      .toEqual({ source: "web", sourceDetail: "studio.nodaro.ai" })
    expect(deriveJobSource(req({ headers: { origin: "https://person.nodaro.ai" } })))
      .toEqual({ source: "web", sourceDetail: "person.nodaro.ai" })
    expect(deriveJobSource(req({ headers: { origin: "http://localhost:3000" } })))
      .toEqual({ source: "web", sourceDetail: "localhost:3000" })
  })

  it("falls back to api on an unparseable or null Origin rather than storing junk", () => {
    // `Origin: null` is what a sandboxed iframe / file:// page sends.
    expect(deriveJobSource(req({ headers: { origin: "null" } })).source).toBe("api")
    expect(deriveJobSource(req({ headers: { origin: "not a url" } })).source).toBe("api")
  })

  it("truncates an over-long detail instead of dropping it", () => {
    const long = "x".repeat(500)
    const d = deriveJobSource(req({ body: { mcp_client: long } })).sourceDetail
    expect(d).not.toBeNull()
    expect(d!.length).toBeLessThanOrEqual(80)
  })

  it("only ever emits a value from the declared vocabulary", () => {
    const cases = [
      req(),
      req({ isInternalCall: true }),
      req({ body: { mcp_client: "X" } }),
      req({ headers: { origin: "https://a.b" } }),
      req({ headers: { "x-nodaro-client": "cli/1" } }),
      req({ appAuthorization: { appId: "a", authorizationId: "b", scopes: [] } }),
    ]
    for (const c of cases) {
      expect(JOB_SOURCES).toContain(deriveJobSource(c).source)
    }
  })
})

describe("jobSourceColumns", () => {
  it("maps onto the real column names", () => {
    expect(jobSourceColumns(req({ headers: { origin: "https://studio.nodaro.ai" } })))
      .toEqual({ source: "web", source_detail: "studio.nodaro.ai" })
  })

  it("emits source_detail: null rather than omitting the key", () => {
    // The column exists; writing undefined would leave a stale value in place
    // on any future upsert path.
    const cols = jobSourceColumns(req())
    expect("source_detail" in cols).toBe(true)
    expect(cols.source_detail).toBeNull()
  })
})
