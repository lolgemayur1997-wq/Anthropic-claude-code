/**
 * buildSnapshot — the single choke-point that turns raw broker data into a
 * scored SymbolSnapshot. Every adapter calls this. All analysis logic lives
 * here so the adapters stay thin and broker-specific.
 */

import {
  atr,
  emaStack,
  macd,
  rsi,
  supertrend,
  vwap,
} from "./indicators.ts";
import {
  countEventRisk,
  scoreIndicators,
  scoreNews,
  scoreOptions,
  scoreOrderBlocks,
  scorePattern,
  scoreStructure,
  scoreVolume,
} from "./scoring.ts";
import type {
  Bias,
  RawCandle,
  RawMarketData,
  SymbolSnapshot,
} from "./adapters/types.ts";
import { blankSnapshot } from "./adapters/types.ts";
import { validateRawMarketData } from "./validate.ts";

const DEFAULT_MIN_RVOL = 1.5;

export function buildSnapshot(raw: RawMarketData): SymbolSnapshot {
  const base = blankSnapshot(raw.symbol, raw.segment);

  // Schema-validate first. A malformed payload must not reach indicators or
  // scoring; gate NO_TRADE by returning the blank snapshot with flags only.
  const issues = validateRawMarketData(raw);
  if (issues.length > 0) {
    return { ...base, ...flagsFromRaw(raw) };
  }

  if (!raw.quote || raw.candles5m.length === 0) {
    // Data insufficient — return UNKNOWN snapshot so the runner gates NO-TRADE.
    return { ...base, ...flagsFromRaw(raw) };
  }

  const closes5 = raw.candles5m.map((c) => c.close);
  const closes15 = raw.candles15m.map((c) => c.close);

  const vwap5m = vwap(raw.candles5m);
  const atr5m = atr(raw.candles5m as unknown as import("./indicators.ts").Candle[], 14);
  const rsi5m = rsi(closes5, 14);
  const rsi15m = rsi(closes15, 14);
  const macd15m = macd(closes15);
  const st15m = supertrend(
    raw.candles15m as unknown as import("./indicators.ts").Candle[],
    10,
    3,
  );
  const emaStack5m = emaStack(closes5);

  const orb = firstMinutes(raw.candles5m, 15);
  const orbHigh = orb.length ? Math.max(...orb.map((c) => c.high)) : null;
  const orbLow = orb.length ? Math.min(...orb.map((c) => c.low)) : null;

  const rvol = computeRvol(raw);
  const spreadPct = computeSpreadPct(raw);
  const bias = deriveBias(raw.quote.ltp, vwap5m, st15m?.trend ?? null, emaStack5m);

  const structureScore = scoreStructure({
    ltp: raw.quote.ltp,
    prevDayHigh: raw.quote.dayHigh,
    prevDayLow: raw.quote.dayLow,
    prevClose: raw.quote.prevClose,
    orbHigh,
    orbLow,
    trend15mHigherHighs: higherHighs(raw.candles15m),
    trend1hHigherHighs: null,
  });

  const patternScore = scorePattern({
    named: null,
    breakoutConfirmed: orbHigh !== null ? raw.quote.ltp > orbHigh : null,
    failedRecently: null,
  });

  const indicatorScore = scoreIndicators({
    rsi5m,
    rsi15m,
    macd15m,
    vwap5m,
    ltp: raw.quote.ltp,
    supertrend15m: st15m,
    emaStack5m,
  });

  const volumeScore = scoreVolume({
    rvol,
    deliveryPctTrend: null,
    minRvol: DEFAULT_MIN_RVOL,
  });

  const orderBlockScore = scoreOrderBlocks({
    mitigatedObNearby: null,
    fvgUnfilled: null,
    liquiditySweep: null,
    breakOfStructure: null,
  });

  const optionsScore = raw.optionChain
    ? scoreOptions({
        oiBuildup: raw.optionChain.oiBuildup,
        pcr: raw.optionChain.pcr,
        unusualActivity: raw.optionChain.unusualActivity,
        ivRank: raw.optionChain.ivRank,
        bias,
      })
    : null;

  const newsScore = raw.news
    ? scoreNews({
        positiveHeadline: raw.news.positive,
        negativeHeadline: raw.news.negative,
        bulkBlockDealFavorable: raw.news.bulkBlockDealFavorable,
        corporateActionToday: raw.news.corporateActionToday,
      })
    : null;

  const eventRiskFlags = countEventRisk({
    resultWithinDays: raw.eventFlags.resultWithinDays,
    exDateToday: raw.eventFlags.exDateToday,
    agmToday: raw.eventFlags.agmToday,
    macroPrintWithinHour:
      raw.eventFlags.macroEventWithinMins !== null &&
      raw.eventFlags.macroEventWithinMins <= 60,
  });

  const setupLabel = deriveSetupLabel(
    raw.quote.ltp,
    orbHigh,
    orbLow,
    vwap5m,
    rvol,
    bias,
  );

  return {
    ...base,
    ltp: raw.quote.ltp,
    prevClose: raw.quote.prevClose,
    dayHigh: raw.quote.dayHigh,
    dayLow: raw.quote.dayLow,
    orbHigh,
    orbLow,
    atr5m,
    spreadPct,
    rvol,
    deliveryPct: null,
    vwap5m,
    rsi5m,
    rsi15m,
    macdHist15m: macd15m.hist,
    supertrend15m: st15m?.trend ?? null,
    emaStack5m,
    structureScore,
    patternScore,
    indicatorScore,
    volumeScore,
    orderBlockScore,
    optionsScore,
    newsScore,
    eventRiskFlags,
    setupLabel,
    bias,
    inFnoBan: raw.eventFlags.inFnoBan,
    resultWithinDays: raw.eventFlags.resultWithinDays,
    macroEventWithinMins: raw.eventFlags.macroEventWithinMins,
    inOfficialFnoUniverse: raw.contractMeta?.inOfficialFnoUniverse ?? null,
    lotSize: raw.contractMeta?.lotSize ?? null,
    dteDays: raw.contractMeta?.dteDays ?? null,
    style: raw.contractMeta?.style ?? null,
    settlement: raw.contractMeta?.settlement ?? null,
    mwplPct: raw.eventFlags.mwplPct,
    inExtraElm: raw.eventFlags.inExtraElm,
    inAsm: raw.eventFlags.inAsm,
    corpActionWithinDays: raw.eventFlags.corpActionWithinDays,
    atmSpreadPct: raw.optionChain?.atmSpreadPct ?? null,
    atmOi: raw.optionChain?.atmOi ?? null,
    atmPremiumTurnoverInr: raw.optionChain?.atmPremiumTurnoverInr ?? null,
    ivPercentile: raw.optionChain?.ivPercentile ?? null,
    atmIv: raw.optionChain?.atmIv ?? null,
    rv20dAnnualizedPct: raw.volMargin?.rv20dAnnualizedPct ?? null,
    marginUtilisationPct: raw.volMargin?.marginUtilisationPct ?? null,
    fetchedAt: new Date().toISOString(),
  };
}

