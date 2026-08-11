-- PAYG effective tier — schema + RPC groundwork.
--
-- A free user's first top-up purchase activates a DERIVED "payg" tier
-- (resolved in TypeScript from stored tier + NET lifetime top-up credits;
-- no stored 'payg' value ever exists — the admin tier enum and billing maps
-- deliberately never learn it). This migration adds the two profile columns,
-- backfills them from the transactions claim ledger, seeds the tier_config
-- row, and extends the three functions that must know about the columns.
--
-- Function-replacement rule (learned the hard way — see migration 176 M2):
-- CREATE OR REPLACE drops function-level SET config unless restated, and
-- reserve_credits lost its search_path pin exactly that way three times
-- (060/169/171). Every function below restates SET search_path = public
-- inline. Pinned by payg-migration-sync.test.ts.

-- ============================================================
-- 1. Profile columns
-- ============================================================
-- lifetime_topup_credits is NET: granted minus refunded/disputed, clamped
-- at zero by every writer. A fully-refunded user is NOT payg.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS lifetime_topup_credits INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_topup_at TIMESTAMPTZ;

-- Backfill from the AUTHORITATIVE claim table (rows are written inside
-- grant_topup_credits_idempotent's own transaction; migration 289 rescaled
-- credits_granted x10 with the balances, so the ledger is unit-consistent).
-- credit_transactions is NOT a source: source='one_time_purchase' has no
-- writer, ever (design 2026-07-05 §2, audit-verified).
UPDATE profiles p
SET lifetime_topup_credits = t.total,
    last_topup_at = t.latest
FROM (
  SELECT user_id, SUM(credits_granted) AS total, MAX(created_at) AS latest
  FROM transactions
  WHERE type = 'topup'
  GROUP BY user_id
) t
WHERE p.id = t.user_id;

-- ============================================================
-- 2. tier_config row (entitlement lookups route payg through the
--    paid-tier path; NULL daily_credit_limit = uncapped)
-- ============================================================
INSERT INTO tier_config (tier, monthly_credits, daily_credit_limit, price_usd)
VALUES ('payg', 0, NULL, 0)
ON CONFLICT (tier) DO NOTHING;

-- ============================================================
-- 3. transactions.type gains 'refund' (clawback claim rows)
-- ============================================================
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE transactions
  ADD CONSTRAINT transactions_type_check
  CHECK (type IN ('subscription', 'topup', 'refund'));

-- ============================================================
-- 4. RLS guard: check_profiles_update_allowed learns both columns
-- ============================================================
-- The SECURITY DEFINER function IS the guard — any profiles column absent
-- from its signature+body is silently user-writable via a plain Supabase
-- UPDATE (the self-mint-payg hole). Order matters: the policy depends on
-- the 9-arg overload, and CREATE with 11 args alone would leave the old
-- overload alive. One migration = one transaction, so there is no
-- policy-less window outside this file.
DROP POLICY IF EXISTS "Users can update own safe columns" ON public.profiles;
DROP FUNCTION IF EXISTS check_profiles_update_allowed(UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER, INTEGER, BIGINT);

CREATE OR REPLACE FUNCTION check_profiles_update_allowed(
  p_user_id UUID,
  p_role TEXT,
  p_tier TEXT,
  p_subscription_tier TEXT,
  p_subscription_credits INTEGER,
  p_topup_credits INTEGER,
  p_daily_spent_credits INTEGER,
  p_credits_balance INTEGER,
  p_storage_limit_bytes BIGINT,
  p_lifetime_topup_credits INTEGER,
  p_last_topup_at TIMESTAMPTZ
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v RECORD;
BEGIN
  SELECT role, tier, subscription_tier, subscription_credits, topup_credits,
         daily_spent_credits, credits_balance, storage_limit_bytes,
         lifetime_topup_credits, last_topup_at
  INTO v FROM profiles WHERE id = p_user_id;

  IF NOT FOUND THEN RETURN FALSE; END IF;

  RETURN (p_role IS NOT DISTINCT FROM v.role)
    AND (p_tier IS NOT DISTINCT FROM v.tier)
    AND (p_subscription_tier IS NOT DISTINCT FROM v.subscription_tier)
    AND (p_subscription_credits IS NOT DISTINCT FROM v.subscription_credits)
    AND (p_topup_credits IS NOT DISTINCT FROM v.topup_credits)
    AND (p_daily_spent_credits IS NOT DISTINCT FROM v.daily_spent_credits)
    AND (p_credits_balance IS NOT DISTINCT FROM v.credits_balance)
    AND (p_storage_limit_bytes IS NOT DISTINCT FROM v.storage_limit_bytes)
    AND (p_lifetime_topup_credits IS NOT DISTINCT FROM v.lifetime_topup_credits)
    AND (p_last_topup_at IS NOT DISTINCT FROM v.last_topup_at);
END;
$$;

CREATE POLICY "Users can update own safe columns" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND check_profiles_update_allowed(
      id, role, tier, subscription_tier,
      subscription_credits, topup_credits, daily_spent_credits,
      credits_balance, storage_limit_bytes,
      lifetime_topup_credits, last_topup_at
    )
  );

