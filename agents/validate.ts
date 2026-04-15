/**
 * Lightweight schema validation for broker adapter payloads.
 *
 * We don't add Zod — it's a dep and we only need a few safety checks.
 * These validators return an array of issue strings (empty = valid). A
 * malformed payload should never reach buildSnapshot; instead the runner
 * substitutes an empty (UNKNOWN) snapshot so the gates fire NO_TRADE.
 */

import type { RawCandle, RawMarketData, RawQuote } from "./adapters/types.ts";

type Issues = string[];

function isFiniteNum(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

function isFiniteOrNull(x: unknown): boolean {
  return x === null || isFiniteNum(x);
}

function isNonNegNum(x: unknown): boolean {
  return isFiniteNum(x) && x >= 0;
}

export function validateCandle(c: RawCandle, idx: number): Issues {
  const issues: Issues = [];
  if (!isFiniteNum(c.time)) issues.push(`candle[${idx}].time not finite`);
  if (!isFiniteNum(c.open)) issues.push(`candle[${idx}].open not finite`);
  if (!isFiniteNum(c.high)) issues.push(`candle[${idx}].high not finite`);
  if (!isFiniteNum(c.low)) issues.push(`candle[${idx}].low not finite`);
  if (!isFiniteNum(c.close)) issues.push(`candle[${idx}].close not finite`);
  if (!isNonNegNum(c.volume)) issues.push(`candle[${idx}].volume invalid`);
  if (isFiniteNum(c.high) && isFiniteNum(c.low) && c.high < c.low) {
    issues.push(`candle[${idx}] high<low`);
  }
  if (
    isFiniteNum(c.high) &&
    isFiniteNum(c.low) &&
    isFiniteNum(c.open) &&
    (c.open > c.high + 1e-6 || c.open < c.low - 1e-6)
  ) {
    issues.push(`candle[${idx}] open outside [low, high]`);
  }
  if (
    isFiniteNum(c.high) &&
    isFiniteNum(c.low) &&
    isFiniteNum(c.close) &&
    (c.close > c.high + 1e-6 || c.close < c.low - 1e-6)
  ) {
    issues.push(`candle[${idx}] close outside [low, high]`);
  }
  return issues;
}

export function validateQuote(q: RawQuote): Issues {
  const issues: Issues = [];
  if (!isFiniteNum(q.ltp) || q.ltp <= 0) issues.push("quote.ltp invalid");
  if (!isFiniteNum(q.prevClose) || q.prevClose <= 0) issues.push("quote.prevClose invalid");
  if (!isFiniteNum(q.dayHigh)) issues.push("quote.dayHigh invalid");
  if (!isFiniteNum(q.dayLow)) issues.push("quote.dayLow invalid");
  if (isFiniteNum(q.dayHigh) && isFiniteNum(q.dayLow) && q.dayHigh < q.dayLow) {
    issues.push("quote dayHigh < dayLow");
  }
  if (!isFiniteOrNull(q.bid)) issues.push("quote.bid not number|null");
  if (!isFiniteOrNull(q.ask)) issues.push("quote.ask not number|null");
  if (isFiniteNum(q.bid) && isFiniteNum(q.ask) && q.ask < q.bid) {
    issues.push("quote ask < bid");
  }
  return issues;
}

export function validateRawMarketData(raw: RawMarketData): Issues {
  const issues: Issues = [];
  if (typeof raw.symbol !== "string" || raw.symbol.length === 0) issues.push("symbol missing");
  if (!["equity", "futures", "options"].includes(raw.segment)) {
    issues.push(`invalid segment: ${raw.segment}`);
  }
  if (!Array.isArray(raw.candles5m)) issues.push("candles5m not array");
  if (!Array.isArray(raw.candles15m)) issues.push("candles15m not array");
  for (let i = 0; i < Math.min(raw.candles5m.length, 200); i++) {
    issues.push(...validateCandle(raw.candles5m[i]!, i));
  }
  for (let i = 0; i < Math.min(raw.candles15m.length, 200); i++) {
    issues.push(...validateCandle(raw.candles15m[i]!, i));
  }
  if (raw.quote !== null) issues.push(...validateQuote(raw.quote));
  if (raw.avgDailyVolume !== null && !isNonNegNum(raw.avgDailyVolume)) {
    issues.push("avgDailyVolume invalid");
  }
  if (raw.optionChain) {
    const oc = raw.optionChain;
    if (oc.pcr !== null && !isFiniteNum(oc.pcr)) issues.push("optionChain.pcr invalid");
    if (oc.ivRank !== null && !(isFiniteNum(oc.ivRank) && oc.ivRank >= 0 && oc.ivRank <= 100)) {
      issues.push("optionChain.ivRank out of [0, 100]");
    }
    if (oc.atmSpreadPct !== null && (!isFiniteNum(oc.atmSpreadPct) || oc.atmSpreadPct < 0)) {
      issues.push("optionChain.atmSpreadPct invalid");
    }
    if (oc.atmOi !== null && !isNonNegNum(oc.atmOi)) {
      issues.push("optionChain.atmOi invalid");
    }
  }
  if (raw.eventFlags.mwplPct !== null) {
    if (!isFiniteNum(raw.eventFlags.mwplPct) || raw.eventFlags.mwplPct < 0 || raw.eventFlags.mwplPct > 100) {
      issues.push("eventFlags.mwplPct out of [0, 100]");
    }
  }
  return issues;
}
