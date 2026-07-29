-- 282_jobs_source_provenance.sql
--
-- Record WHICH SURFACE created each job, so admin can tell an MCP call from a
-- CLI run from a browser session from an integration.
--
-- Until now the only provenance marker was `mcp_client`, stamped by hand at
-- each of ~60 insert sites. Everything that was not MCP -- the canvas, the
-- studio client, the CLI, the SDK, a published app, a raw API call -- collapsed
-- to NULL, so the admin jobs view could not answer "where did this come from".
--
-- TWO COLUMNS, DELIBERATELY:
--   source        coarse, closed vocabulary: the KIND of caller.
--   source_detail the specific identity -- MCP client name ("Claude"), browser
--                 origin host ("studio.nodaro.ai"), client+version ("cli/1.4.0"),
--                 developer-app id.
--
-- The split is what keeps this from rotting. A host -> label lookup would need
-- a code change and a deploy for every new subdomain, and its failure mode is
-- silent (the new surface reports as something else). Here a brand-new
-- `person.nodaro.ai` appears in admin as `web / person.nodaro.ai` on launch day
-- with no code change at all.
--
-- `workflow` is deliberately NOT a source value. A job inside an orchestrated
-- run is already identified exactly by `workflow_execution_id IS NOT NULL`;
-- duplicating that into `source` would create a second answer to the same
-- question that can disagree with the first. The interesting fact about such a
-- job is what triggered the RUN, which `workflow_executions.trigger_type`
-- already holds.

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS source        TEXT,
  ADD COLUMN IF NOT EXISTS source_detail TEXT;

COMMENT ON COLUMN public.jobs.source IS
  'Coarse calling surface: internal | mcp | app | cli | sdk | web | api. Derived from request context by backend/src/lib/job-source.ts. NULL for rows predating migration 282 whose origin could not be inferred.';
COMMENT ON COLUMN public.jobs.source_detail IS
  'Specific identity within source: MCP client name, browser origin host, client package/version, or developer-app id. NULL when there is nothing more specific to say.';

-- Admin filters and groups by source over a recent time window; jobs is large,
-- so an unindexed scan there is a real cost. Partial: NULL rows are the
-- un-inferrable historical tail and are never filtered ON, only displayed.
CREATE INDEX IF NOT EXISTS idx_jobs_source_created_at
  ON public.jobs (source, created_at DESC)
  WHERE source IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Backfill from signals the existing rows already carry.
--
-- Only what is DERIVABLE. Guessing would be worse than a null: an operator can
-- reason about "unknown", but silently mislabeling a CLI run as a browser run
-- produces confident, wrong answers.
--
--   mcp_client set              -> 'mcp'    (exact: nothing but MCP tools set it)
--   workflow_id AND node_id set -> 'web'    (canvas single-node Run; the
--                                            frontend injects both via
--                                            withWorkflowId, and only a browser
--                                            session has a canvas node id)
--   everything else             -> left NULL
--
-- Rows inside an orchestrated run (workflow_execution_id set) are intentionally
-- left NULL rather than labelled: their caller was the orchestrator, whose own
-- upstream trigger lives on workflow_executions. See the note above.
--
-- Idempotent: each statement is guarded on `source IS NULL`, so a re-run is a
-- no-op rather than a re-classification.
-- ---------------------------------------------------------------------------

UPDATE public.jobs
   SET source = 'mcp',
       source_detail = LEFT(mcp_client, 80)
 WHERE source IS NULL
   AND mcp_client IS NOT NULL
   AND mcp_client <> '';

UPDATE public.jobs
   SET source = 'web'
 WHERE source IS NULL
   AND workflow_execution_id IS NULL
   AND workflow_id IS NOT NULL
   AND node_id IS NOT NULL;
