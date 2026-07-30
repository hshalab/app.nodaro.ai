-- ============================================================================
-- PHASE 2 (credit re-denomination) — DATA half: scale balances + history x10
-- ============================================================================
-- NOT YET SCHEDULED. Lives under _phase2_pending/ so Supabase does NOT apply
-- it; renumber into supabase/migrations/ only when Phase 2 is approved.
--
-- Pairs with 901_credit_redenomination_scale_x10_REVERSE.sql — audit A6/R10
-- requires the reverse to exist and be tested BEFORE this ships.
--
-- Value-preserving: CREDIT_BASE_USD goes $0.02 -> $0.002, so every stored
-- credit quantity must x10 to represent the same dollar value.
--
-- COLUMN COVERAGE (verified against production 2026-07-30 — the design doc's
-- §5.3 list was incomplete; it omitted total_credits and daily_spent_credits):
--   profiles.subscription_credits    live, 90 code refs  -> x10
--   profiles.topup_credits           live, 82 code refs  -> x10
--   profiles.total_credits           live, 71 code refs  -> x10  (MISSING from §5.3)
--   profiles.daily_spent_credits     live, 49 code refs  -> x10  (MISSING from §5.3)
--   profiles.app_credits_allowance   live, 16 code refs  -> x10
--   profiles.credits_balance         dead (1 ref, every row = 50) -> untouched
--   profiles.daily_credits_used      dead (0 refs, all zeros)     -> untouched
-- Leaving total_credits unscaled would show every user a balance 10x too low;
-- leaving daily_spent_credits unscaled against a x10 daily_credit_limit would
-- silently grant free users 10x their daily allowance.
--
-- PRECONDITION (A6 drain check) — run BEFORE applying:
--   SELECT count(*) FROM jobs WHERE status IN ('pending','processing');   -- must be 0
--   SELECT count(*) FROM usage_logs WHERE status = 'reserved';           -- must be 0
-- A reservation straddling the flip would refund or charge 10x wrong.

BEGIN;

-- ── Single-shot guard ──────────────────────────────────────────────────────
-- Re-running this migration double-scales every balance silently (verified:
-- a second run took the balance sum 75,940 -> 759,400). Supabase applies a
-- migration once, but the rollback-and-retry path this pairs with makes a
-- manual re-run plausible, so the state is tracked explicitly rather than
-- inferred. The reverse migration clears it, so forward -> reverse -> forward
-- is allowed; forward -> forward is not.
CREATE TABLE IF NOT EXISTS credit_redenomination_state (
  id         INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM credit_redenomination_state WHERE id = 1) THEN
    RAISE EXCEPTION 'x10 scaling already applied (see credit_redenomination_state) — re-running would double-scale every balance. Run the REVERSE migration first if you mean to retry.';
  END IF;
END $$;

INSERT INTO credit_redenomination_state (id) VALUES (1);

-- Snapshot for verification + reverse-migration safety. Kept after the
-- migration on purpose: A7 asserts post-state = 10x this, and the reverse
-- restores from it rather than dividing (division cannot recover a value that
-- was rounded, and it silently "succeeds" on a partially-applied forward run).
CREATE TABLE IF NOT EXISTS credit_redenomination_snapshot (
  profile_id             UUID PRIMARY KEY,
  subscription_credits   INTEGER NOT NULL,
  topup_credits          INTEGER NOT NULL,
  total_credits          INTEGER,
  daily_spent_credits    INTEGER,
  app_credits_allowance  INTEGER,
  captured_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO credit_redenomination_snapshot
  (profile_id, subscription_credits, topup_credits, total_credits, daily_spent_credits, app_credits_allowance)
SELECT id, subscription_credits, topup_credits, total_credits, daily_spent_credits, app_credits_allowance
FROM profiles
ON CONFLICT (profile_id) DO NOTHING;

-- ── Live balances ──
-- NULL is deliberately NOT coalesced to 0 anywhere below: NULL means "never
-- recorded", 0 means "recorded as zero", and COALESCE(NULL,0)*10 destroys that
-- distinction irreversibly (the reverse migration's division yields 0, not
-- NULL). SQL's NULL * 10 = NULL preserves it, so the round trip is exact.
-- Verified: an earlier COALESCE version failed the round-trip digest on all 5
-- history tables.
UPDATE profiles SET
  subscription_credits  = subscription_credits  * 10,
  topup_credits         = topup_credits         * 10,
  total_credits         = total_credits         * 10,
  daily_spent_credits   = daily_spent_credits   * 10,
  app_credits_allowance = app_credits_allowance * 10;

-- ── Tier config (BOTH sources of truth must move — migrations 067 and 281
--    are prior production incidents caused by updating only one) ──
UPDATE tier_config SET monthly_credits = 1500  WHERE tier = 'free';
UPDATE tier_config SET monthly_credits = 4500  WHERE tier = 'basic';
UPDATE tier_config SET monthly_credits = 11000 WHERE tier = 'standard';
UPDATE tier_config SET monthly_credits = 23000 WHERE tier = 'pro';
UPDATE tier_config SET monthly_credits = 52000 WHERE tier = 'business';
UPDATE tier_config SET daily_credit_limit = daily_credit_limit * 10
  WHERE daily_credit_limit IS NOT NULL;

-- ── History (§3.4: backfill x10 so admin/reporting need no interpretation layer) ──
UPDATE usage_logs SET
  credits_used    = credits_used    * 10,
  credits_charged = credits_charged * 10;

UPDATE jobs SET
  credits        = credits        * 10,
  credits_actual = credits_actual * 10;

UPDATE transactions      SET credits_granted = credits_granted * 10;
UPDATE credit_purchases  SET credits         = credits         * 10;

UPDATE credit_anomalies SET
  credits_estimated = credits_estimated * 10,
  credits_actual    = credits_actual    * 10,
  diff              = diff              * 10;

-- NOT scaled (correctly): every *_usd / *_cost column. Those are dollars and
-- dollars do not change. jobs.provider_cost, jobs.display_cost,
-- usage_logs.cost_usd, credit_anomalies.provider_cost_usd all stay as-is.

COMMIT;
