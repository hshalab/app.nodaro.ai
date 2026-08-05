---
"@nodaro/shared": minor
---

A wired location reference now defaults to the role `location`, not `background`.

`DEFAULT_LABEL_BY_SOURCE["wired-location"]` was `"background"`, which `roleToPhrase` renders as `"the background from reference image B"`. Image models read that phrasing as *paste this behind the subject*, so a character + location pair came back as a composite rather than a photograph — an indoor-lit subject over the location, with no shared light and no ground contact.

Measured on gpt-image-2 (2K, 16:9, one character + one location, 4 draws per arm, only the role word varying): with `background` all four draws were cut-outs — no cast shadow at the subject's feet and the action the prompt asked for ignored. With `location` the subject rendered inside the scene, full-length, with ground contact, a cast shadow, and one sun lighting subject and location alike.

`"location"` is added to `REFERENCE_ROLE_PRESETS["wired-location"]` (second, mirroring `wired-character`'s `ref-only`/`person` order). `"background"` remains a curated pick for the genuine backdrop case — it is simply no longer what every location silently gets.

Existing references are unaffected: `resolveDefaultRole` prefers an explicitly stored role, so only new or defaulted references change. `normalizeRoleSlug` is data-driven from the preset list, so the new role needs no extra wiring.