-- ============================================================
-- 5. reserve_credits: payg users exit the free-allowance economy
-- ============================================================
-- Same 8-arg signature as migration 171. Two behavior changes, both gated
-- on v_lifetime = 0 so they fire ONLY for genuinely-free users:
--   (a) the app-run allowance requirement no longer applies to payg users
--       whose topup pool happens to be empty (previously they'd pass the
--       swapped TS gates and then 500 here), and
--   (b) allowance earn/consume deltas are zero for payg (paid-path
--       semantics), matching the TS-side effective-tier swap.
CREATE OR REPLACE FUNCTION reserve_credits(
  p_user_id UUID,
  p_credits INTEGER,
  p_job_id UUID,
  p_model_identifier TEXT DEFAULT NULL,
  p_provider_cost_usd NUMERIC DEFAULT NULL,
  p_display_cost_usd NUMERIC DEFAULT NULL,
  p_is_app_run BOOLEAN DEFAULT FALSE,
  p_daily_limit INTEGER DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub_credits INTEGER;
  v_topup_credits INTEGER;
  v_tier TEXT;
  v_app_allowance INTEGER;
  v_lifetime INTEGER;
  v_usage_log_id UUID;
  v_from_sub INTEGER := 0;
  v_from_topup INTEGER := 0;
  v_allowance_delta INTEGER := 0;
  v_daily_spent INTEGER;
  v_last_reset DATE;
  v_effective_daily INTEGER;
BEGIN
  IF p_credits <= 0 THEN
    RAISE EXCEPTION 'Credits must be positive, got %', p_credits;
  END IF;

  SELECT subscription_credits, topup_credits, COALESCE(tier, 'free'),
         COALESCE(app_credits_allowance, 0),
         COALESCE(lifetime_topup_credits, 0),
         COALESCE(daily_spent_credits, 0),
         COALESCE(last_daily_reset::DATE, '1970-01-01'::DATE)
  INTO v_sub_credits, v_topup_credits, v_tier, v_app_allowance, v_lifetime,
       v_daily_spent, v_last_reset
  FROM profiles WHERE id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;

  -- Effective daily spent — same UTC-day reset rule as reset_daily_spent_if_needed.
  IF v_last_reset < CURRENT_DATE THEN
    v_effective_daily := 0;
  ELSE
    v_effective_daily := v_daily_spent;
  END IF;

  -- (b) Atomic daily cap under FOR UPDATE (only when a limit is supplied).
  IF p_daily_limit IS NOT NULL AND (v_effective_daily + p_credits) > p_daily_limit THEN
    RAISE EXCEPTION 'Daily credit limit reached: limit %, spent today %, need %',
      p_daily_limit, v_effective_daily, p_credits
      USING ERRCODE = 'check_violation';
  END IF;

  IF (v_sub_credits + v_topup_credits) < p_credits THEN
    RAISE EXCEPTION 'Insufficient credits: need %, have %', p_credits, (v_sub_credits + v_topup_credits);
  END IF;

  -- App allowance check: genuinely-free users (never purchased) with no topup
  -- must have enough allowance. Payg (v_lifetime > 0) is paid-path: exempt.
  IF p_is_app_run AND v_tier = 'free' AND v_topup_credits = 0 AND v_lifetime = 0 THEN
    IF v_app_allowance < p_credits THEN
      RAISE EXCEPTION 'Insufficient app credits: need %, have %. Earn app credits by running flows.', p_credits, v_app_allowance;
    END IF;
  END IF;

  -- Deduct from subscription first, then topup
  IF v_sub_credits >= p_credits THEN
    v_from_sub := p_credits;
  ELSE
    v_from_sub := v_sub_credits;
    v_from_topup := p_credits - v_from_sub;
  END IF;

  -- (a) Exact app-allowance delta applied here — recorded in metadata so
  -- refund_credits can reverse EXACTLY this (never minting/burning allowance
  -- that reserve didn't touch). Payg users (v_lifetime > 0) neither earn nor
  -- consume allowance — they left the free economy at first purchase.
  IF p_is_app_run AND v_tier = 'free' AND v_topup_credits = 0 AND v_lifetime = 0 THEN
    v_allowance_delta := -p_credits;   -- app run consumes allowance
  ELSIF NOT p_is_app_run AND v_tier = 'free' AND v_lifetime = 0 THEN
    v_allowance_delta := p_credits;    -- flow run earns allowance
  ELSE
    v_allowance_delta := 0;            -- paid tier, payg, or free+app-run+has-topup
  END IF;

  UPDATE profiles
  SET subscription_credits = subscription_credits - v_from_sub,
      topup_credits = topup_credits - v_from_topup,
      daily_spent_credits = v_effective_daily + p_credits,
      last_daily_reset = CURRENT_DATE,
      app_credits_allowance = COALESCE(app_credits_allowance, 0) + v_allowance_delta
  WHERE id = p_user_id;

  INSERT INTO usage_logs (user_id, job_id, action, provider, credits_used, cost_usd, status, metadata)
  VALUES (
    p_user_id,
    p_job_id,
    COALESCE(p_model_identifier, 'generate'),
    'reserved',
    p_credits,
    p_provider_cost_usd,
    'reserved',
    jsonb_build_object(
      'model', p_model_identifier,
      'display_cost', p_display_cost_usd,
      'from_sub', v_from_sub,
      'from_topup', v_from_topup,
      'is_app_run', p_is_app_run,
      'allowance_delta', v_allowance_delta
    )
  )
  RETURNING id INTO v_usage_log_id;

  RETURN v_usage_log_id;
END;
$$;

-- ============================================================
-- 6. grant_topup_credits_idempotent: lifetime increment, exactly once
-- ============================================================
-- The increment sits AFTER the ON CONFLICT early-return so a webhook
-- redelivery cannot double-count. It deliberately does NOT live in
-- add_topup_credits: admin comps reuse that path and a comp must never
-- activate payg (the documented admin lever is setting
-- lifetime_topup_credits directly).
CREATE OR REPLACE FUNCTION grant_topup_credits_idempotent(
  p_user_id UUID,
  p_credits INTEGER,
  p_stripe_transaction_id TEXT,
  p_amount_usd DECIMAL
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows INTEGER;
BEGIN
  INSERT INTO transactions (user_id, stripe_transaction_id, type, amount_usd, credits_granted)
  VALUES (p_user_id, p_stripe_transaction_id, 'topup', p_amount_usd, p_credits)
  ON CONFLICT (stripe_transaction_id) DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    -- Duplicate delivery / replay: claim already exists → do NOT re-grant.
    RETURN FALSE;
  END IF;

  -- Same transaction as the claim above → commit together or not at all.
  PERFORM add_topup_credits(p_user_id, p_credits);

  UPDATE profiles
  SET lifetime_topup_credits = COALESCE(lifetime_topup_credits, 0) + p_credits,
      last_topup_at = NOW()
  WHERE id = p_user_id;

  RETURN TRUE;
END;
$$;

REVOKE EXECUTE ON FUNCTION grant_topup_credits_idempotent(UUID, INTEGER, TEXT, DECIMAL) FROM anon, authenticated;

-- ============================================================
-- 7. clawback_topup_credits: refund/dispute reversal, pool-only
-- ============================================================
-- Pool-only by design: the storage floor lives in TypeScript
-- (downgradeToEffectiveFloor) because duplicating TIER_STORAGE_LIMITS into
-- SQL is exactly the drift class this repo guards against. Idempotency via
-- the same claim mechanism as the grant: one transactions row per
-- refund/dispute id (type='refund', negative credits_granted). Both pools
-- clamp at zero — a clawback can never drive a balance negative, and a
-- fully-refunded user drops out of payg (net lifetime back to 0).
CREATE OR REPLACE FUNCTION clawback_topup_credits(
  p_user_id UUID,
  p_refund_id TEXT,
  p_credits INTEGER,
  p_amount_usd DECIMAL
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows INTEGER;
BEGIN
  IF p_credits <= 0 THEN
    RAISE EXCEPTION 'Clawback credits must be positive, got %', p_credits;
  END IF;

  INSERT INTO transactions (user_id, stripe_transaction_id, type, amount_usd, credits_granted)
  VALUES (p_user_id, p_refund_id, 'refund', p_amount_usd, -p_credits)
  ON CONFLICT (stripe_transaction_id) DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    -- This refund/dispute id was already processed.
    RETURN FALSE;
  END IF;

  UPDATE profiles
  SET topup_credits = GREATEST(topup_credits - p_credits, 0),
      lifetime_topup_credits = GREATEST(COALESCE(lifetime_topup_credits, 0) - p_credits, 0)
  WHERE id = p_user_id;

  RETURN TRUE;
END;
$$;

REVOKE EXECUTE ON FUNCTION clawback_topup_credits(UUID, TEXT, INTEGER, DECIMAL) FROM anon, authenticated;
