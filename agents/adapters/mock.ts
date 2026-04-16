/**
 * Mock adapter — returns all-UNKNOWN snapshots. Use for testing the report
 * pipeline without any broker credentials. Every run will produce NO-TRADE.
 */

import { blankSnapshot, type Adapter, type Segment, type SymbolSnapshot } from "./types.ts";

const mock: Adapter = {
  name: "mock",
  async getIndiaVix(): Promise<number | null> {
    return null;
  },
  async getSymbolSnapshot(symbol: string, segment: Segment): Promise<SymbolSnapshot> {
    return blankSnapshot(symbol, segment);
  },
  emptySnapshot(symbol: string, segment: Segment): SymbolSnapshot {
    return blankSnapshot(symbol, segment);
  },
};

export default mock;
