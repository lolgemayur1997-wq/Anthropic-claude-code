/**
 * Kite Connect (Zerodha) adapter.
 *
 * To activate:
 *   1. `bun add kiteconnect` (or use fetch directly against api.kite.trade)
 *   2. Set env: KITE_API_KEY + KITE_ACCESS_TOKEN (access token rotates daily)
 *   3. Fill the two functions below. Everything else is shared.
 *
 * Endpoints you need:
 *   GET  /quote?i=NSE:RELIANCE                  → LTP + OHLC + depth + OI
 *   GET  /quote/ohlc?i=...                      → faster OHLC only
 *   GET  /instruments/historical/{token}/5minute?from=...&to=...&oi=1
 *                                               → historical candles
 *   GET  /instruments                           → full instrument CSV (cache!)
 *
 * Auth header:
 *   Authorization: token <KITE_API_KEY>:<KITE_ACCESS_TOKEN>
 *   X-Kite-Version: 3
 *
 * Docs: https://kite.trade/docs/connect/v3/
 */

import { buildSnapshot } from "../snapshot.ts";
import {
  blankSnapshot,
  emptyRawMarketData,
  type Adapter,
  type Segment,
  type SymbolSnapshot,
} from "./types.ts";

const KITE_API_KEY = process.env.KITE_API_KEY;
const KITE_ACCESS_TOKEN = process.env.KITE_ACCESS_TOKEN;

function requireCreds(): void {
  if (!KITE_API_KEY || !KITE_ACCESS_TOKEN) {
    throw new Error(
      "Kite adapter requires KITE_API_KEY and KITE_ACCESS_TOKEN env vars.",
    );
  }
}

const kite: Adapter = {
  name: "kite",

  async getIndiaVix(): Promise<number | null> {
    requireCreds();
    // FILL IN:
    //   const r = await kiteGet("/quote/ohlc?i=NSE:INDIA VIX");
    //   return r.data["NSE:INDIA VIX"].last_price;
    return null;
  },

  async getSymbolSnapshot(symbol: string, segment: Segment): Promise<SymbolSnapshot> {
    requireCreds();
    // FILL IN: assemble RawMarketData, then hand to buildSnapshot.
    //
    //   const raw: RawMarketData = {
    //     symbol, segment,
    //     candles5m:  await kiteHistorical(token, "5minute",  todayStart, now),
    //     candles15m: await kiteHistorical(token, "15minute", yesterday, now),
    //     quote:      await kiteQuote(`NSE:${symbol}`),
    //     avgDailyVolume: await kiteAvgVolume(token, 20),
    //     optionChain: segment === "options" ? await kiteOptionChain(symbol) : null,
    //     news: null,            // plug in your news source
    //     eventFlags: await kiteEventFlags(symbol),
    //   };
    //   return buildSnapshot(raw);

    return buildSnapshot(emptyRawMarketData(symbol, segment));
  },

  emptySnapshot: blankSnapshot,
};

export default kite;
