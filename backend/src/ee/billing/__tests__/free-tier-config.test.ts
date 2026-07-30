import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { TIER_CREDITS, FREE_TIER_RESTRICTIONS } from "../stripe-config.js"

// The free tier's numbers live in two places that nothing reconciles: the code
// constants below, and the `tier_config` DB row. Migration 067 repriced every
// paid tier and skipped `free`, so the row sat at an earlier pricing
// structure's 50/mo + 10/day while the code granted 150/mo + 50/day. The
// monthly figure is not cosmetic — getBalance returns it as `monthlyAllocation`,
// which the public SDK exposes via client.credits.balance().
//
// Migration 281 corrected the row; 287 re-seeded it for the credit
// re-denomination. This pins the constants to the LATEST seeding migration, so
// changing a constant without re-seeding the table fails here instead of
// silently misreporting a user's allowance.

const MIGRATION = join(
  import.meta.dirname,
  "../../../../../supabase/migrations/287_credit_redenomination_tier_config.sql",
)

function seededFreeValues(): { monthly: number; daily: number } {
  const sql = readFileSync(MIGRATION, "utf8")
  const monthly = /monthly_credits\s*=\s*(\d+)/.exec(sql)
  const daily = /daily_credit_limit\s*=\s*(\d+)/.exec(sql)
  if (!monthly || !daily) throw new Error("could not parse the tier_config seeding migration")
  return { monthly: Number(monthly[1]), daily: Number(daily[1]) }
}

describe("free tier_config row matches the code constants", () => {
  it("seeds monthly_credits from TIER_CREDITS.free", () => {
    expect(seededFreeValues().monthly).toBe(TIER_CREDITS.free)
  })

  it("seeds daily_credit_limit from FREE_TIER_RESTRICTIONS.dailyCreditCap", () => {
    expect(seededFreeValues().daily).toBe(FREE_TIER_RESTRICTIONS.dailyCreditCap)
  })

  it("free tier is 150/month and 50/day", () => {
    // Pinned explicitly: these are the numbers quoted to users, so a change
    // should be a deliberate edit here, not an incidental one elsewhere.
    expect(TIER_CREDITS.free).toBe(1500)
    expect(FREE_TIER_RESTRICTIONS.dailyCreditCap).toBe(500)
  })
})
