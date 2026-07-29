/**
 * Where did a job come from? Prints the PROVENANCE of one job id — MCP tool,
 * orchestrated workflow run, single-node canvas Run, published app, or a direct
 * API/SDK call — without printing the job's content.
 *
 * The user-facing `GET /v1/jobs/:id` filters on `user_id = req.userId`, so an
 * operator cannot answer this question for someone else's job through the API;
 * a job belonging to another user is indistinguishable from one that does not
 * exist. This reads the row with the service-role client instead.
 *
 * Deliberately selects only provenance columns (no `input_data` / `output_data`
 * payloads) so running it on another user's job doesn't surface their prompts
 * or media. `input_data->>type` is the one exception — it's the node type, not
 * user content.
 *
 * Usage: npx tsx scripts/job-provenance.ts <jobId>
 */
import "dotenv/config"
import { createClient } from "@supabase/supabase-js"

const jobId = process.argv[2]
if (!jobId) {
  console.error("usage: npx tsx scripts/job-provenance.ts <jobId>")
  process.exit(1)
}

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing from the environment")
  process.exit(1)
}
const supabase = createClient(url, key)

interface JobProvenance {
  id: string
  status: string
  mcp_client: string | null
  workflow_id: string | null
  node_id: string | null
  workflow_execution_id: string | null
  provider: string | null
  user_id: string
  created_at: string
  started_at: string | null
  completed_at: string | null
  type: string | null
}

/**
 * The classification, in the order the fields are actually set:
 *
 *  - `mcp_client` is stamped by every MCP tool from `session.clientName`, and by
 *    nothing else — so it is the one unambiguous MCP marker.
 *  - `workflow_execution_id` is set only by the orchestrator, so it means the
 *    job was a node inside a server-side workflow run.
 *  - `workflow_id` + `node_id` with NO execution id is a single-node "Run" from
 *    the canvas (the frontend injects both via `withWorkflowId`).
 *  - none of the above = a direct REST/SDK call.
 *
 * MCP and workflow are not exclusive: `run_workflow` over MCP produces child
 * jobs carrying BOTH, which is why this reports every marker rather than
 * collapsing to one label.
 */
function classify(j: JobProvenance): string[] {
  const out: string[] = []
  if (j.mcp_client) out.push(`MCP — client "${j.mcp_client}"`)
  if (j.workflow_execution_id) out.push(`workflow run (execution ${j.workflow_execution_id})`)
  else if (j.workflow_id && j.node_id) out.push("single-node Run from the canvas")
  if (out.length === 0) out.push("direct REST / SDK call (no MCP tag, no workflow context)")
  return out
}

const { data, error } = await supabase
  .from("jobs")
  .select(
    "id,status,mcp_client,workflow_id,node_id,workflow_execution_id,provider,user_id,created_at,started_at,completed_at,input_data->>type",
  )
  .eq("id", jobId)
  .maybeSingle()

if (error) {
  console.error("query failed:", error.message)
  process.exit(1)
}
if (!data) {
  console.log(`job ${jobId}: NOT FOUND in the jobs table (check the environment — staging vs production)`)
  process.exit(0)
}

const j = data as unknown as JobProvenance
console.log(`job          : ${j.id}`)
console.log(`type         : ${j.type ?? "(none)"}`)
console.log(`status       : ${j.status}`)
console.log(`provider     : ${j.provider ?? "(none)"}`)
console.log(`created      : ${j.created_at}`)
console.log(`started      : ${j.started_at ?? "(not started)"}`)
console.log(`completed    : ${j.completed_at ?? "(not completed)"}`)
console.log(`user         : ${j.user_id}`)
console.log("")
console.log("markers      :")
console.log(`  mcp_client            = ${j.mcp_client ?? "null"}`)
console.log(`  workflow_execution_id = ${j.workflow_execution_id ?? "null"}`)
console.log(`  workflow_id           = ${j.workflow_id ?? "null"}`)
console.log(`  node_id               = ${j.node_id ?? "null"}`)
console.log("")
console.log("SOURCE       : " + classify(j).join(" + "))
