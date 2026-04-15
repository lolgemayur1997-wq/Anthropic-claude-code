/**
 * Low-level Dhan HQ v2 API client.
 *
 * Docs: https://dhanhq.co/docs/v2/
 *
 * Reads credentials from environment variables:
 *   DHAN_CLIENT_ID        — 10-digit client id
 *   DHAN_ACCESS_TOKEN     — JWT access token (rotate via web.dhan.co)
 *
 * All functions return raw-data shapes. buildSnapshot in agents/snapshot.ts
 * maps them onto RawMarketData and runs the analysis pipeline.
 *
 * Rate limiting: the client applies a conservative 100ms per-request minimum
 * gap. Dhan's published limits vary by endpoint; this is well within them.
 */

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const BASE_URL = "https://api.dhan.co";
const INSTRUMENT_MASTER_URL = "https://images.dhan.co/api-data/api-scrip-master-detailed.csv";
const INSTRUMENT_CACHE_PATH = join(
  process.cwd(),
  "agents/config/.dhan-instruments-cache.json",
);
const INSTRUMENT_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const MIN_REQUEST_GAP_MS = 100;

// --- Config ---

export interface DhanConfig {
  clientId: string;
  accessToken: string;
}

export function loadConfig(): DhanConfig {
  const clientId = process.env.DHAN_CLIENT_ID;
  const accessToken = process.env.DHAN_ACCESS_TOKEN;
  if (!clientId || !accessToken) {
    throw new Error(
      "Dhan adapter requires DHAN_CLIENT_ID and DHAN_ACCESS_TOKEN env vars. " +
        "Get them from web.dhan.co → Profile → DhanHQ Trading APIs. " +
        "Put them in .env.intraday (gitignored).",
    );
  }
  return { clientId, accessToken };
}

// --- Request helper ---

let lastRequestAt = 0;

async function throttle(): Promise<void> {
  const elapsed = Date.now() - lastRequestAt;
  const wait = MIN_REQUEST_GAP_MS - elapsed;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
}

interface RequestOptions {
  method?: "GET" | "POST";
  path: string;
  body?: unknown;
  timeoutMs?: number;
  retries?: number;
}

async function request<T>(cfg: DhanConfig, opts: RequestOptions): Promise<T> {
  const { method = "POST", path, body, timeoutMs = 15000, retries = 2 } = opts;
  const url = `${BASE_URL}${path}`;
  let lastError: unknown = new Error("Dhan request never executed");

  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttle();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        headers: {
          "access-token": cfg.accessToken,
          "client-id": cfg.clientId,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.ok) return (await res.json()) as T;

      const text = await res.text();
      // Auth errors don't retry — token is bad, token will stay bad.
      if (res.status === 401 || res.status === 403) {
        throw new Error(
          `Dhan auth failed (${res.status}): ${text}. Regenerate access token at web.dhan.co.`,
        );
      }
      // 404 doesn't retry either — wrong endpoint or wrong symbol.
      if (res.status === 404) throw new Error(`Dhan 404 at ${path}: ${text}`);

      // 429 (rate limit) or 5xx — backoff + retry.
      lastError = new Error(`Dhan ${res.status} at ${path}: ${text}`);
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    } catch (e) {
      clearTimeout(timer);
      lastError = e;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }
  }
  throw lastError;
}

// --- Instrument master (Dhan's ~20 MB CSV of every tradable instrument) ---

export interface DhanInstrument {
  securityId: string;
  tradingSymbol: string;
  exchange: string; // NSE, BSE
  segment: string; // E, D, I, M, C
  instrumentName: string; // EQUITY, OPTIDX, OPTSTK, FUTIDX, FUTSTK, INDEX
  lotSize: number;
  expiryDate: string | null; // YYYY-MM-DD
  strikePrice: number | null;
  optionType: "CE" | "PE" | null;
  symbolName: string; // underlying for derivatives
}

interface InstrumentCache {
  fetched_at: number;
  instruments: DhanInstrument[];
}

/** CSV field extractor that handles quoted commas. */
export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

