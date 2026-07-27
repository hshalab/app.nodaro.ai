---
"@nodaro/sdk": minor
---

Workflow optimistic concurrency, first-class in the SDK: `UpdateWorkflowInput` gains `expectedUpdatedAt` / `expectedVersion`, and a stale write now throws the new `WorkflowConflictError` (409 `workflow_conflict`) carrying `currentUpdatedAt`, `currentVersion`, and `currentRecord` — the full current workflow returned by the server on conflict, so callers merge-and-retry without a follow-up GET instead of last-writer-wins clobbering concurrent tabs.
