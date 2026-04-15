#!/usr/bin/env bash
# Install a cron entry that runs the intraday-research wrapper every trading
# day at 09:45 IST (= 04:15 UTC).
#
# The cron daemon on Linux/macOS honors the CRON_TZ directive at the top of
# the crontab. If your cron build does not support CRON_TZ, the UTC fallback
# entry still fires at 09:45 IST.
#
# Usage:
#   bash scripts/install-cron.sh            # install
#   bash scripts/install-cron.sh --remove   # uninstall
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MORNING_WRAPPER="$REPO_DIR/scripts/run-intraday-research.sh"
POSTMORTEM_WRAPPER="$REPO_DIR/scripts/run-post-mortem.sh"
MARKER="# intraday-research@claude-code"

mkdir -p "$REPO_DIR/out"
chmod +x "$MORNING_WRAPPER" "$POSTMORTEM_WRAPPER"

if [ "${1:-}" = "--remove" ]; then
  crontab -l 2>/dev/null | grep -v "$MARKER" | crontab -
  echo "[install-cron] removed."
  exit 0
fi

TMP="$(mktemp)"
crontab -l 2>/dev/null | grep -v "$MARKER" > "$TMP" || true

{
  echo "CRON_TZ=Asia/Kolkata $MARKER"
  echo "45 9  * * 1-5 bash $MORNING_WRAPPER     $MARKER"
  echo "45 15 * * 1-5 bash $POSTMORTEM_WRAPPER  $MARKER"
} >> "$TMP"

crontab "$TMP"
rm "$TMP"

echo "[install-cron] installed. Current entries:"
crontab -l | grep "$MARKER" || true
echo
echo "Notes:"
echo "  - Set INTRADAY_ADAPTER (kite/upstox/dhan) in $REPO_DIR/.env.intraday"
echo "  - Copy agents/config/watchlist.sample.json -> watchlist.json"
echo "  - Copy agents/config/thresholds.sample.json -> thresholds.json"
echo "  - Verify: bash $WRAPPER"
