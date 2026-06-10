# Pre-Trade — Full NSE F&O Readiness Check

Runs the entire `.claude/rules/nse-fno-pre-trade.md` ruleset in order, as a
gate before any stock-options trade is considered qualifying. This is the
**single command to run before placing an options trade**.

## Arguments
- `$ARGUMENTS` — stock symbol + bias + intended structure, e.g.
  `RELIANCE long vertical-debit-spread` or `all` to run against the watchlist.

## Workflow (matches rule §9 "Daily Workflow")

Execute in this order. Any failure short-circuits to NO_TRADE.

1. **Universe** — run `/check-fno-universe $SYMBOL`
2. **Contract specs** — run `/check-contract-specs $SYMBOL`
3. **Ban / Surveillance** — run `/check-ban-surveillance $SYMBOL`
4. **Corporate actions** — run `/check-corporate-actions $SYMBOL`
5. **Liquidity** — run `/check-liquidity $SYMBOL $BIAS`
6. **IV vs RV** — run `/check-iv-rv $SYMBOL $BIAS`
7. **Price + OI + volume alignment** — confirm via the existing
   `intraday-research` skill checklist (chart + indicators + OI buildup).
8. **Structure choice** — pick based on IV/RV classification (rule §6):
   - UNDERPRICED → long option / debit structure
   - OVERPRICED  → credit structure (gated on margin + no Extra-ELM)
   - NEUTRAL     → directional vertical
9. **Margin** — run `/check-margin $STRUCTURE`
10. **Expiry planning** — confirm exit-before-expiry rule (rule §1) unless
    delivery is part of the plan.

## Output

A single table summarising the 10 checks + final verdict:

```
| Step | Check              | Status  | Notes                           |
|------|--------------------|---------|---------------------------------|
| 1    | Universe           | PASS    | IN_UNIVERSE                     |
| 2    | Contract specs     | PASS    | lot=250, DTE=13, European       |
| 3    | Ban / Surveillance | PASS    | MWPL 42%, no ELM, no ASM        |
| 4    | Corp actions       | PASS    | no events ≤ 14d                 |
| 5    | Liquidity          | PASS    | ATM spread 0.3%, OI 500×lot     |
| 6    | IV vs RV           | NEUTRAL | IV 24.3 vs RV20 21.8            |
| 7    | Price + OI + vol   | ALIGN   | long bias, short-cover OI       |
| 8    | Structure          | CHOSEN  | vertical-debit-spread           |
| 9    | Margin             | PASS    | util 14%, 2σ loss within cap    |
| 10   | Expiry plan        | PASS    | exit by T-3                     |
|      | **Final**          | **QUALIFYING** |                          |
```

## Final rule

A trade qualifies **only if every step is PASS** and the intended structure
matches the IV/RV classification. Anything else is NO_TRADE.

## Output file

Write the combined result to `out/pre-trade-<symbol>-<timestamp>.md` for
audit.
