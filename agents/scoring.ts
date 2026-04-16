/**
 * Pure scoring functions. Each returns a number in [0, 1] or `null` when the
 * required inputs are missing. The runner's gate logic translates `null` into
 * UNKNOWN → NO-TRADE.
 */

import type { EmaStack, MacdResult, SupertrendResult } from "./indicators.ts";

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

// --- 1. Price structure ---

export interface StructureInputs {
  ltp: number | null;
  prevDayHigh: number | null;
  prevDayLow: number | null;
  prevClose: number | null;
  orbHigh: number | null;
  orbLow: number | null;
  trend15mHigherHighs: boolean | null;
  trend1hHigherHighs: boolean | null;
}

export function scoreStructure(s: StructureInputs): number | null {
  if (s.ltp === null) return null;
  let pts = 0;
  let tot = 0;
  // Position vs. PDH/PDL
  if (s.prevDayHigh !== null) {
    tot += 1;
    if (s.ltp > s.prevDayHigh) pts += 1;
    else if (s.prevDayLow !== null && s.ltp > s.prevDayLow) pts += 0.5;
  }
  // ORB containment
  if (s.orbHigh !== null && s.orbLow !== null) {
    tot += 1;
    if (s.ltp > s.orbHigh || s.ltp < s.orbLow) pts += 1;
  }
  // Multi-timeframe trend
  if (s.trend15mHigherHighs !== null) {
    tot += 1;
    if (s.trend15mHigherHighs) pts += 1;
  }
  if (s.trend1hHigherHighs !== null) {
    tot += 1;
    if (s.trend1hHigherHighs) pts += 1;
  }
  return tot === 0 ? null : clamp01(pts / tot);
}

// --- 2. Chart pattern ---

export interface PatternInputs {
  named: string | null; // e.g. "flag", "triangle", "h&s", or null
  breakoutConfirmed: boolean | null;
  failedRecently: boolean | null;
}

export function scorePattern(p: PatternInputs): number | null {
  if (p.named === null) return 0; // no pattern is a valid 0
  let s = 0.5; // a named pattern alone is 0.5
  if (p.breakoutConfirmed === true) s += 0.4;
  if (p.failedRecently === true) s -= 0.3;
  return clamp01(s);
}

// --- 3. Indicators ---

export interface IndicatorInputs {
  rsi5m: number | null;
  rsi15m: number | null;
  macd15m: MacdResult | null;
  vwap5m: number | null;
  ltp: number | null;
  supertrend15m: SupertrendResult | null;
  emaStack5m: EmaStack | null;
}

export function scoreIndicators(i: IndicatorInputs): number | null {
  const parts: number[] = [];
  if (i.rsi5m !== null) parts.push(rsiBand(i.rsi5m));
  if (i.rsi15m !== null) parts.push(rsiBand(i.rsi15m));
  if (i.macd15m && i.macd15m.hist !== null) {
    parts.push(i.macd15m.hist > 0 ? 1 : 0);
  }
  if (i.vwap5m !== null && i.ltp !== null) {
    parts.push(i.ltp > i.vwap5m ? 1 : 0);
  }
  if (i.supertrend15m) {
    parts.push(i.supertrend15m.trend === "up" ? 1 : 0);
  }
  if (i.emaStack5m !== null) {
    parts.push(i.emaStack5m === "up" ? 1 : i.emaStack5m === "down" ? 0 : 0.5);
  }
  if (parts.length === 0) return null;
  return clamp01(parts.reduce((a, b) => a + b, 0) / parts.length);
}

function rsiBand(v: number): number {
  if (v >= 80) return 0.2; // overbought — fade zone
  if (v >= 60) return 1.0; // strong momentum
  if (v >= 40) return 0.5; // neutral
  if (v >= 20) return 0.2; // weak
  return 0.0; // deeply oversold
}

// --- 4. Volume ---

export interface VolumeInputs {
  rvol: number | null;
  deliveryPctTrend: "rising" | "falling" | "flat" | null;
  minRvol: number;
}