// --- Helpers ---

function flagsFromRaw(raw: RawMarketData): Partial<SymbolSnapshot> {
  return {
    inFnoBan: raw.eventFlags.inFnoBan,
    resultWithinDays: raw.eventFlags.resultWithinDays,
    macroEventWithinMins: raw.eventFlags.macroEventWithinMins,
    inOfficialFnoUniverse: raw.contractMeta?.inOfficialFnoUniverse ?? null,
    lotSize: raw.contractMeta?.lotSize ?? null,
    dteDays: raw.contractMeta?.dteDays ?? null,
    mwplPct: raw.eventFlags.mwplPct,
    inExtraElm: raw.eventFlags.inExtraElm,
    inAsm: raw.eventFlags.inAsm,
    corpActionWithinDays: raw.eventFlags.corpActionWithinDays,
  };
}

function firstMinutes(candles: RawCandle[], minutes: number): RawCandle[] {
  if (candles.length === 0) return [];
  const start = candles[0]!.time;
  return candles.filter((c) => c.time - start < minutes * 60);
}

function computeRvol(raw: RawMarketData): number | null {
  if (raw.avgDailyVolume === null || raw.avgDailyVolume === 0) return null;
  const todayVol = raw.candles5m.reduce((a, c) => a + c.volume, 0);
  // Approximation: scale average by fraction of session elapsed.
  const sessionMinutes = 375; // 09:15–15:30
  const elapsed = raw.candles5m.length * 5;
  const expected = raw.avgDailyVolume * (elapsed / sessionMinutes);
  if (expected === 0) return null;
  return todayVol / expected;
}

function computeSpreadPct(raw: RawMarketData): number | null {
  if (!raw.quote || raw.quote.bid === null || raw.quote.ask === null) return null;
  if (raw.quote.ltp === 0) return null;
  return ((raw.quote.ask - raw.quote.bid) / raw.quote.ltp) * 100;
}

function deriveBias(
  ltp: number,
  vwap5m: number | null,
  st: "up" | "down" | null,
  stack: "up" | "down" | "tangled" | null,
): Bias {
  const votesUp =
    (vwap5m !== null && ltp > vwap5m ? 1 : 0) +
    (st === "up" ? 1 : 0) +
    (stack === "up" ? 1 : 0);
  const votesDown =
    (vwap5m !== null && ltp < vwap5m ? 1 : 0) +
    (st === "down" ? 1 : 0) +
    (stack === "down" ? 1 : 0);
  if (votesUp >= 2 && votesUp > votesDown) return "long";
  if (votesDown >= 2 && votesDown > votesUp) return "short";
  return null;
}

function higherHighs(candles: RawCandle[]): boolean | null {
  if (candles.length < 4) return null;
  const last = candles.slice(-4);
  return last[3]!.high > last[2]!.high && last[2]!.high > last[1]!.high;
}

function deriveSetupLabel(
  ltp: number,
  orbHigh: number | null,
  orbLow: number | null,
  vwap5m: number | null,
  rvol: number | null,
  bias: Bias,
): string | null {
  if (bias === null) return null;
  const parts: string[] = [];
  if (orbHigh !== null && ltp > orbHigh) parts.push("ORB breakout");
  else if (orbLow !== null && ltp < orbLow) parts.push("ORB breakdown");
  if (vwap5m !== null) parts.push(ltp > vwap5m ? "above VWAP" : "below VWAP");
  if (rvol !== null) parts.push(`RVOL ${rvol.toFixed(2)}x`);
  return parts.length ? parts.join(", ") : null;
}
