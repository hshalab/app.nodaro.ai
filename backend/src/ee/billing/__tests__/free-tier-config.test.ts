import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync } from "node:fs"
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

  it("free tier is 1,500/month and 500/day", () => {
    // Pinned explicitly: these are the numbers quoted to users, so a change
    // should be a deliberate edit here, not an incidental one elsewhere.
    expect(TIER_CREDITS.free).toBe(1500)
    expect(FREE_TIER_RESTRICTIONS.dailyCreditCap).toBe(500)
  })
})

// THE THIRD HOME OF THE FREE GRANT — and the one that broke.
//
// `handle_new_user()` (migration 001) inserts a profile without naming
// subscription_credits, so a new account's opening balance is decided ENTIRELY
// by that column's DEFAULT. The tests above pin the code constants against the
// tier_config row and caught drift there twice (067, 281) — but neither of them
// can see the column default, and the 2026-07-30 x10 re-denomination moved
// every free-tier number EXCEPT that one. It sat at 150 against 10x prices
// until 295 repaired it, which meant a new user could not afford a single
// `smart` analysis (333 credits) with their entire balance.
describe("profiles.subscription_credits default matches the free grant", () => {
  /** The default as the LATEST migration to set it leaves it. */
  function latestSeededDefault(): { value: number; migration: string } {
    const dir = join(import.meta.dirname, "../../../../../supabase/migrations")
    const hits = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort() // NNN_ prefix sorts chronologically
      .flatMap((f) => {
        const m = /ALTER\s+COLUMN\s+subscription_credits\s+SET\s+DEFAULT\s+(\d+)/i.exec(
          readFileSync(join(dir, f), "utf8"),
        )
        return m ? [{ value: Number(m[1]), migration: f }] : []
      })
    if (hits.length === 0) throw new Error("no migration sets the subscription_credits default")
    return hits[hits.length - 1]!
  }

  it("equals TIER_CREDITS.free — a new signup gets the advertised grant", () => {
    const { value, migration } = latestSeededDefault()
    expect(
      value,
      `${migration} leaves the signup default at ${value}, but TIER_CREDITS.free is ${TIER_CREDITS.free}. ` +
        `handle_new_user() relies on this default, so every new account would start at the wrong balance.`,
    ).toBe(TIER_CREDITS.free)
  })
})
