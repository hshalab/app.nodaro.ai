/**
 * Provider Routing Configuration
 *
 * Maps ProviderCapability values to provider preference chains.
 * KIE.ai is the sole primary provider; Replicate participates only as the
 * image-generation fallback for the models that live exclusively there.
 *
 * The legacy `ai_provider` app-setting deliberately does NOT affect routing:
 * migration 005 seeds it to "replicate" on every fresh database, nothing
 * rewrites it on self-host (community has no admin routes, and the admin PUT
 * only accepts "kie"), and the old non-"kie" branch returned an empty chain —
 * which made every registry-routed node throw on a fresh install even with a
 * valid KIE_API_KEY. Pinned by config.test.ts.
 *
 * This file does NOT import any existing routing code; it is a
 * self-contained config consumed only by the new providers/router.ts.
 */

import type { ProviderCapability } from "./provider.interface.js"
import {
  getAppSettings,
  calculateDisplayCost,
  type AppSettings,
} from "../lib/app-settings.js"

// ─── Types ────────────────────────────────────────────────────────

export type ProviderUsed = "kie" | "replicate"

export interface RoutingDecision {
  /** Ordered list of provider IDs to attempt */
  providerChain: string[]
  /** Markup % to apply to the cost of the provider actually used */
  markupPercent: number
  /** Which raw AI provider setting is active */
  activeProvider: "kie" | "replicate"
  /** The full settings object (cached) */
  settings: AppSettings
}

// ─── Constants ────────────────────────────────────────────────────

/**
 * Capabilities that only KIE.ai supports (no Replicate fallback exists).
 * These operations have no fallback provider — the chain is always ["kie"].
 */
const KIE_ONLY_CAPABILITIES: ReadonlySet<ProviderCapability> = new Set([
  "video-to-video",
  "motion-transfer",
  "video-upscale",
  "lip-sync",
])

// ─── Public API ───────────────────────────────────────────────────

/**
 * Build a routing decision for a given capability + model.
 *
 * @param capability  e.g. "image-generation", "image-to-video"
 * @param model       e.g. "nano-banana", "veo3", "minimax"
 * @returns           RoutingDecision with providerChain & markup
 */
export async function buildRoutingDecision(
  capability: ProviderCapability,
  model: string
): Promise<RoutingDecision> {
  const settings = await getAppSettings()

  // KIE-only capabilities have no fallback; image-generation falls through to
  // Replicate for the "Open" (uncensored) models that only live there
  // (flux-2-klein, kontext-multi) — the router.ts walker uses each provider's
  // `supportedModels`, so KIE-routed ids never reach Replicate. Everything else
  // is KIE-only. (All three KIE-mode chains share the same markup/provider.)
  const providerChain: RoutingDecision["providerChain"] = KIE_ONLY_CAPABILITIES.has(capability)
    ? ["kie"]
    : capability === "image-generation"
      ? ["kie", "replicate"]
      : ["kie"]
  return {
    providerChain,
    markupPercent: settings.cost_markup_percent,
    activeProvider: "kie",
    settings,
  }
}

/**
 * Calculate display cost with markup applied.
 * Re-exports the existing helper so router.ts only imports from config.
 */
export function applyMarkup(
  providerCost: number | null,
  markupPercent: number
): number | null {
  if (providerCost === null) return null
  return calculateDisplayCost(providerCost, markupPercent)
}

/**
 * Determine the markup to use when a specific provider was used.
 * The configured markup applies uniformly across KIE and the Replicate
 * fallback (self-host simply seeds cost_markup_percent = 0).
 * `providerUsed` is kept in the signature so a future per-provider markup
 * (e.g. cheaper rate for Replicate fallback) can branch without an API break.
 */
export function resolveMarkup(
  decision: RoutingDecision,
  providerUsed: ProviderUsed
): number {
  void providerUsed
  if (decision.activeProvider !== "kie") return 0
  return decision.settings.cost_markup_percent
}
