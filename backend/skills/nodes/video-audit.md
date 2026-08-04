---
node_type: video-audit
generated_at: 2026-08-04T14:59:29.789Z
generated_from: 210cb078c
---

# AI Audit

<!-- AUTO-GEN:START node-data-shape -->
**Type:** `video-audit`
**Category:** processing
**Credit cost:** 3
**Inputs (target handles):** `video`, `analysis`
**Outputs (source handles):** `json`, `text`

**Required data fields:**
- `label: string`

**Optional data fields:**
- `videoUrl?: string`
- `probedVideo?: { url: string; durationSec: number }`
- `lastAuditReport?: VideoAuditReport`
- `executionStatus?: "idle" | "running" | "completed" | "failed"`
- `errorMessage?: string`
- `currentJobId?: string`
- `currentJobProgress?: number`
- `generatedJson?: VideoAnalysisResult`

**Default data:**
```json
{
  "label": "AI Audit",
  "executionStatus": "idle"
}
```
<!-- AUTO-GEN:END node-data-shape -->

## When to use

(Add prose here. Auto-gen will preserve it across regenerations.)

<!-- AUTO-GEN:START mcp-call -->
<!-- AUTO-GEN:END mcp-call -->

## Common gotchas

(Add prose here.)

<!-- AUTO-GEN:START examples -->
## Worked example

```json
{
  "id": "video-audit-1",
  "type": "video-audit",
  "position": {
    "x": 0,
    "y": 0
  },
  "data": {
    "label": "AI Audit",
    "executionStatus": "idle"
  }
}
```
<!-- AUTO-GEN:END examples -->
