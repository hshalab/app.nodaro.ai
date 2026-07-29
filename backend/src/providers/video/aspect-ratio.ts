/**
 * Pure aspect-ratio math, dependency-free on purpose.
 *
 * Split out of `source-matched-aspect.ts` so provider code can snap a ratio
 * without dragging in that module's ffmpeg/probe imports (which pull `config`
 * + child_process at load time). One implementation, two consumers.
 */

/**
 * Pick the aspect-ratio token closest to a given shape from a candidate list.
 * Non-ratio candidates (e.g. VEO's "Auto") are skipped. Compared in log space
 * so e.g. 16:9 and 9:16 are symmetric.
 */
export function closestAspectRatio(
  width: number,
  height: number,
  candidates: readonly string[],
): string | undefined {
  if (!width || !height) return undefined
  const target = Math.log(width / height)
  let best: string | undefined
  let bestDist = Infinity
  for (const candidate of candidates) {
    const [w, h] = candidate.split(":").map(Number)
    if (!w || !h) continue
    const dist = Math.abs(Math.log(w / h) - target)
    if (dist < bestDist) {
      bestDist = dist
      best = candidate
    }
  }
  return best
}

/**
 * Snap an aspect-ratio TOKEN ("4:3", "21:9", …) onto the closest member of a
 * supported set. Returns undefined for non-ratio tokens ("Auto", "adaptive")
 * and for anything unparseable, so callers decide their own fallback.
 */
export function snapAspectRatioToken(
  token: string | undefined,
  candidates: readonly string[],
): string | undefined {
  if (!token) return undefined
  if (candidates.includes(token)) return token
  const [w, h] = token.split(":").map(Number)
  if (!w || !h) return undefined
  return closestAspectRatio(w, h, candidates)
}
