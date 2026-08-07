-- The recast driver's working set, and nothing else.
--
-- The driver ticks every 5 seconds looking for runs that owe a step. That set
-- is tiny and does not grow: a run leaves it the moment it dispatches
-- (gvpJobId lands) or the driver gives up. Without this the only usable index
-- is idx_jobs_app_slug, which narrows to every recast job ever created —
-- planning rows, every candidates cycle, every rescore — and that set grows
-- without bound.
--
-- input_data->>'type' = 'recast' is NOT optional: app_slug='recast' is shared
-- by the candidate cycles, rescores, revises and script imports. Selecting on
-- app_slug alone hands the driver a candidates cycle to drive.
--
-- output_data->'driver'->>'gaveUpAt' is null is NOT optional either — it is
-- what makes "a run leaves it... when the driver gives up" (above) true of
-- the INDEX, not just of the query result. Without this term a given-up run
-- (driver.ts's DRIVER_MAX_ATTEMPTS reached) still matches every other term
-- and stays in the index for the full 7-day DRIVER_WINDOW_DAYS: the scan's
-- real WHERE is a strict superset of this predicate, so Postgres still uses
-- the index and still pays a per-row heap fetch to recheck and discard each
-- given-up row, every 5-second tick, for a week. With the term, the indexed
-- set itself drops the row the moment gaveUpAt is written.
--
-- ORDERED BY created_at, NOT updated_at: `jobs` HAS NO `updated_at` COLUMN.
-- Its timestamps are created_at (NOT NULL DEFAULT NOW()), started_at and
-- completed_at (001_initial_schema.sql:105-119), and no later migration adds
-- one. created_at is chosen over completed_at because it is NOT NULL, so the
-- index predicate and the ORDER BY have no null-ordering behaviour to reason
-- about; the two differ by at most the planning window (minutes) anyway.
--
-- NOT CONCURRENTLY, same constraint 271_client_app_origin.sql:104-112 names
-- for idx_jobs_app_slug on this same table: the migration runner wraps each
-- file in a transaction, and CREATE INDEX CONCURRENTLY cannot run inside one.
-- Unlike that index, this predicate's matched set is not provably zero at
-- apply time — recast's interactive lane has been running browser-driven in
-- production, so some rows are already genuinely mid-flight, owed a step.
-- The set is still small by construction (this five-term predicate), so the
-- plain CREATE INDEX's SHARE lock — which blocks every INSERT/UPDATE/DELETE
-- on `jobs`, the busiest table in the system, for the build's duration — has
-- little to write. It still has to READ the whole table once: a partial
-- predicate shrinks the resulting index and every later query, not the
-- one-time build scan. `IF NOT EXISTS` makes the statement idempotent and
-- safe to retry if that build is ever interrupted.
create index if not exists idx_jobs_recast_driver
  on public.jobs (created_at)
  where app_slug = 'recast'
    and input_data->>'type' = 'recast'
    and status = 'completed'
    and output_data->>'gvpJobId' is null
    and output_data->'driver'->>'gaveUpAt' is null;
