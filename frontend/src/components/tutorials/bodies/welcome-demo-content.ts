// Prose for the Welcome Demo tutorial.
//
// As with the other tutorials, only text that has no home in the workflow lives
// here. Prompts, model names, results, durations and the voice settings are all
// read from the template snapshot at render time.

/** The node each step is about. Ids are stable — the demo workflow is seeded
 *  from `backend/src/lib/demo-workflow.ts`, not drawn by hand. */
export const NODE_IDS = {
  idea: "demo-idea",
  image: "demo-image",
  video: "demo-video",
  narration: "demo-narration",
  voice: "demo-voice",
  final: "demo-final",
} as const

export const GROUP_TITLES = {
  idea: { title: "Scene Idea", sub: "One sentence, in plain words" },
  image: { title: "Scene Image", sub: "The sentence becomes a frame" },
  video: { title: "Animate", sub: "The frame becomes five seconds" },
  audio: { title: "Narration and Voiceover", sub: "A second, separate chain" },
  final: { title: "Final Cut", sub: "Video in, voice in, one file out" },
} as const

/** The single most useful thing to say about the first node. */
export const IDEA_CALLOUT = "This is the one line to change first."

export const RAIL_NOTE = {
  eyebrow: "Nothing here costs anything to look at",
  body: "Every result is already generated. Edit the Scene Idea and press Run on Scene Image when you want it to be yours.",
}

/** Where Final Cut's two inputs come from, in the reader's terms rather than
 *  node ids. */
export const FINAL_INPUTS = ["Video from 03", "Voiceover from 04"] as const
