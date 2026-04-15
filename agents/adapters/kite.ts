/**
 * Kite Connect adapter STUB.
 *
 * To activate: install the kiteconnect SDK and fill in the TODOs below with
 * real API calls. This stub intentionally does NOT fetch data — it returns
 * UNKNOWN snapshots so the runner can be exercised end-to-end without a live
 * broker key.
 *
 * Env:
 *   KITE_API_KEY
 *   KITE_ACCESS_TOKEN
 *
 * Docs: https://kite.trade/docs/connect/v3/
 */

import { blankSnapshot, type Adapter, type Segment, type SymbolSnapshot } from "./types.ts";

const KITE_API_KEY = process.env.KITE_API_KEY;
const KITE_ACCESS_TOKEN = process.env.KITE_ACCESS_TOKEN;

function requireCreds(): void {
  if (!KITE_API_KEY || !KITE_ACCESS_TOKEN) {
    throw new Error(
      "Kite adapter requires KITE_API_KEY and KITE_ACCESS_TOKEN env vars. See agents/adapters/kite.ts",
    );
  }
}

const kite: Adapter = {
  name: "kite",
  async getIndiaVix(): Promise<number | null> {
    requireCreds();
    // TODO: call GET /quote?i=NSE:INDIA VIX and return .last_price
    return null;
  },
  async getSymbolSnapshot(symbol: string, segment: Segment): Promise<SymbolSnapshot> {
    requireCreds();
    // TODO: fetch:
    //   - /quote/ohlc for LTP + day H/L + prev close
    //   - /instruments/historical/{token}/5minute for ORB, ATR, VWAP, indicators
    //   - /quote for depth (spread)
    //   - /instruments for F&O ban list (from NSE daily file) + option chain
    //   - adapter should compute indicator + score values here
    return blankSnapshot(symbol, segment);
  },
  emptySnapshot: blankSnapshot,
};

export default kite;
