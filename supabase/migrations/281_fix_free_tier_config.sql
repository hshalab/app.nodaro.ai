-- 281: correct the tier_config row for the free tier.
--
-- Bug
-- ---
-- Migration 067 ("Fix tier_config monthly_credits to match actual plan values")
-- repriced basic/standard/pro/business and skipped `free`, so the free row kept
-- an earlier pricing structure's numbers:
--
--            tier_config (before)   code (authoritative)
--   monthly       50                150   TIER_CREDITS.free
--   daily          10                50   FREE_TIER_RESTRICTIONS.dailyCreditCap
--
-- Impact
-- ------
-- `monthly_credits` is NOT dead config: CreditsService.getBalance returns it as
-- `monthlyAllocation` (credits.ts), which the public SDK surfaces from
-- client.credits.balance(). Free users were told their monthly allocation was
-- 50 when they actually receive 150.
--
-- `daily_credit_limit` genuinely is unused for free — both reserveCredits and
-- getBalance special-case the free tier to FREE_TIER_RESTRICTIONS.dailyCreditCap
-- rather than reading tier_config. Correcting it anyway so the table stops
-- contradicting the code: it is admin-visible, and 10 vs 50 is exactly the kind
-- of discrepancy someone "fixes" in the wrong direction.
--
-- No profiles backfill needed (unlike 067): free users are already granted 150
-- from TIER_CREDITS.free, so only the config row was ever wrong.

UPDATE tier_config
SET monthly_credits = 150,
    daily_credit_limit = 50
WHERE tier = 'free';
