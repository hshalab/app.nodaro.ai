-- ============================================================
-- 311: pool-aware web spending for payg (decision log D1 v2, 2026-08-12)
-- ============================================================
-- Tier-based web blocking made a paying user LOSE web access to their
-- remaining FREE-pool credits. Amendment: on consumer surfaces a payg
-- account may keep spending its free (subscription_credits) pool under
-- free-tier rules; the top-up pool NEVER spends there.
--
-- Mechanics: reserve_credits gains p_web_free_mode BOOLEAN DEFAULT FALSE.
-- The flag SELF-GATES on payg-ness (stored free + lifetime > 0), so
-- callers may pass true for any web-originated request without checking
-- the user first:
--   - free user: only has a sub pool — restriction is vacuous, no-op.
--   - subscriber: mode ignored (may straddle into topup on web by design).
--   - payg: draws sub pool only; when it can't cover, raises with the
--     SUBSCRIPTION_REQUIRED: prefix the credit guard maps to the 403 modal.
-- The free daily cap arrives via the existing p_daily_limit param (the TS
-- caller passes the free tier's limit alongside web_free_mode).
--
-- The old 8-arg overload is DROPPED (not replaced) — two overloads with
-- defaults are ambiguous under PostgREST named-param resolution.
-- search_path is restated because CREATE OR REPLACE drops function-level
-- settings (the migration-176 lesson).

DROP FUNCTION IF EXISTS reserve_credits(UUID, INTEGER, UUID, TEXT, NUMERIC, NUMERIC, BOOLEAN, INTEGER);

CREATE OR REPLACE FUNCTION reserve_credits(
  p_user_id UUID,
  p_credits INTEGER,
  p_job_id UUID,
  p_model_identifier TEXT DEFAULT NULL,
  p_provider_cost_usd NUMERIC DEFAULT NULL,
  p_display_cost_usd NUMERIC DEFAULT NULL,
  p_is_app_run BOOLEAN DEFAULT FALSE,
  p_daily_limit INTEGER DEFAULT NULL,
  p_web_free_mode BOOLEAN DEFAULT FALSE
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
  v_pool_restricted BOOLEAN := FALSE;
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

  -- Pool restriction fires ONLY for payg accounts (self-gating; see header).
  v_pool_restricted := p_web_free_mode AND v_tier = 'free' AND v_lifetime > 0;

  -- Effective daily spent — same UTC-day reset rule as reset_daily_spent_if_needed.
  IF v_last_reset < CURRENT_DATE THEN
    v_effective_daily := 0;
  ELSE
    v_effective_daily := v_daily_spent;
  END IF;

  -- Atomic daily cap under FOR UPDATE (only when a limit is supplied).
  IF p_daily_limit IS NOT NULL AND (v_effective_daily + p_credits) > p_daily_limit THEN
    RAISE EXCEPTION 'Daily credit limit reached: limit %, spent today %, need %',
      p_daily_limit, v_effective_daily, p_credits
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_pool_restricted THEN
    -- Web spending draws the free pool only; the top-up pool is reserved
    -- for the developer surfaces. The guard maps this prefix to the
    -- subscription_required 403 (approved modal) rather than a plain 402.
    IF v_sub_credits < p_credits THEN
      RAISE EXCEPTION 'SUBSCRIPTION_REQUIRED: web spending draws only free-pool credits: need %, free pool has %',
        p_credits, v_sub_credits;
    END IF;
    v_from_sub := p_credits;
  ELSE
    IF (v_sub_credits + v_topup_credits) < p_credits THEN
      RAISE EXCEPTION 'Insufficient credits: need %, have %', p_credits, (v_sub_credits + v_topup_credits);
    END IF;

    -- Deduct from subscription first, then topup
    IF v_sub_credits >= p_credits THEN
      v_from_sub := p_credits;
    ELSE
      v_from_sub := v_sub_credits;
      v_from_topup := p_credits - v_from_sub;
    END IF;
  END IF;

  -- App allowance check: genuinely-free users (never purchased) with no topup
  -- must have enough allowance. Payg (v_lifetime > 0) is paid-path: exempt.
  IF p_is_app_run AND v_tier = 'free' AND v_topup_credits = 0 AND v_lifetime = 0 THEN
    IF v_app_allowance < p_credits THEN
      RAISE EXCEPTION 'Insufficient app credits: need %, have %. Earn app credits by running flows.', p_credits, v_app_allowance;
    END IF;
  END IF;

  -- Allowance deltas — unchanged from 308: payg users neither earn nor
  -- consume allowance (they left the free economy at first purchase), and
  -- that holds in web-free-mode too.
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
      'allowance_delta', v_allowance_delta,
      'web_free_mode', v_pool_restricted
    )
  )
  RETURNING id INTO v_usage_log_id;

  RETURN v_usage_log_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION reserve_credits(UUID, INTEGER, UUID, TEXT, NUMERIC, NUMERIC, BOOLEAN, INTEGER, BOOLEAN) FROM anon, authenticated;
