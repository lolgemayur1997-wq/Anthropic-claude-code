/**
 * Sector mapping + concurrent-position concentration check.
 *
 * Three simultaneous long positions in banks isn't diversification, it's 3×
 * leverage on "banks." This module rejects the Nth position in a sector once
 * the configured cap is reached.
 *
 * Sector map is a minimum viable starter set. Override via user config at
 * `agents/config/sector-map.json` (follow the same key format).
 */

export const DEFAULT_SECTOR_MAP: Record<string, string> = {
  // Banks — PSU + private
  HDFCBANK: "BANKS",
  ICICIBANK: "BANKS",
  AXISBANK: "BANKS",
  SBIN: "BANKS",
  KOTAKBANK: "BANKS",
  INDUSINDBK: "BANKS",
  BANKBARODA: "BANKS",
  PNB: "BANKS",
  FEDERALBNK: "BANKS",
  IDFCFIRSTB: "BANKS",

  // IT
  TCS: "IT",
  INFY: "IT",
  WIPRO: "IT",
  HCLTECH: "IT",
  TECHM: "IT",
  LTIM: "IT",
  PERSISTENT: "IT",
  MPHASIS: "IT",
  COFORGE: "IT",

  // Energy / oil & gas
  RELIANCE: "ENERGY",
  ONGC: "ENERGY",
  BPCL: "ENERGY",
  HPCL: "ENERGY",
  IOC: "ENERGY",
  GAIL: "ENERGY",

  // Auto — NSE tickers use & and -, NOT underscore
  TATAMOTORS: "AUTO",
  MARUTI: "AUTO",
  "M&M": "AUTO",
  "M&MFIN": "NBFC",
  HEROMOTOCO: "AUTO",
  "BAJAJ-AUTO": "AUTO",
  EICHERMOT: "AUTO",
  TVSMOTOR: "AUTO",
  ASHOKLEY: "AUTO",
  BOSCHLTD: "AUTO",
  MOTHERSON: "AUTO",

  // FMCG
  HINDUNILVR: "FMCG",
  ITC: "FMCG",
  NESTLEIND: "FMCG",
  BRITANNIA: "FMCG",
  DABUR: "FMCG",
  GODREJCP: "FMCG",
  MARICO: "FMCG",

  // Pharma
  SUNPHARMA: "PHARMA",
  CIPLA: "PHARMA",
  DRREDDY: "PHARMA",
  DIVISLAB: "PHARMA",
  LUPIN: "PHARMA",
  TORNTPHARM: "PHARMA",
  BIOCON: "PHARMA",

  // Metals
  TATASTEEL: "METALS",
  JSWSTEEL: "METALS",
  HINDALCO: "METALS",
  VEDL: "METALS",
  COALINDIA: "METALS",
  SAIL: "METALS",

  // Financial services (non-bank)
  BAJFINANCE: "NBFC",
  BAJAJFINSV: "NBFC",
  LICI: "NBFC",
  SBILIFE: "NBFC",
  HDFCLIFE: "NBFC",
  ICICIPRULI: "NBFC",
  ICICIGI: "NBFC",

  // Telecom
  BHARTIARTL: "TELECOM",
  IDEA: "TELECOM",

  // Cement
  ULTRACEMCO: "CEMENT",
  SHREECEM: "CEMENT",
  GRASIM: "CEMENT",
  DALBHARAT: "CEMENT",

  // Power
  POWERGRID: "POWER",
  NTPC: "POWER",
  ADANIGREEN: "POWER",
  TATAPOWER: "POWER",

  // Index
  NIFTY: "INDEX",
  BANKNIFTY: "INDEX",
  FINNIFTY: "INDEX",
  MIDCPNIFTY: "INDEX",
};

export function sectorOf(symbol: string, overrides?: Record<string, string>): string {
  const key = symbol.toUpperCase();
  return overrides?.[key] ?? DEFAULT_SECTOR_MAP[key] ?? "UNKNOWN";
}

export interface OpenPosition {
  symbol: string;
  bias: "long" | "short";
}

/** Count how many positions are concurrently long in the same sector (and
 *  same-direction). Returns `null` for UNKNOWN sectors so the gate can
 *  choose to be strict or lenient. */
export function concurrentSameSectorCount(
  candidate: { symbol: string; bias: "long" | "short" },
  open: OpenPosition[],
  overrides?: Record<string, string>,
): { sector: string; sameDirCount: number } {
  const sector = sectorOf(candidate.symbol, overrides);
  if (sector === "UNKNOWN" || sector === "INDEX") {
    return { sector, sameDirCount: 0 };
  }
  const sameDirCount = open.filter(
    (p) => sectorOf(p.symbol, overrides) === sector && p.bias === candidate.bias,
  ).length;
  return { sector, sameDirCount };
}

/** Returns a human-readable gate reason if the candidate would breach the
 *  cap, otherwise null. */
export function correlationGateReason(
  candidate: { symbol: string; bias: "long" | "short" },
  open: OpenPosition[],
  cap: number,
  overrides?: Record<string, string>,
): string | null {
  const { sector, sameDirCount } = concurrentSameSectorCount(candidate, open, overrides);
  if (sector === "UNKNOWN" || sector === "INDEX") return null;
  if (sameDirCount >= cap) {
    return `already ${sameDirCount} ${candidate.bias} ${sector} positions (cap ${cap})`;
  }
  return null;
}
