import { describe, expect, test } from "bun:test";
import { classifyOiBuildup } from "./dhan.ts";

function inputs(over: Partial<Parameters<typeof classifyOiBuildup>[0]>): Parameters<typeof classifyOiBuildup>[0] {
  return {
    atmCallOi: 100000,
    atmCallPrevOi: 100000,
    atmPutOi: 100000,
    atmPutPrevOi: 100000,
    underlyingLtp: 22500,
    underlyingPrevClose: 22500,
    ...over,
  };
}

describe("classifyOiBuildup — four classic states", () => {
  test("price ↑ + call OI ↑ → long-build", () => {
    const r = classifyOiBuildup(
      inputs({
        underlyingLtp: 22600,
        underlyingPrevClose: 22500,
        atmCallOi: 110000,
        atmCallPrevOi: 100000,
      }),
    );
    expect(r).toBe("long-build");
  });

  test("price ↑ + call OI ↓ → short-cover", () => {
    const r = classifyOiBuildup(
      inputs({
        underlyingLtp: 22600,
        underlyingPrevClose: 22500,
        atmCallOi: 85000,
        atmCallPrevOi: 100000,
      }),
    );
    expect(r).toBe("short-cover");
  });

  test("price ↓ + put OI ↑ → short-build", () => {
    const r = classifyOiBuildup(
      inputs({
        underlyingLtp: 22400,
        underlyingPrevClose: 22500,
        atmPutOi: 115000,
        atmPutPrevOi: 100000,
      }),
    );
    expect(r).toBe("short-build");
  });

  test("price ↓ + put OI ↓ → long-unwind", () => {
    const r = classifyOiBuildup(
      inputs({
        underlyingLtp: 22400,
        underlyingPrevClose: 22500,
        atmPutOi: 85000,
        atmPutPrevOi: 100000,
      }),
    );
    expect(r).toBe("long-unwind");
  });
});

describe("classifyOiBuildup — nulls and noise", () => {
  test("null on missing prev close", () => {
    expect(classifyOiBuildup(inputs({ underlyingPrevClose: null }))).toBeNull();
  });
  test("null on missing prev call OI", () => {
    expect(classifyOiBuildup(inputs({ atmCallPrevOi: null }))).toBeNull();
  });
  test("null on price move below noise threshold (default 0.05%)", () => {
    const r = classifyOiBuildup(
      inputs({ underlyingLtp: 22501, underlyingPrevClose: 22500 }), // 0.004%
    );
    expect(r).toBeNull();
  });
  test("null on OI move below noise threshold (default 2%)", () => {
    const r = classifyOiBuildup(
      inputs({
        underlyingLtp: 22600,
        underlyingPrevClose: 22500,
        atmCallOi: 100500,
        atmCallPrevOi: 100000, // 0.5% change
      }),
    );
    expect(r).toBeNull();
  });
});
