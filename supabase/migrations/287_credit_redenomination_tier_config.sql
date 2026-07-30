-- Tier config for the credit re-denomination + tier flattening.
--
-- tier_config DUPLICATES the TIER_CREDITS constant in
-- backend/src/ee/billing/stripe-config.ts. Updating one and not the other has
-- caused two prior production incidents (migrations 067 and 281), so both move
-- in this same PR.
--
-- daily_credit_limit x10 keeps the free-tier cap worth the same dollars; left
-- at 50 against x10 prices it would lock free users out after one small job.
--
-- price_usd is NOT updated: it is stale ($19/$39/$79/$149 vs the real
-- $12/$29/$59/$129 in frontend/src/lib/pricing-data.ts) AND read by no code.
-- A5 #3 recommends dropping the column rather than maintaining a second,
-- wrong copy of a displayed price. Left untouched here so this migration stays
-- purely about the re-denomination.

BEGIN;

UPDATE tier_config SET monthly_credits = 1500  WHERE tier = 'free';
UPDATE tier_config SET monthly_credits = 4500  WHERE tier = 'basic';
UPDATE tier_config SET monthly_credits = 11000 WHERE tier = 'standard';
UPDATE tier_config SET monthly_credits = 23000 WHERE tier = 'pro';
UPDATE tier_config SET monthly_credits = 52000 WHERE tier = 'business';

UPDATE tier_config SET daily_credit_limit = 500 WHERE tier = 'free';
-- Paid tiers carry NULL (no daily cap); left untouched.

COMMIT;
