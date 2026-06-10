/**
 * Tests for buildSnapshot — the raw→scored pipeline.
 *
 * These also cover two audit findings (options-field propagation and
 * malformed-payload rejection) end-to-end since the UNKNOWN verdict flows
 * from here into the runner's collectUnknowns / evaluateGates path.
 */

import { describe, expect, test } from "bun:test";
import type { RawCandle, RawMarketData } from "./adapters/types.ts";
import { emptyRawMarketData } from "./adapters/types.ts";
import { buildSnapshot } from "./snapshot.ts";

function flatCandles(n: number, base = 100): RawCandle[] {
  return Array.from({ length: n }, (_, i) => ({
    time: i * 60, // seconds, per the documented contract
    open: base,
    high: base + 1,
    low: base - 1,
    close: base + (i % 2 === 0 ? 0.5 : -0.5),
    volume: 1000,
  }));
}

describe("buildSnapshot — empty raw produces UNKNOWN snapshot", () => {
  test("mock/empty returns nulls for computed fields", () => {
    const s = buildSnapshot(emptyRawMarketData("X", "options"));
    expect(s.ltp).toBeNull();
    expect(s.atr5m).toBeNull();
    expect(s.vwap5m).toBeNull();
    expect(s.bias).toBeNull();
  });
});

describe("buildSnapshot — malformed payload path (schema validation)", () => {
  test("bad candle (high<low) short-circuits to UNKNOWN", () => {
    const raw: RawMarketData = {
      ...emptyRawMarketData("X", "equity"),
      quote: { ltp: 100, prevClose: 99, dayHigh: 102, dayLow: 98, bid: 99.9, ask: 100.1 },
      candles5m: [
        { time: 0, open: 100, high: 99, low: 101, close: 100, volume: 1000 }, // high<low
      ],
    };
    const s = buildSnapshot(raw);
    // Validation fails → buildSnapshot returns UNKNOWN snapshot, not a
    // snapshot with half-computed indicators.
    expect(s.ltp).toBeNull();
    expect(s.vwap5m).toBeNull();
  });
});

describe("buildSnapshot — well-formed equity payload populates fields", () => {
  test("indicators and scores become non-null with real data", () => {
    const candles = flatCandles(60);
    const raw: RawMarketData = {
      ...emptyRawMarketData("X", "equity"),
      quote: {
        ltp: 100,
        prevClose: 99,
        dayHigh: 102,
        dayLow: 98,
        bid: 99.9,
        ask: 100.1,
      },
      candles5m: candles,
      candles15m: candles,
      avgDailyVolume: 20000,
    };
    const s = buildSnapshot(raw);
    expect(s.ltp).toBe(100);
    expect(s.vwap5m).not.toBeNull();
    expect(s.atr5m).not.toBeNull();
    // spread = (100.1 - 99.9) / 100 * 100 = 0.2%
    expect(s.spreadPct).toBeCloseTo(0.2, 3);
  });
});

describe("Audit fix #7 — RawCandle.time uses seconds", () => {
  test("ORB computed over first 15 minutes only", () => {
    // 5-min candles, 6 of them: first 3 are in ORB (0..14m), rest outside.
    const c: RawCandle[] = [
      { time: 0,    open: 100, high: 103, low: 99,  close: 102, volume: 1000 }, // ORB
      { time: 300,  open: 102, high: 104, low: 100, close: 101, volume: 1000 }, // ORB
      { time: 600,  open: 101, high: 105, low: 100, close: 103, volume: 1000 }, // ORB
      { time: 900,  open: 103, high: 106, low: 99,  close: 104, volume: 1000 }, // NOT ORB (at 15m boundary)
      { time: 1200, open: 104, high: 108, low: 101, close: 106, volume: 1000 },
      { time: 1500, open: 106, high: 110, low: 105, close: 109, volume: 1000 },
    ];
    const raw: RawMarketData = {
      ...emptyRawMarketData("X", "equity"),
      quote: { ltp: 109, prevClose: 99, dayHigh: 110, dayLow: 99, bid: null, ask: null },
      candles5m: c,
      candles15m: c,
      avgDailyVolume: 20000,
    };
    const s = buildSnapshot(raw);
    // ORB high = max of first 3 candles = 105, low = 99
    expect(s.orbHigh).toBe(105);
    expect(s.orbLow).toBe(99);
  });
});
