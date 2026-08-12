import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { getAuthHeaders } from "@/lib/api"
import { sectionCardSpaced, MONO_FONT, PINK } from "./billing-styles"

/**
 * Community cloud-connect containment surface (Phase 4a): the user's
 * connected self-hosted instances, their spend this month, a per-instance
 * monthly cap (auto-saved, AR-style debounce — no save button), and
 * one-click revoke. Self-hiding: renders nothing when the user has no
 * connected instances (or the feature flag is off server-side → 404/empty).
 */

interface ConnectedInstance {
  authorizationId: string
  name: string
  instanceUrl: string | null
  connectedAt: string
  lastUsedAt: string | null
  spentThisMonth: number
  monthlySpendCapCredits: number | null
}

async function fetchInstances(): Promise<ConnectedInstance[]> {
  const res = await fetch("/v1/me/connected-instances", { headers: await getAuthHeaders() })
  if (!res.ok) return []
  const body = (await res.json()) as { instances?: ConnectedInstance[] }
  return body.instances ?? []
}

export function ConnectedInstances() {
  const [instances, setInstances] = useState<ConnectedInstance[] | null>(null)

  const reload = useCallback(() => {
    fetchInstances().then(setInstances).catch(() => setInstances([]))
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  if (!instances || instances.length === 0) return null

  return (
    <section style={sectionCardSpaced}>
      <h2 style={{ fontSize: 19, fontWeight: 700, color: "#f2f2f4", letterSpacing: "-0.01em" }}>
        Connected Instances
      </h2>
      <p style={{ fontSize: 13.5, color: "#7c7c85", marginTop: 2 }}>
        Self-hosted Nodaro servers spending from this wallet. Set a monthly cap
        or disconnect any of them.
      </p>
      <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
        {instances.map((inst) => (
          <InstanceRow key={inst.authorizationId} inst={inst} onChanged={reload} />
        ))}
      </div>
    </section>
  )
}

function InstanceRow({ inst, onChanged }: { inst: ConnectedInstance; onChanged: () => void }) {
  const [cap, setCap] = useState(inst.monthlySpendCapCredits ? String(inst.monthlySpendCapCredits) : "")
  const [revoking, setRevoking] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedRef = useRef(inst.monthlySpendCapCredits ? String(inst.monthlySpendCapCredits) : "")

  useEffect(() => {
    if (cap === lastSavedRef.current) return
    const parsed = /^\d+$/.test(cap) ? parseInt(cap, 10) : null
    const valid = cap === "" || (parsed !== null && parsed >= 100 && parsed <= 1_000_000)
    if (!valid) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/v1/me/connected-instances/${inst.authorizationId}`, {
          method: "PATCH",
          headers: { ...(await getAuthHeaders()), "Content-Type": "application/json" },
          body: JSON.stringify({ monthlySpendCapCredits: cap === "" ? null : parsed }),
        })
        if (!res.ok) throw new Error("Failed to save cap")
        lastSavedRef.current = cap
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save cap")
      }
    }, 900)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [cap, inst.authorizationId])

  async function handleRevoke() {
    if (!window.confirm(`Disconnect "${inst.name}"? Its access stops immediately.`)) return
    setRevoking(true)
    try {
      const res = await fetch(`/v1/me/connected-instances/${inst.authorizationId}/revoke`, {
        method: "POST",
        headers: await getAuthHeaders(),
      })
      if (!res.ok) throw new Error("Failed to disconnect")
      toast.success("Instance disconnected")
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to disconnect")
    } finally {
      setRevoking(false)
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 16,
        border: "1px solid #1f1f25",
        borderRadius: 12,
        padding: "14px 16px",
      }}
    >
      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#f2f2f4" }}>{inst.name}</div>
        <div style={{ fontFamily: MONO_FONT, fontSize: 11.5, color: "#7c7c85", marginTop: 2 }}>
          {inst.instanceUrl ?? "unknown host"} · connected{" "}
          {new Date(inst.connectedAt).toLocaleDateString()}
          {inst.lastUsedAt ? ` · last used ${new Date(inst.lastUsedAt).toLocaleDateString()}` : ""}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontFamily: MONO_FONT, fontSize: 10, letterSpacing: "0.14em", color: "#7c7c85" }}>
          SPENT THIS MONTH
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: "#f2f2f4" }}>
          {inst.spentThisMonth.toLocaleString()}
        </div>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#c4c4cc" }}>
        cap
        <input
          type="text"
          inputMode="numeric"
          value={cap}
          placeholder="none"
          onChange={(e) => setCap(e.target.value.replace(/[^0-9]/g, ""))}
          style={{
            width: 90,
            background: "#101014",
            border: "1px solid #26262c",
            borderRadius: 8,
            color: "#f2f2f4",
            fontSize: 13.5,
            padding: "7px 10px",
            outline: "none",
          }}
          aria-label={`Monthly cap for ${inst.name}`}
        />
      </label>
      <button
        onClick={handleRevoke}
        disabled={revoking}
        style={{
          border: `1px solid ${PINK}`,
          background: "transparent",
          color: PINK,
          fontSize: 13,
          fontWeight: 600,
          padding: "8px 16px",
          borderRadius: 9,
          cursor: "pointer",
          opacity: revoking ? 0.5 : 1,
        }}
      >
        Disconnect
      </button>
    </div>
  )
}
