/**
 * Community fallback for `@nodaroai/picker-ui` — the DEGRADED lane of the
 * two-mode seam (see ./index.ts).
 *
 * When the private package is not installed (community self-host, public CI),
 * the vite/vitest alias resolves `./rich-or-stub` to THIS module. Everything
 * here is functional but plain: single-dim pickers render the shared tile
 * grid with text-only tiles (no animated previews), multi-dim pickers render
 * one select per field from the public wiring's `fieldOptions`, and the
 * prompt editor falls back to the classic TagTextarea (no @-mention pills).
 *
 * This module is ALSO the seam's type contract: app code sees these types in
 * BOTH lanes (tsc never resolves the private package), so anything shared app
 * code consumes must exist here with a faithful signature. The rich package's
 * conformance to this contract is asserted by `npm run typecheck:picker-ui`
 * (internal CI, where the package is installed).
 */
import { useMemo, type ComponentType, type ReactNode } from "react"
import {
  SINGLE_PICKER_WIRING,
  MULTI_PICKER_WIRING,
  getPickerWiring,
  type PickerWiringEntry,
  type SingleDimPickerWiring,
  type MultiDimPickerWiring,
  type FramingValue,
  type LightingValue,
  type PersonValue,
  type StylingValue,
  type TemporalValue,
  type ExposureValue,
} from "@nodaro/prompts"
import type { I18nCatalogId, LocaleId } from "@nodaro/shared"
import { cn } from "@/lib/utils"
import { useLocalizedCatalog } from "@/hooks/use-localized-entry"
import { TagTextarea, type RefImageItem } from "@/components/editor/config-panels/tag-textarea"
import type { SnippetPoolItem } from "@/lib/snippet-pool"
import type { NodeRefItem } from "@/lib/node-refs"
import { DimensionTileGrid } from "./fallback/dimension-tile-grid"

// ─── Registry surface (same shapes the rich package exports) ────────────────

export interface PickerCatalogEntry extends PickerWiringEntry {}

interface BaseParameterPickerMeta {
  readonly nodeType: string
  readonly label: string
}

export interface SingleDimParameterPickerMeta extends BaseParameterPickerMeta {
  readonly kind: "single"
  readonly valueField: string
  readonly defaultValue: string
  readonly catalogId: I18nCatalogId
  readonly entries: ReadonlyArray<PickerCatalogEntry>
  readonly groupOrder?: ReadonlyArray<string>
  readonly groupLabels?: Readonly<Record<string, string>>
  readonly renderIcon?: (entryId: string) => ReactNode
}

export type MultiDimValue = Record<string, string | ReadonlyArray<string> | undefined>

export interface MultiDimParameterPickerMeta extends BaseParameterPickerMeta {
  readonly kind: "multi"
  readonly fields: ReadonlyArray<string>
  readonly catalogId: I18nCatalogId
  readonly catalogEntries: ReadonlyArray<{ readonly id: string; readonly label: string }>
  readonly Picker: ComponentType<{
    value: MultiDimValue
    onChange: (patch: MultiDimValue) => void
    className?: string
  }>
}

export type ParameterPickerMeta = SingleDimParameterPickerMeta | MultiDimParameterPickerMeta

// ─── Generic degraded pickers ───────────────────────────────────────────────

/** Same props shape as every rich single-dim picker (value + onValueChange). */
interface SinglePickerProps {
  readonly value: string
  readonly onValueChange: (id: string) => void
  readonly className?: string
}

/** Text-tile single-dim picker over the shared fallback grid (no previews). */
function makeSinglePicker(nodeType: string): ComponentType<SinglePickerProps> {
  const wiring = SINGLE_PICKER_WIRING.find((w) => w.nodeType === nodeType)
  function StubSinglePicker({ value, onValueChange, className }: SinglePickerProps) {
    if (!wiring) return null
    return (
      <DimensionTileGrid
        entries={wiring.entries}
        value={value}
        onChange={(v) => {
          const id = Array.isArray(v) ? v[0] : v
          if (typeof id === "string") onValueChange(id)
        }}
        renderIcon={() => null}
        catalog={wiring.catalogId}
        className={className}
      />
    )
  }
  StubSinglePicker.displayName = `Stub(${nodeType})`
  return StubSinglePicker
}

