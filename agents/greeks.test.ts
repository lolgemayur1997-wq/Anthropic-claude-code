import { describe, expect, test } from "bun:test";
import {
  bsPrice,
  daysToYears,
  expectedMoveFromIv,
  expectedMoveFromStraddle,
  greeks,
  impliedVol,
} from "./greeks.ts";

const APPROX = (a: number | null, b: number, tol = 1e-2): boolean =>
  a !== null && Math.abs(a - b) < tol;

describe("bsPrice — reference values", () => {
  // Standard textbook example: Hull, Options Futures & Other Derivatives
  //   S=42, K=40, r=0.10, sigma=0.20, T=0.5
  //   Call ≈ 4.7594, Put ≈ 0.8086
  test("call price matches Hull example", () => {
    const p = bsPrice("call", { s: 42, k: 40, r: 0.1, sigma: 0.2, t: 0.5 });
    expect(APPROX(p, 4.7594, 0.01)).toBeTrue();
  });
  test("put price matches Hull example", () => {
    const p = bsPrice("put", { s: 42, k: 40, r: 0.1, sigma: 0.2, t: 0.5 });
    expect(APPROX(p, 0.8086, 0.01)).toBeTrue();
  });
  test("returns null for zero time", () => {
    expect(bsPrice("call", { s: 100, k: 100, r: 0.05, sigma: 0.2, t: 0 })).toBeNull();
  });
  test("returns null for zero sigma", () => {
    expect(bsPrice("call", { s: 100, k: 100, r: 0.05, sigma: 0, t: 0.25 })).toBeNull();
  });
});

describe("greeks — sanity checks", () => {
  const atm = { s: 100, k: 100, r: 0.05, sigma: 0.2, t: 0.25 };

  test("ATM call delta near 0.5", () => {
    const g = greeks("call", atm)!;
    expect(g.delta).toBeGreaterThan(0.5);  // slightly >0.5 due to rate
    expect(g.delta).toBeLessThan(0.6);
  });
  test("ATM put delta near -0.5", () => {
    const g = greeks("put", atm)!;
    expect(g.delta).toBeLessThan(-0.4);
    expect(g.delta).toBeGreaterThan(-0.5);
  });
  test("call and put gamma are identical at same strike", () => {
    const c = greeks("call", atm)!;
    const p = greeks("put", atm)!;
    expect(Math.abs(c.gamma - p.gamma)).toBeLessThan(1e-9);
  });
  test("call and put vega are identical at same strike", () => {
    const c = greeks("call", atm)!;
    const p = greeks("put", atm)!;
    expect(Math.abs(c.vega - p.vega)).toBeLessThan(1e-9);
  });
  test("theta is negative for long options (ATM)", () => {
    const c = greeks("call", atm)!;
    const p = greeks("put", atm)!;
    expect(c.theta).toBeLessThan(0);
    expect(p.theta).toBeLessThan(0);
  });
});

describe("impliedVol — round trip", () => {
  test("recovers input vol within tolerance", () => {
    const inp = { s: 100, k: 100, r: 0.05, sigma: 0.25, t: 0.25 };
    const mkt = bsPrice("call", inp)!;
    const iv = impliedVol({ type: "call", s: 100, k: 100, r: 0.05, t: 0.25, marketPrice: mkt });
    expect(APPROX(iv, 0.25, 1e-3)).toBeTrue();
  });
  test("recovers input vol for OTM put", () => {
    const inp = { s: 100, k: 95, r: 0.05, sigma: 0.35, t: 0.1 };
    const mkt = bsPrice("put", inp)!;
    const iv = impliedVol({ type: "put", s: 100, k: 95, r: 0.05, t: 0.1, marketPrice: mkt });
    expect(APPROX(iv, 0.35, 1e-3)).toBeTrue();
  });
  test("returns null on sub-intrinsic price", () => {
    // Intrinsic call at S=100, K=80 is ~20; price=5 < intrinsic → impossible
    const iv = impliedVol({ type: "call", s: 100, k: 80, r: 0.05, t: 0.25, marketPrice: 5 });
    expect(iv).toBeNull();
  });
});

describe("expected move helpers", () => {
  test("from IV: spot × IV × sqrt(days/365)", () => {
    const m = expectedMoveFromIv(100, 0.3, 30)!;
    expect(APPROX(m, 100 * 0.3 * Math.sqrt(30 / 365), 1e-9)).toBeTrue();
  });
  test("returns null on zero spot", () => {
    expect(expectedMoveFromIv(0, 0.3, 30)).toBeNull();
  });
  test("from straddle applies smoothing", () => {
    const m = expectedMoveFromStraddle(100, 10, 30)!;
    expect(APPROX(m, 8.5, 1e-9)).toBeTrue();
  });
});

describe("daysToYears", () => {
  test("converts 365 days to 1 year", () => {
    expect(daysToYears(365)).toBe(1);
  });
});
