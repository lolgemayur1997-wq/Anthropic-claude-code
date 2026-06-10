# Pick Structure — Select the optimal option structure

Given the IV regime, bias, DTE, margin headroom, and liquidity of adjacent
strikes, select the structure with the best asymmetry. Backed by
`agents/structure.ts::pickStructure`.

## Arguments
- `$ARGUMENTS` — symbol + bias, e.g. `RELIANCE long`.

## Steps

1. Run `/check-iv-rv $SYMBOL $BIAS` to classify the IV regime
   (UNDERPRICED / OVERPRICED / NEUTRAL).
2. Run `/check-contract-specs $SYMBOL` to get DTE.
3. Run `/check-margin "<structure>"` (twice — credit-spread candidate and
   debit-spread candidate) to establish margin headroom.
4. Run `/check-liquidity $SYMBOL $BIAS` to confirm adjacent OTM strike is
   liquid.
5. Call `pickStructure()` with the collected inputs. Result is one of:
   - `long-call` / `long-put`
   - `call-debit-spread` / `put-debit-spread`
   - `call-credit-spread` / `put-credit-spread`
   - `iron-fly` / `iron-condor`
   - `no-structure` (nothing fits — gate to NO_TRADE)
6. Print the pick plus the rationale and rule-defence tags (§1, §3, §5, §6, §7).

## Output

```yaml
symbol: RELIANCE
bias: long
iv_regime: NEUTRAL
dte_days: 13
has_margin_headroom: true
in_extra_elm: false
in_asm: false
liquid_otm_available: true
structure: call-debit-spread
rationale: NEUTRAL IV → directional vertical (debit spread) for defined risk
defended_by: ["§6"]
```

## Rules

- `iron-fly` / `iron-condor` are credit structures — gated on both margin
  headroom AND no Extra-ELM/ASM AND sufficient DTE.
- `no-structure` is a valid (and common) outcome — do not force a trade.
- Always pair the structure pick with `/pick-strike` before sending a final
  plan to `/pre-trade`.