/** Multi-select-capable single-dim pickers (pick up to N) — same contract as
 *  the rich versions: value may be one id or an array; maxSelected caps it. */
interface MultiSelectSinglePickerProps {
  readonly value: string | ReadonlyArray<string> | undefined
  readonly onValueChange: (value: string | ReadonlyArray<string> | undefined) => void
  readonly className?: string
  readonly maxSelected?: number
}

function makeMultiSelectSinglePicker(nodeType: string): ComponentType<MultiSelectSinglePickerProps> {
  const wiring = SINGLE_PICKER_WIRING.find((w) => w.nodeType === nodeType)
  function StubMultiSelectPicker({ value, onValueChange, className, maxSelected = 1 }: MultiSelectSinglePickerProps) {
    if (!wiring) return null
    return (
      <DimensionTileGrid
        entries={wiring.entries}
        value={value}
        onChange={onValueChange}
        renderIcon={() => null}
        catalog={wiring.catalogId}
        className={className}
        maxSelected={maxSelected}
      />
    )
  }
  StubMultiSelectPicker.displayName = `Stub(${nodeType})`
  return StubMultiSelectPicker
}

/** Faithful per-picker value contracts — identical to the rich package's
 *  (structural mirror; the typecheck:picker-ui contract pass pins parity). */
export interface MusicGenreValue {
  readonly genre?: string | ReadonlyArray<string>
  readonly subgenre?: string
  readonly era?: string
}
export interface MusicMoodValue {
  readonly energy?: string
  readonly emotion?: string | ReadonlyArray<string>
  readonly vibe?: string | ReadonlyArray<string>
}
export interface InstrumentationValue {
  readonly instruments?: ReadonlyArray<string>
  readonly production?: string
  readonly vocalPresence?: string | ReadonlyArray<string>
  readonly singingStyle?: string | ReadonlyArray<string>
}
export interface VoiceCharacterValue {
  readonly age?: string
  readonly gender?: string
  readonly language?: string | ReadonlyArray<string>
  readonly accent?: string
  readonly timbre?: string
}
export interface VoiceDeliveryValue {
  readonly pace?: string
  readonly emotion?: string
  readonly archetype?: string
}

interface MultiPickerProps<V> {
  readonly value: V
  readonly onChange: (patch: Partial<V>) => void
  readonly className?: string
}

/** One labeled select per field, options from the public wiring. */
function makeMultiPicker<V extends object>(nodeType: string): ComponentType<MultiPickerProps<V>> {
  function StubMultiPicker({ value, onChange, className }: MultiPickerProps<MultiDimValue>) {
    const wiring = getPickerWiring(nodeType) as MultiDimPickerWiring | undefined
    const { resolveLabel } = useLocalizedCatalog((wiring?.catalogId ?? "setting") as I18nCatalogId)
    const fields = useMemo(() => wiring?.fields ?? [], [wiring])
    if (!wiring) return null
    return (
      <div className={cn("flex flex-col gap-2", className)}>
        {fields.map((field) => {
          const options = wiring.fieldOptions[field] ?? []
          const current = value[field]
          const currentId = Array.isArray(current) ? current[0] : current
          return (
            <label key={field} className="flex flex-col gap-1 text-xs">
              <span className="text-muted-foreground capitalize">{field.replace(/([A-Z])/g, " $1")}</span>
              <select
                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                value={currentId ?? ""}
                onChange={(e) => onChange({ [field]: e.target.value || undefined })}
              >
                <option value="">—</option>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {resolveLabel(o.id, o.label)}
                  </option>
                ))}
              </select>
            </label>
          )
        })}
      </div>
    )
  }
  StubMultiPicker.displayName = `Stub(${nodeType})`
  return StubMultiPicker as unknown as ComponentType<MultiPickerProps<V>>
}

// ─── Registry (data from wiring, degraded renderers) ────────────────────────

export const SINGLE_PICKERS: ReadonlyArray<SingleDimParameterPickerMeta> =
  SINGLE_PICKER_WIRING.map((w: SingleDimPickerWiring) => ({ ...w }))

export const MULTI_PICKERS: ReadonlyArray<MultiDimParameterPickerMeta> =
  MULTI_PICKER_WIRING.map((w: MultiDimPickerWiring) => ({
    kind: "multi" as const,
    nodeType: w.nodeType,
    label: w.label,
    fields: w.fields,
    catalogId: w.catalogId,
    catalogEntries: w.catalogEntries,
    Picker: makeMultiPicker(w.nodeType),
  }))

