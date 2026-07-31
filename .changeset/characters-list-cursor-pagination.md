---
"@nodaro/sdk": minor
---

`characters.list()` is now cursor-paginated. `ListCharactersParams` accepts an opaque `cursor`, and the result adds `nextCursor` (`string | null`) alongside `characters` — page until it is `null`.

Previously the call returned at most `limit` rows (default 100) with no way to reach the rest, so a user with more characters than the limit could not see them at all. Existing callers reading `.characters` keep working unchanged, but a single call was never "all characters" and now says so: the new `ListCharactersResult` type is exported.
