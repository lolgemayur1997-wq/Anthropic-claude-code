/**
 * NSE F&O charges calculator (intraday and overnight).
 *
 * Rates reflect current SEBI / exchange / tax circulars. Override via the
 * `ChargeSchedule` argument if rates change or your broker offers a different
 * deal (flat ₹20 vs percentage, for example).
 *
 * Returns a full breakdown PER SIDE (buy or sell) and for the round trip.
 * Every intraday plan MUST subtract these from the gross R-multiples — gross
 * R-multiples are fiction.
 *
 * References (verify on NSE/SEBI circulars before trading):
 *   - STT: Finance Act / CBDT notifications
 *   - Exchange transaction charge: NSE Circular NSE/F&A/xxxxx
 *   - SEBI turnover fee: SEBI circular
 *   - Stamp duty: Indian Stamp (Amendment) Act, 2020
 *   - GST: 18% on (brokerage + txn + SEBI)
 */

export type Segment = "futures" | "options";
export type Side = "buy" | "sell";

export interface ChargeSchedule {
  // Tax on SELL side only. Futures: 0.02% of traded value. Options: 0.1% of
  // premium (turnover) on sell; 0.125% of intrinsic on exercise.
  stt: { futures_sell_pct: number; options_sell_premium_pct: number; options_exercise_intrinsic_pct: number };
  // Exchange transaction charge (NSE). Rates differ by segment.
  // Values are % of turnover. Futures ~0.0019%, Options ~0.05% of premium.
  exchange_txn: { futures_pct: number; options_premium_pct: number };
  // SEBI turnover fee (% of turnover, both sides).
  sebi_turnover_pct: number;
  // Stamp duty (BUY side only). Futures 0.002%, Options 0.003%.
  stamp_duty: { futures_buy_pct: number; options_buy_premium_pct: number };
  // Brokerage per order (flat) OR % of turnover (max-cap aware broker).
  brokerage: { flat_inr: number; pct_of_turnover: number; cap_inr: number };
  // GST: 18% of (brokerage + exchange_txn + sebi).
  gst_pct: number;
}

export const DEFAULT_SCHEDULE: ChargeSchedule = {
  stt: {
    futures_sell_pct: 0.02,
    options_sell_premium_pct: 0.1,
    options_exercise_intrinsic_pct: 0.125,
  },
  exchange_txn: {
    futures_pct: 0.0019,
    options_premium_pct: 0.05,
  },
  sebi_turnover_pct: 0.0001,
  stamp_duty: {
    futures_buy_pct: 0.002,
    options_buy_premium_pct: 0.003,
  },
  brokerage: {
    flat_inr: 20,
    pct_of_turnover: 0.03,
    cap_inr: 20,
  },
  gst_pct: 18,
};

export interface TradeLeg {
  segment: Segment;
  side: Side;
  qty: number;         // contracts × lot size (i.e. total underlying units)
  price: number;       // futures price OR option premium
}

export interface ChargeBreakdown {
  turnover: number;
  stt: number;
  exchange_txn: number;
  sebi_turnover: number;
  stamp_duty: number;
  brokerage: number;
  gst: number;
  total: number;
}

function brokerageFor(turnover: number, s: ChargeSchedule): number {
  const pct = turnover * (s.brokerage.pct_of_turnover / 100);
  const b = Math.min(pct, s.brokerage.cap_inr);
  return Math.max(b, Math.min(s.brokerage.flat_inr, turnover)) || 0;
}

/** Charges for a single leg (buy or sell). Returns ₹ values. */
export function chargesForLeg(leg: TradeLeg, s: ChargeSchedule = DEFAULT_SCHEDULE): ChargeBreakdown {
  const turnover = leg.qty * leg.price;
  const stt = computeStt(leg, s);
  const exchange_txn = computeExchangeTxn(leg, s);
  const sebi_turnover = turnover * (s.sebi_turnover_pct / 100);
  const stamp_duty = computeStampDuty(leg, s);
  const brokerage = brokerageFor(turnover, s);
  const gstBase = brokerage + exchange_txn + sebi_turnover;
  const gst = gstBase * (s.gst_pct / 100);
  const total = stt + exchange_txn + sebi_turnover + stamp_duty + brokerage + gst;
  return { turnover, stt, exchange_txn, sebi_turnover, stamp_duty, brokerage, gst, total };
}

function computeStt(leg: TradeLeg, s: ChargeSchedule): number {
  if (leg.side !== "sell") return 0;
  const turnover = leg.qty * leg.price;
  if (leg.segment === "futures") return turnover * (s.stt.futures_sell_pct / 100);
  return turnover * (s.stt.options_sell_premium_pct / 100);
}

function computeExchangeTxn(leg: TradeLeg, s: ChargeSchedule): number {
  const turnover = leg.qty * leg.price;
  return leg.segment === "futures"
    ? turnover * (s.exchange_txn.futures_pct / 100)
    : turnover * (s.exchange_txn.options_premium_pct / 100);
}

function computeStampDuty(leg: TradeLeg, s: ChargeSchedule): number {
  if (leg.side !== "buy") return 0;
  const turnover = leg.qty * leg.price;
  return leg.segment === "futures"
    ? turnover * (s.stamp_duty.futures_buy_pct / 100)
    : turnover * (s.stamp_duty.options_buy_premium_pct / 100);
}

/** Round-trip charges: entry + exit. Returns total ₹ and total as % of
 *  entry notional. Use this when converting gross R-multiples to net. */
export function roundTripCharges(
  segment: Segment,
  qty: number,
  entryPrice: number,
  exitPrice: number,
  s: ChargeSchedule = DEFAULT_SCHEDULE,
): { entry: ChargeBreakdown; exit: ChargeBreakdown; total_inr: number; total_pct_of_entry_notional: number } {
  const entry = chargesForLeg({ segment, side: "buy", qty, price: entryPrice }, s);
  const exit = chargesForLeg({ segment, side: "sell", qty, price: exitPrice }, s);
  const total_inr = entry.total + exit.total;
  const total_pct_of_entry_notional =
    entryPrice === 0 ? 0 : (total_inr / (qty * entryPrice)) * 100;
  return { entry, exit, total_inr, total_pct_of_entry_notional };
}

/** Net R-multiple after round-trip charges.
 *  gross_r = (exit - entry) / (entry - stop)
 *  net_r   = (gross_r × risk_per_contract - charges_per_contract) / risk_per_contract
 */
export function netRMultiple(
  segment: Segment,
  qty: number,
  entryPrice: number,
  stopPrice: number,
  exitPrice: number,
  s: ChargeSchedule = DEFAULT_SCHEDULE,
): number {
  const riskPerUnit = Math.abs(entryPrice - stopPrice);
  if (riskPerUnit === 0 || qty === 0) return 0;
  const grossPnl = (exitPrice - entryPrice) * qty;
  const charges = roundTripCharges(segment, qty, entryPrice, exitPrice, s).total_inr;
  const netPnl = grossPnl - charges;
  const riskInr = riskPerUnit * qty;
  return netPnl / riskInr;
}
