#!/usr/bin/env bash
# Wrapper invoked by cron at 09:45 IST each trading day.
#
# Responsibilities:
#   1. Skip on weekends and NSE market holidays.
#   2. Load broker/env credentials.
#   3. Run the bun-based research runner.
#   4. Optionally pipe the output to a notification channel (macOS notify,
#      libnotify on Linux, ntfy.sh, Telegram, Slack — you fill in).
#
# Exit codes:
#   0  success (or skipped)
#   1  config / adapter error
set -euo pipefail

REPO_DIR="${INTRADAY_REPO_DIR:-$HOME/Anthropic-claude-code}"
ADAPTER="${INTRADAY_ADAPTER:-mock}"
WATCHLIST="${INTRADAY_WATCHLIST:-agents/config/watchlist.json}"
THRESHOLDS="${INTRADAY_THRESHOLDS:-agents/config/thresholds.json}"
OUT_DIR="${INTRADAY_OUT_DIR:-$REPO_DIR/out}"

cd "$REPO_DIR"

# --- Holiday guard ---
# Populate agents/config/holidays.txt with one YYYY-MM-DD per NSE holiday.
TODAY="$(TZ=Asia/Kolkata date +%F)"
DOW="$(TZ=Asia/Kolkata date +%u)"   # 1=Mon .. 7=Sun
if [ "$DOW" -ge 6 ]; then
  echo "[intraday] weekend ($TODAY), skipping."
  exit 0
fi
if [ -f agents/config/holidays.txt ] && grep -qx "$TODAY" agents/config/holidays.txt; then
  echo "[intraday] NSE holiday ($TODAY), skipping."
  exit 0
fi

# --- Credentials ---
# Load broker env vars from a local, gitignored file. Never commit secrets.
if [ -f "$REPO_DIR/.env.intraday" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$REPO_DIR/.env.intraday"
  set +a
fi

# --- Run ---
mkdir -p "$OUT_DIR"
LOG="$OUT_DIR/cron-$(TZ=Asia/Kolkata date +%F).log"

{
  echo "[intraday] $(TZ=Asia/Kolkata date -Is) adapter=$ADAPTER"
  bun run agents/intraday-research.ts \
    --adapter "$ADAPTER" \
    --watchlist "$WATCHLIST" \
    --thresholds "$THRESHOLDS" \
    --out "$OUT_DIR"
} >> "$LOG" 2>&1

# --- Notify (optional) ---
REPORT="$OUT_DIR/intraday-research-$TODAY.md"
if [ -f "$REPORT" ]; then
  if [ -n "${INTRADAY_NTFY_TOPIC:-}" ]; then
    curl -sS -d "Intraday research ready: $REPORT" \
      "https://ntfy.sh/${INTRADAY_NTFY_TOPIC}" >/dev/null || true
  fi
  if [ -n "${INTRADAY_TELEGRAM_BOT:-}" ] && [ -n "${INTRADAY_TELEGRAM_CHAT:-}" ]; then
    curl -sS "https://api.telegram.org/bot${INTRADAY_TELEGRAM_BOT}/sendDocument" \
      -F "chat_id=${INTRADAY_TELEGRAM_CHAT}" \
      -F "document=@${REPORT}" >/dev/null || true
  fi
fi

echo "[intraday] done -> $REPORT"
