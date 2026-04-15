---
name: intraday-research
description: |
  Run a disciplined pre-market intraday research pass on an Indian equities / F&O
  watchlist. Ingests live data via a broker/data adapter (Kite, Upstox, Dhan,
  etc. — you configure), scores each symbol against the checklist, and emits a
  structured research note with entry, stop, target, invalidation levels and
  position-sizing math. Use at or before 09:45 IST, after the opening range has
  formed. Does NOT place orders and does NOT generate trade signals without
  live data — it is a research runner, not an advisor.
---

# Intraday Research Skill

> **Compliance notice.** This skill produces research output for the user's own
> decision-making. It is **not** investment advice. The user is solely
> responsible for any trade placed. Options trading carries uncapped/high risk;
> per SEBI's Jan 2023 retail F&O study, ~89% of individual intraday option
> traders posted net losses. Acting on material non-public information violates
> SEBI (PIT) Regulations, 2015 — never source "insider" tips. Corporate
> disclosures must come from public channels only (NSE/BSE announcements,
> company filings, SEBI EDIFAR, regulator press releases).

## Authoritative ruleset

For **stock-options trades on NSE**, always defer to
`.claude/rules/nse-fno-pre-trade.md`. That file encodes the exchange's own
thresholds (ban at 95% MWPL, extra ELM, ASM, corp-action adjustments,
European + physical settlement, auto-exercise, etc.). The `gates` in
`config/thresholds.json` must never loosen those thresholds.

Operator-invokable checks (all defined as slash commands):

Pre-trade (NSE F&O rules):
- `/check-fno-universe` — universe eligibility (rule §2)
- `/check-contract-specs` — lot, expiry, DTE, style, settlement (rule §1)
- `/check-ban-surveillance` — MWPL %, Extra ELM, ASM (rule §3)
- `/check-corporate-actions` — earnings, splits, bonus, rights, mergers (§4)
- `/check-liquidity` — ATM spread, OI vs lot, premium turnover, depth (§5)
- `/check-iv-rv` — IV percentile vs 20/60d realized vol; buyer vs seller (§6)
- `/check-margin` — SPAN + ELM + 1σ/2σ stress (§7)
- `/pre-trade` — runs the full sequence as a single gate (rule §9 workflow)

Structure + strike (analytics):
- `/pick-structure` — best structure for IV regime × bias × DTE × margin
- `/pick-strike` — delta-targeted strike picker (Black-Scholes); supports
  vertical-spread two-leg selection

Discipline (tilt protection + learning loop):
- `/journal` — append-only event log; powers circuit breakers
- `/post-mortem` — EOD review: forecast vs. outcome, gate calibration, tuning

## Hard gates the runner enforces automatically (no slash command needed)

- NSE F&O rules §1–§7 (see above)
- **Daily loss cap** — halt for rest of day once breached
- **Max trades per day** — hard cap (default 3)
- **Cooldown after stop-out** — NO_TRADE for N minutes after a stopped trade
- **Sector/correlation cap** — max N same-direction positions in the same sector
- **Charges bake-in** — targets are expressed as *net* R-multiples (after
  STT + exchange + SEBI + stamp + brokerage + GST)

## When to invoke

- At **09:30–09:45 IST** after the opening range (ORB) has printed.
- On explicit `/intraday-research` invocation.
- Triggered by the 09:45 cron hook (see `scripts/run-intraday-research.sh`).
- Before any stock-options trade: run `/pre-trade <symbol> <bias>` first.
- After the morning scan: run `/review-trade` to get the senior-trader's
  discretionary review of each `PASS` plan.

## Two-stage review (team)

```
Stage 1 — intraday-researcher    (rule-based)
  live data → indicators → scoring → NSE F&O gates → circuit breakers → plan

Stage 2 — senior-trader          (discretionary, /review-trade)
  context · pattern quality · trap risk · flow-vs-price · premium sanity ·
  structure · size · invalidation clarity · regret test
  ⇒ APPROVE / REVISE / REJECT per plan
```

The senior-trader can DOWNGRADE a PASS to NO_TRADE with reason; it cannot
UPGRADE a gated or UNKNOWN plan — rule gates encode exchange reality and
stay the floor. See `.claude/agents/README.md` for the full roster and
authority matrix.

## Activation (raw data → scored snapshot → report)

The runner is broker-agnostic. The data pipeline has one choke-point:

```
broker adapter → RawMarketData → buildSnapshot() → SymbolSnapshot → runner → report
                                       │
                                       ├─ indicators.ts  (EMA, RSI, MACD, VWAP,
                                       │                  ATR, Supertrend, Bollinger)
                                       └─ scoring.ts     (section-weighted 0..1 scores)
```

