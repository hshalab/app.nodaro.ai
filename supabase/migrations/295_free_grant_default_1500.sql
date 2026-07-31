-- Free-tier signup grant: repair the column default the x10 re-denomination missed.
--
-- THE DEFECT. New profiles are created by `handle_new_user()` (migration 001),
-- which inserts id/email/full_name/avatar_url and nothing else — so the signup
-- grant comes entirely from the COLUMN DEFAULT on profiles.subscription_credits.
-- Migration 054 set that default to 150 and nothing has changed it since.
--
-- The 2026-07-30 re-denomination ($0.02 -> $0.002 per credit) moved every other
-- free-tier number by 10x — `tier_config.monthly_credits` to 1500 (287),
-- `TIER_CREDITS.free` to 1500, existing balances x10 (289) — but not this
-- default. So every account created after the flip starts with a tenth of the
-- intended grant while paying post-flip prices. In practice that is not a
-- discount, it is a broken free tier: a single `smart` video analysis costs 333
-- credits, more than twice such a user's entire balance.
--
-- Confirmed on live data before writing this: free profiles created after the
-- flip carry exactly 150.
--
-- TWO PARTS: the default (so it stops happening) and a backfill (so the users
-- it already happened to are made whole).
--
-- BACKFILL TARGETING. `credit_redenomination_snapshot` (created by 289) holds a
-- row for every profile that existed at flip time, so "not in the snapshot" is
-- an exact, date-free definition of "created after the flip" — the only cohort
-- that can have received the stale default. Narrowed further to free-tier
-- accounts that never held a subscription and sit at or below the stale grant,
-- so a downgraded ex-subscriber cannot be swept in.
--
-- The backfill ADDS the shortfall rather than setting a value, which preserves
-- whatever the user already spent:
--   untouched 150            -> 1500   (full intended grant)
--   spent 50, holding 100    -> 1450   (as if they had started at 1500)
--   spent it all, holding 0  -> 1350   (ditto)
--
-- Idempotent by ledger, not by luck: every profile credited is recorded, and
-- the UPDATE excludes anything already in that table. Re-running is a no-op.

BEGIN;

-- ── Part 1: the default ────────────────────────────────────────────────────
ALTER TABLE profiles ALTER COLUMN subscription_credits SET DEFAULT 1500;

-- ── Part 2: make the affected accounts whole ───────────────────────────────
CREATE TABLE IF NOT EXISTS free_grant_backfill_295 (
  profile_id   UUID PRIMARY KEY,
  credits_before INTEGER NOT NULL,
  credits_added  INTEGER NOT NULL,
  applied_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

WITH affected AS (
  SELECT p.id, p.subscription_credits AS before
  FROM profiles p
  WHERE p.tier = 'free'
    AND p.subscription_credits <= 150
    -- created AFTER the re-denomination: absent from the pre-flip snapshot
    AND NOT EXISTS (SELECT 1 FROM credit_redenomination_snapshot s WHERE s.profile_id = p.id)
    -- never a subscriber, so this cannot be a downgraded account
    AND NOT EXISTS (SELECT 1 FROM subscriptions sub WHERE sub.user_id = p.id)
    -- not already credited by a previous run of this migration
    AND NOT EXISTS (SELECT 1 FROM free_grant_backfill_295 b WHERE b.profile_id = p.id)
),
ledger AS (
  INSERT INTO free_grant_backfill_295 (profile_id, credits_before, credits_added)
  SELECT id, before, 1350 FROM affected
  RETURNING profile_id
)
UPDATE profiles p
SET subscription_credits = p.subscription_credits + 1350
FROM ledger l
WHERE p.id = l.profile_id;

COMMIT;
