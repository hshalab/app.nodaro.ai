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
-- ORDERED BY created_at, NOT updated_at: `jobs` HAS NO `updated_at` COLUMN.
-- Its timestamps are created_at (NOT NULL DEFAULT NOW()), started_at and
-- completed_at (001_initial_schema.sql:105-119), and no later migration adds
-- one. created_at is chosen over completed_at because it is NOT NULL, so the
-- index predicate and the ORDER BY have no null-ordering behaviour to reason
-- about; the two differ by at most the planning window (minutes) anyway.
create index if not exists idx_jobs_recast_driver
  on public.jobs (created_at)
  where app_slug = 'recast'
    and input_data->>'type' = 'recast'
    and status = 'completed'
    and output_data->>'gvpJobId' is null;
