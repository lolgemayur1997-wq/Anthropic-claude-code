/**
 * DEMO ADAPTER — synthetic, deterministic, for PIPELINE DEMONSTRATION ONLY.
 *
 * ⚠ This adapter does NOT fetch real market data. It generates plausible
 *    shapes so you can see what the pipeline looks like when populated.
 *    Every number below is fabricated. Never trade off this output.
 *
 * Produces three scenarios keyed by symbol:
 *   RELIANCE  → clean trending-up equity, high confluence
 *   NIFTY     → options, full chain, clean breakout setup
 *   HDFCBANK  → choppy oscillation, should get GATED by confluence gate
 *
 * Any other symbol returns a generic trending snapshot.
 */

import { buildSnapshot } from "../snapshot.ts";
import {
  blankSnapshot,
  type Adapter,
  type RawCandle,
  type RawMarketData,
  type Segment,
  type SymbolSnapshot,
} from "./types.ts";

const DEMO_BANNER = `[demo-adapter] synthetic data — DO NOT TRADE OFF THIS OUTPUT`;

// --- Candle generators ---

function trendingCandles(
  base: number,
  step: number,
  n: number,
  dtSec: number,
): RawCandle[] {
  return Array.from({ length: n }, (_, i) => {
    const p = base + step * i;
    const close = p + step * 0.6;
    const wingspan = Math.abs(step) * 1.2;
    return {
      time: i * dtSec,
      open: p,
      high: Math.max(p, close) + wingspan,
      low: Math.min(p, close) - wingspan,
      close,
      volume: 2000 + (i % 3) * 500,
    };
  });
}

function choppyCandles(base: number, jitter: number, n: number, dtSec: number): RawCandle[] {
  return Array.from({ length: n }, (_, i) => {
    const dir = i % 2 === 0 ? 1 : -1;
    const open = base + dir * jitter * 0.3;
    const close = base - dir * jitter * 0.2;
    return {
      time: i * dtSec,
      open,
      high: base + jitter,
      low: base - jitter,
      close,
      volume: 800 + (i % 4) * 200,
    };
  });
}

// --- Scenarios ---

function buildReliance(): RawMarketData {
  // Trending up. Quote below is consistent with the candle sequence.
  const c5 = trendingCandles(2800, 1.5, 30, 300).map((c) => ({ ...c, volume: 120_000 }));
  const c15 = trendingCandles(2800, 3.5, 20, 900).map((c) => ({ ...c, volume: 360_000 }));
  const c1h = trendingCandles(2800, 8, 10, 3600).map((c) => ({ ...c, volume: 1_440_000 }));
  return {
    symbol: "RELIANCE",
    segment: "equity",
    candles5m: c5,
    candles15m: c15,
    candles1h: c1h,
    prevDailyCloses: Array.from({ length: 20 }, (_, i) => 2790 + i * 0.8),
    prevDayHigh: 2800,
    prevDayLow: 2770,
    // c5 ends at 2800 + 1.5*29 + 1.5*0.6 = ~2844.4
    quote: { ltp: 2844, prevClose: 2790, dayHigh: 2846, dayLow: 2799, bid: 2843.5, ask: 2844.5 },
    avgDailyVolume: 4_000_000,
    optionChain: null,
    contractMeta: null,
    volMargin: {
      rv20dAnnualizedPct: 18,
      rv60dAnnualizedPct: 22,
      marginRequiredInr: 42000,
      marginUtilisationPct: 8.4,
    },
    news: {
      positive: true,
      negative: false,
      bulkBlockDealFavorable: null,
      corporateActionToday: false,
    },
    eventFlags: {
      inFnoBan: false,
      resultWithinDays: null,
      macroEventWithinMins: null,
      exDateToday: false,
      agmToday: false,
      mwplPct: 34,
      inExtraElm: false,
      inAsm: false,
      corpActionWithinDays: null,
      corpActionType: null,
    },
  };
}

