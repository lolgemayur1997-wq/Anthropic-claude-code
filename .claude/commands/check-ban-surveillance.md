# Check Ban / Extra-ELM / Surveillance Status

Apply the NSE Clearing risk-control flags from
`.claude/rules/nse-fno-pre-trade.md` §3. Any flag is a hard NO-TRADE for
fresh positions.

## Arguments
- `$ARGUMENTS` — stock symbol or `all` for the full watchlist.

## Steps

1. Load the **daily F&O ban list** published by NSE Clearing (the adapter
   should cache the CSV at `agents/config/nse-ban-list.csv`).
2. Compute **MWPL %** = open interest / market-wide position limit × 100.
   - `>= 95%` → **BAN PERIOD** → NO_TRADE for fresh OI.
   - `>= 90%` and < 95% → warn (approaching ban).
3. Check **Extra ELM (+15%)** list: where top-10 clients hold > 20% of
   applicable MWPL, an additional 15% extreme-loss margin is levied.
4. Check **Additional Surveillance Margin (ASM)** list.
5. Report flags and penalty context:
   - Violation penalty: 1% of quantity value OR ₹1,00,000 whichever is
     lower, min ₹5,000 (per entity per stock). Separate penalty for
     increasing positions during ban.

## Output

```
| Symbol | MWPL % | Ban? | Extra ELM? | ASM? | Verdict |
|--------|--------|------|------------|------|---------|
| XYZ    | 97.2   | YES  | YES        | NO   | NO_TRADE (ban + ELM) |
```

## Rule

If the intended structure is **short-premium** (selling), additionally gate
on any Extra-ELM / ASM flag — capital efficiency is destroyed even if the
position itself is allowed.
