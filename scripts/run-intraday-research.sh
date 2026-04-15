#!/usr/bin/env bash
# Wrapper invoked by cron at 09:45 IST each trading day.
#
# Responsibilities:
#   1. Skip on weekends and NSE market holidays.
#   2. Load broker/env credentials from .env.intraday (gitignored).
#   3. Run the bun-based research runner, capture stdout + stderr to a log.
#   4. Push a Telegram summary + the Markdown report (best-effort).
#
# Env contract (see .env.intraday.sample):
#   INTRADAY_ADAPTER         mock | kite | upstox | dhan   (default: mock)
#   INTRADAY_REPO_DIR        absolute repo path             (default: $HOME/Anthropic-claude-code)
#   INTRADAY_WATCHLIST       path to watchlist.json
#   INTRADAY_THRESHOLDS      path to thresholds.json
#   INTRADAY_OUT_DIR         report output directory
#   TELEGRAM_BOT_TOKEN       bot token from @BotFather
#   TELEGRAM_CHAT_ID         your chat id (positive int or negative for groups)
#   INTRADAY_NTFY_TOPIC      optional ntfy.sh topic for phone push
#
# Exit codes:
#   0  success (including market-closed skip)
#   1  runner or notification error (notification errors are logged, not fatal)
set -u

REPO_DIR="${INTRADAY_REPO_DIR:-$HOME/Anthropic-claude-code}"
ADAPTER="${INTRADAY_ADAPTER:-mock}"
WATCHLIST="${INTRADAY_WATCHLIST:-agents/config/watchlist.json}"
THRESHOLDS="${INTRADAY_THRESHOLDS:-agents/config/thresholds.json}"
OUT_DIR="${INTRADAY_OUT_DIR:-$REPO_DIR/out}"

cd "$REPO_DIR" || { echo "[intraday] repo not found: $REPO_DIR" >&2; exit 1; }

# --- Holiday guard ---
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
if [ -f "$REPO_DIR/.env.intraday" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$REPO_DIR/.env.intraday"
  set +a
fi

mkdir -p "$OUT_DIR"
LOG="$OUT_DIR/cron-$TODAY.log"
REPORT="$OUT_DIR/intraday-research-$TODAY.md"
SUMMARY_FILE="$OUT_DIR/.summary-$TODAY.txt"

# --- Run ---
echo "[intraday] $(TZ=Asia/Kolkata date -Is) adapter=$ADAPTER" >>"$LOG"
RUN_STATUS=0
bun run agents/intraday-research.ts \
  --adapter "$ADAPTER" \
  --watchlist "$WATCHLIST" \
  --thresholds "$THRESHOLDS" \
  --out "$OUT_DIR" >>"$LOG" 2>&1 || RUN_STATUS=$?

# --- Build a short summary line ---
SUMMARY="Intraday research $TODAY — adapter=$ADAPTER"
if [ -f "$OUT_DIR/intraday-research-$TODAY.json" ]; then
  # grep -c prints a count AND exits non-zero on no-match, which combined
  # with `|| echo 0` previously produced "0\n0". Use || true to preserve
  # grep's stdout verbatim, then fall back to 0 only if stdout is empty.
  PASS=$(grep -c '"verdict": "PASS"' "$OUT_DIR/intraday-research-$TODAY.json" 2>/dev/null || true)
  GATED=$(grep -c '"verdict": "GATED"' "$OUT_DIR/intraday-research-$TODAY.json" 2>/dev/null || true)
  NOTR=$(grep -c '"verdict": "NO_TRADE"' "$OUT_DIR/intraday-research-$TODAY.json" 2>/dev/null || true)
  SUMMARY="$SUMMARY | PASS=${PASS:-0} GATED=${GATED:-0} NO_TRADE=${NOTR:-0}"
fi
if [ "$RUN_STATUS" -ne 0 ]; then
  SUMMARY="[ERROR] $SUMMARY (runner exit $RUN_STATUS)"
fi
echo "$SUMMARY" >"$SUMMARY_FILE"
echo "[intraday] $SUMMARY" >>"$LOG"

# --- Telegram delivery (best-effort) ---
# Accept both canonical and legacy env var names.
BOT="${TELEGRAM_BOT_TOKEN:-${INTRADAY_TELEGRAM_BOT:-}}"
CHAT="${TELEGRAM_CHAT_ID:-${INTRADAY_TELEGRAM_CHAT:-}}"

notify_telegram() {
  local text_file="$1"
  local doc_file="$2"
  if [ -z "$BOT" ] || [ -z "$CHAT" ]; then
    echo "[intraday] telegram: TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set; skipping." >>"$LOG"
    return 0
  fi
  # 1) text message
  if [ -f "$text_file" ]; then
    curl -sS -m 20 \
      -d "chat_id=${CHAT}" \
      --data-urlencode "text@${text_file}" \
      "https://api.telegram.org/bot${BOT}/sendMessage" >>"$LOG" 2>&1 || \
      echo "[intraday] telegram sendMessage failed" >>"$LOG"
  fi
  # 2) document
  if [ -n "$doc_file" ] && [ -f "$doc_file" ]; then
    curl -sS -m 60 \
      -F "chat_id=${CHAT}" \
      -F "document=@${doc_file}" \
      "https://api.telegram.org/bot${BOT}/sendDocument" >>"$LOG" 2>&1 || \
      echo "[intraday] telegram sendDocument failed" >>"$LOG"
  fi
}

notify_ntfy() {
  local text_file="$1"
  if [ -z "${INTRADAY_NTFY_TOPIC:-}" ]; then return 0; fi
  curl -sS -m 15 --data-binary "@${text_file}" \
    "https://ntfy.sh/${INTRADAY_NTFY_TOPIC}" >>"$LOG" 2>&1 || \
    echo "[intraday] ntfy push failed" >>"$LOG"
}

# Always send summary. On error, also send the log. On success, send the report.
if [ "$RUN_STATUS" -eq 0 ] && [ -f "$REPORT" ]; then
  notify_telegram "$SUMMARY_FILE" "$REPORT"
  notify_ntfy "$SUMMARY_FILE"
else
  notify_telegram "$SUMMARY_FILE" "$LOG"
  notify_ntfy "$SUMMARY_FILE"
fi

rm -f "$SUMMARY_FILE"
echo "[intraday] done -> $REPORT (exit $RUN_STATUS)"
exit "$RUN_STATUS"
