// Public dashboard hook for the unified Tutorials tab.
// Calls GET /v1/tutorials which returns categories pre-grouped with video and
// flow items in each bucket. Skip-auth: anonymous users can browse the
// tutorials too.

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { fetchTutorialsGrouped, type TutorialCategoryWithItems } from "@/lib/api"

/**
 * Tutorial categories that exist for OTHER Nodaro clients and must not render
 * in the app's Tutorials tab. `studio-examples` (created 2026-07-29) carries
 * studio's admin-curated example productions; studio discovers it through the
 * SAME public GET /v1/tutorials, so the exclusion is strictly app-presentation
 * side — never filter it server-side. Remove a slug from this set to
 * cross-promote that category in the app instead.
 */
const APP_HIDDEN_TUTORIAL_CATEGORY_SLUGS: ReadonlySet<string> = new Set(["studio-examples"])

/** Drop categories curated for other clients. Exported for the unit test. */
export function filterAppTutorialCategories(
  categories: TutorialCategoryWithItems[],
): TutorialCategoryWithItems[] {
  return categories.filter((c) => !APP_HIDDEN_TUTORIAL_CATEGORY_SLUGS.has(c.slug))
}

export function useTutorialsGrouped() {
  return useQuery({
    queryKey: queryKeys.tutorials.grouped(),
    queryFn: fetchTutorialsGrouped,
    staleTime: 60_000,
    select: (data) => ({ categories: filterAppTutorialCategories(data.categories) }),
  })
}
