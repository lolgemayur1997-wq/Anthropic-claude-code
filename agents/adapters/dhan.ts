/**
 * Dhan adapter.
 *
 * Env: DHAN_CLIENT_ID + DHAN_ACCESS_TOKEN
 *
 * Endpoints:
 *   POST /market-quote             → LTP/OHLC/depth
 *   POST /charts/historical        → historical candles
 *   GET  /option-chain             → chain + OI
 *
 * Auth headers:
 *   access-token: <DHAN_ACCESS_TOKEN>
 *   client-id:    <DHAN_CLIENT_ID>
 *
 * Docs: https://dhanhq.co/docs/v2/
 */

import { buildSnapshot } from "../snapshot.ts";
import {
  blankSnapshot,
  type Adapter,
  type RawMarketData,
  type Segment,
  type SymbolSnapshot,
} from "./types.ts";

function requireCreds(): void {
  if (!process.env.DHAN_CLIENT_ID || !process.env.DHAN_ACCESS_TOKEN) {
    throw new Error("Dhan adapter requires DHAN_CLIENT_ID and DHAN_ACCESS_TOKEN env vars.");
  }
}

const dhan: Adapter = {
  name: "dhan",

  async getIndiaVix(): Promise<number | null> {
    requireCreds();
    // FILL IN
    return null;
  },

  async getSymbolSnapshot(symbol: string, segment: Segment): Promise<SymbolSnapshot> {
    requireCreds();
    // FILL IN: assemble RawMarketData and return buildSnapshot(raw).
    const _raw: RawMarketData = {
      symbol,
      segment,
      candles5m: [],
      candles15m: [],
      quote: null,
      avgDailyVolume: null,
      optionChain: null,
      news: null,
      eventFlags: {
        inFnoBan: false,
        resultWithinDays: null,
        macroEventWithinMins: null,
        exDateToday: false,
        agmToday: false,
      },
    };
    return buildSnapshot(_raw);
  },

  emptySnapshot: blankSnapshot,
};

export default dhan;