To enable live data you implement **two functions** on one adapter
(`agents/adapters/{kite,upstox,dhan}.ts`):

1. `getIndiaVix()` — return India VIX LTP.
2. `getSymbolSnapshot(symbol, segment)` — fetch raw candles + quote + OI,
   assemble a `RawMarketData`, return `buildSnapshot(raw)`.

Everything downstream — indicator math, scoring, gates, trade-plan
generation, report rendering, Telegram delivery — is shared and tested.

## Inputs

The runner expects the following from the configured adapter:

| Input                          | Source                                       |
|--------------------------------|----------------------------------------------|
| Watchlist (symbols + segment)  | `config/watchlist.json` (user-owned)         |
| 1m / 5m / 15m OHLCV            | Broker historical API                        |
| Live LTP + bid/ask + day H/L   | Broker WebSocket / REST quote                |
| Option chain + OI + OI change  | Broker option-chain API                      |
| Index context (NIFTY / BNF)    | Broker index feed                            |
| India VIX                      | NSE India VIX feed                           |
| Bulk / block deals             | NSE/BSE public bulk-deal CSV                 |
| Corporate announcements        | NSE/BSE corporate announcements feed         |
| News headlines                 | Configured news feed (public RSS / vendor)   |

If any input is unavailable, the checklist item is marked **UNKNOWN** — never
fabricated. A trade plan with any UNKNOWN primary criterion is gated to
**NO-TRADE** by default.

## Pre-market gate (before 09:15)

Run these once before the session — if any fails, the day's bias is downgraded:

- [ ] SGX Nifty / GIFT Nifty overnight gap and direction noted
- [ ] Dow / Nasdaq / S&P close read
- [ ] Asia (Nikkei, Hang Seng, KOSPI) direction noted
- [ ] Brent crude, USD/INR, US 10Y yield levels read
- [ ] India VIX prior close and implied direction noted
- [ ] Scheduled macro events (RBI, CPI, Fed, FOMC, budget, result-day) flagged
- [ ] FII / DII cash figures from prior session logged
- [ ] Overnight news scan complete (stock-specific, sectoral, regulatory)

## Opening-range window (09:15–09:30)

- [ ] Record 15-min ORB high, low, range for NIFTY, BANKNIFTY
- [ ] Record ORB high/low for each watchlist symbol
- [ ] Note gap classification per symbol: gap-up continuation / gap-fill /
      inside-day / gap-and-go / gap-and-reverse
- [ ] Flag symbols with first-candle volume > 1.5× 20-day average first-candle

## Per-symbol checklist (09:30–09:45 pass)

For each watchlist symbol, score the following. A trade only qualifies if it
hits the **minimum score threshold** defined in `config/thresholds.json`.

### 1. Price structure
- [ ] Trend on 15m (higher-highs/higher-lows vs. lower-highs/lower-lows)
- [ ] Trend on 1h for context
- [ ] Position relative to prior-day H/L/Close (PDH / PDL / PDC)
- [ ] Position relative to ORB high/low
- [ ] Key daily support / resistance within 2% of LTP
- [ ] Weekly / monthly pivots (P, R1, S1) within range

### 2. Chart patterns (explicit tag; no ambiguous reads)
- [ ] Named pattern on 5m or 15m (flag/pennant/triangle/cup-handle/VCP/
      double-top/bottom/H&S/IH&S/rectangle) OR **none**
- [ ] Breakout / breakdown confirmed on close > level with volume? yes/no
- [ ] Fake-out risk (prior failed breakouts at same level last 5 sessions)

### 3. Indicators (multi-timeframe; snapshot values, not prose)
- [ ] RSI(14) on 5m and 15m — value + divergence flag
- [ ] MACD(12,26,9) on 15m — histogram sign + zero-line + signal cross
- [ ] VWAP on 5m — price above/below + distance from VWAP in %
- [ ] Anchored VWAP from session open and from prior swing pivot
- [ ] Supertrend(10,3) on 15m — trend side + flip-distance
- [ ] EMA stack: 9 / 20 / 50 on 5m and 15m — aligned up / down / tangled
- [ ] ATR(14) on 5m — for stop-distance sizing
- [ ] Bollinger(20,2) squeeze / expansion state

### 4. Volume
- [ ] Current volume vs. 20-day average at same time-of-day (intraday relative
      volume, RVOL) — need ≥ 1.5× for a valid breakout trade
- [ ] Volume-at-price node within 1% of LTP (HVN / LVN from prior 5-session VP)
- [ ] Delivery % trend over last 5 sessions (rising / falling)

