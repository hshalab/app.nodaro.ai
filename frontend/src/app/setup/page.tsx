import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Database,
  Server,
  HardDrive,
  KeyRound,
} from "lucide-react"

/**
 * /setup — self-host install health screen.
 *
 * Public (works before login: a broken Supabase config breaks login itself)
 * and registered only on non-cloud builds. Polls GET /v1/setup/status and
 * renders one card per dependency: Database, Redis, Storage, Provider keys.
 */

interface CheckResult {
  readonly ok: boolean
  readonly status: string
  readonly latencyMs: number | null
  readonly hint?: string
}

interface ProvidersCheck {
  readonly ok: boolean
  readonly keys: Record<string, boolean>
  readonly hint?: string
}

interface SetupStatus {
  readonly edition: string
  readonly timestamp: string
  readonly checks: {
    readonly database: CheckResult
    readonly redis: CheckResult
    readonly storage: CheckResult
    readonly providers: ProvidersCheck
  }
}

const POLL_INTERVAL_MS = 5000

const STATUS_LABELS: Record<string, string> = {
  ok: "Connected",
  error: "Unreachable",
  migrations_missing: "Migrations missing",
  not_configured: "Not configured",
}

const PROVIDER_LABELS: Record<string, string> = {
  kie: "KIE.ai",
  replicate: "Replicate",
  anthropic: "Anthropic",
  gemini: "Google Gemini",
  elevenlabs: "ElevenLabs",
  fal: "fal.ai",
}

function StatusIcon({ ok, warn }: { readonly ok: boolean; readonly warn?: boolean }) {
  if (ok) return <CheckCircle2 className="h-5 w-5 text-green-500" aria-hidden />
  if (warn) return <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden />
  return <XCircle className="h-5 w-5 text-red-500" aria-hidden />
}

function CheckCard({
  title,
  icon,
  check,
  warnStatuses = [],
}: {
  readonly title: string
  readonly icon: React.ReactNode
  readonly check: CheckResult
  readonly warnStatuses?: readonly string[]
}) {
  const warn = warnStatuses.includes(check.status)
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          {icon}
          {title}
        </div>
        <StatusIcon ok={check.ok} warn={warn} />
      </div>
      <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
        <span>{STATUS_LABELS[check.status] ?? check.status}</span>
        {check.ok && check.latencyMs !== null && (
          <span className="text-xs rounded bg-muted px-1.5 py-0.5">{check.latencyMs}ms</span>
        )}
      </div>
      {!check.ok && check.hint && (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{check.hint}</p>
      )}
    </div>
  )
}

export default function SetupPage() {
  const [status, setStatus] = useState<SetupStatus | null>(null)
  const [apiDown, setApiDown] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  const load = useCallback(async () => {
    setRefreshing(true)
    try {
      const res = await fetch("/v1/setup/status", { cache: "no-store" })
      if (!res.ok) throw new Error(`status ${res.status}`)
      setStatus((await res.json()) as SetupStatus)
      setApiDown(false)
    } catch {
      setApiDown(true)
    } finally {
      setRefreshing(false)
      setLastChecked(new Date())
    }
  }, [])

  useEffect(() => {
    void load()
    const timer = setInterval(() => void load(), POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [load])

  const allOk =
    status !== null &&
    status.checks.database.ok &&
    status.checks.redis.ok &&
    status.checks.storage.ok &&
    status.checks.providers.ok

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Install Health</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Live status of this Nodaro install{status ? ` (${status.edition} edition)` : ""}.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            aria-label="Refresh now"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {status === null && !apiDown && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {apiDown && (
          <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <XCircle className="h-5 w-5 text-red-500" aria-hidden />
              API unreachable
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              The frontend is up but the backend is not answering. Check the container logs
              (docker compose logs -f) and that port 3000 is not blocked.
            </p>
          </div>
        )}

        {status && (
          <>
            {allOk && (
              <div className="mb-4 rounded-lg border border-green-500/40 bg-green-500/10 p-3 text-sm">
                Everything is connected. You are ready to generate.
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <CheckCard
                title="Database (Supabase)"
                icon={<Database className="h-4 w-4 text-muted-foreground" />}
                check={status.checks.database}
              />
              <CheckCard
                title="Redis"
                icon={<Server className="h-4 w-4 text-muted-foreground" />}
                check={status.checks.redis}
              />
              <CheckCard
                title="Storage (R2 / S3)"
                icon={<HardDrive className="h-4 w-4 text-muted-foreground" />}
                check={status.checks.storage}
                warnStatuses={["not_configured"]}
              />
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <KeyRound className="h-4 w-4 text-muted-foreground" />
                    Provider keys
                  </div>
                  <StatusIcon ok={status.checks.providers.ok} warn />
                </div>
                <ul className="mt-2 space-y-1">
                  {Object.entries(status.checks.providers.keys).map(([key, present]) => (
                    <li
                      key={key}
                      className="flex items-center justify-between text-xs text-muted-foreground"
                    >
                      <span>{PROVIDER_LABELS[key] ?? key}</span>
                      <span className={present ? "text-green-500" : "text-muted-foreground/60"}>
                        {present ? "configured" : "missing"}
                      </span>
                    </li>
                  ))}
                </ul>
                {!status.checks.providers.ok && status.checks.providers.hint && (
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {status.checks.providers.hint}
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        <div className="mt-8 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {lastChecked
              ? `Last checked ${lastChecked.toLocaleTimeString()} - refreshes every 5s`
              : "Checking..."}
          </span>
          <Link to="/" className="hover:text-foreground underline underline-offset-2">
            Back to app
          </Link>
        </div>
      </div>
    </div>
  )
}
