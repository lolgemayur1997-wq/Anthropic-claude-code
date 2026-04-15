/**
 * Pure technical-indicator library for the intraday-research runner.
 *
 * Every function returns `null` when input is insufficient. Never throws,
 * never guesses, never returns NaN. The runner's UNKNOWN gate maps a `null`
 * here to NO-TRADE for the symbol.
 */

export interface Candle {
  time: number; // epoch seconds or ms — caller's choice, unused by indicators
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// --- Moving averages ---

export function sma(values: number[], period: number): number | null {
  if (period <= 0 || values.length < period) return null;
  const slice = values.slice(values.length - period);
  const sum = slice.reduce((a, b) => a + b, 0);
  return sum / period;
}

export function emaSeries(values: number[], period: number): number[] | null {
  if (period <= 0 || values.length < period) return null;
  const k = 2 / (period + 1);
  const out: number[] = [];
  const seed = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out.push(seed);
  let prev = seed;
  for (let i = period; i < values.length; i++) {
    const v = values[i]! * k + prev * (1 - k);
    out.push(v);
    prev = v;
  }
  return out;
}

export function ema(values: number[], period: number): number | null {
  const series = emaSeries(values, period);
  return series ? series[series.length - 1]! : null;
}

// --- RSI (Wilder) ---

export function rsi(values: number[], period = 14): number | null {
  if (values.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i]! - values[i - 1]!;
    if (d > 0) gains += d;
    else losses -= d;
  }
  let avgG = gains / period;
  let avgL = losses / period;
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i]! - values[i - 1]!;
    const g = d > 0 ? d : 0;
    const l = d < 0 ? -d : 0;
    avgG = (avgG * (period - 1) + g) / period;
    avgL = (avgL * (period - 1) + l) / period;
  }
  if (avgL === 0) return 100;
  const rs = avgG / avgL;
  return 100 - 100 / (1 + rs);
}

// --- MACD ---

export interface MacdResult {
  macd: number | null;
  signal: number | null;
  hist: number | null;
}

export function macd(
  values: number[],
  fast = 12,
  slow = 26,
  signal = 9,
): MacdResult {
  const fastE = emaSeries(values, fast);
  const slowE = emaSeries(values, slow);
  if (!fastE || !slowE) return { macd: null, signal: null, hist: null };
  const offset = slow - fast;
  const macdLine: number[] = [];
  for (let i = 0; i < slowE.length; i++) {
    macdLine.push(fastE[i + offset]! - slowE[i]!);
  }
  const signalE = emaSeries(macdLine, signal);
  if (!signalE) return { macd: null, signal: null, hist: null };
  const m = macdLine[macdLine.length - 1]!;
  const s = signalE[signalE.length - 1]!;
  return { macd: m, signal: s, hist: m - s };
}

// --- VWAP (session) ---

export function vwap(candles: Candle[]): number | null {
  if (candles.length === 0) return null;
  let pv = 0;
  let v = 0;
  for (const c of candles) {
    const tp = (c.high + c.low + c.close) / 3;
    pv += tp * c.volume;
    v += c.volume;
  }
  return v === 0 ? null : pv / v;
}

// --- ATR (Wilder) ---

export function atr(candles: Candle[], period = 14): number | null {
  if (candles.length < period + 1) return null;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1]!;
    const cur = candles[i]!;
    const tr = Math.max(
      cur.high - cur.low,
      Math.abs(cur.high - prev.close),
      Math.abs(cur.low - prev.close),
    );
    trs.push(tr);
  }
  let a = trs.slice(0, period).reduce((x, y) => x + y, 0) / period;
  for (let i = period; i < trs.length; i++) {
    a = (a * (period - 1) + trs[i]!) / period;
  }
  return a;
}

// --- Supertrend ---

export interface SupertrendResult {
  trend: "up" | "down";
  band: number;
}

export function supertrend(
  candles: Candle[],
  period = 10,
  mult = 3,
): SupertrendResult | null {
  const n = candles.length;
  if (n < period + 2) return null;

  // TR series
  const tr: number[] = [0];
  for (let i = 1; i < n; i++) {
    const prev = candles[i - 1]!;
    const cur = candles[i]!;
    tr.push(
      Math.max(
        cur.high - cur.low,
        Math.abs(cur.high - prev.close),
        Math.abs(cur.low - prev.close),
      ),
    );
  }
  // Wilder ATR series (index aligned with candles)
  const atrS: number[] = new Array(n).fill(0);
  let seed = 0;
  for (let i = 1; i <= period; i++) seed += tr[i]!;
  atrS[period] = seed / period;
  for (let i = period + 1; i < n; i++) {
    atrS[i] = (atrS[i - 1]! * (period - 1) + tr[i]!) / period;
  }

  const finalUpper: number[] = new Array(n).fill(0);
  const finalLower: number[] = new Array(n).fill(0);
  const trendArr: Array<"up" | "down"> = new Array(n).fill("up");

  for (let i = period; i < n; i++) {
    const c = candles[i]!;
    const mid = (c.high + c.low) / 2;
    const bu = mid + mult * atrS[i]!;
    const bl = mid - mult * atrS[i]!;
    if (i === period) {
      finalUpper[i] = bu;
      finalLower[i] = bl;
      trendArr[i] = c.close > bu ? "up" : "down";
      continue;
    }
    const prevUpper = finalUpper[i - 1]!;
    const prevLower = finalLower[i - 1]!;
    const prevClose = candles[i - 1]!.close;
    finalUpper[i] = bu < prevUpper || prevClose > prevUpper ? bu : prevUpper;
    finalLower[i] = bl > prevLower || prevClose < prevLower ? bl : prevLower;
    const prevTrend = trendArr[i - 1]!;
    if (prevTrend === "up" && c.close < finalLower[i]!) trendArr[i] = "down";
    else if (prevTrend === "down" && c.close > finalUpper[i]!) trendArr[i] = "up";
    else trendArr[i] = prevTrend;
  }

  const last = trendArr[n - 1]!;
  const band = last === "up" ? finalLower[n - 1]! : finalUpper[n - 1]!;
  return { trend: last, band };
}

// --- Bollinger Bands ---

export interface BollingerResult {
  mid: number;
  upper: number;
  lower: number;
  widthPct: number;
}

export function bollinger(
  values: number[],
  period = 20,
  mult = 2,
): BollingerResult | null {
  const mid = sma(values, period);
  if (mid === null) return null;
  const slice = values.slice(values.length - period);
  const variance =
    slice.reduce((a, b) => a + (b - mid) * (b - mid), 0) / period;
  const sd = Math.sqrt(variance);
  const upper = mid + mult * sd;
  const lower = mid - mult * sd;
  const widthPct = mid === 0 ? 0 : ((upper - lower) / mid) * 100;
  return { mid, upper, lower, widthPct };
}

// --- EMA stack classifier ---

export type EmaStack = "up" | "down" | "tangled";

export function emaStack(
  closes: number[],
  fast = 9,
  mid = 20,
  slow = 50,
): EmaStack | null {
  const f = ema(closes, fast);
  const m = ema(closes, mid);
  const s = ema(closes, slow);
  if (f === null || m === null || s === null) return null;
  if (f > m && m > s) return "up";
  if (f < m && m < s) return "down";
  return "tangled";
}