### 5. Order blocks & market structure
- [ ] Last bullish / bearish order block on 15m with mitigation status
- [ ] Liquidity sweeps (equal highs / lows taken in prior session)
- [ ] Fair-value gap / imbalance on 5m not yet filled
- [ ] Break-of-structure / change-of-character tag

### 6. Options / OI (for F&O symbols)
- [ ] Max pain strike for current expiry
- [ ] Highest OI call + put strikes (resistance / support zones)
- [ ] Today's OI change by strike — buildup classification:
      long-build / short-build / long-unwind / short-cover
- [ ] PCR (OI) for the symbol and for index
- [ ] IV rank / IV percentile (symbol + India VIX context)
- [ ] ATM straddle price vs. expected move
- [ ] Unusual options activity: strikes with >2× avg OI-change

### 7. News / flow (public sources only)
- [ ] NSE/BSE corporate announcement today? (link)
- [ ] Bulk / block deal disclosure today or prior session? (counterparty if
      disclosed)
- [ ] Headline scan: result beat/miss, guidance, M&A, order-win, rating change,
      regulatory action, promoter pledge change, QIP/preferential, buyback
- [ ] Sector news / peer move correlation
- [ ] F&O ban list status (symbol currently banned? cannot add fresh positions)

### 8. Event risk
- [ ] Result date within 3 trading days?
- [ ] Ex-date (dividend / split / bonus) today or tomorrow?
- [ ] AGM / EGM today?
- [ ] Macro print during session (CPI / IIP / RBI / Fed)?

## Scoring

Each checklist section contributes to a weighted score (weights configurable in
`config/thresholds.json`, defaults shown):

| Section              | Weight |
|----------------------|--------|
| Price structure      | 20%    |
| Chart pattern        | 15%    |
| Indicators           | 15%    |
| Volume               | 15%    |
| Order blocks         | 10%    |
| Options / OI         | 15%    |
| News / flow          | 5%     |
| Event risk (penalty) | -10% per active risk flag |

**Gates (hard NO-TRADE overrides regardless of score):**
- Any primary input UNKNOWN
- Symbol in F&O ban list (for fresh options trade)
- India VIX > configured ceiling (default 22)
- Scheduled macro print within next 60 minutes
- Result within 1 trading day and user has not explicitly opted in
- Spread > configured ceiling (default 0.15% for liquid F&O underlyings)

## Trade-plan template (emitted per qualifying symbol)

```yaml
symbol: <SYMBOL>
segment: equity | futures | options
bias: long | short
score: <0–100>
setup: <one-line named setup, e.g. "15m flag breakout above PDH with RVOL 2.1">
invalidation: <price level that disproves the thesis>

entry:
  trigger: <exact condition, e.g. "5m close > 1842.50">
  zone: [<low>, <high>]

stop_loss:
  level: <price>
  distance_atr: <multiple of ATR(14) 5m>
  basis: <structural | ATR | level-based>

targets:
  t1: { level: <price>, r_multiple: 1.0 }
  t2: { level: <price>, r_multiple: 2.0 }
  trail_after: <price or condition>

position_sizing:
  account_risk_pct: <configured, default 0.5%>
  risk_per_trade_inr: <= account_risk_pct * equity>
  qty: floor(risk_per_trade_inr / (entry - stop))
  notional_cap_inr: <configured, default 10% of equity>

options_plan:      # only if segment == options
  instrument: <e.g. "NIFTY 25APR 22500 CE">
  structure: <long-call | long-put | debit-spread | iron-fly | ...>
  underlying_view: <mirrors bias>
  max_loss_inr: <debit or net premium>
  target_premium: <absolute or as underlying-move proxy>
  exit_by: <time-stop, e.g. "14:30 IST if not in profit">
  theta_gate: <max acceptable theta/day as % of premium>

execution_notes:
  - avoid market-on-open; use limit at or inside spread
  - do not add to losers
  - scale out at t1 (50%), move stop to entry

context_snapshot:
  india_vix: <value>
  nifty_trend: <up | down | range>
  banknifty_trend: <up | down | range>
  sector_trend: <up | down | range>
  fii_dii_prior: <...>
```

## Output

The runner writes:

- `out/intraday-research-<YYYY-MM-DD>.md` — human-readable note
- `out/intraday-research-<YYYY-MM-DD>.json` — machine-readable structured output
- `out/intraday-research-<YYYY-MM-DD>.log` — raw adapter responses (audit trail)

## Disclaimers (always printed at the top of every report)

```
This report is automated research, not investment advice. The operator is
solely responsible for any trade decision. Option trading is high-risk; losses
can exceed premium paid on short-vol strategies. Do not act on non-public /
insider information. Verify every level against your broker's terminal before
placing an order.
```
