import { describe, expect, test } from "bun:test";
import { emptyRawMarketData } from "./adapters/types.ts";
import { validateCandle, validateQuote, validateRawMarketData } from "./validate.ts";

describe("validateCandle", () => {
  test("valid candle has no issues", () => {
    const issues = validateCandle(
      { time: 1, open: 100, high: 101, low: 99, close: 100.5, volume: 1000 },
      0,
    );
    expect(issues).toEqual([]);
  });
  test("rejects high < low", () => {
    const issues = validateCandle(
      { time: 1, open: 100, high: 99, low: 101, close: 100, volume: 1000 },
      0,
    );
    expect(issues.some((i) => i.includes("high<low"))).toBeTrue();
  });
  test("rejects close outside [low, high]", () => {
    const issues = validateCandle(
      { time: 1, open: 100, high: 101, low: 99, close: 150, volume: 1000 },
      0,
    );
    expect(issues.some((i) => i.includes("close outside"))).toBeTrue();
  });
  test("rejects NaN fields", () => {
    const issues = validateCandle(
      { time: 1, open: NaN, high: 101, low: 99, close: 100, volume: 1000 },
      3,
    );
    expect(issues.some((i) => i.includes("candle[3].open"))).toBeTrue();
  });
  test("rejects negative volume", () => {
    const issues = validateCandle(
      { time: 1, open: 100, high: 101, low: 99, close: 100, volume: -5 },
      0,
    );
    expect(issues.length).toBeGreaterThan(0);
  });
});

describe("validateQuote", () => {
  test("valid quote has no issues", () => {
    const issues = validateQuote({
      ltp: 100,
      prevClose: 99,
      dayHigh: 102,
      dayLow: 98,
      bid: 99.9,
      ask: 100.1,
    });
    expect(issues).toEqual([]);
  });
  test("allows null bid/ask", () => {
    const issues = validateQuote({
      ltp: 100,
      prevClose: 99,
      dayHigh: 102,
      dayLow: 98,
      bid: null,
      ask: null,
    });
    expect(issues).toEqual([]);
  });
  test("rejects ask < bid", () => {
    const issues = validateQuote({
      ltp: 100,
      prevClose: 99,
      dayHigh: 102,
      dayLow: 98,
      bid: 101,
      ask: 100,
    });
    expect(issues.some((i) => i.includes("ask < bid"))).toBeTrue();
  });
  test("rejects non-positive ltp", () => {
    const issues = validateQuote({
      ltp: 0,
      prevClose: 99,
      dayHigh: 102,
      dayLow: 98,
      bid: null,
      ask: null,
    });
    expect(issues.some((i) => i.includes("ltp"))).toBeTrue();
  });
});

describe("validateRawMarketData", () => {
  test("empty raw market data is valid (nulls everywhere, UNKNOWN downstream)", () => {
    const issues = validateRawMarketData(emptyRawMarketData("X", "equity"));
    expect(issues).toEqual([]);
  });
  test("catches invalid ivRank (out of 0..100)", () => {
    const r = emptyRawMarketData("X", "options");
    r.optionChain = {
      pcr: 0.9,
      maxPainStrike: null,
      oiBuildup: null,
      unusualActivity: null,
      ivRank: 150,
      ivPercentile: null,
      atmIv: null,
      atmSpreadPct: null,
      atmOi: null,
      atmPremiumTurnoverInr: null,
      atmTopBidSize: null,
      atmTopAskSize: null,
    };
    const issues = validateRawMarketData(r);
    expect(issues.some((i) => i.includes("ivRank"))).toBeTrue();
  });
  test("catches invalid MWPL % > 100", () => {
    const r = emptyRawMarketData("X", "options");
    r.eventFlags.mwplPct = 150;
    const issues = validateRawMarketData(r);
    expect(issues.some((i) => i.includes("mwplPct"))).toBeTrue();
  });

  test("catches invalid candles1h (audit regression)", () => {
    const r = emptyRawMarketData("X", "equity");
    r.quote = { ltp: 100, prevClose: 99, dayHigh: 101, dayLow: 99, bid: null, ask: null };
    r.candles1h = [
      { time: 0, open: 100, high: 99, low: 101, close: 100, volume: 1000 }, // high<low
    ];
    const issues = validateRawMarketData(r);
    expect(issues.some((i) => i.includes("high<low"))).toBeTrue();
  });

  test("catches invalid prevDailyCloses (audit regression)", () => {
    const r = emptyRawMarketData("X", "equity");
    r.prevDailyCloses = [100, NaN, 102];
    const issues = validateRawMarketData(r);
    expect(issues.some((i) => i.includes("prevDailyCloses[1]"))).toBeTrue();
  });

  test("catches prevDayHigh < prevDayLow (audit regression)", () => {
    const r = emptyRawMarketData("X", "equity");
    r.prevDayHigh = 95;
    r.prevDayLow = 100;
    const issues = validateRawMarketData(r);
    expect(issues.some((i) => i.includes("prevDayHigh < prevDayLow"))).toBeTrue();
  });
});
