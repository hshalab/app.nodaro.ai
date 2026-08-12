-- Top-up credit expiry — grants ledger + 12-month expiry waterfall.
--
-- Top-up credits change semantics from "never expire" to "valid for 12
-- months". Every path that ADDS to profiles.topup_credits now also records
-- a topup_grants row (amount + expiry date), and a daily sweep expires the
-- unconsumed remainder of grants past their expires_at, FIFO:
--
--   consumed  = SUM(grants.amount) - SUM(grants.expired_amount) - topup_credits
--   allocate consumed over grants oldest-first (their live remainders);
--   for each grant past expires_at, expire whatever allocation left uncovered.
--
-- The four grant paths and how they are covered:
--   1. Stripe/PAYG purchases  — grant_topup_credits_idempotent PERFORMs
--      add_topup_credits, so the replaced body below covers it (source is
--      refined to 'purchase' by an UPDATE inside that same transaction).
--   2. Subscription carryover — add_topup_credits (source 'system').
--   3. Failed-job refunds     — add_topup_credits (source 'system'; a fresh
--      12-month clock on refunded credits is a deliberate, generous choice).
--   4. Admin grants           — admin_adjust_credits (source 'admin'; admin
--      top-ups expire like any other top-up — stated product decision).
--
-- Negative admin adjustments and spends need no grant bookkeeping: they
-- shrink topup_credits, which the waterfall reads as consumption against
-- the oldest grants first.
--
-- INVARIANTS (pinned by topup-expiry-migration-sync.test.ts):
--   - expire_topup_credits touches ONLY profiles.topup_credits and
--     topup_grants.expired_amount. It must NEVER touch
--     lifetime_topup_credits (payg tier is derived from it — expiry is not
--     a refund; see migration 308) and NEVER write to transactions (that is
--     the purchase-claim ledger). The expiry event is logged to
--     credit_transactions by the TypeScript sweep (source 'expiry').
--   - Function-replacement rule (migration 308 header, learned via 176 M2):
--     CREATE OR REPLACE drops function-level SET config unless restated —
--     every function here restates SET search_path = public inline, and
--     every REVOKE is restated after the replacement.

-- ============================================================
-- 1. Grants ledger
-- ============================================================
CREATE TABLE IF NOT EXISTS topup_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  expired_amount INTEGER NOT NULL DEFAULT 0 CHECK (expired_amount >= 0 AND expired_amount <= amount),
  source TEXT NOT NULL CHECK (source IN ('purchase', 'system', 'admin', 'grandfather')),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Sweep candidate lookup: due grants that still have a live remainder.
CREATE INDEX IF NOT EXISTS idx_topup_grants_due
  ON topup_grants (user_id, expires_at)
  WHERE expired_amount < amount;

