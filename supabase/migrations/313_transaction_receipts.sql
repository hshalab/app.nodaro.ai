-- ============================================================
-- 313: Stripe receipt links on the transactions ledger (Billing-UX)
-- ============================================================
-- Founder request 2026-08-12: receipts must be visible/downloadable in the
-- app. The charge's hosted receipt_url is captured at provisioning time
-- (webhook handlers) via a post-grant UPDATE keyed on the PI id — the grant
-- RPC itself is untouched. Nullable: rows predating this migration (and
-- non-Stripe rows like admin comps) simply have no link.

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS receipt_url TEXT;