export const ALL_PARAMETER_PICKERS: ReadonlyArray<ParameterPickerMeta> = [
  ...SINGLE_PICKERS,
  ...MULTI_PICKERS,
]

const PICKER_MAP = new Map<string, ParameterPickerMeta>(ALL_PARAMETER_PICKERS.map((p) => [p.nodeType, p]))

export function getParameterPickerMeta(nodeType: string | undefined | null): ParameterPickerMeta | undefined {
  if (!nodeType) return undefined
  return PICKER_MAP.get(nodeType)
}

export { isParameterPickerNode } from "@/lib/parameter-picker-types"

// ─── Named picker components (contract parity with the rich package) ────────

export const SettingPicker = makeSinglePicker("setting")
export const StylePicker = makeSinglePicker("style")
export const ColorLookPicker = makeSinglePicker("color-look")
export const EraPicker = makeSinglePicker("era")
export const PhotoGenrePicker = makeSinglePicker("photo-genre")
export const BackdropPicker = makeSinglePicker("backdrop")
export const RenderQualityPicker = makeSinglePicker("render-quality")
export const CompositionEffectsPicker = makeSinglePicker("composition-effects")
export const LoopSubjectPicker = makeSinglePicker("loop-subject")
export const CameraMotionPicker = makeSinglePicker("camera-motion")
export const LensPicker = makeSinglePicker("lens")
export const CameraFormatPicker = makeSinglePicker("camera-format")
export const PosePicker = makeSinglePicker("pose")
export const AnimalPicker = makeSinglePicker("animal")
export const VehiclePicker = makeSinglePicker("vehicle")
export const WeaponPicker = makeSinglePicker("weapon")
export const FurniturePicker = makeSinglePicker("furniture")

// Multi-select-capable (pick up to N) — mirrors the rich union contract.
export const AtmospherePicker = makeMultiSelectSinglePicker("atmosphere")
export const PhotographerPicker = makeMultiSelectSinglePicker("photographer")
export const AestheticPicker = makeMultiSelectSinglePicker("aesthetic")
export const ActionFxPicker = makeMultiSelectSinglePicker("action-fx")
export const PostProcessEffectsPicker = makeMultiSelectSinglePicker("post-process-effects")
export const TransitionPicker = makeMultiSelectSinglePicker("transition")
export const CharacterFxPicker = makeMultiSelectSinglePicker("character-fx")
export const MaterialPicker = makeMultiSelectSinglePicker("material")
export const HeldPropPicker = makeMultiSelectSinglePicker("held-prop")

/** Combine-videos transition picker — distinct rich contract (value/onChange). */
export function CombineTransitionPicker({ value, onChange }: { readonly value: string; readonly onChange: (id: string) => void }): ReactNode {
  const Inner = TransitionStubForCombine
  return <Inner value={value} onValueChange={(v) => { const id = Array.isArray(v) ? v[0] : v; if (typeof id === "string") onChange(id) }} />
}
const TransitionStubForCombine = makeMultiSelectSinglePicker("transition")

export const FramingPicker = makeMultiPicker<FramingValue>("framing")
export const LightingPicker = makeMultiPicker<LightingValue>("lighting")
export const PersonPicker = makeMultiPicker<PersonValue>("person")
export const StylingPicker = makeMultiPicker<StylingValue>("styling")
export const TemporalPicker = makeMultiPicker<TemporalValue>("temporal")
export const ExposureSettingsPicker = makeMultiPicker<ExposureValue>("exposure-settings")
export const MusicGenrePicker = makeMultiPicker<MusicGenreValue>("music-genre")
export const MusicMoodPicker = makeMultiPicker<MusicMoodValue>("music-mood")
export const InstrumentationPicker = makeMultiPicker<InstrumentationValue>("instrumentation")
export const VoiceCharacterPicker = makeMultiPicker<VoiceCharacterValue>("voice-character")
export const VoiceDeliveryPicker = makeMultiPicker<VoiceDeliveryValue>("voice-delivery")

// ─── Preview placeholders (no animations in the community lane) ─────────────
// Each declares the SAME required id prop as its rich counterpart so the
// contract check pins prop parity; all render nothing in the stub lane.

