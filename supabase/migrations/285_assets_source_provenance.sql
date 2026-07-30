-- 285_assets_source_provenance.sql
--
-- Carry job provenance onto the asset row, so a library view can FILTER by
-- origin in the database instead of hydrating each item's job to find out
-- where it came from.
--
-- Migration 282 put `source` / `source_detail` on `jobs`. That answered
-- "where did this job come from" for the admin jobs view, but the library
-- reads `assets` -- a client wanting "show me only what the browser extension
-- made" had to fetch every candidate job to decide, which is a per-item round
-- trip that cannot be paginated or counted server-side.
--
-- DENORMALIZED ON PURPOSE. The alternative (join assets -> jobs on every
-- library page) pays a join on the hot listing path for a value that is
-- immutable once written: a job's calling surface is decided at insert and
-- never changes, so the copy can never drift from its source. Uploads have no
-- job at all, which is exactly why the column has to live here.
--
-- FORWARD-ONLY, NO BACKFILL. Existing rows stay NULL and read as "unknown"
-- in the UI. A backfill is possible (assets.job_id -> jobs.source), but it
-- would rewrite a large table to answer a question nobody asked of historical
-- media; if a real need appears, the same UPDATE ... FROM jobs is a later
-- one-liner. Deliberate, not an oversight.

ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS source        TEXT,
  ADD COLUMN IF NOT EXISTS source_detail TEXT;

COMMENT ON COLUMN public.assets.source IS
  'Coarse originating surface, copied from jobs.source at asset creation: internal | mcp | app | cli | sdk | extension | web | api. NULL for rows predating migration 285 and for assets with no originating job.';
COMMENT ON COLUMN public.assets.source_detail IS
  'Specific identity within source (origin host, extension/<name> label, client package/version, MCP client name, developer-app id). NULL when there is nothing more specific to say.';

-- Library listing is always scoped to one user and ordered newest-first; an
-- origin filter narrows within that. Partial on NOT NULL: the historical tail
-- is displayed, never filtered on.
CREATE INDEX IF NOT EXISTS idx_assets_user_source_created_at
  ON public.assets (user_id, source, created_at DESC)
  WHERE source IS NOT NULL;
