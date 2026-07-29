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

The header is sent only where it adds information: in a browser the `Origin`
header already identifies the app and the backend prefers it, so the default
label is suppressed there. That also avoids making browser apps depend on the
header being present in the server's CORS `Access-Control-Allow-Headers` — a
lagging or self-hosted backend would otherwise fail the preflight and break
every call from the page.

No behaviour changes for existing callers, and older versions keep working —
they are simply recorded as generic API calls.
