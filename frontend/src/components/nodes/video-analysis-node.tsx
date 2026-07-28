"use client"

import { memo, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { Position, type NodeProps } from "@xyflow/react"
import { ScanSearch, Film, Braces, Type, Loader2, AlertCircle, Copy, Expand, X } from "lucide-react"
import { JsonTree, type JsonNodeLabeler, type JsonValue } from "@/components/ui/json-tree"
import { BaseNode } from "./base-node"
import { NodeQuickStrip } from "./node-quick-strip"
import { EditableNodeLabel } from "./editable-node-label"
import { HandleWithPopover, HANDLE_COLORS } from "./handle-with-popover"
import { NodeJobProgress } from "./node-job-progress"
import { useWorkflowStore } from "@/hooks/use-workflow-store"
import { useModelCredits } from "@/ee/hooks/use-model-credits"
import { useUpstreamVideoDuration } from "@/hooks/use-upstream-video-duration"
import { ACCEPTS_VIDEO } from "@/lib/ffmpeg-handles"
import { DATA_HANDLE_COLORS } from "@/lib/data-handles"
import { buildVideoAnalysisCreditId, resolveVideoAnalysisModel } from "@nodaro/shared"
import type { VideoAnalysisResult } from "@nodaro/shared"
import type { VideoAnalysisNodeData } from "@/types/nodes"

const secs = (n: unknown) => (typeof n === "number" ? n.toFixed(1) : String(n))
const clip = (s: unknown, n = 44) => {
  const t = String(s)
  return t.length > n ? `${t.slice(0, n - 1)}…` : t
}

/**
 * Domain summaries for the result tree — the only schema knowledge in play.
 * Array items are the rows a user scans, so each gets the identity it is
 * actually looked up by (`#8 · 10.8–16.8s · intimacy`) instead of `[7]`.
 * Everything else falls through to the generic key/value rendering, so the tree
 * still mirrors the payload exactly.
 */
function useAnalysisLabeler(result: VideoAnalysisResult | undefined): JsonNodeLabeler {
  return useMemo(() => {
    const slotLabels = new Map((result?.slots ?? []).map((s) => [s.slotId, s.label]))
    return (path, value) => {
      if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined
      const v = value as Record<string, JsonValue>

      // slots[i] / scenes[i]
      if (path.length === 2 && typeof path[1] === "number") {
        if (path[0] === "slots") return `${v.slotId} · ${v.label} · ${String(v.source).replace("wired-", "")}`
        if (path[0] === "scenes") return `#${v.sceneNumber} · ${secs(v.startSec)}–${secs(v.endSec)}s · ${v.label}`
      }
      if (path.length !== 4 || typeof path[3] !== "number") return undefined

      // scenes[i].audio[j] — where speech attribution surfaces. Falls back to the
      // voice-casting note while the analyzer has no `speakerSlot` to give.
      if (path[0] === "scenes" && path[2] === "audio") {
        const who = typeof v.speakerSlot === "string" ? slotLabels.get(v.speakerSlot) ?? v.speakerSlot : v.voice
        return [String(v.mode), who ? clip(who, 24) : undefined, `“${clip(v.content)}”`].filter(Boolean).join(" · ")
      }
      // slots[i].variations[j]
      if (path[0] === "slots" && path[2] === "variations") return `${v.variationId} · ${v.label}`
      return undefined
    }
  }, [result])
}

function ResultTreeModal({
  isOpen, onClose, result, labelFor,
}: {
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly result: VideoAnalysisResult
  readonly labelFor: JsonNodeLabeler
}) {
  if (!isOpen) return null
  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-8" onClick={onClose}>
      <div
        className="relative w-full max-w-3xl max-h-[85vh] bg-background rounded-lg border border-border shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <ScanSearch className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Video Analysis</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {result.scenes.length} scenes · {result.slots.length} slots · {result.meta.durationSec.toFixed(1)}s
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="text-xs px-2 py-1 rounded bg-muted hover:bg-muted/80 transition-colors"
              onClick={() => navigator.clipboard.writeText(JSON.stringify(result, null, 2))}
            >
              Copy JSON
            </button>
            <button type="button" aria-label="Close" className="text-muted-foreground hover:text-foreground" onClick={onClose}>
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="overflow-auto p-4">
          <JsonTree value={result as unknown as JsonValue} labelFor={labelFor} className="text-[11px]" />
        </div>
      </div>
    </div>,
    document.body,
  )
}

