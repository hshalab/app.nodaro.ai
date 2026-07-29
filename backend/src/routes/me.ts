import type { FastifyInstance } from "fastify"
import { supabase } from "../lib/supabase.js"
import { roleIsAdmin, warmAdminCache } from "../lib/admin-check.js"

/**
 * GET /v1/me — the canonical identity / token-introspection endpoint.
 *
 * The standard "who is this token's user" lookup, like GitHub `/user` or
 * Google `/userinfo`. Authentication-only: ANY valid bearer token resolves to
 * its owner's identity — both first-party Supabase JWTs and developer-app
 * OAuth tokens (the auth middleware sets `req.userId` for both). There is
 * deliberately NO scope gate: the token itself proves identity, the scope
 * catalog has no identity/profile scope, and inventing one would be unwanted
 * surface. Finer PII scoping can be layered later if a real need appears.
 *
 * Returns IDENTITY, not settings — `{ id, email, displayName, avatarUrl, tier,
 * isAdmin }`. Mutable preferences live at `/v1/user/settings`; do not
 * duplicate them here. `isAdmin` is DESCRIPTIVE only (lets clients decide
 * whether to render admin surfaces instead of capability-probing an admin
 * endpoint); every admin route stays enforced server-side by the admin
 * middleware, which this flag never bypasses.
 */
export async function meRoutes(app: FastifyInstance) {
  app.get("/v1/me", async (req, reply) => {
    const userId = req.userId

    if (!userId) {
      return reply.status(401).send({ error: "Authentication required" })
    }

    // `profiles` has no `display_name` column (see database.types.ts): the
    // human-readable name lives in `full_name`. `subscription_tier` is
    // nullable, so coalesce to "free" to keep `tier` a non-null string.
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, email, full_name, avatar_url, tier, subscription_tier, role")
      .eq("id", userId)
      .single()

    if (error || !profile) {
      return reply.status(404).send({ error: "Profile not found" })
    }

    // The role is already in hand — pre-warm the admin cache so a subsequent
    // admin-gated call skips its profile round-trip (mirrors creditGuard).
    warmAdminCache(userId, profile.role)

    return reply.send({
      data: {
        id: profile.id,
        email: profile.email,
        displayName: profile.full_name ?? null,
        avatarUrl: profile.avatar_url ?? null,
        // `tier` first: it is the column the Stripe paths write, so it tracks
        // reality; `subscription_tier` is the fallback for rows predating it.
        // Inlined rather than importing ee/billing/tier-columns.ts — core may
        // not statically import from ee/ (tools/check-ee-imports.mjs).
        tier: profile.tier ?? profile.subscription_tier ?? "free",
        isAdmin: roleIsAdmin(profile.role),
      },
    })
  })
}
