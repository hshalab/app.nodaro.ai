/**
 * A2 authority #2 — per-identifier OBSERVED provider costs from production.
 *
 * Joins jobs.provider_cost (the real charge recorded at commit) to the model
 * identifier via jobs.usage_log_id -> usage_logs.action, and aggregates per
 * identifier. This is the strongest cost authority available without a KIE
 * dashboard session token (the billing-log endpoints are session-authed, not
 * API-key-authed — fetchAllKieLogs 401s with KIE_API_KEY).
 *
 * Read-only. Run:
 *   cd backend && set -a && source .env && set +a
 *   npx tsx scripts/observed-provider-costs.mts > observed-costs.json
 */
const URL = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY || URL === "http://stub") throw new Error("real SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required")

type Row = {
  provider_cost: number | string
  provider: string | null
  job_type: string | null
  created_at: string
  usage_logs: { action: string | null }[] | { action: string | null } | null
}

const rows: Row[] = []
for (let offset = 0; ; offset += 1000) {
  const res = await fetch(
    `${URL}/rest/v1/jobs?select=provider_cost,provider,job_type,created_at,usage_logs(action)&provider_cost=gt.0&order=created_at.desc&limit=1000&offset=${offset}`,
    { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } },
  )
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
  const page = (await res.json()) as Row[]
  rows.push(...page)
  if (page.length < 1000) break
}
console.error(`[observed] jobs with provider_cost>0: ${rows.length}`)

function actionOf(r: Row): string {
  const ul = r.usage_logs
  const a = Array.isArray(ul) ? ul[0]?.action : ul?.action
  return a ?? `(no-usage-log) ${r.job_type ?? "?"}`
}

interface Agg {
  identifier: string
  n: number
  usd: number[]
  providers: Set<string>
  jobTypes: Set<string>
  firstSeen: string
  lastSeen: string
}
const byId = new Map<string, Agg>()
for (const r of rows) {
  const usd = Number(r.provider_cost)
  if (!Number.isFinite(usd) || usd <= 0) continue
  const id = actionOf(r)
  const a = byId.get(id)
  if (a) {
    a.n++
    a.usd.push(usd)
    if (r.provider) a.providers.add(r.provider)
    if (r.job_type) a.jobTypes.add(r.job_type)
    if (r.created_at < a.firstSeen) a.firstSeen = r.created_at
    if (r.created_at > a.lastSeen) a.lastSeen = r.created_at
  } else {
    byId.set(id, {
      identifier: id, n: 1, usd: [usd],
      providers: new Set(r.provider ? [r.provider] : []),
      jobTypes: new Set(r.job_type ? [r.job_type] : []),
      firstSeen: r.created_at, lastSeen: r.created_at,
    })
  }
}

const round = (n: number) => Math.round(n * 1e6) / 1e6
const q = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)))]

const out = [...byId.values()]
  .sort((a, b) => b.n - a.n)
  .map(a => {
    const sorted = [...a.usd].sort((x, y) => x - y)
    return {
      identifier: a.identifier,
      n: a.n,
      minUsd: round(sorted[0]),
      p50Usd: round(q(sorted, 0.5)),
      p95Usd: round(q(sorted, 0.95)),
      maxUsd: round(sorted[sorted.length - 1]),
      distinctValues: new Set(sorted.map(u => u.toFixed(6))).size,
      providers: [...a.providers].sort(),
      jobTypes: [...a.jobTypes].sort(),
      firstSeen: a.firstSeen,
      lastSeen: a.lastSeen,
    }
  })

console.log(JSON.stringify({
  collectedAt: new Date().toISOString(),
  totalJobs: rows.length,
  identifiers: out.length,
  source: "jobs.provider_cost joined to usage_logs.action via usage_log_id",
  models: out,
}, null, 2))
