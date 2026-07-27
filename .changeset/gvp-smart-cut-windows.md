---
"@nodaro/shared": minor
---

New `smart-cut-windows` module: `clampSmartCutWindow()` plus the `SMART_CUT_WINDOW_MIN` / `_MAX` / `_DEFAULT` bounds for generate-video-pro's best-pair search windows. The canvas Run path and the workflow orchestrator are two independent senders into the same engine route, so both narrow the node's `smartCutFramesPrev` / `smartCutFramesNext` through this one function — a stale or hand-edited node value degrades to a legal request instead of failing a multi-segment run at finalize time, and the two paths cannot drift apart.
