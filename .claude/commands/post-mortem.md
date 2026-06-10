# Post-Mortem — End-of-Day Review

Read the day's journal + closing market data and write a structured review
to `out/post-mortem-<YYYY-MM-DD>.md`. Answers: what did the agent predict,
what happened, which gates correctly blocked losers, which were false
positives, what is the current edge calibration.

## When to invoke

- Manually after market close (15:30 IST), OR
- Auto-triggered by the cron at 15:45 IST (add a second crontab line for
  `run-post-mortem.sh` — mirrors the 09:45 wrapper).

## Arguments
- `$ARGUMENTS` — optional YYYY-MM-DD (defaults to today IST).

## Workflow

1. Load `out/intraday-research-<date>.json` (morning scan).
2. Load `out/journal/intraday-<date>.jsonl`.
3. Fetch end-of-day data via the configured adapter:
   - Close price for each symbol on the morning watchlist
   - Day's H/L/V
4. Cross-reference:
   - For each `PLAN_EMITTED`: did price reach T1? Hit stop? Neither?
   - For each `GATE_BLOCKED`: did the gated setup avoid a loss (true positive)
     or miss a winner (false positive)?
5. Compute:
   - Forecast vs. outcome hit rate
   - Gate false-positive rate by reason
   - Average R-multiple (gross + net after charges)
   - Drawdown, max adverse excursion
6. Emit findings + a **threshold-tuning suggestion** (never auto-applied).

## Output structure

```
# Post-Mortem — 2026-04-15

## Forecast vs outcome
| Symbol | Plan | Outcome | Gross R | Net R (after chgs) |
|--------|------|---------|---------|---------------------|

## Gate calibration
| Gate                 | Fired | True positives | False positives | FPR  |
|----------------------|-------|----------------|-----------------|------|
| F&O ban list         | 5     | 5              | 0               | 0%   |
| VIX > 22             | 3     | 2              | 1               | 33%  |
| ATM spread > 0.5%    | 4     | 3              | 1               | 25%  |

## Threshold tuning suggestions (NOT auto-applied)
- Consider lowering `vix_ceiling` to 20 (missed 2 winners on VIX 20–22 days).
- `min_oi_lot_multiple` at 5 rejected no winners today; keep.

## Takeaways
- Best setup: <SYMBOL> — <setup>
- Worst decision: <SYMBOL> — <what went wrong>
- Next-day watch: <...>
```

## Rules

- Suggestions are suggestions. Do not modify `thresholds.json` automatically.
- Use only recorded journal events + closing data. Never back-fill or rewrite.
- If closing data is unavailable, print "data pending; rerun later" and exit.
