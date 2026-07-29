/**
 * Routes must create jobs through `insertJob`, never `supabase.from("jobs")
 * .insert(...)` directly.
 *
 * This is the half of the design that doesn't decay. The helper alone is a
 * convention, and conventions lose: `mcp_client` was a genuinely useful column
 * that ended up absent from a large share of insert sites purely because each
 * new route had to remember it, and nothing anywhere reported the gap. The same
 * would happen to `source` / `source_detail` within a few features.
 *
 * So the rule is mechanical: a route that hand-rolls the insert fails this
 * test, with the fix in the message.
 *
 * Scope is `src/routes/` only. Workers, the orchestrator and reconcile paths
 * legitimately insert without a FastifyRequest to derive provenance from — they
 * are acting on behalf of an earlier request whose surface is already recorded
 * on the parent row, and inventing a source for them would be worse than
 * leaving it null.
 */
import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync } from "node:fs"
import { join, dirname, relative } from "node:path"
import { fileURLToPath } from "node:url"

const ROUTES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "routes")

function tsFiles(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "__tests__") continue
    const full = join(dir, e.name)
    if (e.isDirectory()) out.push(...tsFiles(full))
    else if (e.name.endsWith(".ts") && !e.name.endsWith(".d.ts")) out.push(full)
  }
  return out
}

/** `.from("jobs")` followed by `.insert(` — allowing the newline-and-indent
 *  chain style the routes are written in. `.update(` / `.select(` on jobs are
 *  untouched by this rule and must not match. */
const DIRECT_INSERT = /\.from\(\s*["']jobs["']\s*\)\s*\.insert\s*\(/

describe("routes create jobs through insertJob", () => {
  const files = tsFiles(ROUTES_DIR)

  it("finds route files to check (the guard is wired to something)", () => {
    expect(files.length).toBeGreaterThan(50)
  })

  it("no route inserts into jobs directly", () => {
    const offenders = files
      .filter((f) => DIRECT_INSERT.test(readFileSync(f, "utf8")))
      .map((f) => relative(ROUTES_DIR, f))

    expect(
      offenders,
      offenders.length === 0
        ? ""
        : `These routes insert into "jobs" directly, so their rows carry no source/source_detail ` +
          `and are invisible in the admin provenance view:\n` +
          offenders.map((o) => `  - routes/${o}`).join("\n") +
          `\n\nUse insertJob(req, row) from lib/insert-job.js — it returns the same ` +
          `{ data, error } shape, so only the call changes.`,
    ).toEqual([])
  })

  it("insertJob is actually used by routes (the rule isn't vacuous)", () => {
    // A regex-only guard passes trivially if every route stopped creating jobs.
    const users = files.filter((f) => readFileSync(f, "utf8").includes("insertJob("))
    expect(users.length).toBeGreaterThan(50)
  })
})
