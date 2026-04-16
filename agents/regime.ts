/**
 * Day-regime classifier.
 *
 * A trader's first question: "What kind of day is this?"
 *
 *   - TREND      — one-sided bar sequence, expanding range, high RVOL.
 *                   Favours: breakouts, pullback entries, trend-continuation.
 *                   Avoids: mean-reversion, fading strength.
 *   - RANGE      — bars oscillate, contracting range, low VIX.
 *                   Favours: mean-reversion at boundaries, iron-condor/fly.
 *                   Avoids: breakout chases (typically fail).
 *   - REVERSAL   — strong open against prior trend, climax + reversal bar.
 *                   Favours: counter-trend entries with confirmation.
 *                   Avoids: continuation trades.
 *   - CHOPPY     — noisy, no persistent direction, neither trend nor range.
 *                   Favours: staying out; reduce size dramatically.
 *
 * Pure function. All inputs nullable — returns null when any required
 * ingredient is missing. Never throws.
 */

import type { Candle } from "./indicators.ts";
import { ema, rsi } from "./indicators.ts";

export type Regime = "TREND" | "RANGE" | "REVERSAL" | "CHOPPY";

export interface RegimeInputs {
  candles15m: Candle[];     // today's bars so far
  prevCloses: number[];     // closes of last 20 daily candles (for ATR)
  vix: number | null;
  vixCeilingForChop?: number; // default 22 — above this we bias toward CHOPPY
}

export interface RegimeResult {
  regime: Regime;
  confidence: number;        // 0..1
  reasons: string[];         // human-readable observations
}

const MIN_BARS = 6;

