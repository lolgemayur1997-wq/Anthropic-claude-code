#!/usr/bin/env bash
# End-of-day post-mortem wrapper. Runs at 15:45 IST after market close.
# Mirrors the 09:45 morning wrapper: same holiday guard, same Telegram
# delivery path. The only difference is the program invoked.
set -u

REPO_DIR="${INTRADAY_REPO_DIR:-$HOME/Anthropic-claude-code}"
OUT_DIR="${INTRADAY_OUT_DIR:-$REPO_DIR/out}"

cd "$REPO_DIR" || { echo "[post-mortem] repo not found: $REPO_DIR" >&2; exit 1; }

TODAY="$(TZ=Asia/Kolkata date +%F)"
DOW="$(TZ=Asia/Kolkata date +%u)"
if [ "$DOW" -ge 6 ]; then
  echo "[post-mortem] weekend ($TODAY), skipping."
  exit 0
fi
if [ -f agents/config/holidays.txt ] && grep -qx "$TODAY" agents/config/holidays.txt; then
  echo "[post-mortem] NSE holiday ($TODAY), skipping."
  exit 0
fi

if [ -f "$REPO_DIR/.env.intraday" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$REPO_DIR/.env.intraday"
  set +a
fi

mkdir -p "$OUT_DIR"
LOG="$OUT_DIR/post-mortem-$TODAY.log"
REPORT="$OUT_DIR/post-mortem-$TODAY.md"

RUN_STATUS=0
echo "[post-mortem] $(TZ=Asia/Kolkata date -Is)" >>"$LOG"
bun run agents/post-mortem.ts --out "$OUT_DIR" >>"$LOG" 2>&1 || RUN_STATUS=$?

# Telegram delivery (best-effort; mirrors the morning wrapper contract).
BOT="${TELEGRAM_BOT_TOKEN:-${INTRADAY_TELEGRAM_BOT:-}}"
CHAT="${TELEGRAM_CHAT_ID:-${INTRADAY_TELEGRAM_CHAT:-}}"

if [ -n "$BOT" ] && [ -n "$CHAT" ] && [ -f "$REPORT" ]; then
  curl -sS -m 20 \
    -d "chat_id=${CHAT}" \
    --data-urlencode "text=Post-mortem ready for ${TODAY}" \
    "https://api.telegram.org/bot${BOT}/sendMessage" >>"$LOG" 2>&1 || \
    echo "[post-mortem] telegram sendMessage failed" >>"$LOG"
  curl -sS -m 60 \
    -F "chat_id=${CHAT}" \
    -F "document=@${REPORT}" \
    "https://api.telegram.org/bot${BOT}/sendDocument" >>"$LOG" 2>&1 || \
    echo "[post-mortem] telegram sendDocument failed" >>"$LOG"
fi

echo "[post-mortem] done -> $REPORT (exit $RUN_STATUS)"
exit "$RUN_STATUS"