-- Service-role only (PostgREST callers get nothing) — same posture as the
-- transactions claim table.
ALTER TABLE topup_grants ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. add_topup_credits — same signature, body now records the grant
-- ============================================================
-- Body copied from migration 024 (search_path pin added by 033, restated
-- here inline). Covers purchases (via grant_topup_credits_idempotent's
-- PERFORM), subscription carryover, and failed-job refunds.
CREATE OR REPLACE FUNCTION add_topup_credits(p_user_id UUID, p_credits INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_credits <= 0 THEN
    RAISE EXCEPTION 'Credits must be positive, got %', p_credits;
  END IF;
  UPDATE profiles SET topup_credits = topup_credits + p_credits WHERE id = p_user_id;
  INSERT INTO topup_grants (user_id, amount, source, granted_at, expires_at)
  VALUES (p_user_id, p_credits, 'system', NOW(), NOW() + INTERVAL '12 months');
END;
$$;

REVOKE EXECUTE ON FUNCTION add_topup_credits(UUID, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION add_topup_credits(UUID, INTEGER) FROM authenticated, anon;

-- ============================================================
-- 3. grant_topup_credits_idempotent — same signature, refines the grant
--    source to 'purchase' (body copied from migration 308)
-- ============================================================
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
  -- add_topup_credits records the topup_grants row (source 'system');
  -- refine it to 'purchase' inside this same transaction.
  PERFORM add_topup_credits(p_user_id, p_credits);
  UPDATE topup_grants SET source = 'purchase'
   WHERE id = (
     SELECT id FROM topup_grants
      WHERE user_id = p_user_id AND source = 'system'
      ORDER BY granted_at DESC LIMIT 1
   );

  UPDATE profiles
  SET lifetime_topup_credits = COALESCE(lifetime_topup_credits, 0) + p_credits,
      last_topup_at = NOW()
  WHERE id = p_user_id;

  RETURN TRUE;
END;
$$;

REVOKE EXECUTE ON FUNCTION grant_topup_credits_idempotent(UUID, INTEGER, TEXT, DECIMAL) FROM anon, authenticated;

-- ============================================================
-- 4. admin_adjust_credits — same signature, positive top-up adjustments
--    record an 'admin' grant (body copied from migration 197)
-- ============================================================
CREATE OR REPLACE FUNCTION admin_adjust_credits(
  p_user_id UUID,
  p_field TEXT,
  p_amount INTEGER
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub INTEGER;
  v_top INTEGER;
BEGIN
  IF p_field NOT IN ('subscription_credits', 'topup_credits') THEN
    RAISE EXCEPTION 'admin_adjust_credits: invalid field %', p_field;
  END IF;

  IF p_field = 'subscription_credits' THEN
    UPDATE profiles
       SET subscription_credits = GREATEST(0, COALESCE(subscription_credits, 0) + p_amount)
     WHERE id = p_user_id
     RETURNING subscription_credits, topup_credits INTO v_sub, v_top;
  ELSE
    UPDATE profiles
       SET topup_credits = GREATEST(0, COALESCE(topup_credits, 0) + p_amount)
     WHERE id = p_user_id
     RETURNING subscription_credits, topup_credits INTO v_sub, v_top;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'admin_adjust_credits: user profile not found %', p_user_id;
  END IF;

  IF p_field = 'topup_credits' AND p_amount > 0 THEN
    INSERT INTO topup_grants (user_id, amount, source, granted_at, expires_at)
    VALUES (p_user_id, p_amount, 'admin', NOW(), NOW() + INTERVAL '12 months');
  END IF;

  RETURN json_build_object('subscription_credits', v_sub, 'topup_credits', v_top);
END;
$$;

REVOKE ALL ON FUNCTION admin_adjust_credits(UUID, TEXT, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_adjust_credits(UUID, TEXT, INTEGER) FROM anon, authenticated;

-- ============================================================
-- 5. expire_topup_credits — per-user FIFO expiry waterfall (atomic)
-- ============================================================
CREATE OR REPLACE FUNCTION expire_topup_credits(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_topup INTEGER;
  v_granted_total INTEGER;
  v_expired_prior INTEGER;
  v_consumed INTEGER;
  v_total_expired INTEGER := 0;
  v_alloc INTEGER;
  v_live INTEGER;
  v_expire INTEGER;
  g RECORD;
BEGIN
  -- Lock the profile row so a concurrent spend can't land between the
  -- consumption computation and the balance decrement (same discipline as
  -- deduct_credits).
  SELECT COALESCE(topup_credits, 0) INTO v_topup
    FROM profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  SELECT COALESCE(SUM(amount), 0), COALESCE(SUM(expired_amount), 0)
    INTO v_granted_total, v_expired_prior
    FROM topup_grants WHERE user_id = p_user_id;

  -- What the user has spent out of the topup pool, total, attributed FIFO.
  v_consumed := GREATEST(0, v_granted_total - v_expired_prior - v_topup);

  FOR g IN
    SELECT id, amount, expired_amount, expires_at
      FROM topup_grants
     WHERE user_id = p_user_id AND expired_amount < amount
     ORDER BY granted_at ASC, id ASC
     FOR UPDATE
  LOOP
    v_live := g.amount - g.expired_amount;
    v_alloc := LEAST(v_consumed, v_live);   -- consumption covers oldest first
    v_consumed := v_consumed - v_alloc;

    IF g.expires_at <= NOW() THEN
      v_expire := v_live - v_alloc;         -- unconsumed remainder of a due grant
      IF v_expire > 0 THEN
        UPDATE topup_grants
           SET expired_amount = expired_amount + v_expire
         WHERE id = g.id;
        v_total_expired := v_total_expired + v_expire;
      END IF;
    END IF;
  END LOOP;

  IF v_total_expired > 0 THEN
    UPDATE profiles
       SET topup_credits = GREATEST(0, COALESCE(topup_credits, 0) - v_total_expired)
     WHERE id = p_user_id;
  END IF;

  RETURN v_total_expired;
END;
$$;

REVOKE EXECUTE ON FUNCTION expire_topup_credits(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION expire_topup_credits(UUID) FROM authenticated, anon;

-- ============================================================
-- 6. Grandfather existing balances — one grant per user, 12 months from
--    rollout. Deliberately NOT backfilled from the transactions ledger:
--    current topup_credits already nets out consumption, so seeding both
--    the historical purchases AND the live balance would double-count.
-- ============================================================
INSERT INTO topup_grants (user_id, amount, source, granted_at, expires_at)
SELECT id, topup_credits, 'grandfather', NOW(), NOW() + INTERVAL '12 months'
  FROM profiles
 WHERE COALESCE(topup_credits, 0) > 0;
