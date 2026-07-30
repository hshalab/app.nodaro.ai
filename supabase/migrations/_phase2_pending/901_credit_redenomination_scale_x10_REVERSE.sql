-- ============================================================================
-- PHASE 2 REVERSE (R10) — undo the x10 credit re-denomination data scaling
-- ============================================================================
-- The escape hatch audit A6/R10 requires to exist and be TESTED before the
-- forward migration ships. The code half of Phase 2 reverts by redeploying the
-- prior image; the data half does not auto-revert, which is why this exists.
--
-- Balances are restored from credit_redenomination_snapshot, NOT by dividing.
-- Division is wrong here for two reasons: it cannot recover a value the
-- forward run rounded, and it silently "succeeds" against a partially-applied
-- forward migration, leaving balances 10x too small. The snapshot is exact.
--
-- History IS divided — it was multiplied by exactly 10 from an integer, so
-- x/10 is lossless; a guard below refuses to run if that is ever untrue.
--
-- Run the same drain check as the forward migration first: no in-flight jobs,
-- no reserved usage_logs.

BEGIN;

-- ── Guard 1: the snapshot must exist, or balances cannot be restored ──
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_name = 'credit_redenomination_snapshot') THEN
    RAISE EXCEPTION 'R10 abort: credit_redenomination_snapshot missing — cannot restore balances exactly. Do NOT divide; investigate.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM credit_redenomination_snapshot) THEN
    RAISE EXCEPTION 'R10 abort: credit_redenomination_snapshot is empty — forward migration never captured state.';
  END IF;
END $$;

-- ── Guard 2: every history value must be divisible by 10, else this is not a
--    clean post-forward state and dividing would corrupt data ──
DO $$
DECLARE bad INTEGER;
BEGIN
  SELECT count(*) INTO bad FROM usage_logs
   WHERE credits_used % 10 <> 0 OR credits_charged % 10 <> 0;
  IF bad > 0 THEN
    RAISE EXCEPTION 'R10 abort: % usage_logs rows are not multiples of 10 — post-forward state is dirty (new activity since the flip?). Resolve manually.', bad;
  END IF;

  SELECT count(*) INTO bad FROM jobs
   WHERE credits % 10 <> 0 OR credits_actual % 10 <> 0;
  IF bad > 0 THEN
    RAISE EXCEPTION 'R10 abort: % jobs rows are not multiples of 10 — post-forward state is dirty.', bad;
  END IF;
END $$;

-- ── Balances: exact restore from the snapshot ──
UPDATE profiles p SET
  subscription_credits  = s.subscription_credits,
  topup_credits         = s.topup_credits,
  total_credits         = s.total_credits,
  daily_spent_credits   = s.daily_spent_credits,
  app_credits_allowance = s.app_credits_allowance
FROM credit_redenomination_snapshot s
WHERE p.id = s.profile_id;

-- Profiles created AFTER the forward migration have no snapshot row. Their
-- balances were granted at the NEW scale, so divide those (and only those).
UPDATE profiles p SET
  subscription_credits  = subscription_credits  / 10,
  topup_credits         = topup_credits         / 10,
  total_credits         = total_credits         / 10,
  daily_spent_credits   = daily_spent_credits   / 10,
  app_credits_allowance = app_credits_allowance / 10
WHERE NOT EXISTS (SELECT 1 FROM credit_redenomination_snapshot s WHERE s.profile_id = p.id);

-- ── Tier config back to pre-flip values ──
UPDATE tier_config SET monthly_credits = 150  WHERE tier = 'free';
UPDATE tier_config SET monthly_credits = 250  WHERE tier = 'basic';
UPDATE tier_config SET monthly_credits = 850  WHERE tier = 'standard';
UPDATE tier_config SET monthly_credits = 2000 WHERE tier = 'pro';
UPDATE tier_config SET monthly_credits = 4800 WHERE tier = 'business';
UPDATE tier_config SET daily_credit_limit = daily_credit_limit / 10
  WHERE daily_credit_limit IS NOT NULL;

-- ── History: lossless division (guarded above) ──
UPDATE usage_logs SET
  credits_used    = credits_used    / 10,
  credits_charged = credits_charged / 10;

UPDATE jobs SET
  credits        = credits        / 10,
  credits_actual = credits_actual / 10;

UPDATE transactions     SET credits_granted = credits_granted / 10;
UPDATE credit_purchases SET credits         = credits         / 10;

UPDATE credit_anomalies SET
  credits_estimated = credits_estimated / 10,
  credits_actual    = credits_actual    / 10,
  diff              = diff              / 10;

-- Clear the single-shot marker so a corrected forward run may be retried.
-- The SNAPSHOT is deliberately kept: it still holds the true pre-flip state,
-- and the forward migration's ON CONFLICT DO NOTHING will not overwrite it
-- with already-reversed values on a retry.
DELETE FROM credit_redenomination_state WHERE id = 1;

COMMIT;
