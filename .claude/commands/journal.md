# Journal — Record and review trade events

Append-only trade journal for audit, tilt protection, and edge calibration.
Events feed the daily-loss cap, max-trades-per-day, and cooldown-after-stop-out
circuit breakers in `agents/intraday-research.ts`.

## Arguments
- `$ARGUMENTS` — one of:
  - `log-taken SYMBOL bias entry stop target qty` — record TRADE_TAKEN
  - `log-closed SYMBOL pnl` — record TRADE_CLOSED (operator-reported exit)
  - `log-stop SYMBOL pnl` — record STOP_HIT
  - `show [YYYY-MM-DD]` — print today's (or given date's) events
  - `summary [YYYY-MM-DD]` — print DailySummary (plans, trades, hit rate, top gates)

## Steps

1. Resolve the journal directory (default `out/journal/`).
2. For `log-*` actions, call the `appendEvent()` API in `agents/journal.ts`.
3. For `show` / `summary`, call `readToday()` and `summarize()`.
4. Print a human-readable table + one-line summary.

## Output (summary example)

```
Date:            2026-04-15
Plans emitted:   7
Trades taken:    2
Winners:         1
Losers:          1
Hit rate:        50.0%
Gross P&L:       ₹-500
Gates blocked:   11
Top gate reasons:
  1. F&O ban list             ×5
  2. VIX ceiling              ×3
  3. corp action in 1d        ×2
```

## Rules

- Never edit historical lines. The journal is append-only.
- P&L on TRADE_CLOSED / STOP_HIT is **net** of charges (operator to compute via
  `agents/charges.ts::roundTripCharges`).
- The agent uses journal state to enforce tilt protection; do not bypass by
  deleting or rewriting entries.