function nullPreview<P>(): (props: P) => ReactNode {
  return () => null
}

export const SettingPreview = nullPreview<{ settingId: string; className?: string }>()
export const AtmospherePreview = nullPreview<{ atmosphereId: string; className?: string }>()
export const StylePreview = nullPreview<{ styleId: string; className?: string }>()
export const ColorLookPreview = nullPreview<{ colorLookId: string; className?: string }>()
export const CameraMotionPreview = nullPreview<{ motionId: string; className?: string }>()
export const LensPreview = nullPreview<{ lensId: string; variant?: "scene" | "hybrid"; className?: string }>()
export const CameraFormatPreview = nullPreview<{ cameraFormatId: string; className?: string }>()
export const FramingPreview = nullPreview<{ framingId: string; className?: string }>()
export const LightingPreview = nullPreview<{ lightingId: string; className?: string }>()
export const TemporalPreview = nullPreview<{ temporalId: string; className?: string }>()
export const MaterialPreview = nullPreview<{ materialId: string; className?: string }>()
export const MoodEmoji = nullPreview<{ moodId: string; className?: string }>()
export const PoseIcon = nullPreview<{ poseId: string; className?: string }>()

// Small silhouette icons (person/styling dimension chips) — text-only fallback.
export const FacialHairIcon = nullPreview<{ facialHairId: string; className?: string }>()
export const EyewearIcon = nullPreview<{ eyewearId: string; className?: string }>()
export const HeadwearIcon = nullPreview<{ headwearId: string; className?: string }>()
export const FaceShapeIcon = nullPreview<{ id: string; className?: string }>()
export const JawlineIcon = nullPreview<{ id: string; className?: string }>()
export const EyeShapeIcon = nullPreview<{ id: string; className?: string }>()
export const NoseIcon = nullPreview<{ id: string; className?: string }>()
export const LipsIcon = nullPreview<{ id: string; className?: string }>()

// ─── Shared functional pieces (re-exported from public app copies) ──────────

export { DimensionTileGrid, TileCommitContext } from "./fallback/dimension-tile-grid"
export { createRovingTabIndexRef, handleConfigPanelNavKeyDown, applyRovingTabIndex, estimateGridCols, isArrowKey, nextNavIndex } from "./fallback/config-keyboard-nav"
export type { DimensionEntry } from "./fallback/types"

/** Detailed person editor (character studio) — degraded to per-field selects. */
export const PersonPickerDetailed = makeMultiPicker<PersonValue>("person")
export {
  PROMPT_EDITOR_PORTAL_ATTR,
  PROMPT_EDITOR_PORTAL_PROPS,
  isPromptEditorPortalInteraction,
} from "@/lib/prompt-editor-portal"
export { computeFlipPosition } from "@/lib/flip-position"

// ─── i18n provider (passthrough — app hooks already read the app store) ─────

export function PickerUiProvider({ children }: { locale?: LocaleId; dir?: "ltr" | "rtl"; children: ReactNode }) {
  return <>{children}</>
}

// ─── PromptEditor fallback (plain TagTextarea — no @-mention pills) ─────────

export interface PromptEditorProps {
  readonly value: string
  readonly onChange: (value: string) => void
  readonly placeholder?: string
  readonly rows?: number
  readonly maxRows?: number
  readonly className?: string
  readonly scrollable?: boolean
  readonly referenceImages?: readonly RefImageItem[]
  readonly nodeRefs?: readonly NodeRefItem[]
  readonly refMap?: ReadonlyMap<string, string>
  readonly snippets?: readonly SnippetPoolItem[]
  readonly onFocus?: () => void
  readonly onBlur?: () => void
  readonly bare?: boolean
}

export function PromptEditor({
  value,
  onChange,
  placeholder,
  rows,
  className,
  referenceImages,
  nodeRefs,
  refMap,
  snippets,
}: PromptEditorProps) {
  return (
    <TagTextarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      className={className}
      referenceImages={referenceImages}
      nodeRefs={nodeRefs}
      refMap={refMap}
      snippets={snippets}
    />
  )
}

/** Mode marker for diagnostics ("stub" here; the rich package reports "rich"). */
export const PICKER_UI_MODE = "stub" as const
