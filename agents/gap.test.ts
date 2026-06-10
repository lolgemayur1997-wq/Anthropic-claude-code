import { describe, expect, test } from "bun:test";
import type { Candle } from "./indicators.ts";
import { classifyGap, gapBiasConflict } from "./gap.ts";

function mkCandle(t: number, open: number, close: number, high?: number, low?: number): Candle {
  const h = high ?? Math.max(open, close) + 0.2;
  const l = low ?? Math.min(open, close) - 0.2;
  return { time: t, open, high: h, low: l, close, volume: 1000 };
}

describe("classifyGap — edge cases", () => {
  test("null when prevClose is zero", () => {
    expect(
      classifyGap({
        prevClose: 0, prevHigh: 0, prevLow: 0,
        todayOpen: 100, candles5m: [mkCandle(0, 100, 101)],
      }),
    ).toBeNull();
  });
  test("null when candles empty", () => {
    expect(
      classifyGap({
        prevClose: 100, prevHigh: 102, prevLow: 98,
        todayOpen: 100.5, candles5m: [],
      }),
    ).toBeNull();
  });
  test("tiny gap below noise → none", () => {
    const r = classifyGap({
      prevClose: 100, prevHigh: 101, prevLow: 99,
      todayOpen: 100.05,
      candles5m: [mkCandle(0, 100.05, 100.1)],
    })!;
    expect(r.gapClass).toBe("none");
  });
});

describe("classifyGap — gap-up variants", () => {
  test("gap-up-continuation: held + extending up", () => {
    const candles = [
      mkCandle(0, 105, 106),
      mkCandle(300, 106, 107),
      mkCandle(600, 107, 108),
    ];
    const r = classifyGap({
      prevClose: 100, prevHigh: 101, prevLow: 98,
      todayOpen: 105,
      candles5m: candles,
    })!;
    expect(r.gapClass).toBe("gap-up-continuation");
    expect(r.gapPct).toBeCloseTo(5, 3);
  });
  test("gap-up-reverse: filled AND below prev close", () => {
    const candles = [
      mkCandle(0, 105, 103),
      mkCandle(300, 103, 100, 103, 99.5),   // pierces prev close
      mkCandle(600, 100, 98.5),
    ];
    const r = classifyGap({
      prevClose: 100, prevHigh: 101, prevLow: 98,
      todayOpen: 105,
      candles5m: candles,
    })!;
    expect(r.gapClass).toBe("gap-up-reverse");
  });
  test("gap-fill: returned to prev close, hovering", () => {
    const candles = [
      mkCandle(0, 105, 104),
      mkCandle(300, 104, 101, 104, 99.9),
      mkCandle(600, 101, 100.1),
    ];
    const r = classifyGap({
      prevClose: 100, prevHigh: 101, prevLow: 98,
      todayOpen: 105,
      candles5m: candles,
    })!;
    expect(r.gapClass).toBe("gap-fill");
  });
});

describe("classifyGap — gap-down variants", () => {
  test("gap-down-continuation: stays below, extending down", () => {
    const candles = [
      mkCandle(0, 95, 94),
      mkCandle(300, 94, 93),
      mkCandle(600, 93, 92),
    ];
    const r = classifyGap({
      prevClose: 100, prevHigh: 101, prevLow: 98,
      todayOpen: 95,
      candles5m: candles,
    })!;
    expect(r.gapClass).toBe("gap-down-continuation");
  });
  test("gap-down-reverse: reclaimed prev close + above", () => {
    const candles = [
      mkCandle(0, 95, 97),
      mkCandle(300, 97, 100, 100.1, 97),   // reclaims prev close
      mkCandle(600, 100, 101.5),
    ];
    const r = classifyGap({
      prevClose: 100, prevHigh: 101, prevLow: 98,
      todayOpen: 95,
      candles5m: candles,
    })!;
    expect(r.gapClass).toBe("gap-down-reverse");
  });
});

describe("classifyGap — inside-day", () => {
  test("meaningful gap-up but range stays inside prior → inside-day", () => {
    // Gap +0.5% (above 0.2% noise), but today's whole range stays inside
    // prior [99, 101]. Direction unclear until a break — classic inside-day.
    const candles = [
      mkCandle(0, 100.5, 100.6, 100.8, 100.3),
      mkCandle(300, 100.6, 100.4, 100.7, 100.3),
      mkCandle(600, 100.4, 100.5, 100.7, 100.3),
    ];
    const r = classifyGap({
      prevClose: 100, prevHigh: 101, prevLow: 99,
      todayOpen: 100.5,
      candles5m: candles,
    })!;
    expect(r.gapClass).toBe("inside-day");
  });
});

describe("gapBiasConflict", () => {
  test("gap-up-continuation + long = compatible", () => {
    expect(gapBiasConflict("gap-up-continuation", "long")).toBeNull();
  });
  test("gap-up-continuation + short = conflict", () => {
    expect(gapBiasConflict("gap-up-continuation", "short")).not.toBeNull();
  });
  test("gap-down-continuation + long = conflict", () => {
    expect(gapBiasConflict("gap-down-continuation", "long")).not.toBeNull();
  });
  test("gap-fill is neutral for both sides", () => {
    expect(gapBiasConflict("gap-fill", "long")).toBeNull();
    expect(gapBiasConflict("gap-fill", "short")).toBeNull();
  });
  test("none (no gap) never conflicts", () => {
    expect(gapBiasConflict("none", "long")).toBeNull();
    expect(gapBiasConflict("none", "short")).toBeNull();
  });
});