function buildNifty(): RawMarketData {
  const c5 = trendingCandles(22500, 3, 30, 300).map((c) => ({ ...c, volume: 4_500_000 }));
  const c15 = trendingCandles(22500, 8, 20, 900).map((c) => ({ ...c, volume: 13_500_000 }));
  const c1h = trendingCandles(22500, 20, 10, 3600).map((c) => ({ ...c, volume: 54_000_000 }));
  return {
    symbol: "NIFTY",
    segment: "options",
    candles5m: c5,
    candles15m: c15,
    candles1h: c1h,
    prevDailyCloses: Array.from({ length: 20 }, (_, i) => 22480 + i * 2),
    prevDayHigh: 22510,
    prevDayLow: 22460,
    // c5 ends at 22500 + 3*29 + 3*0.6 = 22588.8
    quote: { ltp: 22588, prevClose: 22495, dayHigh: 22592, dayLow: 22501, bid: 22587, ask: 22589 },
    avgDailyVolume: 150_000_000,
    optionChain: {
      pcr: 0.82,
      maxPainStrike: 22500,
      oiBuildup: "short-cover",
      unusualActivity: true,
      ivRank: 28,
      ivPercentile: 32,
      atmIv: 11.4,
      atmSpreadPct: 0.18,
      atmOi: 1_850_000,
      atmPremiumTurnoverInr: 95_000_000,
      atmTopBidSize: 12000,
      atmTopAskSize: 11500,
    },
    contractMeta: {
      inOfficialFnoUniverse: true,
      lotSize: 25,
      quantityFreeze: 1800,
      expiry: "2026-04-21",
      dteDays: 6,
      style: "European",
      settlement: "Cash",
    },
    volMargin: {
      rv20dAnnualizedPct: 10.5,
      rv60dAnnualizedPct: 12,
      marginRequiredInr: 18500,
      marginUtilisationPct: 3.7,
    },
    news: null,
    eventFlags: {
      inFnoBan: false,
      resultWithinDays: null,
      macroEventWithinMins: null,
      exDateToday: false,
      agmToday: false,
      mwplPct: 42,
      inExtraElm: false,
      inAsm: false,
      corpActionWithinDays: null,
      corpActionType: null,
    },
  };
}

function buildHdfcbank(): RawMarketData {
  const c5 = choppyCandles(1620, 3, 30, 300);
  const c15 = choppyCandles(1620, 5, 20, 900);
  const c1h = choppyCandles(1620, 8, 10, 3600);
  return {
    symbol: "HDFCBANK",
    segment: "equity",
    candles5m: c5,
    candles15m: c15,
    candles1h: c1h,
    prevDailyCloses: Array.from({ length: 20 }, (_, i) => 1618 + (i % 3 === 0 ? 2 : -1)),
    prevDayHigh: 1628,
    prevDayLow: 1612,
    quote: { ltp: 1622, prevClose: 1620, dayHigh: 1625, dayLow: 1617, bid: 1621.8, ask: 1622.3 },
    avgDailyVolume: 6_000_000,
    optionChain: null,
    contractMeta: null,
    volMargin: {
      rv20dAnnualizedPct: 14,
      rv60dAnnualizedPct: 16,
      marginRequiredInr: 0,
      marginUtilisationPct: 0,
    },
    news: null,
    eventFlags: {
      inFnoBan: false,
      resultWithinDays: null,
      macroEventWithinMins: null,
      exDateToday: false,
      agmToday: false,
      mwplPct: 28,
      inExtraElm: false,
      inAsm: false,
      corpActionWithinDays: null,
      corpActionType: null,
    },
  };
}

function buildGeneric(symbol: string, segment: Segment): RawMarketData {
  const base = 500;
  const c5 = trendingCandles(base, 0.5, 20, 300);
  const c15 = trendingCandles(base, 1.5, 15, 900);
  return {
    symbol,
    segment,
    candles5m: c5,
    candles15m: c15,
    candles1h: [],
    prevDailyCloses: Array.from({ length: 20 }, (_, i) => base - 10 + i),
    prevDayHigh: base,
    prevDayLow: base - 5,
    quote: { ltp: base + 10, prevClose: base - 2, dayHigh: base + 12, dayLow: base + 1, bid: base + 9.8, ask: base + 10.2 },
    avgDailyVolume: 1_000_000,
    optionChain: null,
    contractMeta: null,
    volMargin: null,
    news: null,
    eventFlags: {
      inFnoBan: false,
      resultWithinDays: null,
      macroEventWithinMins: null,
      exDateToday: false,
      agmToday: false,
      mwplPct: 20,
      inExtraElm: false,
      inAsm: false,
      corpActionWithinDays: null,
      corpActionType: null,
    },
  };
}

function buildRaw(symbol: string, segment: Segment): RawMarketData {
  switch (symbol) {
    case "RELIANCE":  return buildReliance();
    case "NIFTY":     return buildNifty();
    case "HDFCBANK":  return buildHdfcbank();
    default:          return buildGeneric(symbol, segment);
  }
}

const demo: Adapter = {
  name: "demo" as any, // registered via index.ts cast
  async getIndiaVix(): Promise<number> {
    return 16.5;
  },
  async getSymbolSnapshot(symbol: string, segment: Segment): Promise<SymbolSnapshot> {
    if (process.env.INTRADAY_DEMO_QUIET !== "1") console.log(DEMO_BANNER);
    return buildSnapshot(buildRaw(symbol, segment));
  },
  emptySnapshot(symbol: string, segment: Segment): SymbolSnapshot {
    return blankSnapshot(symbol, segment);
  },
};

export default demo;