export function scoreVolume(v: VolumeInputs): number | null {
  if (v.rvol === null) return null;
  let s = 0;
  if (v.rvol >= v.minRvol * 1.5) s += 0.7;
  else if (v.rvol >= v.minRvol) s += 0.5;
  else if (v.rvol >= v.minRvol * 0.75) s += 0.2;
  if (v.deliveryPctTrend === "rising") s += 0.3;
  else if (v.deliveryPctTrend === "flat") s += 0.15;
  return clamp01(s);
}

// --- 5. Order blocks / structure ---

export interface OrderBlockInputs {
  mitigatedObNearby: boolean | null; // untapped OB within 1 ATR of LTP
  fvgUnfilled: boolean | null;
  liquiditySweep: boolean | null;
  breakOfStructure: boolean | null;
}

export function scoreOrderBlocks(o: OrderBlockInputs): number | null {
  const flags = [o.mitigatedObNearby, o.fvgUnfilled, o.liquiditySweep, o.breakOfStructure];
  const known = flags.filter((f) => f !== null) as boolean[];
  if (known.length === 0) return null;
  const hits = known.filter((f) => f).length;
  return clamp01(hits / known.length);
}

// --- 6. Options / OI ---

export interface OptionsInputs {
  oiBuildup: "long-build" | "short-build" | "long-unwind" | "short-cover" | null;
  pcr: number | null;
  unusualActivity: boolean | null;
  ivRank: number | null; // 0..100
  bias: "long" | "short" | null;
}

export function scoreOptions(o: OptionsInputs): number | null {
  if (o.oiBuildup === null && o.pcr === null) return null;
  let s = 0.5;
  if (o.bias === "long") {
    if (o.oiBuildup === "long-build" || o.oiBuildup === "short-cover") s += 0.3;
    if (o.oiBuildup === "short-build" || o.oiBuildup === "long-unwind") s -= 0.3;
    if (o.pcr !== null && o.pcr < 0.7) s += 0.1; // bullish skew
  } else if (o.bias === "short") {
    if (o.oiBuildup === "short-build" || o.oiBuildup === "long-unwind") s += 0.3;
    if (o.oiBuildup === "long-build" || o.oiBuildup === "short-cover") s -= 0.3;
    if (o.pcr !== null && o.pcr > 1.3) s += 0.1;
  }
  if (o.unusualActivity === true) s += 0.1;
  // IV rank very high = premium-selling favoured, very low = buying favoured.
  // Not directional; leave as context, no adjustment here.
  return clamp01(s);
}

// --- 7. News ---

export interface NewsInputs {
  positiveHeadline: boolean | null;
  negativeHeadline: boolean | null;
  bulkBlockDealFavorable: boolean | null;
  corporateActionToday: boolean | null;
}

export function scoreNews(n: NewsInputs): number | null {
  const anyKnown = [
    n.positiveHeadline,
    n.negativeHeadline,
    n.bulkBlockDealFavorable,
    n.corporateActionToday,
  ].some((x) => x !== null);
  if (!anyKnown) return null;
  let s = 0.5;
  if (n.positiveHeadline) s += 0.25;
  if (n.negativeHeadline) s -= 0.25;
  if (n.bulkBlockDealFavorable) s += 0.15;
  if (n.corporateActionToday) s -= 0.1; // event risk, not directional
  return clamp01(s);
}

// --- 8. Event risk (count of active flags — used as a penalty) ---

export interface EventRiskInputs {
  resultWithinDays: number | null;
  exDateToday: boolean | null;
  agmToday: boolean | null;
  macroPrintWithinHour: boolean | null;
}

export function countEventRisk(e: EventRiskInputs): number {
  let n = 0;
  if (e.resultWithinDays !== null && e.resultWithinDays <= 1) n++;
  if (e.exDateToday === true) n++;
  if (e.agmToday === true) n++;
  if (e.macroPrintWithinHour === true) n++;
  return n;
}
