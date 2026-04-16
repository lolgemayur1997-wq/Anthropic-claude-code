# Check Margin & Capital Efficiency (SPAN + ELM)

Apply rule §7 of `.claude/rules/nse-fno-pre-trade.md`. Margin load and stress
determine whether a premium-collected number is actually attractive on a
risk-adjusted basis.

## Arguments
- `$ARGUMENTS` — structure description (e.g. `RELIANCE 1850 CE short 1 lot`).

## Steps

1. Compute the **SPAN margin** via the broker's margin API (Kite:
   `/margins/basket`, Upstox: `/margin`, Dhan: `/margin-calculator`).
2. Add **ELM = 3.5%** of notional (equity-derivatives ELM).
3. Check for **Extra ELM (+15%)** and **ASM** flags (see
   `/check-ban-surveillance`).
4. Compute **stress margins**:
   - Underlying ±1σ move (derived from RV20 annualized → 1-day)
   - Underlying ±2σ move
5. Express capital efficiency:
   - **Max loss** (for defined-risk structures) — explicit INR
   - **Return on margin** (ROM) at T+0 under 0/1/2σ moves
   - **Margin utilisation %** of account equity
6. Apply NSE Clearing intraday snapshot timing: SPAN files refresh at
   11:00, 12:30, 14:00, 15:30, EOD, BOD. Flag if current time is within ±5m
   of a refresh — numbers can jump.

## Output

```yaml
structure: short RELIANCE 1850 CE 1 lot (250 qty)
premium_collected_inr: 9500
span_inr: 98000
elm_inr: 16187.50
extra_elm_inr: 0
asm_inr: 0
total_margin_inr: 114187.50
margin_utilisation_pct: 22.8
max_loss_inr: undefined-risk
rom_t0_0sigma_pct: 8.3
stress:
  plus_1sigma_pnl_inr: -18500
  minus_1sigma_pnl_inr: 9500
  plus_2sigma_pnl_inr: -62000
  minus_2sigma_pnl_inr: 9500
verdict: MARGIN_HEAVY; RECONSIDER if short-premium
```

## Gates

- Margin utilisation > configured cap (default 25% of equity) → NO_TRADE
- Undefined-risk structure + 2σ stress loss > 2× premium collected → NO_TRADE
- SPAN file within refresh window → recompute after next snapshot

## Rule

A short option that looks attractive on premium can still be a bad trade on
return on margin. Always read premium, margin, and stress together.
