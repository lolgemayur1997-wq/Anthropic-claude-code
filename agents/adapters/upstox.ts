/**
 * Upstox adapter STUB.
 *
 * Env:
 *   UPSTOX_ACCESS_TOKEN
 *
 * Docs: https://upstox.com/developer/api-documentation/
 */

import { blankSnapshot, type Adapter, type Segment, type SymbolSnapshot } from "./types.ts";

function requireCreds(): void {
  if (!process.env.UPSTOX_ACCESS_TOKEN) {
    throw new Error("Upstox adapter requires UPSTOX_ACCESS_TOKEN env var.");
  }
}

const upstox: Adapter = {
  name: "upstox",
  async getIndiaVix(): Promise<number | null> {
    requireCreds();
    // TODO: GET /market-quote/ltp?instrument_key=NSE_INDEX|India VIX
    return null;
  },
  async getSymbolSnapshot(symbol: string, segment: Segment): Promise<SymbolSnapshot> {
    requireCreds();
    // TODO: /market-quote/ohlc + /historical-candle/intraday + /option/chain
    return blankSnapshot(symbol, segment);
  },
  emptySnapshot: blankSnapshot,
};

export default upstox;
