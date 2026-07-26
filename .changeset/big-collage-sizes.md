---
"@nodaro/sdk": minor
---

Add `client.media.imageCollage()` — composite 2–30 images into one 2K/4K collage via `POST /v1/image-collage`, including the new per-image `imageSizes` relative size hints (`0` auto / `1` big / `2` medium / `3` small, index-aligned with `imageUrls`; smart layout only).
