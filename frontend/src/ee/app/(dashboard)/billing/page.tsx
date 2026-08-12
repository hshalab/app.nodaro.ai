import { useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import { CheckCircle2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "@/hooks/use-auth"
import { hasCredits } from "@/lib/edition"
import { getUserEarnings } from "@/lib/api"
import { queryKeys } from "@/lib/query-keys"
import { useUserCredits } from "@/ee/hooks/queries/use-credits-queries"
import {
  useSubscription,
  useTransactions,
  useStorageProfile,
  useManageSubscriptionMutation,
} from "@/ee/hooks/queries/use-billing-queries"
import { CurrentPlanCard } from "@/ee/components/billing/CurrentPlanCard"
import { CreditBalanceCard } from "@/ee/components/billing/CreditBalanceCard"
import { CreditActivity } from "@/ee/components/billing/CreditActivity"
import { ConnectedInstances } from "@/ee/components/billing/ConnectedInstances"
import {
  SANS_FONT,
  formatCredits,
  mutedParagraph,
  sectionCardSpaced,
  sectionTitle,
  statLabel,
} from "@/ee/components/billing/billing-styles"

/**
 * MiniApp earnings — preserved from the previous billing page (self-hides
 * when the user has never earned), rendered in the mock's card chrome.
 */
function EarningsSection() {
  const { data, isLoading } = useQuery({
    queryKey: ["user-earnings"],
    queryFn: () => getUserEarnings({ limit: 10 }),
    staleTime: 30_000,
  })

  if (isLoading || !data || data.totalLifetime === 0) return null

  const stats = [
    { label: "Total Lifetime", value: data.totalLifetime },
    { label: "This Month", value: data.thisMonth },
    { label: "Last 30 Days", value: data.last30Days },
  ]

  return (
    <section style={sectionCardSpaced}>
      <h2 style={{ ...sectionTitle, margin: "0 0 4px" }}>MiniApp Earnings</h2>
      <p style={{ ...mutedParagraph, margin: "0 0 20px" }}>
        Earnings are added to your top-up balance and never expire.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24 }}>
        {stats.map((stat) => (
          <div key={stat.label}>
            <div style={{ ...statLabel, marginBottom: 6 }}>{stat.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>
              {formatCredits(stat.value)} CR
            </div>
          </div>
        ))}
      </div>
      {data.items.length > 0 && (
        <div style={{ marginTop: 20 }}>
          {data.items.map((item) => (
            <div
              key={item.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 4px",
                borderBottom: "1px solid var(--blg-border-soft)",
                fontSize: 13.5,
              }}
            >
              <div>
                <span style={{ color: "var(--blg-t1-row)" }}>{item.appName}</span>
                <span style={{ color: "var(--blg-t2-dim)", fontSize: 12.5, marginLeft: 10 }}>
                  {new Date(item.createdAt).toLocaleDateString()}
                </span>
              </div>
              <span style={{ color: "var(--blg-pos)", fontWeight: 500 }}>
                +{formatCredits(item.totalEarned)} CR
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export default function BillingPage() {
  const { user, loading: authLoading } = useAuth()
  const [searchParams] = useSearchParams()
  const qc = useQueryClient()

  // Free/payg credits are a ONE-TIME signup grant — there is no monthly
  // refresh anywhere in the system (founder-verified 2026-08-12; the mock's
  // "resets monthly" was a designer assumption). Balance passes through
  // untouched: monthlyAllocation 0 → "one-time grant" semantics everywhere.
  const { data: balance, isLoading: creditsLoading } = useUserCredits(user?.id)
  const { data: subscription, isLoading: subLoading } = useSubscription(user?.id)
  const { data: transactions = [], isLoading: txLoading } = useTransactions(user?.id)
  const { data: storage } = useStorageProfile(user?.id)
  const manageMutation = useManageSubscriptionMutation()

  // Handle success redirect from Stripe checkout
  useEffect(() => {
    if (!user?.id) return
    if (!searchParams.get("success") && !searchParams.get("topup")) return
    const timer = setTimeout(() => {
      qc.invalidateQueries({ queryKey: queryKeys.billing.all })
      qc.invalidateQueries({ queryKey: queryKeys.credits.balance(user.id) })
    }, 3000)
    return () => clearTimeout(timer)
  }, [searchParams, user?.id, qc])

  // Show toast on success redirect
  useEffect(() => {
    const isSuccess = searchParams.get("success") === "true"
    const isTopup = searchParams.get("topup") === "true"
    if (isSuccess || isTopup) {
      toast.success(
        isTopup ? "Credits added to your account!" : "Subscription activated!",
      )
    }
  }, [searchParams])

  async function handleManageSubscription() {
    if (!user?.id) return
    try {
      const url = await manageMutation.mutateAsync(user.id)
      if (url) {
        window.open(url, "_blank")
      } else {
        toast.error("Unable to open subscription management portal")
      }
    } catch {
      toast.error("Failed to open subscription management")
    }
  }

  if (authLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!hasCredits()) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-muted-foreground">Billing is not available in this edition.</p>
      </div>
    )
  }

  return (
    <div
      style={{
        background: "var(--blg-bg)",
        minHeight: "100%",
        fontFamily: SANS_FONT,
        color: "var(--blg-t1)",
      }}
    >
      {/* Mock's <main> block — a div here because the dashboard layout already renders <main>. */}
      <div style={{ minWidth: 0, maxWidth: 1180, padding: "48px 56px 80px" }}>
        {/* Success banner (preserved ?success= / ?topup= handling) */}
        {(searchParams.get("success") === "true" ||
          searchParams.get("topup") === "true") && (
          <div className="mb-6 flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/10 p-4">
            <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-500" />
            <p className="text-sm text-green-700 dark:text-green-400">
              {searchParams.get("topup") === "true"
                ? "Your credit top-up has been processed. Credits will appear shortly."
                : "Your subscription is now active. Welcome aboard!"}
            </p>
          </div>
        )}

        <h1 style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.03em", margin: 0 }}>
          Billing
        </h1>
        <p style={{ fontSize: 15, color: "var(--blg-t2)", margin: "8px 0 36px" }}>
          Manage your subscription, credits, and payment history.
        </p>

        <CurrentPlanCard
          balance={balance}
          subscription={subscription}
          subLoading={subLoading}
          storageLimitBytes={storage?.storageLimit}
          onManageSubscription={handleManageSubscription}
          managePending={manageMutation.isPending}
        />

        <CreditBalanceCard
          balance={balance}
          creditsLoading={creditsLoading}
          transactions={transactions}
          showAutoRecharge={!!user}
        />

        <EarningsSection />

        <ConnectedInstances />

        <CreditActivity transactions={transactions} loading={txLoading} />

        {/* Legal links (preserved) */}
        <div className="mt-8 flex items-center justify-center gap-4 text-xs text-muted-foreground/60">
          <a
            href="https://nodaro.ai/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-muted-foreground"
          >
            Terms of Service
          </a>
          <span>&middot;</span>
          <a
            href="https://nodaro.ai/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-muted-foreground"
          >
            Privacy Policy
          </a>
          <span>&middot;</span>
          <a
            href="https://nodaro.ai/refund"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-muted-foreground"
          >
            Refund Policy
          </a>
        </div>
      </div>
    </div>
  )
}
