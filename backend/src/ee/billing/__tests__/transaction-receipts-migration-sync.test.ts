import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import path from "path"

// Migration 313: nullable receipt_url on transactions (Billing-UX).
const sql = readFileSync(
  path.resolve(__dirname, "../../../../../supabase/migrations/313_transaction_receipts.sql"),
  "utf8"
)

describe("transaction-receipts migration 313 — text sync", () => {
  it("adds a nullable receipt_url column", () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS receipt_url TEXT(?!\s+NOT NULL)/)
  })
})
