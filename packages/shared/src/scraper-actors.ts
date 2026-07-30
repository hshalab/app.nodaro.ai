export const SCRAPER_ACTOR_IDS = [
  "content-crawler",
  "google-search",
  "instagram",
  "tiktok",
  "rss",
] as const

export type ScraperActorId = (typeof SCRAPER_ACTOR_IDS)[number]

export const SCRAPER_ACTOR_LABELS: Record<ScraperActorId, string> = {
  "content-crawler": "Website Content (Markdown)",
  "google-search":   "Google Search",
  "instagram":       "Instagram",
  "tiktok":          "TikTok",
  "rss":             "RSS Feed",
}

/** Credit costs per composite SKU — must stay in sync with STATIC_CREDIT_COSTS in backend.
 *
 * "Must stay in sync" was doing no work: these were left at the pre-2026-07-30
 * credit base while the backend moved, so every SKU here read a tenth of the
 * real price. Values below are copied from `model_pricing`, which is what the
 * user is actually charged. */
export const SCRAPER_CREDIT_COSTS: Record<string, number> = {
  "web-scrape": 20,
  "web-scrape:google-search": 30,
  "web-scrape:content-crawler": 10,
  "web-scrape:content-crawler:site": 50,
  "web-scrape:instagram": 10,
  "web-scrape:tiktok": 10,
  "web-scrape:rss": 10,
}

export function isScraperActor(value: unknown): value is ScraperActorId {
  return typeof value === "string" && (SCRAPER_ACTOR_IDS as readonly string[]).includes(value)
}

export interface ScraperCreditInput {
  actor: ScraperActorId
  mode?: "page" | "site"
}

export function buildScraperCreditId(input: ScraperCreditInput): string {
  if (input.actor === "content-crawler") {
    const mode = input.mode ?? "page"
    return mode === "site" ? "web-scrape:content-crawler:site" : "web-scrape:content-crawler"
  }
  return `web-scrape:${input.actor}`
}

/**
 * Resolve the credit identifier from an unvalidated request body.
 * Falls back to a fixed default SKU (google-search) on missing/invalid actor
 * so misrouted requests reserve a known mid-tier price, not the max-cost tier.
 */
export function resolveScraperCreditId(body: unknown): string {
  const raw = body as { actor?: unknown; mode?: unknown } | undefined
  if (!raw || !isScraperActor(raw.actor)) return "web-scrape:google-search"
  const mode = raw.mode === "site" ? "site" : "page"
  return buildScraperCreditId({ actor: raw.actor, mode })
}
