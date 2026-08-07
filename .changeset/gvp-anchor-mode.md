---
"@nodaro/shared": minor
---

New `GVP_ANCHOR_CHOICES` + `resolveGvpAnchorWire` (with the `GvpAnchorChoice` / `GvpAnchorWireMode` types) — the Generate Video Pro keyframes anchor lever. Translates the node's product vocabulary (`auto` / `start-end` / `start-only` / `reference`) into the engine's chain mode (`upfront` / `progressive` / `none`), with `auto` and any unknown value resolving to `undefined` so the field stays off the wire and the engine default stays in charge. One resolver shared by every send path, so callers cannot disagree about which mode a run requested.
