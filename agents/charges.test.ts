import { describe, expect, test } from "bun:test";
import {
  chargesForLeg,
  DEFAULT_SCHEDULE,
  netRMultiple,
  roundTripCharges,
} from "./charges.ts";

describe("chargesForLeg — STT", () => {
  test("futures buy has no STT", () => {
    const r = chargesForLeg({ segment: "futures", side: "buy", qty: 100, price: 2500 });
    expect(r.stt).toBe(0);
  });
  test("futures sell STT = 0.02% of turnover", () => {
    const r = chargesForLeg({ segment: "futures", side: "sell", qty: 100, price: 2500 });
    // turnover = 250000; STT = 0.0002 * 250000 = 50
    expect(r.stt).toBeCloseTo(50, 5);
  });
  test("options buy has no STT", () => {
    const r = chargesForLeg({ segment: "options", side: "buy", qty: 50, price: 120 });
    expect(r.stt).toBe(0);
  });
  test("options sell STT = 0.1% of premium turnover", () => {
    const r = chargesForLeg({ segment: "options", side: "sell", qty: 50, price: 120 });
    // turnover = 6000; STT = 0.001 * 6000 = 6
    expect(r.stt).toBeCloseTo(6, 5);
  });
});

describe("chargesForLeg — stamp duty (buy side only)", () => {
  test("options buy stamp duty = 0.003% of premium", () => {
    const r = chargesForLeg({ segment: "options", side: "buy", qty: 100, price: 100 });
    // turnover = 10000; stamp = 0.00003 * 10000 = 0.3
    expect(r.stamp_duty).toBeCloseTo(0.3, 5);
  });
  test("options sell pays no stamp duty", () => {
    const r = chargesForLeg({ segment: "options", side: "sell", qty: 100, price: 100 });
    expect(r.stamp_duty).toBe(0);
  });
});

describe("chargesForLeg — GST on brokerage + txn + sebi", () => {
  test("GST = 18% of (brokerage + exchange_txn + sebi)", () => {
    const r = chargesForLeg({ segment: "options", side: "buy", qty: 50, price: 200 });
    const expected = (r.brokerage + r.exchange_txn + r.sebi_turnover) * 0.18;
    expect(r.gst).toBeCloseTo(expected, 5);
  });
});

describe("roundTripCharges", () => {
  test("sums entry + exit and computes pct of entry notional", () => {
    const rt = roundTripCharges("options", 50, 100, 150);
    expect(rt.total_inr).toBeCloseTo(rt.entry.total + rt.exit.total, 5);
    expect(rt.total_pct_of_entry_notional).toBeGreaterThan(0);
  });
  test("charges scale with turnover", () => {
    const small = roundTripCharges("options", 50, 100, 150);
    const large = roundTripCharges("options", 500, 100, 150);
    expect(large.total_inr).toBeGreaterThan(small.total_inr);
  });
});

describe("netRMultiple", () => {
  test("1R gross trade becomes < 1R net after charges", () => {
    // entry 100, stop 90, target 110 → gross 1R
    const n = netRMultiple("options", 50, 100, 90, 110);
    expect(n).toBeLessThan(1);
    expect(n).toBeGreaterThan(0);
  });
  test("zero risk returns 0 safely", () => {
    expect(netRMultiple("options", 50, 100, 100, 110)).toBe(0);
  });
});

describe("DEFAULT_SCHEDULE sanity", () => {
  test("STT options sell is 0.1%", () => {
    expect(DEFAULT_SCHEDULE.stt.options_sell_premium_pct).toBe(0.1);
  });
  test("GST is 18%", () => {
    expect(DEFAULT_SCHEDULE.gst_pct).toBe(18);
  });
});
