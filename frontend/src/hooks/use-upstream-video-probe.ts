/**
 * Read the DURATION of a wired upstream video by loading its metadata, and cache
 * it on the node.
 *
 * Why this exists: a duration-priced node has to know how long the video is to
 * quote a price, and for a WIRED video the frontend previously had no reliable way
 * to find out. `useUpstreamVideoDuration` inspects the source node's data for a
 * duration field, which only works when that particular producer happens to store
 * one — so the video-analysis badge fell back to the `:600s` ceiling and quoted
 * 200 credits for a 30-second clip (reported 2026-07-28). The reservation is
 * computed server-side from the real length, so the number on screen was ~6x the
 * number charged.
 *
 * This asks the video itself instead of the producer's data shape. `preload =
 * "metadata"` fetches only the container header, and the result is cached on the
 * node under the SAME url-bound shape as `probedYoutube` — so it is invalidated
 * automatically when the upstream changes, and never trusted for a different url.
 *
 * The upstream url comes from `extractNodeOutput`, the single source of truth the
 * DAG itself uses, rather than a hand-kept list of url field names — which is the
 * class of bug this hook is fixing.
 */

import { useCallback, useEffect } from "react"
import { useWorkflowStore } from "@/hooks/use-workflow-store"
import { extractNodeOutput } from "@/components/editor/workflow-editor/execution-graph"

export interface ProbedVideo {
  url: string
  durationSec: number
}

export function useUpstreamVideoProbe(
  id: string,
  handleId: string,
  probed: ProbedVideo | undefined,
  updateNodeData: (id: string, data: Record<string, unknown>) => void,
): number | undefined {
  const url = useWorkflowStore(
    useCallback(
      (s) => {
        const edge = s.edges.find((e) => e.target === id && e.targetHandle === handleId)
        if (!edge) return undefined
        const src = s.nodes.find((n) => n.id === edge.source)
        if (!src) return undefined
        const out = extractNodeOutput(src, edge.sourceHandle ?? undefined)
        // extractNodeOutput also yields text/JSON payloads for data handles; only a
        // real http(s) url is loadable, and anything else must not be probed.
        return typeof out === "string" && /^https?:\/\//i.test(out) ? out : undefined
      },
      [id, handleId],
    ),
  )

  useEffect(() => {
    // Already known for THIS url, or nothing wired — no fetch.
    if (!url || probed?.url === url) return
    let cancelled = false
    const el = document.createElement("video")
    el.preload = "metadata"
    el.muted = true
    const cleanup = () => {
      el.removeAttribute("src")
      el.load() // abort the in-flight range request rather than leaving it hanging
    }
    const onLoaded = () => {
      const d = el.duration
      cleanup()
      if (!cancelled && Number.isFinite(d) && d > 0) {
        updateNodeData(id, { probedVideo: { url, durationSec: d } })
      }
    }
    // A failed probe stays silent: the caller falls back to the ceiling, which is
    // the pre-existing behaviour and never under-quotes.
    el.addEventListener("loadedmetadata", onLoaded, { once: true })
    el.addEventListener("error", cleanup, { once: true })
    el.src = url
    return () => {
      cancelled = true
      el.removeEventListener("loadedmetadata", onLoaded)
      cleanup()
    }
  }, [id, url, probed?.url, updateNodeData])

  return probed && probed.url === url ? probed.durationSec : undefined
}
