/**
 * Dhan adapter STUB.
 *
 * Env:
 *   DHAN_CLIENT_ID
 *   DHAN_ACCESS_TOKEN
 *
 * Docs: https://dhanhq.co/docs/v2/
 */

import { blankSnapshot, type Adapter, type Segment, type SymbolSnapshot } from "./types.ts";

function requireCreds(): void {
  if (!process.env.DHAN_CLIENT_ID || !process.env.DHAN_ACCESS_TOKEN) {
    throw new Error("Dhan adapter requires DHAN_CLIENT_ID and DHAN_ACCESS_TOKEN env vars.");
  }
}

const dhan: Adapter = {
  name: "dhan",
  async getIndiaVix(): Promise<number | null> {
    requireCreds();
    // TODO: /market-quote for INDIA VIX
    return null;
  },
  async getSymbolSnapshot(symbol: string, segment: Segment): Promise<SymbolSnapshot> {
    requireCreds();
    // TODO: /market-quote + /historical-data + /option-chain + /market-depth
    return blankSnapshot(symbol, segment);
  },
  emptySnapshot: blankSnapshot,
};

export default dhan;
