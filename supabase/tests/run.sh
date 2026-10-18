#!/usr/bin/env bash
# Runs the RLS / sync end-to-end suite against a throwaway local Supabase
# stack (Docker). Never touches the linked production project.
#
#   supabase/tests/run.sh            # live schema + every migration >= 0010
#   supabase/tests/run.sh baseline   # live schema only (today's production rules)
#   supabase/tests/run.sh stop       # tear the local stack down
#
# The stack lives in $RLS_WORKDIR (default /tmp/expensetracker-rls) so the
# repo's supabase/ folder and its link to production stay untouched.
set -euo pipefail

MODE="${1:-hardened}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WORK="${RLS_WORKDIR:-/tmp/expensetracker-rls}"

if [[ "$MODE" == "stop" ]]; then
  supabase stop --workdir "$WORK" --no-backup
  exit 0
fi

mkdir -p "$WORK"
if [[ ! -f "$WORK/supabase/config.toml" ]]; then
  (cd "$WORK" && supabase init --workdir "$WORK" >/dev/null)
  sed -i '' 's/^project_id = .*/project_id = "expensetracker-rls"/' "$WORK/supabase/config.toml"
fi

# Edge Function settings for the local stack: the `ai` function gets a fake
# OpenAI key (calls reach OpenAI and fail, which proves the wiring), AI and
# mail limits are 3/day, and send-push runs without JWT verification like
# production.
CFG="$WORK/supabase/config.toml"
NEEDS_RESTART=0
if ! grep -q '^\[edge_runtime.secrets\]' "$CFG"; then
  printf '\n[edge_runtime.secrets]\nOPENAI_API_KEY = "local-test-key-not-real"\nAI_DAILY_LIMIT = "3"\n' >> "$CFG"
  NEEDS_RESTART=1
fi
if ! grep -q '^MAIL_DAILY_LIMIT' "$CFG"; then
  sed -i '' 's/^\[edge_runtime.secrets\]$/[edge_runtime.secrets]\
MAIL_DAILY_LIMIT = "3"/' "$CFG"
  NEEDS_RESTART=1
fi
if ! grep -q '^\[functions.send-push\]' "$CFG"; then
  printf '\n[functions.send-push]\nverify_jwt = false\n' >> "$CFG"
  NEEDS_RESTART=1
fi

MIG="$WORK/supabase/migrations"
rm -rf "$MIG" && mkdir -p "$MIG"
cp "$ROOT/supabase/schema/public_baseline.sql" "$MIG/0000_baseline.sql"
cp "$ROOT/supabase/tests/local_setup.sql" "$MIG/0001_local_setup.sql"
if [[ "$MODE" != "baseline" ]]; then
  for f in "$ROOT"/supabase/migrations/*.sql; do
    n="$(basename "$f")"
    if (( 10#${n%%_*} >= 10 )); then cp "$f" "$MIG/$n"; fi
  done
fi
echo "Migrations: $(ls "$MIG" | tr '\n' ' ')"

rm -rf "$WORK/supabase/functions"
cp -R "$ROOT/supabase/functions" "$WORK/supabase/functions"

if [[ "$NEEDS_RESTART" == 1 ]] && supabase status --workdir "$WORK" >/dev/null 2>&1; then
  supabase stop --workdir "$WORK" --no-backup
fi
if ! supabase status --workdir "$WORK" >/dev/null 2>&1; then
  supabase start --workdir "$WORK" \
    -x realtime,storage-api,imgproxy,mailpit,studio,logflare,vector,supavisor,postgres-meta
fi
supabase db reset --local --workdir "$WORK" >/dev/null

STATUS="$(supabase status --workdir "$WORK" -o json 2>/dev/null)"
export RLS_API_URL="$(echo "$STATUS" | node -pe 'JSON.parse(require("fs").readFileSync(0)).API_URL')"
export RLS_ANON_KEY="$(echo "$STATUS" | node -pe 'JSON.parse(require("fs").readFileSync(0)).ANON_KEY')"
export RLS_SERVICE_KEY="$(echo "$STATUS" | node -pe 'JSON.parse(require("fs").readFileSync(0)).SERVICE_ROLE_KEY')"
export RLS_DB_URL="$(echo "$STATUS" | node -pe 'JSON.parse(require("fs").readFileSync(0)).DB_URL')"
export RLS_MODE="$MODE"

node "$ROOT/supabase/tests/rls-e2e.mjs"