function VideoAnalysisNodeComponent({ id, data, selected }: NodeProps) {
  const nodeData = data as VideoAnalysisNodeData
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData)
  const status = nodeData.executionStatus ?? "idle"
  const result = nodeData.generatedJson
  const scenes = result?.scenes ?? []

  // Duration for the credit-bucket estimate: a probed YouTube duration wins
  // (only while it still matches the node's current youtubeUrl), else the wired
  // upstream video's duration, else undefined → buildVideoAnalysisCreditId's
  // ceiling composite. Display only; the real reservation is computed
  // server-side from the actual video length (ffprobe is authoritative).
  const upstreamDuration = useUpstreamVideoDuration(id, "video")
  const probedDuration =
    nodeData.probedYoutube && nodeData.probedYoutube.url === nodeData.youtubeUrl
      ? nodeData.probedYoutube.durationSec
      : undefined
  // Resolve the tier ("fast"/"pro") or raw model to the internal model (default
  // pro) so the pre-run credit estimate matches what the server charges.
  const model = resolveVideoAnalysisModel(nodeData.llmModel)
  const creditModelId = useMemo(
    () => buildVideoAnalysisCreditId(model, probedDuration ?? upstreamDuration ?? undefined),
    [model, probedDuration, upstreamDuration],
  )
  const credits = useModelCredits(creditModelId)
  const [treeOpen, setTreeOpen] = useState(false)
  const labelFor = useAnalysisLabeler(result)

  return (
    <div className="relative max-w-[240px]">
      <EditableNodeLabel
        label={nodeData.label}
        icon={<ScanSearch className="w-3.5 h-3.5" />}
        onSave={(newLabel) => updateNodeData(id, { label: newLabel })}
      />
      <BaseNode
        id={id}
        label={nodeData.label}
        icon={<ScanSearch className="h-4 w-4" />}
        category="processing"
        credits={credits}
        selected={selected}
        isRunning={status === "running"}
        minWidth={240}
        hideHeader
        topToolbarContent={
          <NodeQuickStrip nodeId={id} credits={credits} isRunning={status === "running"} />
        }
        handles={[
          { id: "video", type: "target", position: Position.Left,  customStyle: { top: 'calc(100% - 24px)', left: '-29px' }, external: true },
          { id: "json",  type: "source", position: Position.Right, customStyle: { top: '24px',              right: '-29px' }, external: true },
          { id: "text",  type: "source", position: Position.Right, customStyle: { top: '52px',              right: '-29px' }, external: true },
        ]}
      >
        <div className="flex flex-col gap-2 p-3" style={{ minHeight: 160 }}>
          {status === "running" && (
            <div className="flex flex-col items-center justify-center gap-2 h-16 rounded-md bg-muted/30">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              <NodeJobProgress progress={nodeData.currentJobProgress} />
            </div>
          )}

          {status === "failed" && (
            <div className="flex flex-col items-center justify-center gap-1 h-16 rounded-md bg-red-500/5 text-red-500 p-2">
              <div className="flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="font-medium">Failed</span>
              </div>
              {nodeData.errorMessage && (
                <p className="text-[10px] text-center text-red-400 line-clamp-2" title={nodeData.errorMessage}>
                  {nodeData.errorMessage}
                </p>
              )}
            </div>
          )}

          {status !== "running" && result && scenes.length > 0 && (
            <div className="relative group">
              {/* A TREE, not a flat scene list. The old preview showed one array
                  and hid everything else the payload carries — slots, per-scene
                  audio layers, variation bindings, meta. Rows are closed one
                  level deep, so this renders as a scannable index the user
                  drills into; the node is narrow, so real inspection happens in
                  the expanded modal. No truncation: height is bounded by
                  max-h + scroll, so a long value costs scroll, never content. */}
              <div className="rounded-md border bg-muted/30 max-h-64 overflow-auto p-1.5">
                <JsonTree value={result as unknown as JsonValue} labelFor={labelFor} />
              </div>
              <div className="absolute -top-1 -right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  aria-label="Expand result"
                  className="w-6 h-6 flex items-center justify-center bg-black/40 backdrop-blur-sm hover:bg-black/60 border border-white/10 text-white rounded-full shadow-sm"
                  onClick={(e) => { e.stopPropagation(); setTreeOpen(true) }}
                >
                  <Expand className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  aria-label="Copy JSON"
                  className="w-6 h-6 flex items-center justify-center bg-black/40 backdrop-blur-sm hover:bg-black/60 border border-white/10 text-white rounded-full shadow-sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    navigator.clipboard.writeText(JSON.stringify(result, null, 2))
                  }}
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {status !== "running" && status !== "failed" && scenes.length === 0 && (
            <div
              className="flex flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-muted-foreground/20 text-muted-foreground/40"
              style={{ minHeight: 120, flex: 1 }}
            >
              <ScanSearch className="w-6 h-6" />
              <span className="text-[10px]">Connect a video or set a URL</span>
            </div>
          )}
        </div>
      </BaseNode>
      <HandleWithPopover nodeId={id} nodeType="video-analysis" handleId="video" type="target" position={Position.Left}  label="Video"       color={HANDLE_COLORS.video}    icon={<Film />}   side="left"  top="calc(100% - 24px)" accepts={ACCEPTS_VIDEO} />
      <HandleWithPopover nodeId={id} nodeType="video-analysis" handleId="json"  type="source" position={Position.Right} label="Scenes JSON" color={DATA_HANDLE_COLORS.json} icon={<Braces />} side="right" top="24px" />
      {/* Same payload as `json`, typed as TEXT — wires straight into prompt/
          text inputs (extractNodeOutput stringifies for both handles). */}
      <HandleWithPopover nodeId={id} nodeType="video-analysis" handleId="text"  type="source" position={Position.Right} label="Text"        color={DATA_HANDLE_COLORS.text} icon={<Type />}   side="right" top="52px" />
      {result && (
        <ResultTreeModal isOpen={treeOpen} onClose={() => setTreeOpen(false)} result={result} labelFor={labelFor} />
      )}
    </div>
  )
}

export const VideoAnalysisNode = memo(VideoAnalysisNodeComponent)
