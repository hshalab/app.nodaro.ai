import { useEffect, useState } from "react"
import { RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { getAutoRecharge, updateAutoRecharge, type AutoRechargeConfig } from "@/lib/api"
import { creditsForLoadUsd, MIN_LOAD_USD, MAX_LOAD_USD } from "@/lib/pricing-data"

/**
 * Auto-recharge settings — "when my balance drops below X credits, load $Y".
 * The failure state doubles as the in-app notification surface: declined
 * attempts show here, and three failures auto-disable until the user
 * re-saves a card (any manual load does) and re-enables.
 */
export function AutoRechargeCard() {
  const [config, setConfig] = useState<AutoRechargeConfig | null>(null)
  const [threshold, setThreshold] = useState("")
  const [amount, setAmount] = useState("")
  const [enabled, setEnabled] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getAutoRecharge()
      .then((c) => {
        setConfig(c)
        setEnabled(c.enabled)
        setThreshold(c.thresholdCredits ? String(c.thresholdCredits) : "")
        setAmount(c.amountUsd ? String(c.amountUsd) : "")
      })
      .catch(() => setConfig(null))
  }, [])

  if (!config) return null

  const parsedThreshold = /^\d+$/.test(threshold) ? parseInt(threshold, 10) : NaN
  const parsedAmount = /^\d+$/.test(amount) ? parseInt(amount, 10) : NaN
  const previewCredits = Number.isNaN(parsedAmount) ? null : creditsForLoadUsd(parsedAmount)
  const valid =
    !enabled ||
    (parsedThreshold >= 100 && parsedThreshold <= 100000 && previewCredits !== null)

  async function handleSave() {
    if (!valid) return
    setSaving(true)
    try {
      await updateAutoRecharge({
        enabled,
        ...(Number.isNaN(parsedThreshold) ? {} : { thresholdCredits: parsedThreshold }),
        ...(Number.isNaN(parsedAmount) ? {} : { amountUsd: parsedAmount }),
      })
      toast.success(enabled ? "Auto-recharge enabled" : "Auto-recharge disabled")
      setConfig((c) => (c ? { ...c, enabled, failureCount: 0 } : c))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          Auto-recharge
        </h3>
        <button
          role="switch"
          aria-checked={enabled}
          onClick={() => setEnabled((v) => !v)}
          className={cn(
            "relative h-5 w-9 rounded-full transition-colors",
            enabled ? "bg-[#ff0073]" : "bg-zinc-300 dark:bg-zinc-700"
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform",
              enabled ? "translate-x-4" : "translate-x-0.5"
            )}
          />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span>When my balance drops below</span>
        <input
          type="text"
          inputMode="numeric"
          value={threshold}
          onChange={(e) => setThreshold(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="3000"
          className="w-24 rounded-md border border-zinc-200 dark:border-zinc-800 bg-transparent px-2 py-1 focus:border-[#ff0073]/60 focus:outline-none"
          aria-label="Threshold in credits"
        />
        <span>credits, load</span>
        <span className="text-muted-foreground">$</span>
        <input
          type="text"
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder={`${MIN_LOAD_USD}-${MAX_LOAD_USD}`}
          className="w-20 rounded-md border border-zinc-200 dark:border-zinc-800 bg-transparent px-2 py-1 focus:border-[#ff0073]/60 focus:outline-none"
          aria-label="Recharge amount in dollars"
        />
        {previewCredits !== null && (
          <span className="text-muted-foreground">= {previewCredits.toLocaleString()} credits</span>
        )}
        <button
          onClick={handleSave}
          disabled={!valid || saving}
          className={cn(
            "ml-auto rounded-md bg-[#ff0073] px-3 py-1 text-sm font-medium text-white",
            (!valid || saving) && "opacity-40 pointer-events-none"
          )}
        >
          Save
        </button>
      </div>

      {!config.hasSavedCard && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          No saved card yet — make one credit load first and your card is saved
          automatically for future recharges.
        </p>
      )}
      {config.failureCount > 0 && (
        <p className="text-xs text-red-500">
          {config.failureCount >= 3
            ? "Auto-recharge was disabled after 3 failed charges. Check your card, make a manual load, then re-enable."
            : `Last charge attempt failed (${config.failureCount}/3). At 3 failures auto-recharge disables itself.`}
        </p>
      )}
    </div>
  )
}
