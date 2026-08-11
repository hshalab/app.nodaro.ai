import { describe, it, expect } from "vitest"
import { readFileSync, existsSync } from "fs"
import path from "path"

// Text-parse sync assertions for the payg effective-tier migration (design
// 2026-07-05 §4.1 + audit F1). The suite cannot execute SQL (no local
// Supabase harness — house pattern, e.g. credit-pricing-migration-sync), so
// these pin the migration TEXT against the invariants that have regressed
// before:
//
//  - search_path pins: CREATE OR REPLACE drops function-level SET config
//    unless restated. reserve_credits lost its pin THREE times (migs 060/169/
//    171, re-pinned by 176 M2); check_profiles_update_allowed is pinned by
//    033:77. Both replacements here must carry the pin inline.
//  - RLS signature: a column absent from check_profiles_update_allowed's
//    signature+body is silently user-writable (self-mint-payg hole).
//  - grant exactly-once: the lifetime increment must sit AFTER the ON
//    CONFLICT early-return, and must NOT live in add_topup_credits (admin
//    comps reuse that path and must never mint payg).

const MIGRATION = path.resolve(
  __dirname,
  "../../../../../supabase/migrations/308_payg_effective_tier.sql"
)

function sql(): string {
  return readFileSync(MIGRATION, "utf8")
}

describe("payg migration 308 — text sync", () => {
  it("exists", () => {
    expect(existsSync(MIGRATION)).toBe(true)
  })

  it("adds both profile columns with safe defaults", () => {
    const s = sql()
    expect(s).toMatch(/ADD COLUMN IF NOT EXISTS lifetime_topup_credits INTEGER NOT NULL DEFAULT 0/)
    expect(s).toMatch(/ADD COLUMN IF NOT EXISTS last_topup_at TIMESTAMPTZ/)
  })

  it("backfills from the transactions claim table (type='topup'), not credit_transactions", () => {
    const s = sql()
    expect(s).toMatch(/FROM transactions[\s\S]{0,120}type = 'topup'/)
    expect(s).not.toMatch(/FROM credit_transactions/)
  })

  it("seeds the tier_config payg row idempotently", () => {
    expect(sql()).toMatch(
      /INSERT INTO tier_config[\s\S]{0,200}'payg'[\s\S]{0,200}ON CONFLICT \(tier\) DO NOTHING/
    )
  })

  it("drops the OLD 9-arg RLS function explicitly (no orphan overload)", () => {
    expect(sql()).toMatch(
      /DROP FUNCTION IF EXISTS check_profiles_update_allowed\(UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER, INTEGER, BIGINT\)/
    )
  })

  it("recreates the RLS function with BOTH new columns in signature and body, search_path pinned", () => {
    const s = sql()
    const fn = s.split("CREATE OR REPLACE FUNCTION check_profiles_update_allowed")[1] ?? ""
    expect(fn).toContain("p_lifetime_topup_credits INTEGER")
    expect(fn).toContain("p_last_topup_at TIMESTAMPTZ")
    expect(fn).toMatch(/p_lifetime_topup_credits IS NOT DISTINCT FROM v\.lifetime_topup_credits/)
    expect(fn).toMatch(/p_last_topup_at IS NOT DISTINCT FROM v\.last_topup_at/)
    expect(fn.slice(0, fn.indexOf("$$"))).toContain("SET search_path = public")
  })

  it("recreates the profiles UPDATE policy passing both new columns", () => {
    const s = sql()
    const policy = s.split('CREATE POLICY "Users can update own safe columns"')[1] ?? ""
    expect(policy).toContain("lifetime_topup_credits")
    expect(policy).toContain("last_topup_at")
  })

  it("replaces reserve_credits with the lifetime gate on BOTH free-allowance branches, search_path pinned", () => {
    const s = sql()
    const fn = s.split("CREATE OR REPLACE FUNCTION reserve_credits")[1] ?? ""
    expect(fn).toMatch(/COALESCE\(lifetime_topup_credits, 0\)/)
    // consume branch AND earn branch both exit for payg (lifetime > 0)
    const gates = fn.match(/v_lifetime = 0/g) ?? []
    expect(gates.length).toBeGreaterThanOrEqual(3)
    expect(fn.slice(0, fn.indexOf("$$"))).toContain("SET search_path = public")
  })

  it("extends grant_topup_credits_idempotent AFTER the duplicate early-return, pin retained", () => {
    const s = sql()
    const fn = s.split("CREATE OR REPLACE FUNCTION grant_topup_credits_idempotent")[1] ?? ""
    expect(fn.slice(0, fn.indexOf("$$"))).toContain("SET search_path = public")
    const earlyReturn = fn.indexOf("RETURN FALSE")
    const lifetime = fn.indexOf("lifetime_topup_credits")
    expect(earlyReturn).toBeGreaterThan(-1)
    expect(lifetime).toBeGreaterThan(earlyReturn)
  })

  it("never touches add_topup_credits (admin comps must not mint payg)", () => {
    expect(sql()).not.toContain("CREATE OR REPLACE FUNCTION add_topup_credits")
  })

  it("widens the transactions type CHECK to include 'refund'", () => {
    expect(sql()).toMatch(/CHECK \(type IN \('subscription', 'topup', 'refund'\)\)/)
  })

  it("creates a pool-only clawback RPC: claim-idempotent, clamped, pinned, revoked", () => {
    const s = sql()
    const fn = s.split("CREATE OR REPLACE FUNCTION clawback_topup_credits")[1] ?? ""
    expect(fn).toMatch(/ON CONFLICT \(stripe_transaction_id\) DO NOTHING/)
    expect(fn).toMatch(/GREATEST\(topup_credits - p_credits, 0\)/)
    expect(fn).toMatch(/GREATEST\(COALESCE\(lifetime_topup_credits, 0\) - p_credits, 0\)/)
    expect(fn.slice(0, fn.indexOf("$$"))).toContain("SET search_path = public")
    // pool-only: the storage floor lives in TS (TIER_STORAGE_LIMITS would drift)
    expect(fn).not.toContain("storage_limit_bytes")
    expect(s).toMatch(/REVOKE EXECUTE ON FUNCTION clawback_topup_credits[\s\S]{0,80}FROM anon, authenticated/)
  })
})
