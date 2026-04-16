# Check F&O Universe Eligibility

Verify that a symbol is in the current official NSE F&O underlyings list.

## Arguments
- `$ARGUMENTS` — the stock symbol (e.g. `RELIANCE`) or `all` to check the full watchlist.

## Steps

1. Read the official NSE underlyings list from the cached contract file at
   `agents/config/nse-fo-universe.csv` (downloaded by the adapter).
   - If the file is missing or > 24h old, ask the adapter to refresh it.
2. For the requested symbol(s), verify eligibility against the canonical
   criteria in `.claude/rules/nse-fno-pre-trade.md` section 2:
   - Top 500 by 6-month avg daily market-cap & traded value
   - Median quarter-sigma order size ≥ ₹75 lakh
   - MWPL ≥ ₹1,500 cr
   - Average daily deliverable value ≥ ₹35 cr
3. Report per symbol:
   - `IN_UNIVERSE` with underlying index (NIFTY/BANKNIFTY constituent?),
     current lot size, expiry, quantity freeze
   - `NOT_IN_UNIVERSE` with the reason if known

## Output

```
| Symbol | Status | Lot | Expiry | Quantity Freeze | Notes |
|--------|--------|-----|--------|-----------------|-------|
| RELIANCE | IN_UNIVERSE | 250 | 2026-04-28 | 25000 | near-month |
```

A symbol that fails this check is a hard NO-TRADE.
