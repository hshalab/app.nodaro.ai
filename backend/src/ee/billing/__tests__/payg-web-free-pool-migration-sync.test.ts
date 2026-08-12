import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import path from "path"

// Text-sync assertions for migration 311 (D1 v2 pool-aware web spending).
// Same invariant classes as payg-migration-sync: replaced functions restate
// search_path, the old overload is dropped (PostgREST ambiguity), the mode
// self-gates on payg-ness, and the guard-mapped error marker is present.

const sql = readFileSync(
  path.resolve(__dirname, "../../../../../supabase/migrations/311_payg_web_free_pool.sql"),
  "utf8"
)

describe("payg web-free-pool migration 311 — text sync", () => {
  it("drops the old 8-arg overload explicitly", () => {
    expect(sql).toMatch(
      /DROP FUNCTION IF EXISTS reserve_credits\(UUID, INTEGER, UUID, TEXT, NUMERIC, NUMERIC, BOOLEAN, INTEGER\)/
    )
  })

  it("recreates reserve_credits with p_web_free_mode defaulting false, pin restated", () => {
    const fn = sql.split("CREATE OR REPLACE FUNCTION reserve_credits")[1] ?? ""
    expect(fn).toContain("p_web_free_mode BOOLEAN DEFAULT FALSE")
    expect(fn.slice(0, fn.indexOf("$$"))).toContain("SET search_path = public")
  })

  it("self-gates the restriction on payg-ness (stored free + lifetime > 0)", () => {
    expect(sql).toMatch(/p_web_free_mode AND v_tier = 'free' AND v_lifetime > 0/)
  })

  it("raises the guard-mapped marker when the free pool can't cover", () => {
    expect(sql).toContain("SUBSCRIPTION_REQUIRED:")
  })

  it("records the applied mode in usage_logs metadata for refund symmetry", () => {
    expect(sql).toMatch(/'web_free_mode', v_pool_restricted/)
  })

  it("revokes direct execution from anon/authenticated", () => {
    expect(sql).toMatch(/REVOKE EXECUTE ON FUNCTION reserve_credits[\s\S]{0,140}FROM anon, authenticated/)
  })
})
