---
"@nodaro/sdk": minor
---

feat: `Job.source` / `Job.source_detail` — job provenance (which kind of caller created the job: `internal | mcp | app | cli | sdk | extension | web | api` + a narrowing detail) is now exposed on owner-facing job reads, so library views can label and filter media by origin. Browser extensions are recognized as their own source kind (extension-scheme `Origin`, optionally refined by an `X-Nodaro-Client: extension/<name>` label).
