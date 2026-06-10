import { describe, expect, test } from "bun:test";
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

describe("scoreStructure", () => {
  test("null when ltp is null", () => {
    expect(scoreStructure({ ltp: null, prevDayHigh: null, prevDayLow: null, prevClose: null, orbHigh: null, orbLow: null, trend15mHigherHighs: null, trend1hHigherHighs: null })).toBeNull();
  });
  test("above PDH scores higher than between PDH/PDL", () => {
    const above = scoreStructure({ ltp: 110, prevDayHigh: 100, prevDayLow: 90, prevClose: 95, orbHigh: 105, orbLow: 85, trend15mHigherHighs: true, trend1hHigherHighs: true });
    const between = scoreStructure({ ltp: 95, prevDayHigh: 100, prevDayLow: 90, prevClose: 95, orbHigh: 105, orbLow: 85, trend15mHigherHighs: false, trend1hHigherHighs: false });
    expect(above!).toBeGreaterThan(between!);
  });
  test("returns 0..1 range", () => {
    const s = scoreStructure({ ltp: 100, prevDayHigh: 105, prevDayLow: 95, prevClose: 98, orbHigh: 102, orbLow: 96, trend15mHigherHighs: true, trend1hHigherHighs: null });
    expect(s!).toBeGreaterThanOrEqual(0);
    expect(s!).toBeLessThanOrEqual(1);
  });
});

describe("scorePattern", () => {
  test("no named pattern returns 0", () => {
    expect(scorePattern({ named: null, breakoutConfirmed: null, failedRecently: null })).toBe(0);
  });
  test("named + breakout = high score", () => {
    const s = scorePattern({ named: "flag", breakoutConfirmed: true, failedRecently: false });
    expect(s!).toBeGreaterThanOrEqual(0.8);
  });
  test("named + breakout + failed recently = reduced", () => {
    const with_ = scorePattern({ named: "flag", breakoutConfirmed: true, failedRecently: true })!;
    const without = scorePattern({ named: "flag", breakoutConfirmed: true, failedRecently: false })!;
    expect(with_).toBeLessThan(without);
  });
});

describe("scoreIndicators", () => {
  test("null when all inputs null", () => {
    expect(scoreIndicators({ rsi5m: null, rsi15m: null, macd15m: null, vwap5m: null, ltp: null, supertrend15m: null, emaStack5m: null })).toBeNull();
  });
  test("all bullish indicators → high score", () => {
    const s = scoreIndicators({
      rsi5m: 65, rsi15m: 65,
      macd15m: { macd: 1, signal: 0.5, hist: 0.5 },
      vwap5m: 100, ltp: 105,
      supertrend15m: { trend: "up", band: 98 },
      emaStack5m: "up",
    });
    expect(s!).toBeGreaterThan(0.7);
  });
  test("RSI overbought (>80) penalised", () => {
    const overbought = scoreIndicators({ rsi5m: 85, rsi15m: 85, macd15m: null, vwap5m: null, ltp: null, supertrend15m: null, emaStack5m: null })!;
    const momentum = scoreIndicators({ rsi5m: 65, rsi15m: 65, macd15m: null, vwap5m: null, ltp: null, supertrend15m: null, emaStack5m: null })!;
    expect(overbought).toBeLessThan(momentum);
  });
});

describe("scoreVolume", () => {
  test("null when rvol null", () => {
    expect(scoreVolume({ rvol: null, deliveryPctTrend: null, minRvol: 1.5 })).toBeNull();
  });
  test("high rvol + rising delivery = high score", () => {
    const s = scoreVolume({ rvol: 2.5, deliveryPctTrend: "rising", minRvol: 1.5 });
    expect(s!).toBeGreaterThan(0.8);
  });
  test("low rvol = low score", () => {
    const s = scoreVolume({ rvol: 0.5, deliveryPctTrend: null, minRvol: 1.5 });
    expect(s!).toBeLessThan(0.3);
  });
});

describe("scoreOrderBlocks", () => {
  test("null when all flags null", () => {
    expect(scoreOrderBlocks({ mitigatedObNearby: null, fvgUnfilled: null, liquiditySweep: null, breakOfStructure: null })).toBeNull();
  });
  test("all true = 1.0", () => {
    expect(scoreOrderBlocks({ mitigatedObNearby: true, fvgUnfilled: true, liquiditySweep: true, breakOfStructure: true })).toBe(1);
  });
  test("mixed flags = partial score", () => {
    const s = scoreOrderBlocks({ mitigatedObNearby: true, fvgUnfilled: false, liquiditySweep: null, breakOfStructure: true });
    expect(s!).toBeGreaterThan(0);
    expect(s!).toBeLessThan(1);
  });
});

describe("scoreOptions", () => {
  test("null when no OI and no PCR", () => {
    expect(scoreOptions({ oiBuildup: null, pcr: null, unusualActivity: null, ivRank: null, bias: null })).toBeNull();
  });
  test("long bias + long-build OI = higher than short-build", () => {
    const longBuild = scoreOptions({ oiBuildup: "long-build", pcr: 0.9, unusualActivity: false, ivRank: null, bias: "long" })!;
    const shortBuild = scoreOptions({ oiBuildup: "short-build", pcr: 0.9, unusualActivity: false, ivRank: null, bias: "long" })!;
    expect(longBuild).toBeGreaterThan(shortBuild);
  });
  test("unusual activity adds a bonus", () => {
    const with_ = scoreOptions({ oiBuildup: "long-build", pcr: 0.9, unusualActivity: true, ivRank: null, bias: "long" })!;
    const without = scoreOptions({ oiBuildup: "long-build", pcr: 0.9, unusualActivity: false, ivRank: null, bias: "long" })!;
    expect(with_).toBeGreaterThan(without);
  });
});

describe("scoreNews", () => {
  test("null when nothing known", () => {
    expect(scoreNews({ positiveHeadline: null, negativeHeadline: null, bulkBlockDealFavorable: null, corporateActionToday: null })).toBeNull();
  });
  test("positive headline boosts, negative lowers", () => {
    const pos = scoreNews({ positiveHeadline: true, negativeHeadline: false, bulkBlockDealFavorable: null, corporateActionToday: null })!;
    const neg = scoreNews({ positiveHeadline: false, negativeHeadline: true, bulkBlockDealFavorable: null, corporateActionToday: null })!;
    expect(pos).toBeGreaterThan(neg);
  });
});

describe("countEventRisk", () => {
  test("zero flags = 0", () => {
    expect(countEventRisk({ resultWithinDays: null, exDateToday: false, agmToday: false, macroPrintWithinHour: false })).toBe(0);
  });
  test("all flags active = 4", () => {
    expect(countEventRisk({ resultWithinDays: 0, exDateToday: true, agmToday: true, macroPrintWithinHour: true })).toBe(4);
  });
  test("result > 1 day doesn't count", () => {
    expect(countEventRisk({ resultWithinDays: 5, exDateToday: false, agmToday: false, macroPrintWithinHour: false })).toBe(0);
  });
});
