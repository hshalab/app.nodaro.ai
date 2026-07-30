/**
 * STATIC_CREDIT_COSTS <-> model_pricing parity check.
 *
 * The code table is a runtime FALLBACK; the DB is what users are actually
 * charged from (`getModelCreditBaseCost`). When they disagree, the price a
 * user pays depends on whether the DB lookup succeeded — so a mismatch is a
 * live pricing ambiguity, not a cosmetic one.
 *
 * Runnable today as a drift baseline, and again after the credit
 * re-denomination as the post-cutover parity assertion.
 *
 * Read-only. Requires a real SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY:
 *
 *   SUPABASE_URL="..." SUPABASE_SERVICE_ROLE_KEY="..." \
 *   SUPABASE_ANON_KEY=stub INTERNAL_ORCHESTRATOR_SECRET="<any 32+ char string>" \
 *   npx tsx scripts/pricing-parity.mts [--csv]
 *
 * (The orchestrator secret is only needed to satisfy env validation at import
 * time — this script never uses it. Do not paste a long hex literal here: the
 * gitleaks gate flags high-entropy hex on sight, even as documentation.)
 *
 * Exit code 1 when any identifier present in both sources disagrees.
 */
import { STATIC_CREDIT_COSTS } from "../src/ee/billing/credits.js"

const URL = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY || URL === "http://stub") {
  throw new Error("pricing-parity: a real SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are required")
}

type Row = { model_identifier: string; credit_cost: number }

const db = new Map<string, number>()
for (let offset = 0; ; offset += 1000) {
  const res = await fetch(
    `${URL}/rest/v1/model_pricing?select=model_identifier,credit_cost&limit=1000&offset=${offset}`,
    { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } },
  )
  if (!res.ok) throw new Error(`model_pricing fetch failed: ${res.status} ${await res.text()}`)
  const page = (await res.json()) as Row[]
  for (const r of page) db.set(r.model_identifier, Number(r.credit_cost))
  if (page.length < 1000) break
}

const stat = STATIC_CREDIT_COSTS as Record<string, number>
const ids = [...new Set([...Object.keys(stat), ...db.keys()])].sort()

type Status = "MATCH" | "MISMATCH" | "CODE_ONLY" | "DB_ONLY"
const rows = ids.map(id => {
  const s = stat[id]
  const d = db.get(id)
  const status: Status =
    s === undefined ? "DB_ONLY" : d === undefined ? "CODE_ONLY" : s === d ? "MATCH" : "MISMATCH"
  return { id, s, d, status }
})

const of = (k: Status) => rows.filter(r => r.status === k)

console.log(`identifiers: static=${Object.keys(stat).length} db=${db.size} union=${ids.length}`)
for (const k of ["MATCH", "MISMATCH", "CODE_ONLY", "DB_ONLY"] as Status[]) {
  console.log(`  ${k.padEnd(9)} ${of(k).length}`)
}

for (const k of ["MISMATCH", "CODE_ONLY", "DB_ONLY"] as Status[]) {
  const list = of(k)
  if (!list.length) continue
  console.log(`\n--- ${k} (${list.length}) ---`)
  for (const r of list) console.log(`  ${r.id}\tstatic=${r.s ?? "-"}\tdb=${r.d ?? "-"}`)
}

if (process.argv.includes("--csv")) {
  console.log(`\nidentifier,static_credits,db_credits,status`)
  for (const r of rows) console.log(`${r.id},${r.s ?? ""},${r.d ?? ""},${r.status}`)
}

if (of("MISMATCH").length > 0) process.exitCode = 1
