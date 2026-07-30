/**
 * A2 authority #1 — actual KIE billing, collected locally.
 *
 * Reproduces the read-only aggregation of `POST /v1/admin/credit-audit/sync`
 * `{ mode: "actual" }` without needing an admin JWT: pulls the KIE billing
 * logs directly with KIE_API_KEY, aggregates per KIE model, and maps each to
 * our identifiers via the route's own buildModelMap (single source of the
 * alias logic).
 *
 * Output is denomination-neutral on purpose: raw KIE credits and USD
 * (1 KIE credit = $0.005). The A2 sheet derives new-base credits itself.
 *
 * Read-only everywhere: KIE log fetch + in-memory aggregation. Run:
 *
 *   cd backend
 *   set -a; source .env; set +a
 *   npx tsx scripts/kie-actual-billing.mts [lookbackMinutes] > /tmp/kie-actual.json
 *
 * (43200 = the 30-day KIE maximum window, default.)
 */
import { fetchAllKieLogs } from "../src/providers/kie/credit-lookup.js"
import { buildModelMap } from "../src/ee/routes/admin-credit-audit.js"

const KIE_USD_PER_CREDIT = 0.005

// The KIE billing-log endpoints are SESSION-authed (the kie.ai dashboard
// token an admin pastes into the credit-audit UI), NOT API-key-authed —
// KIE_API_KEY gets 401 "session token expired" on every endpoint. Grab a
// fresh token from the kie.ai dashboard and pass it as KIE_SESSION_TOKEN.
const token = process.env.KIE_SESSION_TOKEN || process.env.KIE_API_KEY
if (!token) throw new Error("KIE_SESSION_TOKEN (kie.ai dashboard session) required")
if (!process.env.KIE_SESSION_TOKEN) console.error("[kie-actual] WARNING: falling back to KIE_API_KEY — expect 401s; use a dashboard session token")

const lookbackMinutes = Math.min(Number(process.argv[2]) || 43_200, 43_200)
const endTime = Date.now()
const beginTime = endTime - lookbackMinutes * 60_000

const { records, sources, errors } = await fetchAllKieLogs(token, beginTime, endTime)
console.error(`[kie-actual] window=${lookbackMinutes}min records=${records.length} sources=${Object.keys(sources).length} errors=${Object.keys(errors).length}`)
for (const [src, msg] of Object.entries(errors)) console.error(`[kie-actual]   source error: ${src}: ${msg}`)

// Mirrors isSuccessState in admin-credit-audit.ts exactly.
const isSuccess = (state: string | undefined) => {
  const s = state?.toLowerCase?.() ?? ""
  return s === "success" || s === "completed" || s === "1" || s === "done"
}

interface Agg {
  kieModel: string
  tasks: number
  totalCredits: number
  minCredits: number
  maxCredits: number
  costBuckets: Map<number, number>
}
const byModel = new Map<string, Agg>()
for (const r of records) {
  if (!isSuccess(r.state)) continue
  const a = byModel.get(r.model)
  if (a) {
    a.tasks++
    a.totalCredits += r.consumeCredits
    a.minCredits = Math.min(a.minCredits, r.consumeCredits)
    a.maxCredits = Math.max(a.maxCredits, r.consumeCredits)
    a.costBuckets.set(r.consumeCredits, (a.costBuckets.get(r.consumeCredits) ?? 0) + 1)
  } else {
    byModel.set(r.model, {
      kieModel: r.model, tasks: 1, totalCredits: r.consumeCredits,
      minCredits: r.consumeCredits, maxCredits: r.consumeCredits,
      costBuckets: new Map([[r.consumeCredits, 1]]),
    })
  }
}

const modelMap = buildModelMap()
const round = (n: number, dp = 4) => Math.round(n * 10 ** dp) / 10 ** dp

const rows = [...byModel.values()]
  .sort((a, b) => b.tasks - a.tasks)
  .map(a => ({
    kieModel: a.kieModel,
    ourKeys: [...new Set((modelMap.get(a.kieModel) ?? []).map(m => (m as { ourKey: string }).ourKey))],
    tasks: a.tasks,
    avgKieCredits: round(a.totalCredits / a.tasks, 2),
    minKieCredits: a.minCredits,
    maxKieCredits: a.maxCredits,
    avgUsd: round((a.totalCredits / a.tasks) * KIE_USD_PER_CREDIT),
    minUsd: round(a.minCredits * KIE_USD_PER_CREDIT),
    maxUsd: round(a.maxCredits * KIE_USD_PER_CREDIT),
    variable: a.minCredits !== a.maxCredits,
    costBuckets: Object.fromEntries(
      [...a.costBuckets.entries()].sort((x, y) => x[0] - y[0]).map(([cr, n]) => [String(cr), n]),
    ),
  }))

console.log(JSON.stringify({
  collectedAt: new Date(endTime).toISOString(),
  lookbackMinutes,
  kieUsdPerCredit: KIE_USD_PER_CREDIT,
  totalRecords: records.length,
  successModels: rows.length,
  sources,
  errors,
  models: rows,
}, null, 2))
