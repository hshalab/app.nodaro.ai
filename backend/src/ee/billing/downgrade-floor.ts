/**
 * The payg storage floor — one home for every downgrade-to-free writer.
 *
 * A user landing on stored tier "free" is NOT always entitlement-free: with
 * net lifetime top-ups > 0 they derive "payg" (effective-tier.ts) and keep a
 * 10 GB storage floor (= basic) instead of the 1 GB free floor. Three writer
 * paths used to inline the downgrade columns and would each have missed this
 * independently (design 2026-07-05 §4.5): handleSubscriptionCanceled (webhook),
 * expireSubscriptions (cron safety net), cleanupCanceledUserMedia (grace-
 * expiry media pass). They all route through here now.
 *
 * The activation half lives here too: a successful top-up grant raises the
 * floor with GREATEST semantics — an admin-raised limit is never lowered.
 */

import { supabase } from "../../lib/supabase.js"
import { TIER_STORAGE_LIMITS } from "./stripe-config.js"
import { tierColumns } from "./tier-columns.js"

/** Storage floor for a user with the given NET lifetime top-up credits. */
export function storageFloorFor(lifetimeTopupCredits: number): number {
  return lifetimeTopupCredits > 0 ? TIER_STORAGE_LIMITS.payg : TIER_STORAGE_LIMITS.free
}

/** Batch-fetch net lifetime top-ups. Missing rows resolve to 0. */
export async function fetchLifetimeTopups(userIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  if (userIds.length === 0) return out
  const { data } = await supabase
    .from("profiles")
    .select("id, lifetime_topup_credits")
    .in("id", userIds)
  for (const row of data ?? []) {
    out.set(row.id as string, (row.lifetime_topup_credits as number) ?? 0)
  }
  return out
}

/**
 * Downgrade ONE user to the free/payg effective floor. Caller-specific
 * columns (credit caps, subscription_ended_at, ...) ride along in `extra`.
 * Returns whether the user landed on the payg floor.
 */
export async function downgradeToEffectiveFloor(
  userId: string,
  extra: Record<string, unknown> = {}
): Promise<{ isPayg: boolean; error: { message: string } | null }> {
  const lifetimes = await fetchLifetimeTopups([userId])
  const lifetime = lifetimes.get(userId) ?? 0
  const { error } = await supabase
    .from("profiles")
    .update({
      ...tierColumns("free"),
      storage_limit_bytes: storageFloorFor(lifetime),
      ...extra,
    })
    .eq("id", userId)
  return { isPayg: lifetime > 0, error: error ?? null }
}

/**
 * Activation-side raise: after a successful top-up grant, lift the storage
 * limit to the payg floor — but never lower an admin-raised value, and never
 * touch subscribers (their floor is write-managed by the subscription paths).
 */
/**
 * After a refund/dispute clawback: a user whose NET lifetime dropped to 0 is
 * no longer payg — collapse the storage floor back to the free 1 GB, but ONLY
 * when the current limit is exactly the payg floor. An admin-raised value is
 * never touched (admin override wins in both directions).
 */
export async function reapplyStorageFloorAfterClawback(userId: string): Promise<void> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("tier, subscription_tier, lifetime_topup_credits, storage_limit_bytes")
    .eq("id", userId)
    .single()
  if (!profile) return

  const stored = (profile.tier as string | null) ?? (profile.subscription_tier as string | null) ?? "free"
  const lifetime = (profile.lifetime_topup_credits as number) ?? 0
  const current = (profile.storage_limit_bytes as number) ?? 0
  if (stored !== "free" || lifetime > 0) return
  if (current !== TIER_STORAGE_LIMITS.payg) return // admin-raised or already free floor

  const { error } = await supabase
    .from("profiles")
    .update({ storage_limit_bytes: TIER_STORAGE_LIMITS.free })
    .eq("id", userId)
  if (error) {
    console.error("[billing] clawback floor collapse failed:", userId, error.message)
  }
}

export async function raiseStorageFloorOnActivation(userId: string): Promise<void> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("tier, subscription_tier, lifetime_topup_credits, storage_limit_bytes")
    .eq("id", userId)
    .single()
  if (!profile) return

  const stored = (profile.tier as string | null) ?? (profile.subscription_tier as string | null) ?? "free"
  const lifetime = (profile.lifetime_topup_credits as number) ?? 0
  if (stored !== "free" || lifetime <= 0) return // subscribers never reach this branch

  const current = (profile.storage_limit_bytes as number) ?? 0
  const floor = TIER_STORAGE_LIMITS.payg
  if (current >= floor) return // admin-raised (or already floored) — no-lower

  const { error } = await supabase
    .from("profiles")
    .update({ storage_limit_bytes: floor })
    .eq("id", userId)
  if (error) {
    console.error("[billing] payg activation storage raise failed:", userId, error.message)
  }
}
