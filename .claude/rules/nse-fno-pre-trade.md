# NSE F&O Stock-Options Pre-Trade Ruleset

Canonical checklist the `intraday-researcher` agent MUST apply before any
stock-options trade is considered qualifying. Sourced from NSE / NSE Clearing
public documentation. Numbers are exchange-published thresholds; local config
in `agents/config/thresholds.json` may tighten them but must never loosen them
past a hard gate.

---

## 1. Contract mechanics (operational-risk layer)

Before anything else — know the instrument.

- Individual-stock options on NSE are **European style**.
- Cycle: **3 months** (near, next, far); expiry on the **last Tuesday** of the
  expiry month (or the previous trading day if that Tuesday is a holiday).
- **Physical settlement**. Final settlement price = last 30-minute VWAP of
  the underlying across exchanges on expiry day.
- **ITM auto-exercise/assignment**. The "do not exercise" facility for stock
  options was discontinued in March 2023.
- **Rule**: never hold short stock options into expiry unless you are ready
  for delivery-style settlement and the margin hit that accompanies it.

## 2. Universe eligibility — do not treat "F&O" as a quality stamp

NSE eligibility for individual-stock derivatives requires ALL of:

- Stock among **top 500** by 6-month average daily market-cap AND traded value
- Median **quarter-sigma order size ≥ ₹75 lakh**
- **MWPL ≥ ₹1,500 crore**
- Average daily **deliverable value ≥ ₹35 crore**

- **Rule**: start the universe from the official NSE underlyings / contract
  file, not broker tips or social media.
- **Rule**: lot size is not static — verify against the latest daily contract
  file on every trade.

## 3. Risk-control flags (hard gates)

These make a stock untradeable regardless of setup quality.

| Flag | Threshold | Effect |
|------|-----------|--------|
| **F&O ban period** | OI > 95% of MWPL | Only position-reducing trades allowed; increasing OI attracts penalty |
| **Extra ELM (Extreme Loss Margin)** | Top-10 clients > 20% of applicable MWPL | +15% extreme-loss margin levied |
| **Additional Surveillance Margin (ASM)** | Per NSE shortlist | Extra margin; capital efficiency destroyed for short-premium strategies |

Violation penalties (NSE Clearing): 1% of violating quantity value OR
₹1,00,000 per entity per stock, whichever is lower, min ₹5,000. Separate
penalties for increasing positions during ban.

- **Rule**: gate NO_TRADE on ban-period AND on extra-ELM if the intended
  structure is short-premium (selling).

## 4. Corporate actions & event risk

NSE adjusts strike, market lot, futures base price, and position size for:
bonus, splits, consolidations, rights, dividends, mergers. For mergers, no
fresh contracts are introduced after record-date announcement; GTC/GTD orders
may be cancelled on the last cum-date.

Mandatory per-symbol checks before entry:

- Earnings / result date
- Board meeting
- Dividend announcement (ex-date)
- Split / bonus / rights / consolidation
- Merger / demerger
- Unusual news-flow

- **Rule**: gate NO_TRADE if any corporate action or result falls within the
  configured horizon (default ≤ 2 trading days).

## 5. Liquidity inspection — first principle for options

Rank the universe from NSE live pages BEFORE reading charts:

- Option Chain
- Market Watch — Equity Derivatives
- Most Active Contracts (stock calls / stock puts separately)
- Change in Open Interest
- All available as CSV.

Per-contract acceptance criteria:

- Liquid underlying (from Most Active ranking)
- **Near-month or next-month** only
- **ATM to 1–2 strikes OTM** only (no deep OTM)
- Reject if **bid-ask spread > threshold** (default 0.5% of LTP for ATM
  options)
- Reject strikes with thin premium turnover / one-sided order book
- Reject names with one-sided OI buildup in illiquid strikes

- **Rule**: A pretty OI buildup in an illiquid contract is a trap. Liquidity
  passes first; opinion second.

## 6. Price + volatility + positioning (read together)

For every candidate underlying, all three layers must agree:

- **Regime**: trend, support/resistance, recent gaps, realized volatility
- **Pricing**: current IV vs. IV history (percentile), expected move into
  expiry, put/call skew
- **Positioning**: OI change, volume, roll behaviour, depth of liquid strikes

Aligned setups only:

- Bullish stock + call-side activity + IV not extreme → long call / call spread
- Bearish stock + put-side activity + adequate liquidity → long put / put spread

- **Rule**: OI alone is NOT a directional signal.

## 7. Margin / capital efficiency (SPAN + ELM)

NSE Clearing updates SPAN files intraday at **11:00, 12:30, 14:00, 15:30,
EOD, BOD**. Equity-derivatives ELM is **3.5% of notional**. Client margin
reporting uses ≥ 4 random intraday snapshots against BOD parameters plus net
option premium payable at snapshot time.

Before selling options, compute:

- Margin now
- Margin under 1σ and 2σ underlying moves
- Whether additional surveillance / ELM applies
- Return on margin — not just premium collected

- **Rule**: size by max loss AND margin stress — not by premium alone.

## 8. Backtesting — use the official NSE data stack

- Participant-wise open interest + trading volumes
- Delta-equivalent OI
- Exposure limit files
- Contract files (daily)
- UDiFF Common Bhavcopy Final
- Historical Reports archive

A credible backtest must include: survivorship-correct universe, actual
tradable contracts per date, historical lot changes, corporate-action
adjustments, ban-period exclusions, realistic slippage + charges, margin
usage (not just premium P&L), expiry handling (physical-settlement
consequences), walk-forward validation.

## 9. Daily workflow — the clean order of operations

1. Pull official NSE stock-derivatives universe
2. Pull latest contract file (lot size, quantity freeze)
3. Remove **ban-period** + **extra-ELM** + **surveillance** names
4. Remove names with **corporate action / earnings** proximity
5. Rank remaining names by **liquidity** (spread, OI, premium turnover)
6. For top names, compare **IV vs realized volatility**
7. Confirm with **price + OI + volume**
8. Choose structure based on **vol edge and event profile**
9. Size by **max loss / margin stress**
10. **Exit before expiry** unless delivery/assignment is explicitly planned

## 10. Bottom-line gate summary

A stock-options trade is NO_TRADE unless ALL of the following are true:

- Symbol is in the current official NSE F&O universe
- Lot size verified against latest daily contract file
- Not in ban period (MWPL < 95%)
- Not in extra-ELM (if short-premium) and not in ASM
- No corporate action / result within configured horizon
- Near-month or next-month only
- ATM to ≤2 OTM only
- ATM bid-ask spread within threshold
- Liquid underlying + liquid strike (OI + premium turnover above floors)
- IV vs realized vol edge exists and matches the structure
- Price + OI + volume agree with the bias
- Margin requirement and 1–2σ stress fit the risk budget
- DTE ≥ configured floor (default 2) for short-premium structures
