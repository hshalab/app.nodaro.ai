// The Underwater Giants tutorial.
//
// Shares the headline + IN→OUT + step-chain frame with Social Media Autopilot,
// because the design deliberately reuses it: both templates are "one input, one
// published post", and giving them different furniture would have made two
// things look unrelated that are not.
//
// What is new here is the TRACED SCENE. This template runs the same eight-step
// journey eight times over, so the way to teach it is to follow ONE scene all
// the way down — its prompt, its still, its motion, its clip in the timeline —
// rather than describe the machine. Clicking a clip re-traces everything.

import { useMemo, useState } from "react"
import { nodeText, nodeMedia } from "../derive-tutorial-data"
import { TutorialAudio } from "../tutorial-audio"
import { TutorialVideo } from "../tutorial-video"
import { TutorialLightbox, useLightbox } from "../tutorial-lightbox"
import type { TutorialBodyProps } from "../tutorial-registry"
import type { WorkflowNode } from "@/types/nodes"
import "./autopilot.css"
import "./underwater.css"

const HEADLINE = "Write eight scenes. Get a finished cinematic reel."
const SUBLINE =
  "Every scene becomes an image, every image becomes a five second shot, and the flow edits them together with music and posts the result."
const CHIPS = ["8 scenes", "34 second reel", "9:16 vertical"]

/** Labels in this template carry stray double spaces ("Scene 7  Text Prompt"),
 *  so every lookup goes through the same normaliser rather than exact text. */
const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase()

const STEPS = [
  { n: 1, kind: "You edit", title: "The eight scenes", line: "One written scene each.", node: "Scene N Text Prompt" },
  { n: 2, kind: "Draws", title: "Eight stills", line: "4K, 9:16, anchored to the last.", node: "Generate Image" },
  { n: 3, kind: "Animates", title: "Eight shots", line: "Five seconds of motion each.", node: "Generate Video" },
  { n: 4, kind: "Edits", title: "One continuous cut", line: "Eight clips, cross-faded.", node: "Combine Videos" },
  { n: 5, kind: "Scores", title: "The music", line: "A track written for it.", node: "Suno Generate" },
  { n: 6, kind: "Finishes", title: "Mix and trim", line: "Levels, length, format.", node: "Merge · Trim · Format" },
  { n: 7, kind: "Posts", title: "Published as a reel", line: "Straight to the feed.", node: "Instagram Post" },
] as const

const SCENE_COUNT = 8

