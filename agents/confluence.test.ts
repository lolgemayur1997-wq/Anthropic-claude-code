import { describe, expect, test } from "bun:test";
import type { Candle } from "./indicators.ts";
import { scoreConfluence } from "./confluence.ts";

function linearCandles(start: number, step: number, n: number, timeStart = 0, dt = 300): Candle[] {
  return Array.from({ length: n }, (_, i) => {
    const base = start + step * i;
    return {
      time: timeStart + i * dt,
      open: base,
      high: base + Math.abs(step) * 0.3,
      low: base - Math.abs(step) * 0.3,
      close: base + step * 0.6,
      volume: 1000,
    };
  });
}

describe("scoreConfluence", () => {
  test("null on insufficient candles", () => {
    const r = scoreConfluence({
      candles5m: linearCandles(100, 0.5, 5),
      candles15m: linearCandles(100, 0.5, 5),
      candles1h: linearCandles(100, 0.5, 5),
      ltp: 105,
    });
    expect(r).toBeNull();
  });

  test("all TFs rising → high confluence score", () => {
    const c5 = linearCandles(100, 0.5, 30);
    const c15 = linearCandles(100, 0.5, 30, 0, 900);
    const c1h = linearCandles(100, 0.5, 20, 0, 3600);
    const r = scoreConfluence({
      candles5m: c5,
      candles15m: c15,
      candles1h: c1h,
      ltp: 130,
    })!;
    expect(r.score).toBeGreaterThan(0.7);
    expect(r.aligned.length).toBeGreaterThan(0);
    expect(r.trend5m).toBe("up");
    expect(r.trend15m).toBe("up");
    expect(r.trend1h).toBe("up");
  });

  test("all TFs falling → high confluence (on the short side)", () => {
    const c5 = linearCandles(130, -0.5, 30);
    const c15 = linearCandles(130, -0.5, 30, 0, 900);
    const c1h = linearCandles(130, -0.5, 20, 0, 3600);
    const r = scoreConfluence({
      candles5m: c5,
      candles15m: c15,
      candles1h: c1h,
      ltp: 100,
    })!;
    expect(r.score).toBeGreaterThan(0.7);
    expect(r.trend5m).toBe("down");
    expect(r.trend15m).toBe("down");
    expect(r.trend1h).toBe("down");
  });

  test("mixed TFs (5m up, 1h down) → low score + conflict recorded", () => {
    const c5 = linearCandles(100, 0.8, 30);
    const c15 = linearCandles(100, 0.1, 30, 0, 900);
    const c1h = linearCandles(120, -0.8, 20, 0, 3600);
    const r = scoreConfluence({
      candles5m: c5,
      candles15m: c15,
      candles1h: c1h,
      ltp: 115,
    })!;
    expect(r.score).toBeLessThan(0.6);
    expect(r.conflicts.length).toBeGreaterThan(0);
  });

  test("score is always within [0, 1]", () => {
    const c = linearCandles(100, 0.3, 30);
    const r = scoreConfluence({
      candles5m: c,
      candles15m: c.map((x) => ({ ...x, time: x.time * 3 })),
      candles1h: c.slice(0, 20).map((x) => ({ ...x, time: x.time * 12 })),
      ltp: 108,
    })!;
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(1);
  });
});
