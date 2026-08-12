// Prose for the Social Media Autopilot tutorial.
//
// The step chain names the nodes it reads from; everything shown inside a step
// (excerpts, slide lines, thumbnails, the caption, the post) comes off those
// nodes at render time.

export const HEADLINE = "Paste an idea. Get a published Instagram carousel."
export const SUBLINE =
  "Seven nodes do the rest: they split your text into slides, draw an image for each one, write the caption, and post it."
export const HEADLINE_CHIPS = ["10 slides max", "one image per slide", "runs unattended"]

export const HERO = {
  in: { badge: "IN", title: "What you give it", sub: "One block of text. Nothing else." },
  out: { badge: "OUT", title: "What you get back", sub: "Ten images, a caption, and a live post" },
  connector: ["7 STEPS", "BELOW"],
}

export const CHAIN_HEADING = {
  title: "How it gets from one to the other",
  note: "Each step below shows a piece of what it actually produced on this run.",
}

/**
 * The seven steps, each pointing at the node whose real output it previews.
 * `node` is matched by label first, then by type — the template's ids are
 * generated, but the labels are authored and stable.
 */
export const STEPS = [
  { n: 1, kind: "Reads", title: "Your idea", line: "The text you pasted, untouched.", label: "Text Prompt" },
  { n: 2, kind: "Constrains", title: "The rules", line: "What it must and must not do.", label: "System" },
  { n: 3, kind: "Writes", title: "Slide copy", line: "One line of copy per slide.", label: "LLM Chat" },
  { n: 4, kind: "Splits", title: "Ten slides", line: "The script becomes rows.", label: "Carousel Script" },
  { n: 5, kind: "Draws", title: "One image each", line: "A picture per slide, in sequence.", label: "Generate Image" },
  { n: 6, kind: "Writes", title: "The caption", line: "Hook, question, hashtags.", label: "LLM Chat-Hook Generator" },
  { n: 7, kind: "Posts", title: "Formats and posts", line: "Sized for the feed, then published.", label: "Instagram Post" },
] as const

export const SLIDE_PREVIEW_COUNT = 2
export const OTHER_SLIDES_LABEL = "The other nine slides"
export const CAPTION_LABEL = "The caption it wrote"
export const POST_CAPTION = "slide 1 of 10, square feed"
