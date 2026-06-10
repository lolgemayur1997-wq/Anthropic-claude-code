import { describe, expect, test } from "bun:test";
import { pickStructure, type StructureInputs } from "./structure.ts";

const base: StructureInputs = {
  bias: "long",
  ivRegime: "NEUTRAL",
  dteDays: 10,
  hasMarginHeadroom: true,
  inExtraElm: false,
  inAsm: false,
  liquidOtmAvailable: true,
};

describe("pickStructure — UNDERPRICED IV", () => {
  test("long bias + DTE ≥ 7 → long-call", () => {
    const r = pickStructure({ ...base, ivRegime: "UNDERPRICED", dteDays: 14 });
    expect(r.structure).toBe("long-call");
  });
  test("short bias + DTE ≥ 7 → long-put", () => {
    const r = pickStructure({ ...base, ivRegime: "UNDERPRICED", bias: "short", dteDays: 14 });
    expect(r.structure).toBe("long-put");
  });
  test("long bias + tight DTE + liquid OTM → call-debit-spread", () => {
    const r = pickStructure({ ...base, ivRegime: "UNDERPRICED", dteDays: 3 });
    expect(r.structure).toBe("call-debit-spread");
  });
  test("long bias + tight DTE but no liquid OTM → long-call fallback", () => {
    const r = pickStructure({
      ...base,
      ivRegime: "UNDERPRICED",
      dteDays: 3,
      liquidOtmAvailable: false,
    });
    expect(r.structure).toBe("long-call");
  });
});

describe("pickStructure — OVERPRICED IV (short premium)", () => {
  test("long bias + headroom + liquid → put-credit-spread", () => {
    const r = pickStructure({ ...base, ivRegime: "OVERPRICED" });
    expect(r.structure).toBe("put-credit-spread");
  });
  test("short bias + headroom + liquid → call-credit-spread", () => {
    const r = pickStructure({ ...base, ivRegime: "OVERPRICED", bias: "short" });
    expect(r.structure).toBe("call-credit-spread");
  });
  test("blocked when Extra-ELM is active", () => {
    const r = pickStructure({ ...base, ivRegime: "OVERPRICED", inExtraElm: true });
    // Falls back to debit spread (defensive) since credit is blocked
    expect(r.structure).toBe("call-debit-spread");
  });
  test("blocked + no liquid OTM → no-structure", () => {
    const r = pickStructure({
      ...base,
      ivRegime: "OVERPRICED",
      inExtraElm: true,
      liquidOtmAvailable: false,
    });
    expect(r.structure).toBe("no-structure");
  });
  test("blocked when DTE < 2 (near expiry)", () => {
    const r = pickStructure({ ...base, ivRegime: "OVERPRICED", dteDays: 1 });
    expect(r.structure).toBe("call-debit-spread");
  });
  test("blocked when margin headroom missing", () => {
    const r = pickStructure({ ...base, ivRegime: "OVERPRICED", hasMarginHeadroom: false });
    expect(r.structure).toBe("call-debit-spread");
  });
  test("no liquid OTM but headroom available → no-structure", () => {
    const r = pickStructure({ ...base, ivRegime: "OVERPRICED", liquidOtmAvailable: false });
    expect(r.structure).toBe("no-structure");
  });
});

describe("pickStructure — NEUTRAL IV", () => {
  test("long bias + liquid OTM → call-debit-spread", () => {
    const r = pickStructure(base);
    expect(r.structure).toBe("call-debit-spread");
  });
  test("short bias + liquid OTM → put-debit-spread", () => {
    const r = pickStructure({ ...base, bias: "short" });
    expect(r.structure).toBe("put-debit-spread");
  });
  test("no liquid OTM → no-structure", () => {
    const r = pickStructure({ ...base, liquidOtmAvailable: false });
    expect(r.structure).toBe("no-structure");
  });
});

describe("pickStructure — rationale always present", () => {
  test("every return carries a rationale", () => {
    const r = pickStructure(base);
    expect(r.rationale.length).toBeGreaterThan(0);
    expect(r.defendedBy.length).toBeGreaterThan(0);
  });
});
