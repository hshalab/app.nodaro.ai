/**
 * Scheduled-cancellation state shared by the billing page and the admin
 * users/subscriptions pages. The columns are synced from Stripe by the
 * subscription.updated webhook — the subscription's `status` stays "active"
 * until the period actually ends, so these fields are the only signal that a
 * cancellation is pending.
 */
export interface CancelableSubscription {
  readonly status?: string | null
  readonly cancel_at_period_end?: boolean | null
  readonly cancel_at?: string | null
  readonly current_period_end?: string | null
}

/**
 * The date an active subscription is scheduled to end, or null when no
 * cancellation is scheduled. Newer Stripe API versions express a portal
 * "cancel at period end" as a `cancel_at` timestamp while the legacy
 * `cancel_at_period_end` boolean stays false — treat either as scheduled.
 */
export function getScheduledCancelDate(
  sub: CancelableSubscription | null | undefined,
): string | null {
  if (!sub || sub.status !== "active") return null
  if (sub.cancel_at) return sub.cancel_at
  if (sub.cancel_at_period_end) return sub.current_period_end ?? null
  return null
}
