// Tier lives in TWO columns on `profiles`: `tier` and `subscription_tier`.
//
// They exist for historical reasons and nothing keeps them in step, so they
// drift: every Stripe path (provision-credits, billing change-plan) wrote only
// `tier`, while the admin panel and GET /v1/me read only `subscription_tier`.
// On 2026-07-28 that surfaced as a paying Basic customer being displayed as
// "free" in admin — and looking, at a glance, like a free user who had blown
// straight through the free daily cap.
//
// Until the duplicate column is dropped, these two helpers are the only
// sanctioned way to touch tier:
//
//   READ  -> resolveEffectiveTier / resolveStoredTier (@nodaro/shared) —
//            entitlement sites use effective (payg derivation); billing/
//            provisioning writers use stored. resolveTierFrom below mirrors
//            the stored coalesce for admin display.
//   WRITE -> tierColumns(tier)      spreads BOTH columns ("payg" NEVER written)
//
// `profiles-tier-columns.test.ts` fails the build if any writer sets `tier:`
// on a profiles update without going through tierColumns().

/**
 * Every column that must move together when a user's tier changes.
 * Spread into a `profiles` update:
 *
 *   .update({ ...tierColumns(newTier), subscription_credits: credits })
 */
export function tierColumns(tier: string): { tier: string; subscription_tier: string } {
  return { tier, subscription_tier: tier }
}

/**
 * Resolve a profile's effective tier. `tier` wins because it is the column the
 * Stripe paths have always written, so it is the one that tracks reality;
 * `subscription_tier` is the historical fallback for rows predating it.
 *
 * This mirrors the SQL side (`COALESCE(tier, subscription_tier, 'free')` in
 * migration 022) and credit enforcement (`resolveTier` in credits.ts).
 */
export function resolveTierFrom(profile: {
  tier?: string | null
  subscription_tier?: string | null
}): string {
  return profile.tier ?? profile.subscription_tier ?? "free"
}