export default function UnderwaterBody({ nodes }: TutorialBodyProps) {
  const [scene, setScene] = useState(1)
  const lightbox = useLightbox()

  const byLabel = useMemo(() => {
    const m = new Map<string, WorkflowNode>()
    for (const n of nodes) {
      const l = (n.data as Record<string, unknown> | undefined)?.label
      if (typeof l === "string" && !m.has(norm(l))) m.set(norm(l), n)
    }
    return m
  }, [nodes])

  const get = (label: string) => byLabel.get(norm(label))
  const scenePrompt = (i: number) => nodeText(get(`Scene ${i} Text Prompt`))
  const sceneStill = (i: number) => nodeMedia(get(`Scene ${i}`))
  const sceneShot = (i: number) => nodeMedia(get(`Scene ${i} video`))
  const sceneMotion = (i: number) => nodeText(get(`Scene ${i} video`))

  const stills = Array.from({ length: SCENE_COUNT }, (_, i) => sceneStill(i + 1))
  const finalReel = nodeMedia(get("Social Media Format")) ?? nodeMedia(get("Trim Video"))
  const music = nodeMedia(get("Suno Generate"))
  const caption = nodeText(get("Caption / Post Text"))
  const postThumb = nodeMedia(get("Instagram Post")) ?? stills[0]

  const preview = (label: string): React.ReactNode => {
    switch (label) {
      case "Scene N Text Prompt":
        return <span className="uw-clamp">{scenePrompt(scene) || "—"}</span>
      case "Generate Image": {
        const url = sceneStill(scene)
        return (
          <div className="uw-trace">
            {url && (
              <span
                className="uw-still tl-openable"
                style={{ backgroundImage: `url(${url})` }}
                role="button"
                tabIndex={0}
                aria-label={`Open scene ${scene} still`}
                onClick={() => lightbox.show(url, `Scene ${scene}`)}
              />
            )}
            <span>
              <span className="uw-scene-tag">Scene {String(scene).padStart(2, "0")}</span>
              <span className="uw-ref">
                {/* The insight the sticky notes never state but the graph does. */}
                {scene === 1
                  ? "The first image sets the look. Every later scene is anchored to it."
                  : `Generated with scene ${scene - 1}'s image as reference.`}
              </span>
            </span>
          </div>
        )
      }
      case "Generate Video":
        return <span className="uw-clamp">{sceneMotion(scene) || "—"}</span>
      case "Combine Videos":
        return (
          <div>
            <div className="uw-timeline">
              {stills.map((url, i) => (
                <button
                  key={i}
                  type="button"
                  className="uw-clip"
                  data-active={scene === i + 1}
                  style={url ? { backgroundImage: `url(${url})` } : undefined}
                  onClick={() => setScene(i + 1)}
                  aria-label={`Trace scene ${i + 1}`}
                  aria-pressed={scene === i + 1}
                />
              ))}
            </div>
            <div className="uw-note">
              clip {scene} of {SCENE_COUNT}, around {(scene - 1) * 5}s in · fade between clips
            </div>
          </div>
        )
      case "Suno Generate":
        return music ? (
          <div>
            <span className="uw-clamp uw-clamp--short">{nodeText(get("Suno Text Prompt"))}</span>
            <div style={{ marginTop: 8 }}>
              <TutorialAudio src={music} label="the score" />
            </div>
          </div>
        ) : (
          "—"
        )
      case "Merge · Trim · Format":
        return (
          <div className="uw-specs">
            <span>MUSIC · under the shots</span>
            <span>TRIM · 0:00 – 0:34</span>
            <span>FORMAT · vertical, 9:16</span>
          </div>
        )
      case "Instagram Post":
        return (
          <div className="ap-post-mini">
            <span
              className="ap-post-mini-img"
              style={postThumb ? { backgroundImage: `url(${postThumb})` } : undefined}
            />
            <span className="ap-live-text">live on instagram</span>
          </div>
        )
      default:
        return "—"
    }
  }

  return (
    <div className="ap">
      <header className="ap-headline">
        <div style={{ minWidth: 0 }}>
          <h1>{HEADLINE}</h1>
          <p className="ap-subline">{SUBLINE}</p>
        </div>
        <div className="ap-headline-chips">
          {CHIPS.map((c) => (
            <span key={c} className="nd-chip">
              {c}
            </span>
          ))}
        </div>
      </header>

      <div className="ap-hero">
        <section className="ap-card">
          <header className="ap-card-head">
            <span className="ap-io-badge">IN</span>
            <div>
              <div className="ap-card-title">What you write</div>
              <div className="ap-card-sub">Eight scenes, in your own words</div>
            </div>
          </header>
          <div className="ap-card-body">
            <div className="ap-input">
              {/* The traced scene, so IN and the chain always agree. */}
              <div className="uw-scene-tag" style={{ marginBottom: 8 }}>
                Scene {String(scene).padStart(2, "0")} of {SCENE_COUNT}
              </div>
              {scenePrompt(scene) || "—"}
            </div>
          </div>
        </section>

        <div className="ap-connector">
          <span className="ap-connector-bar" />
          <span className="ap-connector-text">
            7 STEPS
            <br />
            BELOW
          </span>
        </div>

        <section className="ap-card ap-card--out">
          <header className="ap-card-head">
            <span className="ap-io-badge ap-io-badge--out">OUT</span>
            <div style={{ minWidth: 0 }}>
              <div className="ap-card-title">What you get back</div>
              <div className="ap-card-sub">One 34-second reel, scored and posted</div>
            </div>
          </header>
          <div className="ap-out-body">
            <div className="uw-reel">
              {finalReel ? (
                <TutorialVideo src={finalReel} poster={stills[0] ?? undefined} />
              ) : (
                <div className="ap-post-img" />
              )}
            </div>
            <div className="ap-out-right">
              <div className="nd-eyebrow">The eight shots</div>
              <div className="uw-shots">
                {stills.map((url, i) => (
                  <button
                    key={i}
                    type="button"
                    className="uw-shot"
                    data-active={scene === i + 1}
                    style={url ? { backgroundImage: `url(${url})` } : undefined}
                    onClick={() => setScene(i + 1)}
                    aria-label={`Trace scene ${i + 1}`}
                    aria-pressed={scene === i + 1}
                  />
                ))}
              </div>
              {caption && (
                <>
                  <div className="nd-eyebrow" style={{ marginTop: 6 }}>
                    The caption
                  </div>
                  <p className="ap-hook">{caption.slice(0, 280)}</p>
                </>
              )}
            </div>
          </div>
        </section>
      </div>

      <div className="ap-chain-head">
        <h2>How it gets from one to the other</h2>
        <p className="ap-chain-note">
          Following scene {String(scene).padStart(2, "0")} — click any shot above to follow a different one.
        </p>
      </div>

      <div className="ap-chain">
        {STEPS.map((step, i) => (
          <span key={step.n} style={{ display: "contents" }}>
            {i > 0 && <span className="ap-link" />}
            <section className={`ap-step${i === STEPS.length - 1 ? " ap-step--last" : ""}`}>
              <div className="ap-step-top">
                <span className="ap-step-badge">{step.n}</span>
                <span className="ap-step-kind">{step.kind}</span>
              </div>
              <div className="ap-step-title">{step.title}</div>
              <div className="ap-step-line">{step.line}</div>
              <div className="ap-preview">{preview(step.node)}</div>
              <div className="ap-step-node">{step.node}</div>
            </section>
          </span>
        ))}
      </div>

      {lightbox.open && (
        <TutorialLightbox src={lightbox.open.src} alt={lightbox.open.alt} onClose={lightbox.hide} />
      )}
    </div>
  )
}
