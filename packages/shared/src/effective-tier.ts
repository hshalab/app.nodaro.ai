/**
 * Effective-tier resolution — the payg derivation.
 *
 * "payg" is a DERIVED tier, never stored: a user whose stored tier resolves
 * to "free" but who has NET lifetime top-up credits (granted − refunded,
 * clamped ≥ 0 by every SQL writer) is treated as "payg" by entitlement
 * checks. Stored tier stays untouched, so subscription webhooks never learn
 * about payg and a cancel→free transition re-derives it automatically.
 *
 * Lives in @nodaro/shared because the pipeline tier maps already do, and
 * both backend (credit gates, workers) and read surfaces need one source.
 *
 * The profile fields are REQUIRED (non-optional) on purpose: a call site
 * whose SELECT forgot to fetch `lifetime_topup_credits` becomes a compile
 * error instead of a silent `?? 0` that quietly deactivates payg — that is
 * the failure mode this shape exists to prevent.
 */

/** Stored-tier resolution — mirrors SQL COALESCE(tier, subscription_tier, 'free'). */
export function resolveStoredTier(p: {
  tier: string | null
  subscription_tier: string | null
}): string {
  return p.tier ?? p.subscription_tier ?? "free"
}

/**
 * Effective tier: stored "free" with NET lifetime top-ups > 0 derives "payg".
 * Every other stored tier passes through untouched.
 */
export function resolveEffectiveTier(p: {
  tier: string | null
  subscription_tier: string | null
  lifetime_topup_credits: number
}): string {
  const stored = resolveStoredTier(p)
  if (stored === "free" && p.lifetime_topup_credits > 0) return "payg"
  return stored
}

/** Media-retention activity window for payg users (design 2026-07-05 §4.6). */
export const PAYG_RETENTION_DAYS = 90

/**
 * Is this payg user inside their retention-activity window?
 *
 * Activity = credit SPEND (callers supply MAX(usage_logs.created_at) — never
 * `last_daily_reset`, which read-only balance polls bump) OR a top-up
 * PURCHASE (`last_topup_at`). Within PAYG_RETENTION_DAYS of either → the
 * nightly reaper leaves their media alone; past it, the standard free-tier
 * reaper rules apply. A user with no lifetime purchases is never
 * retention-active (they are not payg).
 */
export function isPaygRetentionActive(
  p: {
    lifetimeTopupCredits: number
    lastTopupAt: string | Date | null
    lastSpendAt: string | Date | null
  },
  now: Date
): boolean {
  if (p.lifetimeTopupCredits <= 0) return false
  const cutoff = now.getTime() - PAYG_RETENTION_DAYS * 24 * 60 * 60 * 1000
  const at = (v: string | Date | null): number | null => {
    if (v === null) return null
    const t = v instanceof Date ? v.getTime() : new Date(v).getTime()
    return Number.isFinite(t) ? t : null
  }
  const topup = at(p.lastTopupAt)
  const spend = at(p.lastSpendAt)
  return (topup !== null && topup >= cutoff) || (spend !== null && spend >= cutoff)
}
