---
"@nodaro/cli": minor
---

New `nodaro media collage <imageUrls...>` command — composite 2–30 images into one 2K/4K collage via `POST /v1/image-collage`, including `--sizes` per-image relative size hints (0 auto / 1 big / 2 medium / 3 small, aligned by position; smart layout only), plus `--layout`, `--resolution`, `--aspect-ratio`, `--gap`, and `--background-color`.
