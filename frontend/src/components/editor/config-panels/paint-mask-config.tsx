"use client"

import { Input } from "@/components/ui/input"
import type { ConfigProps } from "./types"
import type { PaintMaskData } from "@/types/nodes"

/** Config panel for the paint-mask source node. Per the design spec, the
 *  node itself carries the primary action (Paint / Edit mask on the card),
 *  so the panel keeps only what the canvas can't show: label + painter
 *  defaults + the polarity explanation. */
export function PaintMaskConfig({ data, onUpdate }: ConfigProps<PaintMaskData> & { nodeId?: string }) {
  const brushSize = data.defaultBrushSize ?? 48
  const hardness = data.defaultBrushHardness ?? 70

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] tracking-[.12em] text-muted-foreground uppercase">Label</label>
        <Input
          value={data.label ?? ""}
          onChange={(e) => onUpdate({ label: e.target.value })}
          placeholder="Paint Mask"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] tracking-[.12em] text-muted-foreground uppercase">Default brush</label>
        <div className="flex gap-2">
          <div className="flex-1 flex flex-col gap-1">
            <div className="flex items-center justify-between text-[11.5px]">
              <span className="text-muted-foreground">Size</span>
              <span className="font-mono">{brushSize}</span>
            </div>
            <input
              type="range"
              min={4}
              max={200}
              value={brushSize}
              onChange={(e) => onUpdate({ defaultBrushSize: Number(e.target.value) })}
              className="w-full accent-[#ff0073]"
            />
          </div>
          <div className="flex-1 flex flex-col gap-1">
            <div className="flex items-center justify-between text-[11.5px]">
              <span className="text-muted-foreground">Hardness</span>
              <span className="font-mono">{hardness}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={hardness}
              onChange={(e) => onUpdate({ defaultBrushHardness: Number(e.target.value) })}
              className="w-full accent-[#ff0073]"
            />
          </div>
        </div>
      </div>

      <p className="text-[11.5px] text-muted-foreground leading-relaxed">
        White areas are regenerated, black areas are preserved. Paint directly on
        the node card, or wire a Generate Mask output into the seed input to
        refine it by hand.
      </p>
    </div>
  )
}
