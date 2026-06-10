import { describe, expect, test } from "bun:test";
import {
  _resetThrottleForTests,
  findEquity,
  findFrontMonthAtm,
  findIndex,
  parseCsvLine,
  parseInstrumentCsv,
  type DhanInstrument,
} from "./dhan-client.ts";

describe("throttle — audit regression (race-free FIFO serialisation)", () => {
  test("concurrent same-category calls fire at least `gap` ms apart", async () => {
    _resetThrottleForTests();
    // 4 parallel data-category calls — mirrors Promise.all in snapshotEquity
    // which fires 4 data requests. Data gap is 200ms.
    const times: number[] = [];
    await Promise.all(
      [0, 1, 2, 3].map(async () => {
        await (
          await import("./dhan-client.ts")
        )._throttleForTests("data");
        times.push(Date.now());
      }),
    );
    times.sort((a, b) => a - b);
    // Adjacent pairs must be separated by at least the gap minus a small
    // timer jitter tolerance (10ms). With the old buggy throttle this
    // assertion fails immediately — all 4 fire within 1ms.
    for (let i = 1; i < times.length; i++) {
      expect(times[i]! - times[i - 1]!).toBeGreaterThanOrEqual(190);
    }
  }, 2000);

  test("different categories do not block each other", async () => {
    _resetThrottleForTests();
    const { _throttleForTests } = await import("./dhan-client.ts");
    const t0 = Date.now();
    await Promise.all([
      _throttleForTests("data"),
      _throttleForTests("quote"),
      _throttleForTests("chain"),
    ]);
    // Three categories are independent — all should fire immediately
    // (first-slot), so total elapsed should be under ~50ms.
    expect(Date.now() - t0).toBeLessThan(100);
  });
});

describe("parseCsvLine", () => {
  test("splits simple CSV", () => {
    expect(parseCsvLine("a,b,c")).toEqual(["a", "b", "c"]);
  });
  test("preserves commas inside quotes", () => {
    expect(parseCsvLine('a,"b,c",d')).toEqual(["a", "b,c", "d"]);
  });
  test("handles empty fields", () => {
    expect(parseCsvLine("a,,b")).toEqual(["a", "", "b"]);
    expect(parseCsvLine(",,")).toEqual(["", "", ""]);
  });
});

// Abbreviated Dhan master schema (real file has ~20 columns; these cover
// everything the parser extracts).
const HEADER = [
  "SEM_EXM_EXCH_ID",
  "SEM_SEGMENT",
  "SEM_SMST_SECURITY_ID",
  "SEM_INSTRUMENT_NAME",
  "SEM_TRADING_SYMBOL",
  "SEM_LOT_UNITS",
  "SEM_EXPIRY_DATE",
  "SEM_STRIKE_PRICE",
  "SEM_OPTION_TYPE",
  "SM_SYMBOL_NAME",
].join(",");

function row(fields: Array<string | number>): string {
  return fields.map(String).join(",");
}

describe("parseInstrumentCsv", () => {
  test("parses equity + index + option rows", () => {
    const csv = [
      HEADER,
      row(["NSE", "E", "1333", "EQUITY", "HDFCBANK", 1, "", "", "", "HDFCBANK"]),
      row(["NSE", "I", "13", "INDEX", "NIFTY", 1, "", "", "", "NIFTY"]),
      row(["NSE", "D", "46000", "OPTIDX", "NIFTY25APR22500CE", 25, "2025-04-24", 22500, "CE", "NIFTY"]),
      row(["NSE", "D", "46001", "OPTIDX", "NIFTY25APR22500PE", 25, "2025-04-24", 22500, "PE", "NIFTY"]),
      "", // blank line tolerated
    ].join("\n");
    const out = parseInstrumentCsv(csv);
    expect(out.length).toBe(4);
    expect(out[0]!.tradingSymbol).toBe("HDFCBANK");
    expect(out[2]!.instrumentName).toBe("OPTIDX");
    expect(out[2]!.strikePrice).toBe(22500);
    expect(out[2]!.optionType).toBe("CE");
    expect(out[2]!.expiryDate).toBe("2025-04-24");
  });

  test("rejects schema with missing required columns", () => {
    const csv = "WRONG_HEADER\nNSE,1333,HDFCBANK";
    expect(() => parseInstrumentCsv(csv)).toThrow();
  });

  test("uppercases symbol names for stable lookup", () => {
    const csv = [HEADER, row(["NSE", "E", "1", "EQUITY", "reliance", 1, "", "", "", "reliance"])].join("\n");
    const out = parseInstrumentCsv(csv);
    expect(out[0]!.tradingSymbol).toBe("RELIANCE");
    expect(out[0]!.symbolName).toBe("RELIANCE");
  });
});