/** Parse Dhan's instrument-master CSV. Pure — exported for testing. */
export function parseInstrumentCsv(csv: string): DhanInstrument[] {
  const lines = csv.split("\n");
  if (lines.length < 2) return [];
  const header = parseCsvLine(lines[0]!).map((h) => h.trim());
  const idx = (name: string): number => header.indexOf(name);
  const iSecId = idx("SEM_SMST_SECURITY_ID");
  const iTrdSym = idx("SEM_TRADING_SYMBOL");
  const iExch = idx("SEM_EXM_EXCH_ID");
  const iSeg = idx("SEM_SEGMENT");
  const iInst = idx("SEM_INSTRUMENT_NAME");
  const iLot = idx("SEM_LOT_UNITS");
  const iExp = idx("SEM_EXPIRY_DATE");
  const iStrike = idx("SEM_STRIKE_PRICE");
  const iOpt = idx("SEM_OPTION_TYPE");
  const iSymName = idx("SM_SYMBOL_NAME");
  if (iSecId < 0 || iTrdSym < 0 || iInst < 0) {
    throw new Error("Unexpected Dhan instrument-master schema — missing columns");
  }

  const out: DhanInstrument[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.trim().length === 0) continue;
    const cols = parseCsvLine(line);
    if (cols.length < header.length) continue;
    const rawOpt = cols[iOpt];
    out.push({
      securityId: (cols[iSecId] ?? "").trim(),
      tradingSymbol: (cols[iTrdSym] ?? "").trim().toUpperCase(),
      exchange: (cols[iExch] ?? "").trim(),
      segment: (cols[iSeg] ?? "").trim(),
      instrumentName: (cols[iInst] ?? "").trim(),
      lotSize: Number(cols[iLot]) || 1,
      expiryDate:
        cols[iExp] && cols[iExp]!.trim() !== "" ? cols[iExp]!.trim().slice(0, 10) : null,
      strikePrice: cols[iStrike] && cols[iStrike]!.trim() !== "" ? Number(cols[iStrike]) : null,
      optionType: rawOpt === "CE" || rawOpt === "PE" ? rawOpt : null,
      symbolName: (cols[iSymName] ?? "").trim().toUpperCase(),
    });
  }
  return out;
}

let _memoryCache: DhanInstrument[] | null = null;

export async function loadInstruments(): Promise<DhanInstrument[]> {
  if (_memoryCache) return _memoryCache;
  mkdirSync(dirname(INSTRUMENT_CACHE_PATH), { recursive: true });
  if (existsSync(INSTRUMENT_CACHE_PATH)) {
    try {
      const s = statSync(INSTRUMENT_CACHE_PATH);
      if (Date.now() - s.mtimeMs < INSTRUMENT_CACHE_TTL_MS) {
        const cache = JSON.parse(readFileSync(INSTRUMENT_CACHE_PATH, "utf8")) as InstrumentCache;
        _memoryCache = cache.instruments;
        return _memoryCache;
      }
    } catch {
      /* fall through to fetch */
    }
  }
  const res = await fetch(INSTRUMENT_MASTER_URL, { signal: AbortSignal.timeout(120000) });
  if (!res.ok) throw new Error(`Failed to download Dhan instrument master: ${res.status}`);
  const csv = await res.text();
  const instruments = parseInstrumentCsv(csv);
  writeFileSync(
    INSTRUMENT_CACHE_PATH,
    JSON.stringify({ fetched_at: Date.now(), instruments }),
    "utf8",
  );
  _memoryCache = instruments;
  return instruments;
}

// --- Instrument lookups ---

export function findEquity(instruments: DhanInstrument[], symbol: string): DhanInstrument | null {
  const up = symbol.toUpperCase();
  return (
    instruments.find(
      (i) => i.instrumentName === "EQUITY" && i.exchange === "NSE" && i.tradingSymbol === up,
    ) ?? null
  );
}

export function findIndex(instruments: DhanInstrument[], symbol: string): DhanInstrument | null {
  const up = symbol.toUpperCase();
  return (
    instruments.find((i) => i.instrumentName === "INDEX" && i.tradingSymbol === up) ??
    instruments.find((i) => i.instrumentName === "INDEX" && i.symbolName === up) ??
    null
  );
}

