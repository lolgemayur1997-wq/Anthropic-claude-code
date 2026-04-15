/**
 * Black-Scholes pricing, greeks, and implied-volatility solver.
 *
 * Conventions:
 *   - rates are annualized, continuous compounding
 *   - sigma is annualized volatility as a decimal (0.20 = 20%)
 *   - T is time to expiry in YEARS (use daysToYears())
 *
 * For Indian stock options (physical settlement, European style), the
 * European BS model is the right default. For stocks with dividends before
 * expiry, pass the continuous dividend yield q.
 *
 * All functions return `null` on invalid inputs (negative T, zero sigma, etc.)
 * — never throw, never NaN.
 */

export type OptionType = "call" | "put";

export interface BsInputs {
  s: number;           // spot
  k: number;           // strike
  t: number;           // years to expiry (must be > 0)
  r: number;           // risk-free rate (annualized, continuous)
  sigma: number;       // annualized vol (decimal)
  q?: number;          // continuous dividend yield (default 0)
}

export interface Greeks {
  price: number;
  delta: number;
  gamma: number;
  theta: number;       // per year; divide by 365 for per-day
  vega: number;        // per 1.00 vol change; divide by 100 for per 1-vol-pt
  rho: number;
}

export function daysToYears(days: number): number {
  return days / 365;
}

// --- Standard normal helpers ---

