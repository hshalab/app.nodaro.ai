# Paint Mask
> Hand-paint a mask over any connected image and emit it as a first-class canvas value. No AI, no credits -- the brush is the whole node.

## Overview

Paint Mask turns a hand-painted mask into a reusable workflow value. Connect an image, click the node (or "Paint Mask" in its config panel) to open the Mask Painter, brush over the regions you want to change, and save. The painted black-and-white PNG is emitted on the node's purple `mask` output, ready to wire into any mask input -- [Modify Image](./modify-image.md), Image to Image, Edit Image, or Relight & Switch.

White pixels mark the region to edit; black pixels mark the region to preserve. This **white = edit** polarity matches [Generate Mask](./generate-mask.md) and the [Generate Image](./generate-image.md#inpainting--refine) inpaint convention exactly, so painted and generated masks are interchangeable everywhere a mask is accepted.

The node never executes: there is no provider, no job, and no credit cost. The painted mask IS the output -- like Upload Image, its value comes from what you put on it, and it persists with the workflow (including export/import and node presets).

## Refining a generated mask

Paint Mask has a second input: a `mask` seed. Wire a [Generate Mask](./generate-mask.md) output into it and the painter opens pre-loaded with the generated mask as its base layer -- brush to add regions, use the eraser to remove them, then save. The hand-refined result is emitted downstream, giving you an auto-segment-then-touch-up chain entirely on the canvas:

```
Upload Image ──┬─> Generate Mask ("the red car") ──> Paint Mask (refine by hand) ──> Modify Image (mask)
               └────────────────────────────────────────────────────────────────────> Modify Image (image)
```

## Configuration

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| Mask | painter | -- | Opens the Mask Painter over the connected image. Brush, eraser, lasso, invert, opacity (soft gray edges), undo/redo. |

## Inputs & Outputs

**Inputs:**
- `image` -- the image to paint over (the mask's alignment reference). Required to open the painter.
- `mask` -- optional seed mask; pre-loads the painter for hand-refinement.

**Outputs:**
- `mask` -- the painted PNG mask, at the full resolution of the source image. White areas will be edited, black areas preserved.

## Credits

**Free.** The node performs no generation.

## Typical Workflow

1. **Upload Image** (or any image producer) provides the source.
2. **Paint Mask** -- connect the image, open the painter, brush the region to change.
3. **Modify Image** (mask-capable provider) or **Generate Image** consumes the same source image plus the painted `mask`; only the white region is re-rendered.

Because the painted mask travels with the workflow like any other node value, one mask can feed several consumers at once (for example the same region into Modify Image and Relight & Switch), and it survives duplication, export, and re-import.

## Notes

- The mask is painted at the source image's native resolution, so it stays pixel-aligned with the image it was painted over. If you later rewire a *different* image into a downstream consumer, repaint the mask -- masks are positional and only meaningful relative to the image they were drawn on.
- Re-running upstream nodes does not change a saved mask. The node keeps the last painted PNG until you edit or clear it, so check it still matches after the upstream image changes.
- The painter's opacity slider paints soft gray values, which downstream inpainting treats as partial blend -- useful for feathered transitions.
- The mask output is a plain PNG, so it can also be used anywhere an image is accepted (preview, save to storage, references).
