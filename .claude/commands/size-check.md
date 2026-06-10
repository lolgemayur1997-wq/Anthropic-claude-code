# Size Check — Risk-Manager Final Sizing

Invokes the `risk-manager` subagent on today's reviewed plans and writes a
structured size-review to `out/risk-review-<date>.md`. This is the **third
stage** of the research pipeline, run after `/review-trade`.

## Arguments

- `$ARGUMENTS` — one of:
  - _(empty)_ — review all APPROVE / REVISE plans from today's senior review
  - `SYMBOL` — review just one symbol
  - `YYYY-MM-DD` or `YYYY-MM-DD SYMBOL`

## Steps

1. Resolve the date (default: today IST) and target symbol(s).
2. Load:
   - `out/intraday-research-<date>.json` (mechanical qty + snapshot)
   - `out/senior-review-<date>.md` (APPROVE/REVISE list)
   - `out/journal/intraday-<date>.jsonl` (circuit-breaker + open positions)
   - `agents/config/thresholds.json` (caps)
3. Spawn the `risk-manager` subagent via the Agent tool. Pass the reviewed
   plans + loaded context.
4. The subagent walks its decision rules in order:
   - Confluence haircut (0 / 25% / veto)
   - Regime haircut (0 / 50% / veto)
   - Circuit-breaker proximity (0 / 50%)
   - Sector concentration (0 / 50%)
   - Charges sanity (veto if netT1R < 0.6)
   - Absolute notional floor (veto below broker minimum)
5. Multiplicative haircuts applied in order; final qty emitted per plan.
6. Write to `out/risk-review-<date>.md`.
7. Print one-line summary: `N reviewed, X at-full-size, Y haircut, Z vetoed`.

## Authority (operator must understand)

- **Can REDUCE** qty or veto to 0 with reason.
- **Cannot INCREASE** qty beyond the mechanical qty.
- **Cannot UPGRADE** a NO_TRADE or REJECT verdict.
- Only the operator places orders.

## Output example

```yaml
risk_review:
  symbol: RELIANCE
  mechanical_qty: 250
  final_qty: 94
  haircut_multiplier: 0.375
  vetoed: false
  reasons:
    - "confluence 0.62 → 25% haircut"
    - "sector BANKS already has 1 long open → 50% haircut"
  risk_inr:
    mechanical: 12500
    final: 4688
  final_note: "at entry, confirm RVOL > 1.5 on the breakout bar; skip otherwise"
```

## Full pipeline (operator's mental model)

```
09:45 — intraday-researcher emits mechanical plans (qty = risk% / stopDist)
      — senior-trader reviews for context (APPROVE / REVISE / REJECT)
      — risk-manager sizes for risk (final_qty, often < mechanical)
operator decides and journals.
```
