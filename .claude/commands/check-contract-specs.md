# Check Contract Specifications

Pull and report the exact contract specs for a stock-options underlying from
the latest NSE daily contract file. Lot sizes and quantity freezes change —
never rely on memory.

## Arguments
- `$ARGUMENTS` — the stock symbol (e.g. `RELIANCE`).

## Steps

1. Load today's contract file cached by the broker adapter.
2. Extract for the symbol:
   - Expiry date (last Tuesday rule; flag if holiday-shifted)
   - Market lot (applicable lot size)
   - Quantity freeze
   - Tick size
   - Base price / previous settlement
   - Applicable margin percentage (SPAN + ELM)
   - Style = European (assert; reject if not)
   - Settlement = Physical (assert)
3. Cross-check the expiry date against NSE holiday calendar.
4. Compute **days to expiry (DTE)** in IST.
5. Compute **minimum notional** = lot size × LTP.

## Output

```yaml
symbol: RELIANCE
expiry: 2026-04-28
dte_days: 13
lot_size: 250
quantity_freeze: 25000
tick_size: 0.05
style: European
settlement: Physical
min_notional_inr: 701250
applicable_margin_pct: 17.5
```

## Rules from `.claude/rules/nse-fno-pre-trade.md` §1

- European style + physical settlement only.
- Auto-exercise for ITM at expiry; "do not exercise" discontinued Mar 2023.
- Never hold short stock options into expiry without delivery plan.