/** Find the front-month (nearest-expiry) ATM option for an underlying. */
export function findFrontMonthAtm(
  instruments: DhanInstrument[],
  underlying: string,
  spot: number,
  optionType: "CE" | "PE" = "CE",
): DhanInstrument | null {
  const up = underlying.toUpperCase();
  const candidates = instruments.filter(
    (i) =>
      (i.instrumentName === "OPTIDX" || i.instrumentName === "OPTSTK") &&
      i.symbolName === up &&
      i.optionType === optionType &&
      i.expiryDate !== null &&
      i.strikePrice !== null,
  );
  if (candidates.length === 0) return null;
  const firstExpiry = candidates.map((c) => c.expiryDate!).sort()[0]!;
  const sameExpiry = candidates.filter((c) => c.expiryDate === firstExpiry);
  sameExpiry.sort(
    (a, b) => Math.abs((a.strikePrice ?? 0) - spot) - Math.abs((b.strikePrice ?? 0) - spot),
  );
  return sameExpiry[0] ?? null;
}

// --- Market feed endpoints ---

interface LtpResponse {
  data: Record<string, Record<string, { last_price: number }>>;
}

export async function fetchLtp(
  cfg: DhanConfig,
  instruments: Record<string, string[]>,
): Promise<Record<string, Record<string, number>>> {
  const res = await request<LtpResponse>(cfg, {
    path: "/v2/marketfeed/ltp",
    body: instruments,
  });
  const out: Record<string, Record<string, number>> = {};
  for (const [seg, ids] of Object.entries(res.data ?? {})) {
    out[seg] = {};
    for (const [id, q] of Object.entries(ids)) {
      out[seg]![id] = q.last_price;
    }
  }
  return out;
}

export interface DhanQuote {
  ltp: number;
  open: number;
  high: number;
  low: number;
  prevClose: number;
  volume: number | null;
  bid: number | null;
  ask: number | null;
  oi: number | null;
}

interface QuoteResponse {
  data: Record<
    string,
    Record<
      string,
      {
        last_price: number;
        ohlc: { open: number; high: number; low: number; close: number };
        volume?: number;
        depth?: {
          buy?: Array<{ price: number; quantity: number }>;
          sell?: Array<{ price: number; quantity: number }>;
        };
        oi?: number;
      }
    >
  >;
}

export async function fetchQuote(
  cfg: DhanConfig,
  instruments: Record<string, string[]>,
): Promise<Record<string, Record<string, DhanQuote>>> {
  const res = await request<QuoteResponse>(cfg, {
    path: "/v2/marketfeed/quote",
    body: instruments,
  });
  const out: Record<string, Record<string, DhanQuote>> = {};
  for (const [seg, ids] of Object.entries(res.data ?? {})) {
    out[seg] = {};
    for (const [id, q] of Object.entries(ids)) {
      out[seg]![id] = {
        ltp: q.last_price,
        open: q.ohlc.open,
        high: q.ohlc.high,
        low: q.ohlc.low,
        prevClose: q.ohlc.close,
        volume: q.volume ?? null,
        bid: q.depth?.buy?.[0]?.price ?? null,
        ask: q.depth?.sell?.[0]?.price ?? null,
        oi: q.oi ?? null,
      };
    }
  }
  return out;
}

// --- Historical candles ---

