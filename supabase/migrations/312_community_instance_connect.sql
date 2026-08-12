-- ============================================================
-- 312: community cloud-connect rails (Phase 4a, decision log D2 + cp2=B)
-- ============================================================
-- Self-hosted community instances connect via the existing developer-app
-- OAuth rails with their own app kind. Backwards-compatible: old code never
-- inserts the new kind, and every insert path is gated behind
-- COMMUNITY_CONNECT_ENABLED until this lands on the DB via dev->main.

-- 1. Widen the registration-kind vocabulary.
ALTER TABLE developer_apps DROP CONSTRAINT IF EXISTS developer_apps_kind_check;
ALTER TABLE developer_apps
  ADD CONSTRAINT developer_apps_kind_check
  CHECK (kind IN ('user', 'first_party_mcp', 'dynamic_mcp', 'community_instance'));

-- 2. Per-instance monthly spend cap (containment trio). NULL = no cap; the
--    user sets it from the Connected Instances page. Enforced at the credit
--    guard via a usage_logs rollup (see PR: known benign race window).
ALTER TABLE developer_app_authorizations
  ADD COLUMN IF NOT EXISTS monthly_spend_cap_credits INTEGER;
