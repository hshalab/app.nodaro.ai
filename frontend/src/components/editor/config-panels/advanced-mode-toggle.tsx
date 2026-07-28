import { useEffect } from "react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { supportsAdvancedMode, ADVANCED_MODE_UNAVAILABLE_REASON, LLM_FEATURE_DEFAULTS } from "@nodaro/shared"
import type { LlmFeature } from "@nodaro/shared"

interface AdvancedModeToggleProps {
  feature: LlmFeature
  /** The node's current llmModel (undefined = the feature default). */
  modelId?: string
  value?: boolean
  onChange: (patch: { advancedMode?: boolean; temperature?: number; maxTokens?: number }) => void
  /** Current sampling values, rendered only while advanced is on. */
  temperature?: number
  maxTokens?: number
  /** Route defaults, so the revealed controls start where the node already is
   *  rather than snapping to some other number the first time they appear. */
  defaultTemperature?: number
  defaultMaxTokens?: number
  /** Set on nodes whose prompt asks the model for JSON — a high temperature
   *  measurably degrades schema adherence there. */
  structuredOutput?: boolean
}

/**
 * Advanced mode opt-in for an LLM node.
 *
 * Shown DISABLED (rather than hidden) when the selected model can't support
 * it: a control that silently vanishes reads as a bug, whereas a greyed one
 * with a reason tells the user exactly what to change. Matches the house
 * pattern for this — `Switch` plus a muted hint line, not a tooltip.
 *
 * Turning it on both pins the request to the vendor's own API and bills one
 * credit tier up, so the copy says so rather than making the price jump look
 * like a glitch.
 */
export function AdvancedModeToggle({
  feature,
  modelId,
  value,
  onChange,
  temperature,
  maxTokens,
  defaultTemperature,
  defaultMaxTokens,
  structuredOutput,
}: AdvancedModeToggleProps) {
  const effectiveModel = modelId || LLM_FEATURE_DEFAULTS[feature]
  const supported = supportsAdvancedMode(effectiveModel)
  const on = value === true

  // Switching to a model that can't run advanced must clear the flag, not
  // leave it set-but-unreachable — the route would 400 on the next run and the
  // user would have no visible cause.
  useEffect(() => {
    if (on && !supported) onChange({ advancedMode: undefined })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveModel])

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label htmlFor={`advanced-${feature}`} className="text-xs font-medium text-muted-foreground">
          Advanced mode
        </Label>
        <Switch
          id={`advanced-${feature}`}
          checked={on && supported}
          disabled={!supported}
          // `undefined` rather than `false` when off, so a node that never
          // touched this stays byte-identical to a pre-feature workflow.
          onCheckedChange={(v) => onChange({ advancedMode: v ? true : undefined })}
        />
      </div>

      {!supported ? (
        <p className="text-[11px] text-muted-foreground">{ADVANCED_MODE_UNAVAILABLE_REASON}</p>
      ) : !on ? (
        <p className="text-[11px] text-muted-foreground">
          Run this model on the provider directly to control temperature, output length and reasoning
          depth. Costs one credit tier more.
        </p>
      ) : (
        <div className="space-y-2 pt-1">
          <div>
            <Label className="text-xs text-muted-foreground">
              Temperature: {(temperature ?? defaultTemperature ?? 0.7).toFixed(1)}
            </Label>
            <input
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={temperature ?? defaultTemperature ?? 0.7}
              onChange={(e) => onChange({ temperature: parseFloat(e.target.value) })}
              className="w-full mt-1 accent-[#ff0073]"
            />
            {structuredOutput && (
              <p className="text-[11px] text-muted-foreground mt-1">
                This node asks the model for structured output — above about 0.5 it starts breaking format.
              </p>
            )}
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Max Tokens</Label>
            <Input
              type="number"
              min={256}
              max={32768}
              step={256}
              value={maxTokens ?? defaultMaxTokens ?? 2048}
              onChange={(e) =>
                onChange({ maxTokens: parseInt(e.target.value, 10) || defaultMaxTokens || 2048 })
              }
              className="mt-1 bg-[#F8FAFC] dark:bg-[#121212] border-gray-200 dark:border-[#2D2D2D]"
            />
          </div>
        </div>
      )}
    </div>
  )
}
