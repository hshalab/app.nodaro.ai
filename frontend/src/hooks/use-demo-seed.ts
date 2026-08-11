import { useEffect, useRef, useState } from "react"
import { getAuthHeaders } from "@/lib/api"
import { queryClient } from "@/lib/query-client"
import { queryKeys } from "@/lib/query-keys"

/**
 * Seed the Welcome Demo workflow for first-time users.
 *
 * Fires a single POST /v1/onboarding/seed-demo when `enabled` first becomes
 * true (the loaded native workflow list is empty). The server-side claim on
 * profiles.demo_seeded_at is atomic and once-per-user-ever, so this hook only
 * guards against request spam, not correctness: repeat calls are cheap no-ops
 * that return { seeded: false }.
 *
 * Failures are deliberately silent — demo seeding must never break or delay
 * the dashboard.
 */
export function useDemoSeed(enabled: boolean): { isSeeding: boolean } {
  const firedRef = useRef(false)
  const [isSeeding, setIsSeeding] = useState(false)

  useEffect(() => {
    if (!enabled || firedRef.current) return
    firedRef.current = true
    let cancelled = false

    const run = async () => {
      setIsSeeding(true)
      try {
        const res = await fetch("/v1/onboarding/seed-demo", {
          method: "POST",
          headers: await getAuthHeaders(),
        })
        if (!res.ok) return
        const json = (await res.json()) as { seeded?: boolean }
        if (!cancelled && json?.seeded) {
          queryClient.invalidateQueries({ queryKey: queryKeys.workflows.all })
        }
      } catch {
        // silent by design
      } finally {
        if (!cancelled) setIsSeeding(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [enabled])

  return { isSeeding }
}
