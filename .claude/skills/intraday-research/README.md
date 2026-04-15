# intraday-research skill

Scaffold for a disciplined, adapter-driven intraday research pass on the
Indian market. Ships with:

- `SKILL.md` — the full checklist (chart patterns, indicators, volume, OI,
  order blocks, news, event risk) and the trade-plan YAML template.
- `../../agents/intraday-researcher.md` — the subagent that runs the skill.
- `../../../agents/intraday-research.ts` — the runner binary.
- `../../../agents/adapters/` — broker adapter interface + stubs for Kite
  Connect, Upstox, and Dhan (fill in your own credentials).
- `../../../scripts/run-intraday-research.sh` — cron wrapper.
- `../../../scripts/install-cron.sh` — installs the 09:45 IST cron entry.

## This is NOT a trade signal generator

The runner consumes whatever data your configured adapter returns. If the
adapter can't fetch a required field, that symbol is gated to **NO-TRADE**.
The output is a research artifact for the operator — entries, stops, and
targets are derived from the data you feed in, not invented by an LLM.

## Bootstrap

```bash
# 1. Install deps
cd agents && bun install && cd ..

# 2. Make your config (gitignored)
cp agents/config/watchlist.sample.json agents/config/watchlist.json
cp agents/config/thresholds.sample.json agents/config/thresholds.json

# 3. Dry-run with the mock adapter (everything UNKNOWN -> NO-TRADE)
bun run agents/intraday-research.ts --adapter mock --dry-run

# 4. Wire your broker adapter — edit one of:
#    agents/adapters/kite.ts
#    agents/adapters/upstox.ts
#    agents/adapters/dhan.ts

# 5. Put creds in a gitignored file
cat > .env.intraday <<'EOF'
INTRADAY_ADAPTER=kite
KITE_API_KEY=...
KITE_ACCESS_TOKEN=...
# Optional notifications:
# INTRADAY_NTFY_TOPIC=my-private-topic
# INTRADAY_TELEGRAM_BOT=123:abc
# INTRADAY_TELEGRAM_CHAT=...
EOF

# 6. Install the 09:45 IST cron
bash scripts/install-cron.sh

# 7. Verify the wrapper end-to-end
bash scripts/run-intraday-research.sh
```

## Compliance

- Not SEBI-registered investment advice. Operator assumes all trade risk.
- Never source "insider" information. Use only public NSE/BSE/SEBI feeds.
- Option trading is high-risk; see SEBI's retail F&O study.
- Verify every computed level against your broker terminal before ordering.
