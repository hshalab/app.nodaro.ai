// The app's Tutorials tab must not render categories curated for other
// Nodaro clients (studio's `studio-examples`), while the shared public
// GET /v1/tutorials keeps serving them — the filter is presentation-side.

import { describe, it, expect } from "vitest"
import { filterAppTutorialCategories } from "../use-tutorials"
import type { TutorialCategoryWithItems } from "@/lib/api"

function cat(slug: string): TutorialCategoryWithItems {
  return { id: `id-${slug}`, name: slug, slug, sortOrder: 0, videos: [], flows: [] }
}

describe("filterAppTutorialCategories", () => {
  it("drops studio-examples and keeps everything else, order preserved", () => {
    const result = filterAppTutorialCategories([
      cat("getting-started"),
      cat("studio-examples"),
      cat("advanced-flows"),
    ])
    expect(result.map((c) => c.slug)).toEqual(["getting-started", "advanced-flows"])
  })

  it("passes through untouched when the studio category is absent", () => {
    const input = [cat("getting-started")]
    expect(filterAppTutorialCategories(input)).toEqual(input)
  })
})
