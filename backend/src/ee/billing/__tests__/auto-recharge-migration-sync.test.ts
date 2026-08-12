import { describe, it, expect } from "vitest"
import { readFileSync, existsSync } from "fs"
import path from "path"

// Text-parse sync assertions for the auto-recharge migration (design
// 2026-07-05 §5.1, founder amendment 2026-08-12: the recharge target is a
// user-chosen dollar AMOUNT, not a pack price id). Same invariant classes
// as payg-migration-sync: every new profiles column must enter the RLS
// guard function (columns absent from it are silently user-writable —
// users could reset failure counts / backdate cooldowns / repoint the
// charge amount), and every replaced function restates its search_path.

const MIGRATION = path.resolve(
  __dirname,
  "../../../../../supabase/migrations/310_auto_recharge.sql"
)

const COLUMNS = [
  "auto_recharge_enabled",
  "auto_recharge_threshold_credits",
  "auto_recharge_amount_usd",
  "auto_recharge_failure_count",
  "auto_recharge_last_attempt_at",
  "auto_recharge_daily_count",
  "auto_recharge_daily_date",
]

function sql(): string {
  return readFileSync(MIGRATION, "utf8")
}

describe("auto-recharge migration 310 — text sync", () => {
  it("exists", () => {
    expect(existsSync(MIGRATION)).toBe(true)
  })

  it("adds all seven columns with safe defaults", () => {
    const s = sql()
    expect(s).toMatch(/ADD COLUMN IF NOT EXISTS auto_recharge_enabled BOOLEAN NOT NULL DEFAULT FALSE/)
    expect(s).toMatch(/ADD COLUMN IF NOT EXISTS auto_recharge_threshold_credits INTEGER/)
    expect(s).toMatch(/ADD COLUMN IF NOT EXISTS auto_recharge_amount_usd INTEGER/)
    expect(s).toMatch(/ADD COLUMN IF NOT EXISTS auto_recharge_failure_count INTEGER NOT NULL DEFAULT 0/)
    expect(s).toMatch(/ADD COLUMN IF NOT EXISTS auto_recharge_last_attempt_at TIMESTAMPTZ/)
    expect(s).toMatch(/ADD COLUMN IF NOT EXISTS auto_recharge_daily_count INTEGER NOT NULL DEFAULT 0/)
    expect(s).toMatch(/ADD COLUMN IF NOT EXISTS auto_recharge_daily_date DATE/)
  })

  it("drops the OLD 11-arg RLS function explicitly (no orphan overload)", () => {
    expect(sql()).toMatch(
      /DROP FUNCTION IF EXISTS check_profiles_update_allowed\(UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER, INTEGER, BIGINT, INTEGER, TIMESTAMPTZ\)/
    )
  })

  it("recreates the RLS function with ALL seven columns in signature and body, pin restated", () => {
    const s = sql()
    const fn = s.split("CREATE OR REPLACE FUNCTION check_profiles_update_allowed")[1] ?? ""
    for (const c of COLUMNS) {
      expect(fn, `signature/body must carry ${c}`).toContain(`p_${c}`)
      expect(fn).toMatch(new RegExp(`p_${c} IS NOT DISTINCT FROM v\\.${c}`))
    }
    expect(fn.slice(0, fn.indexOf("$$"))).toContain("SET search_path = public")
  })

  it("recreates the profiles UPDATE policy passing all seven columns", () => {
    const s = sql()
    const policy = s.split('CREATE POLICY "Users can update own safe columns"')[1] ?? ""
    for (const c of COLUMNS) {
      expect(policy, `policy must pass ${c}`).toContain(c)
    }
  })

  it("creates the atomic claim RPC: all gates in one UPDATE, pinned, revoked", () => {
    const s = sql()
    const fn = s.split("CREATE OR REPLACE FUNCTION claim_auto_recharge")[1] ?? ""
    expect(fn).toContain("auto_recharge_failure_count < 3")
    expect(fn).toMatch(/INTERVAL '10 minutes'/)
    expect(fn).toContain("auto_recharge_daily_count < 3")
    expect(fn.slice(0, fn.indexOf("$$"))).toContain("SET search_path = public")
    expect(s).toMatch(/REVOKE EXECUTE ON FUNCTION claim_auto_recharge[\s\S]{0,60}FROM anon, authenticated/)
  })

  it("creates the failure RPC with auto-disable at 3, pinned, revoked", () => {
    const s = sql()
    const fn = s.split("CREATE OR REPLACE FUNCTION record_auto_recharge_failure")[1] ?? ""
    expect(fn).toContain("auto_recharge_failure_count + 1 >= 3")
    expect(fn.slice(0, fn.indexOf("$$"))).toContain("SET search_path = public")
    expect(s).toMatch(/REVOKE EXECUTE ON FUNCTION record_auto_recharge_failure[\s\S]{0,60}FROM anon, authenticated/)
  })

  it("never touches reserve_credits or the grant RPC (out of scope)", () => {
    const s = sql()
    expect(s).not.toContain("CREATE OR REPLACE FUNCTION reserve_credits")
    expect(s).not.toContain("CREATE OR REPLACE FUNCTION grant_topup_credits_idempotent")
  })
})
