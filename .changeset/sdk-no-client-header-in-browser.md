---
"@nodaro/sdk": patch
---

Don't send `X-Nodaro-Client` from a browser, and let `Origin` identify the app.

The header was introduced (unreleased) so the backend could tell CLI and
server-side SDK traffic apart. In a browser it is both redundant and risky:

- Redundant — the browser already sends `Origin`, which names the actual product
  (`studio.nodaro.ai`) rather than the library that made the call. The backend
  now prefers `Origin`, so a browser-sent header is discarded on arrival.
- Risky — `X-Nodaro-Client` is not a CORS-safelisted request header, so sending
  it from a page requires an exact match in the server's
  `Access-Control-Allow-Headers`. Against a backend that predates that entry the
  PREFLIGHT fails, breaking every API call from the app rather than just its
  provenance. Self-hosted and lagging deployments make that a real risk.

The default label is therefore suppressed in browsers. An explicit `clientLabel`
is always sent — naming yourself is a deliberate act — which is how `@nodaro/cli`
stays distinguishable.

No action needed by browser apps: they are identified by `Origin`, which they
already send.
