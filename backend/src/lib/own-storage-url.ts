/**
 * True when `url` lives inside this install's OWN configured public-storage
 * subtree — i.e. under `R2_PUBLIC_URL/` exactly.
 *
 * Why an exemption exists at all: on self-host the bundled MinIO is reached
 * through the app's own origin (R2_PUBLIC_URL=http://localhost:3000/storage/
 * <bucket>, proxied by Caddy to the minio container), which is loopback /
 * private-range by design. Without this, every server-side download of a
 * generated asset (combine-videos pulling clips, template preview copies,
 * ffmpeg inputs) would be rejected by the SSRF gates and self-host
 * generation would be dead on arrival.
 *
 * Why it is safe: the base is operator-configured (.env), not derived from
 * request input, and the match is SUBTREE-scoped, not origin-scoped — the
 * candidate's normalized href must start with `<R2_PUBLIC_URL>/`. So
 * `http://localhost:3000/v1/...` (same origin, different path) stays blocked,
 * `.../storage/nodaro-assets-evil/...` fails the required `/` boundary, and
 * URL normalization resolves `..` segments before the comparison. On cloud,
 * R2_PUBLIC_URL is a public CDN origin that never trips the private-IP gates,
 * so this changes nothing there.
 *
 * DELIBERATELY reads process.env, not ../lib/config.js:
 *   1. R2_PUBLIC_URL carries no Zod transform — the env string IS the config
 *      value, so the read is semantically identical (config.ts loads dotenv
 *      before anything fetches, in every entrypoint).
 *   2. This check sits inside safeUrlSchema, a hot path crossed by dozens of
 *      route tests that partially doMock ../lib/config.js (only the edition
 *      helpers). Vitest THROWS on access to an export the mock factory didn't
 *      define, the refine's catch turns that throw into `return false`, and
 *      every URL in the suite silently 400s (video-sfx was the first casualty).
 *      An env read has no mock surface at all.
 */
export function isConfiguredStorageUrl(url: string | URL): boolean {
  const raw = process.env.R2_PUBLIC_URL
  if (!raw) return false
  let base: URL
  let candidate: URL
  try {
    base = new URL(raw)
    candidate = url instanceof URL ? url : new URL(url)
  } catch {
    return false
  }
  if (candidate.protocol !== "http:" && candidate.protocol !== "https:") return false
  const baseHref = base.href.replace(/\/+$/, "")
  return candidate.href.startsWith(baseHref + "/")
}
