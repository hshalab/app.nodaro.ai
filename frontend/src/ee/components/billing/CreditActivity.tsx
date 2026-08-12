import type { CSSProperties } from "react"
import { Loader2 } from "lucide-react"
import type { TransactionRecord } from "@/lib/api"
import {
  CYAN,
  MONO_FONT,
  PINK,
  formatCredits,
  formatShortDate,
  sectionCard,
  sectionTitle,
} from "./billing-styles"

interface CreditActivityProps {
  transactions: readonly TransactionRecord[]
  loading: boolean
}

const GRID_COLUMNS = "1.4fr 1fr 0.9fr 0.7fr"
const MAX_ROWS = 10

type ActivitySource = "Subscription" | "Top-up" | "Refund"

interface ActivityRow {
  id: string
  description: string
  source: ActivitySource
  date: string
  /** Signed credit amount, e.g. "+3,300" / "−990" (U+2212 minus). */
  amount: string
  positive: boolean
  /** Stripe hosted receipt link (view/download); null for older rows. */
  receiptUrl: string | null
}

const TAG_COLORS: Record<ActivitySource, { color: string; background: string }> = {
  Subscription: { color: PINK, background: "#26101a" },
  "Top-up": { color: CYAN, background: "#0d2429" },
  Refund: { color: "#8a8a93", background: "#1a1a1f" },
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function toActivityRow(tx: TransactionRecord): ActivityRow {
  // The declared union is "subscription" | "topup", but refund rows can come
  // through the same feed — widen before comparing so tsc allows the check.
  const type: string = tx.type
  const isRefund = type === "refund"
  const source: ActivitySource =
    type === "subscription" ? "Subscription" : isRefund ? "Refund" : "Top-up"
  const description =
    type === "subscription"
      ? `${capitalize(tx.tier ?? "Subscription")} plan`
      : isRefund
        ? "Credit refund"
        : "Credit top-up"
  const credits = Math.abs(tx.credits_granted)
  const negative = isRefund || tx.credits_granted < 0
  return {
    id: tx.id,
    description,
    source,
    date: formatShortDate(tx.created_at),
    amount: `${negative ? "−" : "+"}${formatCredits(credits)}`,
    positive: !negative,
    receiptUrl: tx.receipt_url ?? null,
  }
}

const headerCell: CSSProperties = {
  display: "grid",
  gridTemplateColumns: GRID_COLUMNS,
  gap: 12,
  padding: "0 4px 10px",
  borderBottom: "1px solid #1c1c22",
  fontSize: 11,
  letterSpacing: "0.1em",
  color: "#6a6a73",
  fontWeight: 700,
}

const bodyRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: GRID_COLUMNS,
  gap: 12,
  padding: "14px 4px",
  borderBottom: "1px solid #16161b",
  alignItems: "center",
  fontSize: 13.5,
}

export function CreditActivity({ transactions, loading }: CreditActivityProps) {
  const rows = [...transactions]
    .sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    .slice(0, MAX_ROWS)
    .map(toActivityRow)

  return (
    <section style={sectionCard}>
      <h2 style={{ ...sectionTitle, margin: "0 0 18px" }}>Credit Activity</h2>
      <div style={headerCell}>
        <span>DESCRIPTION</span>
        <span>SOURCE</span>
        <span>DATE</span>
        <span style={{ textAlign: "right" }}>AMOUNT</span>
      </div>
      {loading ? (
        <div className="flex h-16 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <p style={{ fontSize: 13, color: "#75757e", margin: "14px 4px 0" }}>
          No transactions yet.
        </p>
      ) : (
        rows.map((row) => (
          <div key={row.id} style={bodyRow}>
            <span style={{ color: "#e4e4e9" }}>
              {row.description}
              {row.receiptUrl && (
                <a
                  href={row.receiptUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ marginLeft: 10, fontSize: 11.5, color: "#7c7c85", textDecoration: "underline" }}
                >
                  Receipt ↗
                </a>
              )}
            </span>
            <span
              style={{
                justifySelf: "start",
                fontSize: 11.5,
                fontWeight: 600,
                color: TAG_COLORS[row.source].color,
                background: TAG_COLORS[row.source].background,
                borderRadius: 99,
                padding: "4px 11px",
              }}
            >
              {row.source}
            </span>
            <span
              style={{ color: "#7c7c85", fontFamily: MONO_FONT, fontSize: 12.5 }}
            >
              {row.date}
            </span>
            <span
              style={{
                textAlign: "right",
                fontFamily: MONO_FONT,
                fontSize: 13,
                fontWeight: 500,
                color: row.positive ? "#63c79a" : "#a8a8b2",
              }}
            >
              {row.amount}
            </span>
          </div>
        ))
      )}
    </section>
  )
}
