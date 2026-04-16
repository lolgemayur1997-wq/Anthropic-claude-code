# Research team

Agents that collaborate on the Indian intraday / F&O research pipeline.

| Role                    | Agent                 | When invoked                                              |
|-------------------------|-----------------------|-----------------------------------------------------------|
| Rule-based scanner      | `intraday-researcher` | 09:45 IST cron, or manual `/intraday-research`            |
| Discretionary reviewer  | `senior-trader`       | `/review-trade` after the morning report                  |
| Position sizing / risk  | `risk-manager`        | `/size-check` after the senior review                     |

## Pipeline flow

```
09:15 IST — opening range starts
09:30 IST — ORB complete
09:45 IST — cron fires
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ intraday-researcher (rule-based)                            │
│  - Pulls live data via configured broker adapter            │
│  - Runs indicators, scoring, NSE F&O gates, circuit breakers│
│  - Emits out/intraday-research-<date>.md + .json            │
│  - Appends events to out/journal/intraday-<date>.jsonl      │
└─────────────────────────────────────────────────────────────┘
    │
    ▼  (operator runs /review-trade, or invokes Agent tool)
┌─────────────────────────────────────────────────────────────┐
│ senior-trader (discretionary)                               │
│  - Reads each PASS plan                                     │
│  - Walks 10 review axes (context, pattern quality, trap     │
│    risk, flow-vs-price, premium sanity, structure, size, …) │
│  - Emits out/senior-review-<date>.md with                   │
│    APPROVE / REVISE / REJECT verdict per plan               │
│  - Can DOWNGRADE PASS → NO_TRADE with reason                │
│  - Cannot UPGRADE gated / UNKNOWN plans                     │
└─────────────────────────────────────────────────────────────┘
    │
    ▼  (operator runs /size-check, or invokes Agent tool)
┌─────────────────────────────────────────────────────────────┐
│ risk-manager (sizing + drawdown)                            │
│  - Reads APPROVE/REVISE plans + today's journal + context   │
│  - Applies multiplicative haircuts:                         │
│    confluence / regime / circuit-breaker proximity /        │
│    sector concentration / charges sanity / notional floor   │
│  - Emits out/risk-review-<date>.md with final_qty per plan  │
│  - Can REDUCE qty or veto to 0; cannot INCREASE beyond      │
│    the runner's mechanical qty                              │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
operator decides → trade + /journal log, OR NO_TRADE + /journal log
    │
15:30 IST — market close
15:45 IST — cron fires
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ post-mortem runner                                          │
│  - Reads journal + morning scan                             │
│  - Writes out/post-mortem-<date>.md                         │
│  - Hit rate, gate calibration, threshold-tuning hints       │
└─────────────────────────────────────────────────────────────┘
```

## Authority boundaries

These are the invariants. Neither agent can relax them.

| Action                                      | intraday-researcher | senior-trader | risk-manager | operator |
|---------------------------------------------|:-------------------:|:-------------:|:------------:|:--------:|
| Fetch live market data                      | ✓ (via adapter)     | —             | —            | —        |
| Apply NSE F&O rule gates                    | ✓                   | —             | —            | —        |
| Emit a PASS plan                            | ✓                   | —             | —            | —        |
| Downgrade PASS → NO_TRADE (with reason)     | —                   | ✓             | ✓ (via veto) | ✓        |
| Upgrade GATED / UNKNOWN → PASS              | —                   | —             | —            | —        |
| Suggest revised qty (non-binding input to RM)| —                   | ✓             | —            | —        |
| Reduce qty below mechanical (binding)        | —                   | —             | ✓            | ✓        |
| Increase qty above mechanical               | —                   | —             | —            | —        |
| Place an order                              | —                   | —             | —            | ✓        |
| Log to journal                              | ✓ (PLAN_EMITTED / GATE_BLOCKED) | — | —      | ✓ (TRADE_TAKEN / TRADE_CLOSED / STOP_HIT) |

## Non-goals (both agents)

- No trade signals. Output is research / review artifact.
- No SEBI-registered advice. Operator bears all trade risk.
- No non-public / insider information. Only published NSE/BSE/SEBI data.
- No order execution. No agent has execution tools.
- No backtest-style win-rate or expected-return claims.

## How to invoke

```bash
# Morning scan — runs automatically at 09:45 IST
# or manually:
bun run agents/intraday-research.ts --adapter <kite|upstox|dhan>

# Senior review — after the morning scan
# In Claude Code:
/review-trade                     # stage 2: senior-trader discretionary review
/review-trade RELIANCE            # review one symbol's plan
/size-check                       # stage 3: risk-manager final sizing
/size-check RELIANCE              # one symbol

# End-of-day review — runs automatically at 15:45 IST
# or manually:
bun run agents/post-mortem.ts
```

## Adding a new team member

The pattern to follow:
1. Write `.claude/agents/<name>.md` with YAML frontmatter (name, description, tools, model) + system prompt.
2. Define authority boundaries in the subagent doc (what it can / cannot change).
3. Add a row to the table above.
4. Add a `/` slash command if operator-invokable.
5. Update the Pipeline flow diagram.
6. Never grant a new agent upgrade-authority on rule gates.
