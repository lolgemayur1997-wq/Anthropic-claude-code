# Pick Strike — Delta-targeted strike selection

"ATM ± 2 strikes" is a heuristic. A disciplined trader picks the strike
closest to a target delta (0.50 ATM, 0.30 for credit-spread short leg, 0.70
for directional long). Backed by `agents/strikes.ts::pickStrikeByDelta`.

## Arguments
- `$ARGUMENTS` — symbol + type + target delta, e.g.
  - `RELIANCE call 0.5` — ATM call
  - `NIFTY put 0.3`    — 30-delta put (credit-spread short leg)
  - `vertical RELIANCE call 0.5 0.3` — two strikes: long 0.5, short 0.3

## Steps

1. Pull the option chain from the adapter (strikes available today, near
   expiry).
2. Pull spot, ATM IV, DTE, risk-free rate (India 91-day T-bill ≈ 6.75% as of
   last MPC; verify on RBI page). Dividend yield assumed 0 unless supplied.
3. For single-delta mode: call `pickStrikeByDelta()` and return the closest
   strike plus its computed delta, premium, and delta error.
4. For vertical mode: call `pickVerticalStrikes()` and return both legs.

## Output (single)

```yaml
symbol: RELIANCE
type: call
target_delta: 0.5
spot: 2842.5
iv_annualized: 0.243
dte_days: 13
rate: 0.0675
picked_strike: 2840
computed_delta: 0.51
premium_model: 28.4
delta_error: 0.01
```

## Output (vertical)

```yaml
symbol: NIFTY
type: put
dte_days: 7
spot: 22540
long_leg:  { strike: 22500, delta: -0.48, premium: 95 }
short_leg: { strike: 22300, delta: -0.28, premium: 42 }
net_debit_model: 53
```

## Rules

- If any input is missing (no IV, no chain, zero DTE), return `null` and
  gate NO_TRADE. Never guess a strike.
- Delta computed by Black-Scholes; options on NSE are European + physical,
  so BS is the correct model.
- Verify the picked strike actually trades at acceptable spread via
  `/check-liquidity` before sending to `/pre-trade`.