const SAMPLE_INSTRUMENTS: DhanInstrument[] = [
  { securityId: "1333", tradingSymbol: "HDFCBANK", exchange: "NSE", segment: "E", instrumentName: "EQUITY", lotSize: 1, expiryDate: null, strikePrice: null, optionType: null, symbolName: "HDFCBANK" },
  { securityId: "500180", tradingSymbol: "HDFCBANK", exchange: "BSE", segment: "E", instrumentName: "EQUITY", lotSize: 1, expiryDate: null, strikePrice: null, optionType: null, symbolName: "HDFCBANK" },
  { securityId: "13", tradingSymbol: "NIFTY", exchange: "NSE", segment: "I", instrumentName: "INDEX", lotSize: 1, expiryDate: null, strikePrice: null, optionType: null, symbolName: "NIFTY" },
  { securityId: "46100", tradingSymbol: "NIFTY25APR22400CE", exchange: "NSE", segment: "D", instrumentName: "OPTIDX", lotSize: 25, expiryDate: "2025-04-24", strikePrice: 22400, optionType: "CE", symbolName: "NIFTY" },
  { securityId: "46200", tradingSymbol: "NIFTY25APR22500CE", exchange: "NSE", segment: "D", instrumentName: "OPTIDX", lotSize: 25, expiryDate: "2025-04-24", strikePrice: 22500, optionType: "CE", symbolName: "NIFTY" },
  { securityId: "46300", tradingSymbol: "NIFTY25APR22600CE", exchange: "NSE", segment: "D", instrumentName: "OPTIDX", lotSize: 25, expiryDate: "2025-04-24", strikePrice: 22600, optionType: "CE", symbolName: "NIFTY" },
  { securityId: "46400", tradingSymbol: "NIFTY25MAY22500CE", exchange: "NSE", segment: "D", instrumentName: "OPTIDX", lotSize: 25, expiryDate: "2025-05-29", strikePrice: 22500, optionType: "CE", symbolName: "NIFTY" },
];

describe("findEquity", () => {
  test("prefers NSE listing", () => {
    const inst = findEquity(SAMPLE_INSTRUMENTS, "HDFCBANK");
    expect(inst?.exchange).toBe("NSE");
    expect(inst?.securityId).toBe("1333");
  });
  test("case-insensitive", () => {
    expect(findEquity(SAMPLE_INSTRUMENTS, "hdfcbank")?.securityId).toBe("1333");
  });
  test("returns null for unknown", () => {
    expect(findEquity(SAMPLE_INSTRUMENTS, "ZZZZZ")).toBeNull();
  });
});

describe("findIndex", () => {
  test("finds NIFTY as index", () => {
    const inst = findIndex(SAMPLE_INSTRUMENTS, "NIFTY");
    expect(inst?.securityId).toBe("13");
    expect(inst?.instrumentName).toBe("INDEX");
  });
});

describe("findFrontMonthAtm", () => {
  test("picks strike closest to spot at nearest expiry", () => {
    // spot between 22500 and 22600 but closer to 22500
    const inst = findFrontMonthAtm(SAMPLE_INSTRUMENTS, "NIFTY", 22540, "CE");
    expect(inst?.strikePrice).toBe(22500);
    expect(inst?.expiryDate).toBe("2025-04-24");
  });
  test("front-month beats further-dated even when strike is same", () => {
    // Both 22500CE exist (Apr + May); expect Apr (earlier expiry).
    const inst = findFrontMonthAtm(SAMPLE_INSTRUMENTS, "NIFTY", 22500, "CE");
    expect(inst?.expiryDate).toBe("2025-04-24");
  });
  test("returns null when underlying unknown", () => {
    expect(findFrontMonthAtm(SAMPLE_INSTRUMENTS, "BANKNIFTY", 48000, "CE")).toBeNull();
  });
});
