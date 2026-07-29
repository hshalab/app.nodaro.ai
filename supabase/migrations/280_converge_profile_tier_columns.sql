-- 280: converge profiles.tier and profiles.subscription_tier.
--
-- Bug
-- ---
-- Tier lives in two columns and nothing kept them in step. Every Stripe path
-- (provision-credits.ts: subscription created/updated/canceled; billing.ts:
-- change-plan) wrote ONLY `tier`, while the admin users list and GET /v1/me
-- read ONLY `subscription_tier`. So the moment a user subscribed, changed plan,
-- or cancelled, the two diverged and stayed diverged.
--
-- Credit enforcement was never affected: resolveTier() and the SQL RPCs read
-- `tier` first (COALESCE(tier, subscription_tier, 'free')), which is the column
-- Stripe actually wrote — so `tier` tracks reality and `subscription_tier` is
-- the stale one.
--
-- Impact was display-only, but severe enough to be mistaken for a billing
-- breach: on 2026-07-28 a paying Basic customer (250 credits/mo, no daily cap
-- by design) appeared in admin as "free" having spent 190 credits — reading as
-- a free user who had blown through the 50/day cap. 4 of 47 profiles were
-- affected, all four with `tier` correct.
--
-- Fix
-- ---
-- Backfill `subscription_tier` from `tier`, the authoritative column. The
-- application side now writes both together via tierColumns() and reads via
-- resolveTierFrom(); profiles-tier-columns.test.ts fails the build if a writer
-- sets one without the other.
--
-- Deliberately NOT dropping subscription_tier here: GET /v1/me and the admin
-- list still select it, and migration 024's RLS self-update guard references
-- it. Dropping the column is a follow-up once those readers are retired.

UPDATE profiles
SET subscription_tier = tier
WHERE tier IS NOT NULL
  AND subscription_tier IS DISTINCT FROM tier;

-- Rows predating the `tier` column (none in production at time of writing, but
-- cheap to converge for self-hosted installs that may have them).
UPDATE profiles
SET tier = subscription_tier
WHERE tier IS NULL
  AND subscription_tier IS NOT NULL;
