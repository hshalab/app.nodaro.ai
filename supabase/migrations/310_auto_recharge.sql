-- Auto-recharge — profile config columns + RLS guard v3.
--
-- "When my balance drops below X credits, load $Y" (user-chosen dollar
-- amount priced by the load rate function — NOT a pack price id). The
-- charge/claim mechanics live in TypeScript (ee/billing/auto-recharge.ts);
-- this migration only adds the per-user configuration + attempt-tracking
-- state, and folds every new column into the profiles UPDATE guard.
--
-- The guard extension is the security-sensitive part: any profiles column
-- absent from check_profiles_update_allowed's signature+body is freely
-- user-writable via a plain Supabase UPDATE — here that would let a user
-- reset their failure count, backdate the cooldown, or repoint the charge
-- amount on someone else's saved card state. All seven columns go in.
--
-- Function-replacement rule (migration 176 lesson): CREATE OR REPLACE
-- drops function-level SET config unless restated — the pin is inline.
-- Pinned by auto-recharge-migration-sync.test.ts.

-- ============================================================
-- 1. Profile columns
-- ============================================================
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS auto_recharge_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS auto_recharge_threshold_credits INTEGER,
  ADD COLUMN IF NOT EXISTS auto_recharge_amount_usd INTEGER,
  ADD COLUMN IF NOT EXISTS auto_recharge_failure_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_recharge_last_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_recharge_daily_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_recharge_daily_date DATE;

-- ============================================================
-- 2. RLS guard: check_profiles_update_allowed learns all seven
-- ============================================================
-- Order matters (policy depends on the old overload; CREATE with new args
-- alone would leave the 11-arg overload alive). One migration = one
-- transaction — no policy-less window outside this file.
DROP POLICY IF EXISTS "Users can update own safe columns" ON public.profiles;
DROP FUNCTION IF EXISTS check_profiles_update_allowed(UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER, INTEGER, BIGINT, INTEGER, TIMESTAMPTZ);

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
  p_last_topup_at TIMESTAMPTZ,
  p_auto_recharge_enabled BOOLEAN,
  p_auto_recharge_threshold_credits INTEGER,
  p_auto_recharge_amount_usd INTEGER,
  p_auto_recharge_failure_count INTEGER,
  p_auto_recharge_last_attempt_at TIMESTAMPTZ,
  p_auto_recharge_daily_count INTEGER,
  p_auto_recharge_daily_date DATE
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
         lifetime_topup_credits, last_topup_at,
         auto_recharge_enabled, auto_recharge_threshold_credits,
         auto_recharge_amount_usd, auto_recharge_failure_count,
         auto_recharge_last_attempt_at, auto_recharge_daily_count,
         auto_recharge_daily_date
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
    AND (p_last_topup_at IS NOT DISTINCT FROM v.last_topup_at)
    AND (p_auto_recharge_enabled IS NOT DISTINCT FROM v.auto_recharge_enabled)
    AND (p_auto_recharge_threshold_credits IS NOT DISTINCT FROM v.auto_recharge_threshold_credits)
    AND (p_auto_recharge_amount_usd IS NOT DISTINCT FROM v.auto_recharge_amount_usd)
    AND (p_auto_recharge_failure_count IS NOT DISTINCT FROM v.auto_recharge_failure_count)
    AND (p_auto_recharge_last_attempt_at IS NOT DISTINCT FROM v.auto_recharge_last_attempt_at)
    AND (p_auto_recharge_daily_count IS NOT DISTINCT FROM v.auto_recharge_daily_count)
    AND (p_auto_recharge_daily_date IS NOT DISTINCT FROM v.auto_recharge_daily_date);
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
      lifetime_topup_credits, last_topup_at,
      auto_recharge_enabled, auto_recharge_threshold_credits,
      auto_recharge_amount_usd, auto_recharge_failure_count,
      auto_recharge_last_attempt_at, auto_recharge_daily_count,
      auto_recharge_daily_date
    )
  );

-- ============================================================
-- 3. claim_auto_recharge: the atomic attempt claim
-- ============================================================
-- ONE conditional UPDATE carries every gate (design §5.2 step 2): enabled,
-- failure count < 3, 10-minute cooldown, and the attempt-time daily cap —
-- date bucket reset-or-incremented in the same statement, claim refused at
-- 3/day. Attempt-time because the settled ledger races webhook lag:
-- charges fire before settlement, so counting settled rows would let a
-- laggy webhook day exceed the cap with real charges. Concurrent callers
-- serialize on the row lock; exactly one wins the claim.
CREATE OR REPLACE FUNCTION claim_auto_recharge(p_user_id UUID)
RETURNS TABLE (amount_usd INTEGER, threshold_credits INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE profiles
  SET auto_recharge_last_attempt_at = NOW(),
      auto_recharge_daily_count = CASE
        WHEN auto_recharge_daily_date IS NOT DISTINCT FROM CURRENT_DATE
          THEN auto_recharge_daily_count + 1
        ELSE 1
      END,
      auto_recharge_daily_date = CURRENT_DATE
  WHERE id = p_user_id
    AND auto_recharge_enabled
    AND auto_recharge_amount_usd IS NOT NULL
    AND auto_recharge_threshold_credits IS NOT NULL
    AND auto_recharge_failure_count < 3
    AND (auto_recharge_last_attempt_at IS NULL
         OR auto_recharge_last_attempt_at < NOW() - INTERVAL '10 minutes')
    AND (auto_recharge_daily_date IS DISTINCT FROM CURRENT_DATE
         OR auto_recharge_daily_count < 3)
  RETURNING auto_recharge_amount_usd, auto_recharge_threshold_credits;
END;
$$;

REVOKE EXECUTE ON FUNCTION claim_auto_recharge(UUID) FROM anon, authenticated;

-- ============================================================
-- 4. record_auto_recharge_failure: increment + auto-disable at 3
-- ============================================================
-- Called by the payment_failed webhook, and by the synchronous charge path
-- ONLY when no PaymentIntent was created (no webhook will ever come for
-- those — e.g. no saved payment method).
CREATE OR REPLACE FUNCTION record_auto_recharge_failure(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE profiles
  SET auto_recharge_failure_count = auto_recharge_failure_count + 1,
      auto_recharge_enabled = CASE
        WHEN auto_recharge_failure_count + 1 >= 3 THEN FALSE
        ELSE auto_recharge_enabled
      END
  WHERE id = p_user_id
  RETURNING auto_recharge_failure_count INTO v_count;
  RETURN COALESCE(v_count, 0);
END;
$$;

REVOKE EXECUTE ON FUNCTION record_auto_recharge_failure(UUID) FROM anon, authenticated;
