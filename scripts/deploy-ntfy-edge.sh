#!/usr/bin/env bash
# Deploy the ntfy edge functions required by Impostazioni → ntfy and Profilo.
# Requires: supabase CLI logged in (SUPABASE_ACCESS_TOKEN) and linked project.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PROJECT_REF="${SUPABASE_PROJECT_REF:-ooqlfldcrnkudhgjnied}"
FUNCTIONS=(ntfy-admin ntfy-config ntfy-resolve ntfy-alert)

if ! command -v supabase >/dev/null 2>&1; then
  echo "Installa la CLI Supabase: https://supabase.com/docs/guides/cli"
  exit 1
fi

echo "Deploy ntfy functions → project $PROJECT_REF"
for name in "${FUNCTIONS[@]}"; do
  echo "==> $name"
  supabase functions deploy "$name" --project-ref "$PROJECT_REF"
done

echo
echo "Smoke probe (unauthenticated POST should be 401, not 404):"
BASE="https://${PROJECT_REF}.supabase.co/functions/v1"
for name in "${FUNCTIONS[@]}"; do
  code=$(curl -sS -o /tmp/ntfy-smoke-"$name".json -w '%{http_code}' \
    -X POST "$BASE/$name" \
    -H 'Content-Type: application/json' \
    -d '{"hotel_id":"hotelgio"}')
  echo "  $name → HTTP $code  $(head -c 120 /tmp/ntfy-smoke-"$name".json)"
done

echo
echo "Poi in Supabase SQL Editor applica (se non già fatto):"
echo "  supabase/migrations/20260923180000_ensure_ntfy_alerts.sql"
echo "Infine in RandApp: Impostazioni → ntfy → Completa topic → Attiva → Test."
