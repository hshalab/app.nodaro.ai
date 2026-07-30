/**
 * Per-service margin resolution.
 *
 * The global `cost_markup_percent` admin setting applies one margin to every
 * priced identifier. Some services warrant their own margin instead — the
 * admin sets those in the `service_margin_percent` setting, a map of
 * identifier-prefix → percent (e.g. `{ "some-service": 30 }`), edited in the
 * admin panel and stored in `app_settings`.
 *
 * DELIBERATELY DATA-DRIVEN: this module contains no service names and no
 * percentages — which services carry their own margin, and how much, is
 * runtime configuration living only in the database. Keep it that way.
 *
 * Semantics:
 * - A prefix matches an identifier when they are equal or the identifier
 *   continues with a `:` composite separator (`"svc"` matches `"svc"` and
 *   `"svc:10s"`, never `"svc-other"`).
 * - The LONGEST matching prefix wins, so `"svc:pro"` can carry a different
 *   margin than the broader `"svc"`.
 * - A matched margin REPLACES the global markup for that identifier (override,
 *   not stacking) — the configured number IS the service's margin.
 * - No match → the global `cost_markup_percent` applies unchanged.
 */
import type { AppSettings } from "../../lib/app-settings.js"

/** Settings slice this module needs; `service_margin_percent` tolerated absent
 *  (older cached shapes, partial test doubles) and treated as empty. */
type MarginSettings = Pick<AppSettings, "cost_markup_percent"> &
  Partial<Pick<AppSettings, "service_margin_percent">>

/** True when `prefix` covers `identifier` on a `:` boundary. */
export function serviceMarginPrefixMatches(identifier: string, prefix: string): boolean {
  return identifier === prefix || identifier.startsWith(`${prefix}:`)
}

/**
 * The markup percent to apply for `modelIdentifier`: its longest-prefix
 * service margin when one is configured, else the global markup.
 */
export function effectiveMarkupPercent(
  settings: MarginSettings,
  modelIdentifier: string,
): number {
  let matched: { prefix: string; percent: number } | null = null
  for (const [prefix, percent] of Object.entries(settings.service_margin_percent ?? {})) {
    if (!serviceMarginPrefixMatches(modelIdentifier, prefix)) continue
    if (!matched || prefix.length > matched.prefix.length) matched = { prefix, percent }
  }
  return matched ? matched.percent : settings.cost_markup_percent
}