export interface DhanCandle {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface ChartsResponse {
  open?: number[];
  high?: number[];
  low?: number[];
  close?: number[];
  volume?: number[];
  timestamp?: number[];
}

function parseChartsResponse(r: ChartsResponse): DhanCandle[] {
  const t = r.timestamp ?? [];
  const out: DhanCandle[] = [];
  for (let i = 0; i < t.length; i++) {
    out.push({
      time: t[i]!,
      open: r.open?.[i] ?? 0,
      high: r.high?.[i] ?? 0,
      low: r.low?.[i] ?? 0,
      close: r.close?.[i] ?? 0,
      volume: r.volume?.[i] ?? 0,
    });
  }
  return out;
}

export async function fetchIntradayCandles(
  cfg: DhanConfig,
  securityId: string,
  exchangeSegment: string, // NSE_EQ, NSE_FNO, IDX_I
  instrumentType: string, // EQUITY, INDEX, OPTIDX, OPTSTK, FUTIDX
  intervalMin: 1 | 5 | 15 | 25 | 60,
  fromDate: string,
  toDate: string,
): Promise<DhanCandle[]> {
  const r = await request<ChartsResponse>(cfg, {
    path: "/v2/charts/intraday",
    body: {
      securityId,
      exchangeSegment,
      instrument: instrumentType,
      interval: String(intervalMin),
      fromDate,
      toDate,
    },
  });
  return parseChartsResponse(r);
}

export async function fetchDailyCandles(
  cfg: DhanConfig,
  securityId: string,
  exchangeSegment: string,
  instrumentType: string,
  fromDate: string,
  toDate: string,
): Promise<DhanCandle[]> {
  const r = await request<ChartsResponse>(cfg, {
    path: "/v2/charts/historical",
    body: {
      securityId,
      exchangeSegment,
      instrument: instrumentType,
      fromDate,
      toDate,
    },
  });
  return parseChartsResponse(r);
}

// --- Option chain ---

export interface DhanOptionLeg {
  ltp: number;
  oi: number;
  iv: number;
  volume: number;
  bid: number | null;
  ask: number | null;
}

export interface DhanOptionChainRow {
  strike: number;
  call: DhanOptionLeg | null;
  put: DhanOptionLeg | null;
}

export interface DhanOptionChain {
  underlyingLtp: number;
  rows: DhanOptionChainRow[];
}

interface OptionChainResponse {
  data: {
    last_price: number;
    oc: Record<
      string,
      {
        ce?: {
          last_price: number;
          volume: number;
          oi: number;
          implied_volatility: number;
          top_bid_price?: number;
          top_ask_price?: number;
        };
        pe?: {
          last_price: number;
          volume: number;
          oi: number;
          implied_volatility: number;
          top_bid_price?: number;
          top_ask_price?: number;
        };
      }
    >;
  };
}

export async function fetchOptionChain(
  cfg: DhanConfig,
  underlyingSecId: number,
  underlyingSeg: string, // IDX_I (indices) or NSE_EQ (stock underlyings)
  expiry: string, // YYYY-MM-DD
): Promise<DhanOptionChain> {
  const r = await request<OptionChainResponse>(cfg, {
    path: "/v2/optionchain",
    body: {
      UnderlyingScrip: underlyingSecId,
      UnderlyingSeg: underlyingSeg,
      Expiry: expiry,
    },
  });
  const rows: DhanOptionChainRow[] = [];
  for (const [strikeStr, legs] of Object.entries(r.data.oc ?? {})) {
    const strike = Number(strikeStr);
    if (!Number.isFinite(strike)) continue;
    rows.push({
      strike,
      call: legs.ce
        ? {
            ltp: legs.ce.last_price,
            oi: legs.ce.oi,
            iv: legs.ce.implied_volatility,
            volume: legs.ce.volume,
            bid: legs.ce.top_bid_price ?? null,
            ask: legs.ce.top_ask_price ?? null,
          }
        : null,
      put: legs.pe
        ? {
            ltp: legs.pe.last_price,
            oi: legs.pe.oi,
            iv: legs.pe.implied_volatility,
            volume: legs.pe.volume,
            bid: legs.pe.top_bid_price ?? null,
            ask: legs.pe.top_ask_price ?? null,
          }
        : null,
    });
  }
  rows.sort((a, b) => a.strike - b.strike);
  return { underlyingLtp: r.data.last_price, rows };
}

interface ExpiryListResponse {
  data: string[];
}

export async function fetchExpiryList(
  cfg: DhanConfig,
  underlyingSecId: number,
  underlyingSeg: string,
): Promise<string[]> {
  const r = await request<ExpiryListResponse>(cfg, {
    path: "/v2/optionchain/expirylist",
    body: {
      UnderlyingScrip: underlyingSecId,
      UnderlyingSeg: underlyingSeg,
    },
  });
  return r.data ?? [];
}
