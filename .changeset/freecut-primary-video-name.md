---
"@nodaro/shared": minor
---

Add optional `videoName` to `NodaroLoadVideoPayload` — display/file name for the primary clip in the FreeCut `NODARO_LOAD_VIDEO` load payload (e.g. "Shot 1.mp4"). Absent keeps the current URL-derived naming, so existing senders are unaffected. Lets Studio's whole-production "Edit in FreeCut" name the primary clip the same way `additionalFiles` entries already carry names for clips 2..N.
