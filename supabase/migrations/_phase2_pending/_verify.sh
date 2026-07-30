#!/bin/bash
# R10 verification harness — proves the reverse migration works BEFORE the
# forward one ships (audit A6/R10). Each guard must actually FIRE; a guard
# never seen failing is not known to work.
#
# Needs Docker. Uses a throwaway Postgres on port 55432 so it never touches a
# local Supabase stack:
#   docker run -d --name r10test -e POSTGRES_PASSWORD=test -p 55432:5432 postgres:17-alpine
#   bash supabase/migrations/_phase2_pending/_verify.sh
#   docker rm -f r10test
#
# Expected: guards 1+2 abort, guard 3 prints "150 / 150", guard 4 prints
# "idempotent".
M="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SP="$M"
FWD=$M/900_credit_redenomination_scale_x10.sql
REV=$M/901_credit_redenomination_scale_x10_REVERSE.sql

psql_run() { docker exec -i r10test psql -U postgres -q -v ON_ERROR_STOP=1 "$@"; }
reset_db() { docker exec -i r10test psql -U postgres -q -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" >/dev/null 2>&1; psql_run < "$SP/_test-fixture.sql" >/dev/null; }

echo "=== GUARD 1: reverse with NO snapshot (must abort) ==="
reset_db
OUT=$(psql_run < "$REV" 2>&1)
echo "$OUT" | grep -oE "R10 abort:[^\"]*" | head -1 || echo "  DID NOT ABORT — guard broken"

echo
echo "=== GUARD 2: reverse on dirty post-forward state (must abort) ==="
reset_db
psql_run < "$FWD" >/dev/null
docker exec -i r10test psql -U postgres -q -c "INSERT INTO usage_logs (credits_used, credits_charged, cost_usd) VALUES (7, 7, 0.14);" >/dev/null
OUT=$(psql_run < "$REV" 2>&1)
echo "$OUT" | grep -oE "R10 abort:[^\"]*" | head -1 || echo "  DID NOT ABORT — guard broken"

echo
echo "=== GUARD 3: post-forward NEW profile (no snapshot row) divides, not restores ==="
reset_db
psql_run < "$FWD" >/dev/null
docker exec -i r10test psql -U postgres -q -c \
  "INSERT INTO profiles (tier, subscription_credits, topup_credits, total_credits, daily_spent_credits) VALUES ('free', 1500, 0, 1500, 0);" >/dev/null
psql_run < "$REV" >/dev/null 2>&1
echo "new-profile row after reverse (expect 150 / 150):"
docker exec -i r10test psql -U postgres -qAt -F' / ' -c \
  "SELECT subscription_credits, total_credits FROM profiles p WHERE NOT EXISTS (SELECT 1 FROM credit_redenomination_snapshot s WHERE s.profile_id = p.id);"

echo
echo "=== GUARD 4: forward is idempotent-safe? (re-running must NOT double-scale silently) ==="
reset_db
psql_run < "$FWD" >/dev/null
BEFORE2=$(docker exec -i r10test psql -U postgres -qAt -c "SELECT sum(subscription_credits) FROM profiles;")
psql_run < "$FWD" >/dev/null 2>&1
AFTER2=$(docker exec -i r10test psql -U postgres -qAt -c "SELECT sum(subscription_credits) FROM profiles;")
echo "sum after 1st forward: $BEFORE2   after 2nd: $AFTER2"
[ "$BEFORE2" = "$AFTER2" ] && echo "  idempotent" || echo "  NOT idempotent — a re-run double-scales (needs a guard)"
