---
---

No release needed: the only `packages/shared` change is a new guard in
`video-analysis-catalog-sync.test.ts` pinning the bare `video-analysis` credit id
to the bucket table's maximum. Tests are not part of the published artifact, so no
consumer-visible behaviour changes. The runtime fixes ride the app
(`backend/src/ee/billing/credits.ts`) and migration 277.
