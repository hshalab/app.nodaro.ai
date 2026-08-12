import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import path from "path"

// Text-sync assertions for migration 312 (Phase 4a community cloud-connect).
// House invariants: the widened kind vocabulary must carry ALL existing kinds
// (dropping one would break every existing app row's CHECK), and the cap
// column must be nullable (NULL = uncapped, the default).

const sql = readFileSync(
  path.resolve(__dirname, "../../../../../supabase/migrations/312_community_instance_connect.sql"),
  "utf8"
)

describe("community-connect migration 312 — text sync", () => {
  it("widens the kind CHECK keeping every existing kind", () => {
    for (const kind of ["user", "first_party_mcp", "dynamic_mcp", "community_instance"]) {
      expect(sql).toContain(`'${kind}'`)
    }
    expect(sql).toMatch(/DROP CONSTRAINT IF EXISTS developer_apps_kind_check/)
  })

  it("adds the nullable per-instance monthly cap", () => {
    expect(sql).toMatch(
      /ADD COLUMN IF NOT EXISTS monthly_spend_cap_credits INTEGER(?!\s+NOT NULL)/
    )
  })
})
