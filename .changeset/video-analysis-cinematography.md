---
"@nodaro/shared": minor
---

Video-analysis captures camera angle, time manipulation, on-screen text, and the clip-level look.

Four gaps in the scene contract, all of them things a recreation needs and could
not read:

- **`angle`** (per scene, optional enum) — the camera VIEWPOINT axis, which
  nothing carried. Vertical placement and roll (`eye-level`, `low`, `high`,
  `overhead`, `worms-eye`, `dutch`) plus the relational viewpoints
  (`over-the-shoulder`, `pov`, `profile`, `from-behind`). Two failures it fixes:
  a true angle had nowhere to live and was improvised into the MOVEMENT field
  (`"camera": "low angle static"` shipped on a real job, hiding the angle from
  anything reading `camera`); and the relational viewpoints were conventions
  inside the `shotType` SIZE list, competing for one slot, so an
  over-the-shoulder *medium* had to discard one of the two. Now both are
  statable: `shotType: "Medium"` + `angle: "over-the-shoulder"`. A closed enum
  precisely because improvisation is the failure being fixed; absent means
  eye-level. `VIDEO_ANALYSIS_FACELESS_ANGLES` marks the viewpoints where no face
  is visible, which auto-cast reads before choosing an identity reference.

- **`speed`** (per scene, optional enum) — `slow-motion` / `ramp-in` /
  `ramp-out` / `timelapse` / `freeze` / `reverse`. Previously unrepresentable
  anywhere, so a recreation rendered every shot at normal speed regardless of what
  the footage did. There is deliberately no `normal` member: absence is normal, so
  the field costs nothing on the majority of shots.

- **`onScreenText`** (per scene, optional) — titles, captions, lower-thirds and
  subtitles burned into the picture, verbatim. Doctrine already asked for these
  inside `visual` prose, but a recreation needs to know discretely whether to
  render text, and `translateOnScreenTextToEnglish` had no structured field to
  land in.

- **`look`** (clip-level, optional) — `style`, `grade`, `format`, `lens`,
  `lighting`, `genre`, `influence`. These belong to the whole piece, and as prose-per-scene a 40-scene
  analysis re-decided the grade forty independent times with nothing holding the
  answers consistent. Stated once, applied everywhere — the drift problem entity
  slots already solve for people. A sibling of `meta` rather than a member,
  because `meta` is measured fact and this is the model's reading of the
  photography. `mergeClipLook` folds each window's reading field-by-field.

  `look.influence` closes the one gap an audit against the product's own Look /
  Camera pickers turned up: everything else there already had a home (setting →
  location slots, color-look → grade, lens/camera-format → lens/format,
  camera-motion → camera, transition → transitionOut, mood → mandated in
  `visual`), but the Photographer / Artist picker — whose catalog ships
  `in the style of …` prompt hints — had no analysis counterpart. It is the
  highest-leverage field of the set, since a couple of words carry an aesthetic
  that would take a paragraph of grade and lighting prose to approximate.

  `look.style` is the rendering MEDIUM — live-action / anime / claymation / 3D /
  oil painting. The Style picker's own catalog defines this axis and states its
  independence from lighting, colour-look, atmosphere and lens, and it is the
  most consequential field of the object: two shots with identical grade, lens,
  lighting and framing look nothing alike when one is live action and the other
  a painting, and no correct grade rescues a recreation rendered in the wrong
  medium. It was the last clip-level axis with no home.

- **`effects`** (per scene, optional enum array) — `blur`, `pixelate`, `glitch`,
  `grain`, `vignette`, `flash`, `distortion`, `double-exposure`. An array because
  a shot can be grainy AND vignetted. Scoped deliberately to things done to the
  IMAGE and NOT to compositing that asserts what is in the shot
  (picture-in-picture, split screen): a real job invented
  `{slot:creator} overlay talking to camera` across nine scenes for a man who is
  never seen, so a field for "there is an inset of a person here" would hand that
  fabrication a legitimate home. An effect is verifiable in the pixels; a claim
  about who is inset is not.

- **`transitionOut` gains `dissolve`.** A cross-fade between two images and a fade
  through black look nothing alike, and collapsing both onto `fade` made a
  recreation render the wrong edit. Additive — every previously valid value still
  validates.

All of these are optional and additive: an older producer still validates, and a
consumer that ignores them is unaffected. Credit prices are unchanged — the extra
output tokens sit inside the existing safety margin.
