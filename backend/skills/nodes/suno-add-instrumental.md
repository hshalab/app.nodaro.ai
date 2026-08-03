---
node_type: suno-add-instrumental
generated_at: 2026-08-03T12:33:47.327Z
generated_from: 4260ead1d
---

# Suno Add Instrumental

<!-- AUTO-GEN:START node-data-shape -->
**Type:** `suno-add-instrumental`
**Category:** ai
**Credit cost:** 4
**Inputs (target handles):** `audio`
**Outputs (source handles):** `audio`

**Required data fields:**
- `label: string`
- `model: "V4_5PLUS" | "V5" | "V5_5"`
- `fieldMappings: FieldMappings`

**Optional data fields:**
- `taskId?: string`
- `audioId?: string`
- `executionStatus?: "idle" | "running" | "completed" | "failed"`
- `errorMessage?: string`
- `generatedAudioUrl?: string`
- `generatedResults?: GeneratedResult[]`
- `activeResultIndex?: number`
- `currentJobId?: string`
- `currentJobProgress?: number`

**Default data:**
```json
{
  "label": "Suno Add Instrumental",
  "model": "V5_5",
  "fieldMappings": {}
}
```
<!-- AUTO-GEN:END node-data-shape -->

## When to use

(Add prose here. Auto-gen will preserve it across regenerations.)

<!-- AUTO-GEN:START mcp-call -->
**MCP tool:** `suno_add_instrumental`

**Input parameters:**
- `audio_asset_id`
- `model`
<!-- AUTO-GEN:END mcp-call -->

## Common gotchas

(Add prose here.)

<!-- AUTO-GEN:START examples -->
## Worked example

```json
{
  "id": "suno-add-instrumental-1",
  "type": "suno-add-instrumental",
  "position": {
    "x": 0,
    "y": 0
  },
  "data": {
    "label": "Suno Add Instrumental",
    "model": "V5_5",
    "fieldMappings": {}
  }
}
```
<!-- AUTO-GEN:END examples -->
