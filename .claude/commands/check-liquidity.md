# Check Liquidity (Underlying + ATM Strike)

Apply rule §5 of `.claude/rules/nse-fno-pre-trade.md`. Liquidity passes
first; opinion second. A pretty OI build-up in an illiquid contract is a
trap.

## Arguments
- `$ARGUMENTS` — stock symbol + intended bias (e.g. `RELIANCE long`) or
  `all` to rank the full watchlist.

## Steps

1. From NSE live pages (via adapter):
   - Option Chain for the underlying
   - Most Active Stock Calls / Puts
   - Change in Open Interest
2. Select the target contract:
   - Near-month or next-month only (reject far-month).
   - ATM strike, plus ≤ 2 OTM on the bias side.
3. For the selected strike, compute:
   - **Bid-ask spread %** = (ask − bid) / LTP × 100
   - **OI ≥ lot_size × `min_lot_oi_multiple`** (default 5×)
   - **Premium turnover** = volume × lot_size × premium LTP
   - **Market depth** at first 3 levels both sides
4. Rank the underlying by:
   - Position in Most-Active ranking
   - Cash-market volume (confirm ≥ 20-day avg)
5. Report per symbol/strike.

## Output

```
symbol: RELIANCE
expiry: near-month (2026-04-28)
strike: 1850 CE
atm_spread_pct: 0.32
oi: 125000
oi_vs_lot: 500x
premium_turnover_inr: 84_500_000
depth_top3_bid_size: 9500
depth_top3_ask_size: 8800
verdict: LIQUID
```

## Gates

- ATM spread > threshold (default 0.5%) → NO_TRADE
- OI < `min_lot_oi_multiple × lot_size` → NO_TRADE
- One-sided depth (bid or ask side < 20% of the other) → NO_TRADE
- Premium turnover below configured floor → NO_TRADE
- Far-month only → NO_TRADE

## Rule

OI without depth is noise. Confirm actual tradability before you size the
position.
