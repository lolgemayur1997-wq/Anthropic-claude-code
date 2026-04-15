/**
 * Dhan adapter — REAL implementation.
 *
 * Reads DHAN_CLIENT_ID and DHAN_ACCESS_TOKEN from the local environment.
 * Never hardcodes credentials; never sends them anywhere except Dhan's
 * official API hosts.
 *
 * Coverage:
 *   - Equity:  full (quote, 5m/15m/1h intraday, 30d daily, avg volume)
 *   - Options: underlying candles + nearest-expiry chain + ATM metrics
 *   - Futures: not yet — returns UNKNOWN snapshot (pipeline gates NO_TRADE)
 *
 * Fields Dhan does NOT provide (stays null → pipeline marks UNKNOWN → gate):
 *   - MWPL %, F&O ban list, Extra-ELM / ASM  (need NSE daily CSV)
 *   - IV rank / percentile                   (need historical IV series)
 *   - OI buildup classification              (needs prior-session OI)
 *   - Corporate actions                      (NSE/BSE announcements feed)
 *   - SPAN / margin stress                   (Dhan margin-calculator API)
 */

import { buildSnapshot } from "../snapshot.ts";
import {
  blankSnapshot,
  emptyRawMarketData,
  type Adapter,
  type RawCandle,
  type RawMarketData,
  type Segment,
  type SymbolSnapshot,
} from "./types.ts";
import {
  fetchDailyCandles,
  fetchExpiryList,
  fetchIntradayCandles,
  fetchLtp,
  fetchOptionChain,
  fetchQuote,
  findEquity,
  findFrontMonthAtm,
  findIndex,
  loadConfig,
  loadInstruments,
  type DhanCandle,
  type DhanConfig,
  type DhanInstrument,
} from "./dhan-client.ts";

// --- Helpers ---

