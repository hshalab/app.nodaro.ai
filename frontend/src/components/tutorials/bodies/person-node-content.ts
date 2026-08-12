// Prose for the Person Node tutorial.
//
// The picks themselves are NOT here: they are read off the person/backdrop/
// framing/mood nodes and resolved to labels through the same catalogs the
// pickers use, so editing the template updates the tutorial.

/** Each lesson is one run: its input nodes and the image they produced. */
export const LESSONS = [
  {
    n: 1,
    title: "Meet the Person node",
    sub: "Picks become a written prompt",
    inputs: ["node_2"],
    result: "node_1",
    body: "Pick attributes and the node writes the character prompt for you. Open Final Prompt on Generate Image to see exactly what is sent to the model.",
    callout:
      "Try it: change one attribute and watch the prompt update. Anything you type in the Prompt field is combined with it.",
  },
  {
    n: 2,
    title: "Same node, different character",
    sub: "Change the picks, change everything",
    inputs: ["node_3"],
    result: "node_4",
    body: "Same Person node, different attributes, completely different result. Step 1 gave editorial street style; the same node here gives an intimate indoor portrait.",
  },
  {
    n: 3,
    title: "Stack nodes for full scene control",
    sub: "Scene, framing, mood, character",
    inputs: ["node_9", "node_6", "node_7", "node_8"],
    result: "node_5",
    body: "The same Person, now with Backdrop, Framing and Mood layered in. Each node adds its own description to the Final Prompt.",
    closing: "Same model, totally different shot. Swap one block and rerun.",
    /** How the parts of the prompt stack up, in the order they read. */
    order: ["scene", "framing", "mood", "character"],
  },
] as const

export const RAIL_STEPS = [
  { n: 1, title: "Meet the Person node", sub: "Seven picks become a written prompt" },
  { n: 2, title: "Same node, different character", sub: "Change the picks, change everything" },
  { n: 3, title: "Stack nodes for scene control", sub: "Backdrop, Framing and Mood on top" },
]

export const RAIL_NOTE = {
  eyebrow: "The pattern",
  body: "Compose images from modular blocks. Swap any node to iterate fast.",
}

/** Node type → the label shown above a stacked input card in lesson 3. */
export const KIND_LABELS: Record<string, string> = {
  person: "Person",
  backdrop: "Backdrop",
  framing: "Framing",
  mood: "Mood",
}
