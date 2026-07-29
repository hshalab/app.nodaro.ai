/**
 * The `X-Nodaro-Client` header must be in the CORS allowlist.
 *
 * This is a fleet-outage guard, not a nicety. All six Nodaro client apps
 * (studio / person / voice / recast / recut / stitch) are browser SPAs that
 * call this API cross-origin through `@nodaro/sdk`, and the SDK sends this
 * header on EVERY request. A custom request header a browser sends must appear
 * in `Access-Control-Allow-Headers` or the preflight fails — at which point
 * every API call from every one of those apps breaks, not merely the
 * provenance field.
 *
 * The failure mode is what makes this worth a test: it cannot be caught in this
 * repo's own runtime. The backend keeps working, `app.nodaro.ai` keeps working
 * (same-origin), the SDK unit tests keep passing — and the breakage appears
 * only in six OTHER repositories, at whatever later date one of them bumps the
 * dependency. The header shipped in the SDK one commit before this allowlist
 * entry existed.
 */
import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { CLIENT_HEADER } from "../job-source.js"

const APP_TS = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "app.ts")

describe("CORS allows the client header", () => {
  const src = readFileSync(APP_TS, "utf8")

  it("app.ts registers CORS with an allowedHeaders list", () => {
    expect(src, "CORS allowedHeaders block not found — did the registration move?")
      .toMatch(/allowedHeaders:\s*\[/)
  })

  it("the allowlist includes the client header, by CONSTANT not by string", () => {
    // Referencing the constant is what keeps the two in lockstep: a rename of
    // CLIENT_HEADER then fails to compile here rather than silently dropping a
    // stale literal out of the allowlist.
    const block = /allowedHeaders:\s*\[([^\]]*)\]/.exec(src)?.[1] ?? ""
    expect(block, `allowedHeaders must include CLIENT_HEADER; found: ${block.trim()}`)
      .toContain("CLIENT_HEADER")
  })

  it("the constant is the exact header the SDK sends, lower-cased", () => {
    // Node lower-cases incoming header names, so the derivation reads the
    // lower-case form; CORS matching is case-insensitive, so one constant
    // serves both. Pinned because a capitalised value here would read fine and
    // silently never match `req.headers[...]`.
    expect(CLIENT_HEADER).toBe("x-nodaro-client")
    expect(CLIENT_HEADER).toBe(CLIENT_HEADER.toLowerCase())
  })
})
