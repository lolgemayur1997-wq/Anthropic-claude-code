# Review Trade — Senior Trader Discretionary Review

Invokes the `senior-trader` subagent on today's morning scan (or a specific
symbol) and writes a structured review to `out/senior-review-<date>.md`.

This is the **second stage** of the research pipeline. Rule-based gates
have already run; this stage adds judgment the rules cannot encode:
pattern quality, trap zones, flow-vs-price conflict, premium sanity,
structure/size critique.

## Arguments

- `$ARGUMENTS` — one of:
  - _(empty)_ — review every `PASS` plan in today's `out/intraday-research-<today>.md`
  - `SYMBOL` — review just the plan for that symbol (e.g. `RELIANCE`)
  - `YYYY-MM-DD` — review a historical day's plans
  - `YYYY-MM-DD SYMBOL` — both

## Steps

1. Resolve the date (default: today in IST) and the target symbol(s).
2. Load:
   - `out/intraday-research-<date>.md` and `.json`
   - `out/journal/intraday-<date>.jsonl` (for today's context)
   - `.claude/rules/nse-fno-pre-trade.md` (ruleset reference)
3. Spawn the `senior-trader` subagent via the Agent tool. Pass the plan(s)
   to review and the loaded context.
4. The subagent walks its 10 review axes per plan and returns YAML blocks.
5. Prepend the compliance block to the output.
6. Write to `out/senior-review-<date>.md`.
7. Print a one-line summary: `N reviewed, X APPROVE, Y REVISE, Z REJECT`.

## Authority (operator must understand)

- The senior-trader can **downgrade** a PASS to NO_TRADE (REJECT verdict)
  with explicit reasoning.
- It cannot **upgrade** a GATED or NO_TRADE (data UNKNOWN) plan. Rule
  gates encode exchange reality and remain the floor.
- The operator is still the decision maker. A REVISE output is a
  suggestion, not a new plan the operator must follow verbatim.

## Output structure (per plan)

See `.claude/agents/senior-trader.md` for the full review YAML schema.
Summary form:

```yaml
review:
  symbol: RELIANCE
  runner_verdict: PASS
  senior_review: REVISE
  reasoning:
    confluences: [...]
    conflicts: [...]
    red_flags: [...]
    trap_risk: medium
    premium_sanity: marginal
  structure_critique:
    agreed: no
    if_no_suggest: "credit put spread — IV percentile 78 favours selling premium"
  size_critique:
    agreed: yes
  revised_plan_if_any:
    entry_trigger: "5m close > 2842.5 AND RVOL > 1.8"
    stop_level: 2825
    targets: [2870, 2895]
    qty: 250
  final_note: "watch for rejection at 2842 — third test this week"
```

## Compliance

- Not investment advice. LLM-based review artifact.
- Based on public data already in the morning snapshot — no non-public
  information.
- Verify every level against your broker terminal before ordering.