export function classifyRegime(i: RegimeInputs): RegimeResult | null {
  if (i.candles15m.length < MIN_BARS) return null;

  const closes = i.candles15m.map((c) => c.close);
  const highs = i.candles15m.map((c) => c.high);
  const lows = i.candles15m.map((c) => c.low);
  const firstOpen = i.candles15m[0]!.open;
  const lastClose = closes[closes.length - 1]!;

  // 1. Directionality: fraction of bars that close in the dominant direction
  const ups = closes.filter((c, idx) => idx > 0 && c > closes[idx - 1]!).length;
  const downs = closes.filter((c, idx) => idx > 0 && c < closes[idx - 1]!).length;
  const total = closes.length - 1;
  const directionality = total === 0 ? 0 : Math.abs(ups - downs) / total;

  // 2. Net move vs. intraday range (trend persistence)
  const dayHigh = Math.max(...highs);
  const dayLow = Math.min(...lows);
  const intradayRange = dayHigh - dayLow;
  const netMove = lastClose - firstOpen;
  const persistenceRatio = intradayRange === 0 ? 0 : Math.abs(netMove) / intradayRange;

  // 3. Range expansion vs. prior-day ATR
  const priorAtr = computeDailyAtr(i.prevCloses);
  const rangeExpansion = priorAtr === null || priorAtr === 0
    ? null
    : intradayRange / priorAtr;

  // 4. RSI(14) on 15m — extreme reading = trending
  const rsi15 = rsi(closes, Math.min(14, closes.length - 1));

  // 5. EMA alignment
  const ema9 = ema(closes, 9);
  const ema20 = ema(closes, 20);
  const emaSpread = ema9 === null || ema20 === null
    ? null
    : Math.abs(ema9 - ema20) / Math.max(ema9, ema20);

  // 6. Early-day vs late-day comparison (reversal detection)
  const half = Math.floor(closes.length / 2);
  const firstHalfMove = closes[half]! - firstOpen;
  const secondHalfMove = lastClose - closes[half]!;
  const signsDiffer = firstHalfMove * secondHalfMove < 0;
  // Normalize against the LARGER of netMove and intradayRange. Using just
  // netMove explodes when halves cancel out (tiny net / big halves).
  const reversalMagnitude = Math.min(
    Math.abs(firstHalfMove),
    Math.abs(secondHalfMove),
  ) / Math.max(Math.abs(netMove), intradayRange, 1e-9);

  // --- Scoring ---
  const reasons: string[] = [];
  const ceiling = i.vixCeilingForChop ?? 22;

  // VIX-based chop check first — a high-VIX day often produces mess
  const vixElevated = i.vix !== null && i.vix > ceiling;

  // REVERSAL: first-half and second-half move in opposite directions AND
  //           reversal magnitude is substantial
  if (signsDiffer && reversalMagnitude > 0.4) {
    reasons.push(`reversal structure: early move vs late move opposite (${reversalMagnitude.toFixed(2)} magnitude)`);
    return { regime: "REVERSAL", confidence: Math.min(0.9, reversalMagnitude + 0.1), reasons };
  }

  // TREND: high directionality + high persistence + expanded range
  const trendSignals = [
    directionality > 0.4,
    persistenceRatio > 0.6,
    rangeExpansion !== null && rangeExpansion > 0.9,
    rsi15 !== null && (rsi15 > 65 || rsi15 < 35),
    emaSpread !== null && emaSpread > 0.005,
  ].filter(Boolean).length;

  if (trendSignals >= 3) {
    if (directionality > 0.4) reasons.push(`directionality ${directionality.toFixed(2)}`);
    if (persistenceRatio > 0.6) reasons.push(`persistence ${persistenceRatio.toFixed(2)} (net move / range)`);
    if (rangeExpansion !== null && rangeExpansion > 0.9) {
      reasons.push(`range expansion ${rangeExpansion.toFixed(2)}× prior ATR`);
    }
    if (rsi15 !== null && (rsi15 > 65 || rsi15 < 35)) reasons.push(`RSI ${rsi15.toFixed(0)} in trend zone`);
    return {
      regime: "TREND",
      confidence: Math.min(0.95, 0.4 + 0.15 * trendSignals),
      reasons,
    };
  }

  // RANGE: low directionality + low persistence + contracted range + low VIX
  const rangeSignals = [
    directionality < 0.2,
    persistenceRatio < 0.3,
    rangeExpansion !== null && rangeExpansion < 0.6,
    !vixElevated,
    rsi15 !== null && rsi15 > 40 && rsi15 < 60,
  ].filter(Boolean).length;

  if (rangeSignals >= 3) {
    reasons.push(`directionality ${directionality.toFixed(2)} (low)`);
    reasons.push(`persistence ${persistenceRatio.toFixed(2)} (low)`);
    if (rangeExpansion !== null) reasons.push(`range ${rangeExpansion.toFixed(2)}× prior ATR`);
    return {
      regime: "RANGE",
      confidence: Math.min(0.9, 0.4 + 0.12 * rangeSignals),
      reasons,
    };
  }

  // Default: CHOPPY — neither trending nor cleanly ranging
  reasons.push(
    `no clear regime: directionality ${directionality.toFixed(2)}, persistence ${persistenceRatio.toFixed(2)}`,
  );
  if (vixElevated) reasons.push(`VIX ${i.vix} > ${ceiling} ceiling`);
  return { regime: "CHOPPY", confidence: 0.5, reasons };
}

/** ATR of a daily-close series, Wilder smoothing. Uses close-to-close diff
 *  as a simple proxy — sufficient for regime comparison. */
function computeDailyAtr(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  const diffs: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    diffs.push(Math.abs(closes[i]! - closes[i - 1]!));
  }
  let a = diffs.slice(0, period).reduce((x, y) => x + y, 0) / period;
  for (let i = period; i < diffs.length; i++) {
    a = (a * (period - 1) + diffs[i]!) / period;
  }
  return a;
}

/** Is the intended structure compatible with the classified regime?
 *  Returns a human-readable conflict reason or null if compatible. */
export function regimeStructureConflict(
  regime: Regime,
  structure: string,
): string | null {
  if (regime === "TREND") {
    if (structure.includes("credit-spread") || structure.includes("iron-")) {
      return `${structure} in a TREND day — neutral structure fights directional move`;
    }
  }
  if (regime === "RANGE") {
    if (structure === "long-call" || structure === "long-put") {
      return `naked long-premium in a RANGE day — time decay dominates`;
    }
  }
  if (regime === "CHOPPY") {
    return "CHOPPY regime — any structure is marginal; prefer NO_TRADE or size down";
  }
  if (regime === "REVERSAL") {
    if (structure.includes("iron-")) {
      return "iron-* in a REVERSAL day — pinning unlikely";
    }
  }
  return null;
}
