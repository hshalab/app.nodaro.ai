---
"@nodaro/sdk": minor
"@nodaro/cli": minor
---

Identify the calling client to the backend, so job origin is recordable.

Both packages now send an `X-Nodaro-Client` header — `sdk/<version>` and
`cli/<version>` respectively — which the backend stores as the job's origin.
Until now an operator looking at a job could not tell a CLI run from an SDK
integration from a raw REST call: all three looked identical on the server.

`createClient` gains a `clientLabel` option for anyone building another wrapper
around the SDK; the CLI uses it to avoid reporting itself as plain SDK traffic.
Both versions are injected at build time from `package.json`, so the reported
version cannot drift from the released one.

No behaviour changes for existing callers, and older versions keep working —
they are simply recorded as generic API calls.