function pdfStdNorm(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

/** Abramowitz & Stegun 26.2.17 — good to ~7.5e-8 */
function cdfStdNorm(x: number): number {
  const b1 = 0.319381530;
  const b2 = -0.356563782;
  const b3 = 1.781477937;
  const b4 = -1.821255978;
  const b5 = 1.330274429;
  const p = 0.2316419;
  const absX = Math.abs(x);
  const t = 1 / (1 + p * absX);
  const poly = t * (b1 + t * (b2 + t * (b3 + t * (b4 + t * b5))));
  const cdf = 1 - pdfStdNorm(absX) * poly;
  return x >= 0 ? cdf : 1 - cdf;
}

// --- Core ---

function validInputs(i: BsInputs): boolean {
  return (
    Number.isFinite(i.s) &&
    Number.isFinite(i.k) &&
    i.s > 0 &&
    i.k > 0 &&
    i.t > 0 &&
    i.sigma > 0 &&
    Number.isFinite(i.r) &&
    Number.isFinite(i.sigma)
  );
}

function dOne(i: BsInputs): number {
  const q = i.q ?? 0;
  return (Math.log(i.s / i.k) + (i.r - q + 0.5 * i.sigma * i.sigma) * i.t) / (i.sigma * Math.sqrt(i.t));
}

export function bsPrice(type: OptionType, i: BsInputs): number | null {
  if (!validInputs(i)) return null;
  const q = i.q ?? 0;
  const d1 = dOne(i);
  const d2 = d1 - i.sigma * Math.sqrt(i.t);
  if (type === "call") {
    return i.s * Math.exp(-q * i.t) * cdfStdNorm(d1) - i.k * Math.exp(-i.r * i.t) * cdfStdNorm(d2);
  }
  return i.k * Math.exp(-i.r * i.t) * cdfStdNorm(-d2) - i.s * Math.exp(-q * i.t) * cdfStdNorm(-d1);
}

export function greeks(type: OptionType, i: BsInputs): Greeks | null {
  if (!validInputs(i)) return null;
  const q = i.q ?? 0;
  const d1 = dOne(i);
  const d2 = d1 - i.sigma * Math.sqrt(i.t);
  const Nd1 = cdfStdNorm(d1);
  const Nmd1 = cdfStdNorm(-d1);
  const Nd2 = cdfStdNorm(d2);
  const Nmd2 = cdfStdNorm(-d2);
  const nd1 = pdfStdNorm(d1);
  const sqrtT = Math.sqrt(i.t);
  const priceCall = i.s * Math.exp(-q * i.t) * Nd1 - i.k * Math.exp(-i.r * i.t) * Nd2;
  const pricePut = i.k * Math.exp(-i.r * i.t) * Nmd2 - i.s * Math.exp(-q * i.t) * Nmd1;
  const price = type === "call" ? priceCall : pricePut;
  const delta = type === "call"
    ? Math.exp(-q * i.t) * Nd1
    : -Math.exp(-q * i.t) * Nmd1;
  const gamma = (Math.exp(-q * i.t) * nd1) / (i.s * i.sigma * sqrtT);
  const vega = i.s * Math.exp(-q * i.t) * nd1 * sqrtT; // per 1.00 vol unit
  const thetaCall =
    -((i.s * Math.exp(-q * i.t) * nd1 * i.sigma) / (2 * sqrtT)) -
    i.r * i.k * Math.exp(-i.r * i.t) * Nd2 +
    q * i.s * Math.exp(-q * i.t) * Nd1;
  const thetaPut =
    -((i.s * Math.exp(-q * i.t) * nd1 * i.sigma) / (2 * sqrtT)) +
    i.r * i.k * Math.exp(-i.r * i.t) * Nmd2 -
    q * i.s * Math.exp(-q * i.t) * Nmd1;
  const theta = type === "call" ? thetaCall : thetaPut;
  const rho = type === "call"
    ? i.k * i.t * Math.exp(-i.r * i.t) * Nd2
    : -i.k * i.t * Math.exp(-i.r * i.t) * Nmd2;
  return { price, delta, gamma, theta, vega, rho };
}

// --- Implied volatility (Newton-Raphson with bisection fallback) ---

export interface IvInputs {
  type: OptionType;
  s: number;
  k: number;
  t: number;
  r: number;
  q?: number;
  marketPrice: number;
}

export function impliedVol(i: IvInputs, maxIter = 60, tol = 1e-5): number | null {
  if (!(i.s > 0 && i.k > 0 && i.t > 0 && i.marketPrice > 0)) return null;

  // Intrinsic check — market price cannot be less than intrinsic
  const q = i.q ?? 0;
  const intrinsic = i.type === "call"
    ? Math.max(0, i.s * Math.exp(-q * i.t) - i.k * Math.exp(-i.r * i.t))
    : Math.max(0, i.k * Math.exp(-i.r * i.t) - i.s * Math.exp(-q * i.t));
  if (i.marketPrice < intrinsic - 1e-6) return null;

  // Initial guess: Brenner-Subrahmanyam approximation
  let sigma = Math.max(0.01, Math.sqrt((2 * Math.PI) / i.t) * (i.marketPrice / i.s));
  if (!Number.isFinite(sigma)) sigma = 0.3;
  sigma = Math.min(Math.max(sigma, 0.01), 5);

  for (let n = 0; n < maxIter; n++) {
    const inp: BsInputs = { s: i.s, k: i.k, t: i.t, r: i.r, sigma, q: i.q };
    const price = bsPrice(i.type, inp);
    const g = greeks(i.type, inp);
    if (price === null || g === null || g.vega === 0) break;
    const diff = price - i.marketPrice;
    if (Math.abs(diff) < tol) return sigma;
    sigma -= diff / g.vega;
    if (sigma <= 0 || sigma > 10) break;
  }

  // Bisection fallback
  let lo = 1e-4;
  let hi = 5;
  for (let n = 0; n < 100; n++) {
    const mid = (lo + hi) / 2;
    const price = bsPrice(i.type, { s: i.s, k: i.k, t: i.t, r: i.r, sigma: mid, q: i.q });
    if (price === null) return null;
    if (Math.abs(price - i.marketPrice) < tol) return mid;
    if (price < i.marketPrice) lo = mid;
    else hi = mid;
  }
  return null;
}

// --- Expected move ---

/** Expected move in absolute price units over the given horizon, derived
 *  from ATM IV. Equivalent to spot × IV × sqrt(days/365). */
export function expectedMoveFromIv(
  spot: number,
  ivAnnualized: number,
  horizonDays: number,
): number | null {
  if (spot <= 0 || ivAnnualized <= 0 || horizonDays <= 0) return null;
  return spot * ivAnnualized * Math.sqrt(horizonDays / 365);
}

/** Expected move implied by the ATM straddle (model-free). */
export function expectedMoveFromStraddle(
  spot: number,
  straddlePremium: number,
  horizonDays: number,
  smoothing = 0.85, // straddle slightly overstates; empirical shrink
): number | null {
  if (spot <= 0 || straddlePremium <= 0 || horizonDays <= 0) return null;
  return straddlePremium * smoothing;
}
