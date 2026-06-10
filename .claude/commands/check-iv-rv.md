# Check IV vs Realized Volatility (Vol Edge)

Apply rule §6 of `.claude/rules/nse-fno-pre-trade.md`. Decide whether the
candidate is a **buyer** or **seller** of optionality for this setup.

## Arguments
- `$ARGUMENTS` — stock symbol + bias (e.g. `RELIANCE long`).

## Steps

1. For the underlying, gather:
   - **Current IV** of the ATM near-month option
   - **IV percentile** over trailing 252 sessions (or as many available)
   - **IV rank** over trailing 52 weeks
2. Compute realized volatility from daily close-to-close log returns:
   - `RV(20)` — 20-day annualized
   - `RV(60)` — 60-day annualized
3. Compute the **IV − RV spread**:
   - `IV − RV(20)` and `IV − RV(60)`
4. Classify:
   - `OVERPRICED` — IV percentile ≥ 70 AND IV > RV(20) by ≥ 20% → sell vol
   - `UNDERPRICED` — IV percentile ≤ 30 AND IV < RV(20) by ≥ 10% → buy vol
   - `NEUTRAL` — otherwise
5. Check **put-call skew** at ATM ± 5% strikes to detect positioning bias.
6. Check the **expected move** = ATM straddle premium / spot × sqrt(252/DTE).

## Output

```yaml
symbol: RELIANCE
atm_iv: 24.3
iv_percentile: 42
rv20: 21.8
rv60: 23.1
iv_minus_rv20: 2.5
iv_minus_rv60: 1.2
classification: NEUTRAL
expected_move_pct_to_expiry: 3.8
put_call_skew: flat
structure_suggestion: vertical-debit-spread
```

## Rule

- Long-option / debit structures favour `UNDERPRICED` regime.
- Short-premium / credit structures favour `OVERPRICED` regime + sufficient
  margin headroom. Gate additionally on Extra-ELM / ASM (see
  `/check-ban-surveillance`).
- `NEUTRAL` regimes: prefer directional verticals over naked structures.
