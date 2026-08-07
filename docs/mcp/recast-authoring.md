# Recast authoring — write a movie as JSON over MCP

The MCP movie-making lane (Cloud edition): your assistant authors a
screenplay-shaped script, validates it for free, imports it as a **real recast
project** — visible and resumable at [recast.nodaro.ai](https://recast.nodaro.ai) —
and renders it with the price surfaced before every spend. Prefer this lane for
end-to-end "make me a video / movie / ad of X" requests; the workflow-editor and
director tools remain the right choice for canvas-building.

## The loop

1. **`get_recast_authoring_skill`** — read the generated authoring guide first.
   It carries the document contract (`meta` / `slots` / `scenes`), the planner's
   own field doctrine (`visual` is a generation prompt; `camera` is motion only;
   `shotType` from a closed vocabulary), enum lists, bounds (scenes ≤ 8s,
   contiguous from 0, total 4s → the platform run cap, `"16:9"` or `"9:16"`),
   audio rules (lyrics ride a `music` layer, never `speech`; no music layer means
   silence), and a validated worked example.
2. **`validate_recast_script`** — free, unlimited-feeling iterate loop. Fix each
   `errors[].path` using its `hint`; repeat until `valid: true`.
3. **`import_recast_script`** — free. Creates the project + workflow and stores
   the script as a completed analysis. **`rights_attested: true` must reflect the
   user's own explicit confirmation in the conversation that the script is their
   own work** — authored recasts render Faithful, exactly as written, brand names
   included. Never set it on the user's behalf. Returns `{ recastId, appUrl }`.
4. **`start_recast`** — without `confirm` it returns the credit quote only.
   Present the price; call again with `confirm: true` once the user accepts.
   Rendering runs server-side; call `start_recast` again when the status shows
   `planned` to advance the run to rendering (no new charge).
5. **`get_recast_status`** — planning / planned / generating (segments done vs
   total, live preview URL) / completed (result URL) / failed. Always includes
   the recast.nodaro.ai deep link — the full editor for casting, retakes, and
   the interactive pick-your-cast/sheet/frames/music mode. On hosts that render
   MCP Apps, this tool shows a live status card: progress bar, the growing
   preview, and the interactive gates as clickable pick-1-of-3 choices.
6. **Interactive mode** — pass `interactive: true` to `start_recast` to choose
   the cast before rendering (a priced surcharge; it rides the quote). The run
   pauses at gates; `get_recast_status` surfaces the candidates, and
   **`resolve_recast_gate`** records the pick (free, pure state) and advances
   the run. Gates open in walk order: **cast** (pick each element's portrait),
   then — person slots only, when the run offers it — the **identity sheet**
   (`gate: "sheet"` with the same `picks` shape: 3 composed sheets whose face
   panel is the SAME chosen portrait, so the pick chooses body & wardrobe
   only), then **scene stills**, then **music**. `finish_auto: true` resolves
   every remaining gate with the critic's top candidate. An abandoned
   interactive run parks safely and auto-resolves on its deadline.

An abandoned conversation strands nothing: the run is a real recast project, and
the app's watcher machinery resumes or parks it safely.

## Scopes

| Tool | Scope |
|------|-------|
| `get_recast_authoring_skill`, `validate_recast_script` | none (ungated) |
| `import_recast_script` | `workflows:write` |
| `start_recast`, `resolve_recast_gate` | `workflows:execute` |
| `get_recast_status` | `workflows:read` |

## REST equivalents

The same lane over raw REST: `POST /v1/video-analysis/import/validate`,
`POST /v1/video-analysis/import`, `GET /v1/video-analysis/authoring-skill` — see
[API integration §13d](../api-integration.md).
