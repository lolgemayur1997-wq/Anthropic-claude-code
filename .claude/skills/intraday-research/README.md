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

## Architecture

```
broker adapter → RawMarketData → buildSnapshot() → SymbolSnapshot → runner → report + Telegram
                                       │
                                       ├─ indicators.ts  (pure, unit-tested)
                                       └─ scoring.ts     (pure, section weights)
```

Adapter authors only implement broker-specific raw-data plumbing. All
analysis (indicators, scoring, gates, trade-plan math, report rendering) is
shared code tested via `bun test`.

## Bootstrap

```bash
# 1. Install deps
cd agents && bun install && cd ..

# 2. Copy sample config (gitignored)
cp agents/config/watchlist.sample.json agents/config/watchlist.json
cp agents/config/thresholds.sample.json agents/config/thresholds.json
cp .env.intraday.sample .env.intraday    # then fill in

# 3. Run tests (indicators)
cd agents && bun test indicators && cd ..

# 4. Dry-run with mock adapter (everything UNKNOWN → NO-TRADE)
bun run agents/intraday-research.ts --adapter mock --dry-run

# 5. Wire ONE broker adapter. Each stub has TWO functions marked "FILL IN":
#    agents/adapters/kite.ts     (Zerodha Kite Connect)
#    agents/adapters/upstox.ts   (Upstox)
#    agents/adapters/dhan.ts     (Dhan)
#
#    Each fill-in ends with `return buildSnapshot(raw)`. Nothing else to do.

# 6. Set INTRADAY_ADAPTER in .env.intraday to the one you wired.

# 7. Telegram push:
#    - Message @BotFather → /newbot → copy token into TELEGRAM_BOT_TOKEN
#    - Start a chat with your bot
#    - Hit https://api.telegram.org/bot<TOKEN>/getUpdates → copy chat.id
#      into TELEGRAM_CHAT_ID

# 8. Install the 09:45 IST cron (weekdays only, Asia/Kolkata TZ)
bash scripts/install-cron.sh

# 9. End-to-end smoke test (runs the wrapper once, sends to Telegram)
bash scripts/run-intraday-research.sh
```

## Compliance

- Not SEBI-registered investment advice. Operator assumes all trade risk.
- Never source "insider" information. Use only public NSE/BSE/SEBI feeds.
- Option trading is high-risk; see SEBI's retail F&O study.
- Verify every computed level against your broker terminal before ordering.
