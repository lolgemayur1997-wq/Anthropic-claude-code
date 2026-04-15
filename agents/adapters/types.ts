/**
 * Broker / data adapter interface for intraday-research.
 *
 * Implement this for whichever data source you have credentials for. Every
 * adapter MUST return UNKNOWN (null) for any field it cannot fetch — never
 * fabricate data.
 */

export type AdapterName = "mock" | "kite" | "upstox" | "dhan";

export type Segment = "equity" | "futures" | "options";

export type Bias = "long" | "short" | null;

// --- Raw shapes every adapter must assemble before calling buildSnapshot ---

export interface RawCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface RawQuote {
  ltp: number;
  prevClose: number;
  dayHigh: number;
  dayLow: number;
  bid: number | null;
  ask: number | null;
}

export interface RawOptionChain {
  pcr: number | null;
  maxPainStrike: number | null;
  oiBuildup: "long-build" | "short-build" | "long-unwind" | "short-cover" | null;
  unusualActivity: boolean | null;
  ivRank: number | null;
}

export interface RawEventFlags {
  inFnoBan: boolean;
  resultWithinDays: number | null;
  macroEventWithinMins: number | null;
  exDateToday: boolean;
  agmToday: boolean;
}

export interface RawNews {
  positive: boolean | null;
  negative: boolean | null;
  bulkBlockDealFavorable: boolean | null;
  corporateActionToday: boolean | null;
}

export interface RawMarketData {
  symbol: string;
  segment: Segment;
  candles5m: RawCandle[];
  candles15m: RawCandle[];
  quote: RawQuote | null;
  avgDailyVolume: number | null; // for RVOL approximation
  optionChain: RawOptionChain | null; // required if segment === "options"
  news: RawNews | null;
  eventFlags: RawEventFlags;
}

export interface SymbolSnapshot {
  symbol: string;
  segment: Segment;

  // Price
  ltp: number | null;
  prevClose: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  orbHigh: number | null;
  orbLow: number | null;

  // Volatility / spread
  atr5m: number | null;
  spreadPct: number | null;

  // Volume
  rvol: number | null;
  deliveryPct: number | null;

  // Indicators (computed by adapter or helper)
  vwap5m: number | null;
  rsi5m: number | null;
  rsi15m: number | null;
  macdHist15m: number | null;
  supertrend15m: "up" | "down" | null;
  emaStack5m: "up" | "down" | "tangled" | null;

  // Structure / pattern
  structureScore: number | null;   // 0..1
  patternScore: number | null;     // 0..1
  indicatorScore: number | null;   // 0..1
  volumeScore: number | null;      // 0..1
  orderBlockScore: number | null;  // 0..1
  optionsScore: number | null;     // 0..1
  newsScore: number | null;        // 0..1
  eventRiskFlags: number | null;

  // Labels
  setupLabel: string | null;
  bias: Bias;

  // Gates / flags
  inFnoBan: boolean;
  resultWithinDays: number | null;
  macroEventWithinMins: number | null;

  // Raw timestamp of data
  fetchedAt: string;
}

export interface Adapter {
  name: AdapterName;
  getIndiaVix(): Promise<number | null>;
  getSymbolSnapshot(symbol: string, segment: Segment): Promise<SymbolSnapshot>;
  emptySnapshot(symbol: string, segment: Segment): SymbolSnapshot;
}

export function blankSnapshot(symbol: string, segment: Segment): SymbolSnapshot {
  return {
    symbol,
    segment,
    ltp: null,
    prevClose: null,
    dayHigh: null,
    dayLow: null,
    orbHigh: null,
    orbLow: null,
    atr5m: null,
    spreadPct: null,
    rvol: null,
    deliveryPct: null,
    vwap5m: null,
    rsi5m: null,
    rsi15m: null,
    macdHist15m: null,
    supertrend15m: null,
    emaStack5m: null,
    structureScore: null,
    patternScore: null,
    indicatorScore: null,
    volumeScore: null,
    orderBlockScore: null,
    optionsScore: null,
    newsScore: null,
    eventRiskFlags: null,
    setupLabel: null,
    bias: null,
    inFnoBan: false,
    resultWithinDays: null,
    macroEventWithinMins: null,
    fetchedAt: new Date().toISOString(),
  };
}
