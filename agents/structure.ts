/**
 * Option structure selector.
 *
 * Given IV regime (buy/sell/neutral), bias (long/short), DTE, and margin
 * headroom, recommend the structure with the best asymmetry:
 *   UNDERPRICED vol → net-long-premium (long call/put, debit spread)
 *   OVERPRICED vol  → net-short-premium (credit spread, iron fly) — gated
 *                     on margin + no Extra-ELM
 *   NEUTRAL         → directional vertical (debit spread)
 *
 * Never returns a naked-short structure when margin headroom is insufficient.
 * This is a pure function — feed it the data, get back a structure + why.
 */

export type IvRegime = "UNDERPRICED" | "OVERPRICED" | "NEUTRAL";
export type Bias = "long" | "short";

export type Structure =
  | "long-call"
  | "long-put"
  | "call-debit-spread"
  | "put-debit-spread"
  | "call-credit-spread"
  | "put-credit-spread"
  | "iron-fly"
  | "iron-condor"
  | "no-structure";

export interface StructureInputs {
  bias: Bias;
  ivRegime: IvRegime;
  dteDays: number;
  hasMarginHeadroom: boolean;     // account has 3×+ margin for defined-risk credit
  inExtraElm: boolean;
  inAsm: boolean;
  liquidOtmAvailable: boolean;    // adjacent OTM strike passes /check-liquidity
}

export interface StructurePick {
  structure: Structure;
  rationale: string;
  defendedBy: string[];          // which rule sections defend this pick
}

const CANNOT_SHORT_PREMIUM = (i: StructureInputs): boolean =>
  !i.hasMarginHeadroom || i.inExtraElm || i.inAsm || i.dteDays < 2;

export function pickStructure(i: StructureInputs): StructurePick {
  // Rule §1: no short-premium into expiry or without margin headroom.
  const blockShort = CANNOT_SHORT_PREMIUM(i);

  if (i.ivRegime === "UNDERPRICED") {
    // Buy vol. Prefer the outright long if DTE has runway, else tighter spread.
    if (i.dteDays >= 7) {
      return {
        structure: i.bias === "long" ? "long-call" : "long-put",
        rationale: "UNDERPRICED IV + sufficient DTE → buy optionality outright",
        defendedBy: ["§6 IV vs RV", "§1 DTE"],
      };
    }
    if (i.liquidOtmAvailable) {
      return {
        structure: i.bias === "long" ? "call-debit-spread" : "put-debit-spread",
        rationale: "UNDERPRICED IV + tight DTE → debit spread caps theta bleed",
        defendedBy: ["§6", "§5 liquidity"],
      };
    }
    return {
      structure: i.bias === "long" ? "long-call" : "long-put",
      rationale: "UNDERPRICED IV, no adjacent liquid strike → outright long",
      defendedBy: ["§6"],
    };
  }

  if (i.ivRegime === "OVERPRICED") {
    if (blockShort) {
      // Gated on margin / ELM / DTE — fall back to defined-risk defensive.
      return {
        structure: i.liquidOtmAvailable
          ? (i.bias === "long" ? "call-debit-spread" : "put-debit-spread")
          : "no-structure",
        rationale:
          "OVERPRICED IV but short-premium blocked (margin / Extra-ELM / DTE). " +
          "Fall back to debit spread or no trade.",
        defendedBy: ["§1", "§3", "§7"],
      };
    }
    if (!i.liquidOtmAvailable) {
      return {
        structure: "no-structure",
        rationale: "OVERPRICED IV but adjacent strike illiquid → no clean credit spread",
        defendedBy: ["§5"],
      };
    }
    return {
      structure: i.bias === "long" ? "put-credit-spread" : "call-credit-spread",
      rationale: "OVERPRICED IV with margin headroom + liquid adjacent strike → credit spread",
      defendedBy: ["§6", "§7", "§5"],
    };
  }

  // NEUTRAL regime — directional vertical is the risk-controlled default.
  if (!i.liquidOtmAvailable) {
    return {
      structure: "no-structure",
      rationale: "NEUTRAL regime without liquid adjacent strike → no edge in naked",
      defendedBy: ["§5", "§6"],
    };
  }
  return {
    structure: i.bias === "long" ? "call-debit-spread" : "put-debit-spread",
    rationale: "NEUTRAL IV → directional vertical (debit spread) for defined risk",
    defendedBy: ["§6"],
  };
}
