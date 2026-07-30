/**
 * The ONLY place credit⇄USD arithmetic is written.
 *
 * Every credit figure derives from {@link CREDIT_BASE_USD}. Dividing by a
 * hardcoded copy of that number instead makes the base impossible to change
 * without a multi-file hunt, so route conversions through here.
 *
 * MILLI-CREDIT GUARD — do not remove. `usd / base` is IEEE-754 division and
 * lands a hair above an integer for many exact-multiple inputs
 * (0.14 / 0.02 = 7.000000000000001), so a bare `Math.ceil` rounds up a whole
 * credit that was not owed. Rounding to milli-credits first absorbs that noise
 * at 1000x finer resolution than any credit-level decision.
 *
 * The guard matters at every base, not just the current one — a finer base does
 * not make it unnecessary, it only moves which inputs trip it. Do not
 * "simplify" it away if {@link CREDIT_BASE_USD} ever changes.
 */
import { CREDIT_BASE_USD } from "./model-constants.js"

/** Milli-credits per credit — the intermediate rounding resolution. */
export const CREDIT_ROUNDING_RESOLUTION = 1000

function assertUsableUsd(usd: number): void {
  if (!Number.isFinite(usd)) throw new Error(`usdToCredits: cost must be finite, got ${usd}`)
  if (usd < 0) throw new Error(`usdToCredits: cost must not be negative, got ${usd}`)
}

/** A USD amount → whole credits at the current base. Rounds up. */
export function usdToCredits(usd: number): number {
  assertUsableUsd(usd)
  const milliCredits = Math.round((usd / CREDIT_BASE_USD) * CREDIT_ROUNDING_RESOLUTION)
  return Math.ceil(milliCredits / CREDIT_ROUNDING_RESOLUTION)
}

/** Whole credits → their USD value at the current base. Display/reporting only. */
export function creditsToUsd(credits: number): number {
  if (!Number.isFinite(credits)) throw new Error(`creditsToUsd: credits must be finite, got ${credits}`)
  return credits * CREDIT_BASE_USD
}
