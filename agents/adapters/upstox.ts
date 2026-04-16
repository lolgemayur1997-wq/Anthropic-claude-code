/**
 * Upstox adapter.
 *
 * Env: UPSTOX_ACCESS_TOKEN
 *
 * Endpoints:
 *   GET /market-quote/ltp?instrument_key=NSE_EQ|INE...
 *   GET /market-quote/ohlc?instrument_key=...
 *   GET /historical-candle/intraday/{instrument_key}/1minute
 *   GET /option/chain?instrument_key=...&expiry_date=...
 *
 * Auth header:
 *   Authorization: Bearer <UPSTOX_ACCESS_TOKEN>
 *
 * Docs: https://upstox.com/developer/api-documentation/
 */

import { buildSnapshot } from "../snapshot.ts";
import {
  blankSnapshot,
  emptyRawMarketData,
  type Adapter,
  type Segment,
  type SymbolSnapshot,
} from "./types.ts";

function requireCreds(): void {
  if (!process.env.UPSTOX_ACCESS_TOKEN) {
    throw new Error("Upstox adapter requires UPSTOX_ACCESS_TOKEN env var.");
  }
}

const upstox: Adapter = {
  name: "upstox",

  async getIndiaVix(): Promise<number | null> {
    requireCreds();
    // FILL IN: fetch LTP for "NSE_INDEX|India VIX"
    return null;
  },

  async getSymbolSnapshot(symbol: string, segment: Segment): Promise<SymbolSnapshot> {
    requireCreds();
    // FILL IN: assemble RawMarketData and return buildSnapshot(raw).
    return buildSnapshot(emptyRawMarketData(symbol, segment));
  },

  emptySnapshot: blankSnapshot,
};

export default upstox;
