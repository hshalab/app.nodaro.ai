import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import path from "path"

// Text-sync assertions for migration 314 (top-up 12-month expiry).
// Invariant classes mirror payg-migration-sync: replaced function bodies
// restate their search_path pin and REVOKEs (CREATE OR REPLACE drops both —
// migration 308 header / 176 M2), signatures stay IDENTICAL (a new overload
// would leave the old function callable AND default to PUBLIC execute — the
// exact hole migration 024 closed), and the expiry waterfall never touches
// the payg-tier inputs (lifetime_topup_credits / the transactions claim
// ledger — expiry is not a refund).

const sql = readFileSync(
  path.resolve(__dirname, "../../../../../supabase/migrations/314_topup_expiry.sql"),
  "utf8"
)

function fnBody(name: string): string {
  const after = sql.split(`CREATE OR REPLACE FUNCTION ${name}`)[1] ?? ""
  const end = after.indexOf("$$;")
  return after.slice(0, end === -1 ? undefined : end)
}

describe("topup expiry migration 314 — text sync", () => {
  it("creates the grants ledger with a live-remainder partial index and RLS", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS topup_grants")
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS idx_topup_grants_due[\s\S]{0,120}WHERE expired_amount < amount/)
    expect(sql).toContain("ALTER TABLE topup_grants ENABLE ROW LEVEL SECURITY")
  })

  it("keeps every replaced signature identical — no new overloads", () => {
    expect(sql).toContain("FUNCTION add_topup_credits(p_user_id UUID, p_credits INTEGER)")
    expect(sql).not.toMatch(/add_topup_credits\([^)]*p_source/)
    expect(sql).toContain("REVOKE EXECUTE ON FUNCTION grant_topup_credits_idempotent(UUID, INTEGER, TEXT, DECIMAL)")
    expect(sql).toContain("REVOKE ALL ON FUNCTION admin_adjust_credits(UUID, TEXT, INTEGER)")
  })

  it("restates the search_path pin on all four replaced/new functions", () => {
    for (const fn of ["add_topup_credits", "grant_topup_credits_idempotent", "admin_adjust_credits", "expire_topup_credits"]) {
      const header = (sql.split(`CREATE OR REPLACE FUNCTION ${fn}`)[1] ?? "").split("$$")[0]
      expect(header, `${fn} must restate SET search_path`).toContain("SET search_path = public")
    }
  })

  it("re-revokes anon/authenticated execution on all four functions", () => {
    expect(sql).toMatch(/REVOKE EXECUTE ON FUNCTION add_topup_credits\(UUID, INTEGER\) FROM authenticated, anon/)
    expect(sql).toMatch(/REVOKE EXECUTE ON FUNCTION grant_topup_credits_idempotent[\s\S]{0,80}FROM anon, authenticated/)
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION admin_adjust_credits[\s\S]{0,60}FROM anon, authenticated/)
    expect(sql).toMatch(/REVOKE EXECUTE ON FUNCTION expire_topup_credits\(UUID\) FROM authenticated, anon/)
  })

  it("every grant path records a topup_grants row", () => {
    expect(fnBody("add_topup_credits(p_user_id UUID, p_credits INTEGER)")).toContain("INSERT INTO topup_grants")
    expect(fnBody("admin_adjust_credits")).toContain("INSERT INTO topup_grants")
    // purchases refine the source inside the idempotent grant's transaction
    expect(fnBody("grant_topup_credits_idempotent")).toContain("SET source = 'purchase'")
  })

  it("expiry waterfall locks the profile row and iterates grants FIFO", () => {
    const body = fnBody("expire_topup_credits")
    expect(body).toContain("FOR UPDATE")
    expect(body).toMatch(/ORDER BY granted_at ASC/)
  })

  it("expiry NEVER touches lifetime_topup_credits or the transactions ledger", () => {
    const body = fnBody("expire_topup_credits")
    expect(body).not.toContain("lifetime_topup_credits")
    expect(body).not.toMatch(/INSERT INTO transactions|UPDATE transactions/)
  })

  it("grandfathers only live balances and documents the no-double-count rule", () => {
    expect(sql).toMatch(/'grandfather'[\s\S]{0,120}FROM profiles[\s\S]{0,60}WHERE COALESCE\(topup_credits, 0\) > 0/)
    expect(sql.toLowerCase()).toContain("double-count")
  })
})
