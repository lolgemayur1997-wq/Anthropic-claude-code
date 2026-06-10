# Check Corporate Actions & Event Risk

Apply rule §4 of `.claude/rules/nse-fno-pre-trade.md`: corporate actions
adjust strike, lot, and base price — a clean setup becomes untradeable if
contract terms are about to change.

## Arguments
- `$ARGUMENTS` — stock symbol or `all`.

## Steps

1. Query the NSE corporate-actions feed (cached by the adapter) for each
   symbol over the next **14 calendar days**.
2. Classify any hit as one of:
   - `EARNINGS` — result announcement
   - `BOARD_MEETING`
   - `DIVIDEND` (ex-date)
   - `SPLIT` / `BONUS` / `RIGHTS` / `CONSOLIDATION`
   - `MERGER` / `DEMERGER`
   - `OTHER`
3. Flag the **days-to-event** (DTE from today in IST).
4. For `MERGER` / `DEMERGER`: check whether no-fresh-contracts window has
   begun post record-date announcement; GTC/GTD cancelled on last cum-date.
5. Cross-check the F&O contract adjustment file — if NSE has announced a
   lot/strike adjustment effective date, flag it.

## Output

```
| Symbol | Event | DTE | Effect on contract | Verdict |
|--------|-------|-----|--------------------|---------|
| INFY   | EARNINGS | 1 | none                | NO_TRADE (within 1 day) |
| XYZ    | BONUS 1:2 | 5 | lot & strike adjustment | NO_TRADE until effective date |
```

## Gates

- Event within configured horizon (default ≤ 2 trading days) → NO_TRADE
- Merger / demerger in the cum-date window → NO_TRADE
- Unresolved contract-adjustment pending → NO_TRADE

## Rule

OI reads on a stock with an imminent corporate action are unreliable.
Strikes, lots, and base prices get adjusted; historical indicators are not
directly comparable to post-adjustment quotes.
