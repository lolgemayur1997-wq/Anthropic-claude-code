#!/usr/bin/env bash
# Quick sanity check for Dhan credentials. Hits India VIX LTP + a single quote
# call. If either fails, prints the exact error so you know whether it's auth,
# network, or data-plan. Does NOT place orders, does NOT fetch your account
# or positions — just read-only market data.
set -u

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

# Load local env (gitignored)
if [ -f .env.intraday ]; then
  set -a
  # shellcheck disable=SC1091
  . .env.intraday
  set +a
fi

if [ -z "${DHAN_CLIENT_ID:-}" ] || [ -z "${DHAN_ACCESS_TOKEN:-}" ]; then
  echo "✗ DHAN_CLIENT_ID or DHAN_ACCESS_TOKEN not set."
  echo "  Edit .env.intraday with your credentials (see .env.intraday.sample)."
  exit 1
fi

echo "→ Testing Dhan /v2/marketfeed/ltp on INDIA VIX..."

# INDIA VIX has a well-known security ID on Dhan: 21 (IDX_I segment).
# If your account has Data API enabled this will return a live number.
# Dhan docs specify integer IDs, NOT string (previous body was ["21"]).
RESP="$(curl -sS -m 15 \
  -H "access-token: ${DHAN_ACCESS_TOKEN}" \
  -H "client-id: ${DHAN_CLIENT_ID}" \
  -H "Content-Type: application/json" \
  -d '{"IDX_I":[21]}' \
  https://api.dhan.co/v2/marketfeed/ltp)"

HTTP=$(echo "$RESP" | head -c 400)

# Detect common error shapes
if echo "$RESP" | grep -q '"errorCode"'; then
  echo "✗ Dhan returned an error:"
  echo "$RESP" | head -c 500
  echo
  echo
  echo "Likely causes:"
  echo "  - Token expired → regenerate at web.dhan.co → Profile → DhanHQ APIs"
  echo "  - Data API not enabled on your account (enable in same screen)"
  echo "  - Client ID typo"
  exit 1
fi

# Happy path — extract last_price
if echo "$RESP" | grep -q '"last_price"'; then
  VIX=$(echo "$RESP" | grep -oE '"last_price"[^,}]+' | head -1 | grep -oE '[0-9.]+' | head -1)
  echo "✓ India VIX = ${VIX}"
  echo "✓ Credentials valid, Data API enabled."
  echo
  echo "Next step:"
  echo "  cp agents/config/watchlist.sample.json agents/config/watchlist.json"
  echo "  bash scripts/run-intraday-research.sh"
  exit 0
fi

echo "? Unexpected response shape:"
echo "$HTTP"
exit 1