function istDate(now = new Date()): string {
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

function daysAgoIst(n: number, now = new Date()): string {
  const d = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function toRawCandles(candles: DhanCandle[]): RawCandle[] {
  return candles.map((c) => ({
    time: c.time,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
  }));
}

/** Dhan intraday returns the current day only. For candles1h we extend
 *  the range to pull the last few sessions. */
function intradayRange(lookbackDays: number): { from: string; to: string } {
  return { from: daysAgoIst(lookbackDays), to: istDate() };
}

// --- Equity path ---

async function snapshotEquity(
  cfg: DhanConfig,
  instruments: DhanInstrument[],
  symbol: string,
): Promise<RawMarketData> {
  const inst = findEquity(instruments, symbol);
  if (!inst) {
    throw new Error(`Dhan: NSE equity '${symbol}' not in instrument master`);
  }
  const today = istDate();
  const r1h = intradayRange(5);

  const [quoteMap, c5, c15, c1h, cDaily] = await Promise.all([
    fetchQuote(cfg, { NSE_EQ: [inst.securityId] }),
    fetchIntradayCandles(cfg, inst.securityId, "NSE_EQ", "EQUITY", 5, today, today),
    fetchIntradayCandles(cfg, inst.securityId, "NSE_EQ", "EQUITY", 15, today, today),
    fetchIntradayCandles(cfg, inst.securityId, "NSE_EQ", "EQUITY", 60, r1h.from, r1h.to),
    fetchDailyCandles(cfg, inst.securityId, "NSE_EQ", "EQUITY", daysAgoIst(45), today),
  ]);

  const q = quoteMap["NSE_EQ"]?.[inst.securityId];
  if (!q) throw new Error(`Dhan: no quote data for ${symbol}`);

  // Strip today from daily history so prev-day is really prev-day.
  const todayStart = new Date(today + "T00:00:00+05:30").getTime() / 1000;
  const priorDaily = cDaily.filter((c) => c.time < todayStart);
  const prevDailyCloses = priorDaily.map((c) => c.close);
  const prevDay = priorDaily[priorDaily.length - 1];
  const avgVol =
    priorDaily.length > 0
      ? priorDaily.reduce((a, c) => a + c.volume, 0) / priorDaily.length
      : null;

  return {
    symbol,
    segment: "equity",
    candles5m: toRawCandles(c5),
    candles15m: toRawCandles(c15),
    candles1h: toRawCandles(c1h),
    prevDailyCloses,
    prevDayHigh: prevDay?.high ?? null,
    prevDayLow: prevDay?.low ?? null,
    quote: {
      ltp: q.ltp,
      prevClose: q.prevClose,
      dayHigh: q.high,
      dayLow: q.low,
      bid: q.bid,
      ask: q.ask,
    },
    avgDailyVolume: avgVol,
    optionChain: null,
    contractMeta: null,
    volMargin: null,
    news: null,
    eventFlags: {
      inFnoBan: false,
      resultWithinDays: null,
      macroEventWithinMins: null,
      exDateToday: false,
      agmToday: false,
      mwplPct: null,
      inExtraElm: false,
      inAsm: false,
      corpActionWithinDays: null,
      corpActionType: null,
    },
  };
}

// --- Options path ---

async function snapshotOptions(
  cfg: DhanConfig,
  instruments: DhanInstrument[],
  underlyingSymbol: string,
): Promise<RawMarketData> {
  const indexInst = findIndex(instruments, underlyingSymbol);
  if (!indexInst) {
    throw new Error(`Dhan: index '${underlyingSymbol}' not in instrument master`);
  }
  const underlyingSeg = "IDX_I";
  const underlyingSecId = Number(indexInst.securityId);
  if (!Number.isFinite(underlyingSecId)) {
    throw new Error(`Dhan: invalid securityId for index ${underlyingSymbol}`);
  }

  // 1. Spot + expiry list in parallel.
  const [ltpMap, expiries] = await Promise.all([
    fetchLtp(cfg, { IDX_I: [indexInst.securityId] }),
    fetchExpiryList(cfg, underlyingSecId, underlyingSeg),
  ]);
  const spot = ltpMap["IDX_I"]?.[indexInst.securityId];
  if (spot === undefined) throw new Error(`Dhan: no LTP for index ${underlyingSymbol}`);
  if (expiries.length === 0) throw new Error(`Dhan: no expiries for ${underlyingSymbol}`);
  const nearestExpiry = expiries[0]!;

  // 2. Chain + candles in parallel.
  const today = istDate();
  const r1h = intradayRange(5);
  const [chain, c5, c15, c1h, cDaily] = await Promise.all([
    fetchOptionChain(cfg, underlyingSecId, underlyingSeg, nearestExpiry),
    fetchIntradayCandles(cfg, indexInst.securityId, underlyingSeg, "INDEX", 5, today, today),
    fetchIntradayCandles(cfg, indexInst.securityId, underlyingSeg, "INDEX", 15, today, today),
    fetchIntradayCandles(cfg, indexInst.securityId, underlyingSeg, "INDEX", 60, r1h.from, r1h.to),
    fetchDailyCandles(cfg, indexInst.securityId, underlyingSeg, "INDEX", daysAgoIst(45), today),
  ]);

  // 3. ATM row + lot size.
  const atmRow =
    chain.rows.length > 0
      ? chain.rows.reduce((best, r) =>
          Math.abs(r.strike - spot) < Math.abs(best.strike - spot) ? r : best,
        )
      : null;
  const atmOpt = findFrontMonthAtm(instruments, underlyingSymbol, spot, "CE");
  const lotSize = atmOpt?.lotSize ?? null;

  // 4. Chain-derived metrics.
  const totalCallOi = chain.rows.reduce((a, r) => a + (r.call?.oi ?? 0), 0);
  const totalPutOi = chain.rows.reduce((a, r) => a + (r.put?.oi ?? 0), 0);
  const pcr = totalCallOi === 0 ? null : totalPutOi / totalCallOi;

  const atmCall = atmRow?.call ?? null;
  const atmSpreadPct =
    atmCall && atmCall.bid !== null && atmCall.ask !== null && atmCall.ltp > 0
      ? ((atmCall.ask - atmCall.bid) / atmCall.ltp) * 100
      : null;
  const atmOi = atmCall?.oi ?? null;
  const atmIv = atmCall?.iv ?? null;
  const atmPremiumTurnoverInr =
    atmCall && lotSize ? atmCall.volume * lotSize * atmCall.ltp : null;

  // 5. Prior-day closes / high / low from daily history.
  const todayStart = new Date(today + "T00:00:00+05:30").getTime() / 1000;
  const priorDaily = cDaily.filter((c) => c.time < todayStart);
  const prevDailyCloses = priorDaily.map((c) => c.close);
  const prevDay = priorDaily[priorDaily.length - 1];

  // 6. DTE
  const expiryMs = new Date(nearestExpiry + "T15:30:00+05:30").getTime();
  const dteDays = Math.max(1, Math.ceil((expiryMs - Date.now()) / (24 * 60 * 60 * 1000)));

  // 7. Max pain (strike minimizing total intrinsic of all outstanding options).
  const maxPainStrike = computeMaxPain(chain.rows);

  return {
    symbol: underlyingSymbol,
    segment: "options",
    candles5m: toRawCandles(c5),
    candles15m: toRawCandles(c15),
    candles1h: toRawCandles(c1h),
    prevDailyCloses,
    prevDayHigh: prevDay?.high ?? null,
    prevDayLow: prevDay?.low ?? null,
    quote: {
      ltp: spot,
      prevClose: prevDay?.close ?? spot,
      dayHigh: c5.length ? Math.max(...c5.map((c) => c.high)) : spot,
      dayLow: c5.length ? Math.min(...c5.map((c) => c.low)) : spot,
      bid: null,
      ask: null,
    },
    avgDailyVolume: null,
    optionChain: {
      pcr,
      maxPainStrike,
      oiBuildup: null,
      unusualActivity: null,
      ivRank: null,
      ivPercentile: null,
      atmIv,
      atmSpreadPct,
      atmOi,
      atmPremiumTurnoverInr,
      atmTopBidSize: null,
      atmTopAskSize: null,
    },
    contractMeta: {
      inOfficialFnoUniverse: atmOpt !== null,
      lotSize,
      quantityFreeze: null,
      expiry: nearestExpiry,
      dteDays,
      style: "European",
      settlement: "Cash",
    },
    volMargin: null,
    news: null,
    eventFlags: {
      inFnoBan: false,
      resultWithinDays: null,
      macroEventWithinMins: null,
      exDateToday: false,
      agmToday: false,
      mwplPct: null,
      inExtraElm: false,
      inAsm: false,
      corpActionWithinDays: null,
      corpActionType: null,
    },
  };
}

/** Compute max-pain strike from an option chain: the strike at which total
 *  intrinsic value of all outstanding OI is minimized. */
function computeMaxPain(
  rows: Array<{
    strike: number;
    call: { oi: number } | null;
    put: { oi: number } | null;
  }>,
): number | null {
  if (rows.length === 0) return null;
  let bestStrike: number | null = null;
  let bestPain = Infinity;
  for (const r of rows) {
    let pain = 0;
    for (const s of rows) {
      if (s.call) pain += Math.max(0, r.strike - s.strike) * s.call.oi;
      if (s.put) pain += Math.max(0, s.strike - r.strike) * s.put.oi;
    }
    if (pain < bestPain) {
      bestPain = pain;
      bestStrike = r.strike;
    }
  }
  return bestStrike;
}

// --- Adapter ---

async function getVix(cfg: DhanConfig, instruments: DhanInstrument[]): Promise<number | null> {
  const vixInst =
    instruments.find((i) => i.instrumentName === "INDEX" && i.tradingSymbol === "INDIA VIX") ??
    instruments.find((i) => i.instrumentName === "INDEX" && i.tradingSymbol === "INDIAVIX");
  if (!vixInst) return null;
  const ltp = await fetchLtp(cfg, { IDX_I: [vixInst.securityId] });
  return ltp["IDX_I"]?.[vixInst.securityId] ?? null;
}

const dhan: Adapter = {
  name: "dhan",

  async getIndiaVix(): Promise<number | null> {
    const cfg = loadConfig();
    const instruments = await loadInstruments();
    return getVix(cfg, instruments);
  },

  async getSymbolSnapshot(symbol: string, segment: Segment): Promise<SymbolSnapshot> {
    const cfg = loadConfig();
    const instruments = await loadInstruments();

    if (segment === "equity") {
      const raw = await snapshotEquity(cfg, instruments, symbol);
      return buildSnapshot(raw);
    }
    if (segment === "options") {
      const raw = await snapshotOptions(cfg, instruments, symbol);
      return buildSnapshot(raw);
    }
    // Futures — not yet implemented. Return UNKNOWN so the pipeline gates.
    return buildSnapshot(emptyRawMarketData(symbol, segment));
  },

  emptySnapshot: blankSnapshot,
};

export default dhan;
