---
"@nodaro/shared": patch
---

Stop restating credit prices in `MODEL_RECOMMENDATIONS` notes

Two recommendation notes quoted a price ("Z-Image is the cheapest at 1 credit", "1 credit, no prompt needed") that the generated table directly beneath them already gives — so they were a second copy, and they rotted: both still said 1 credit after the values became 2 and 3. The notes now name the ranking, not the number.
