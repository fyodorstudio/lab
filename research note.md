# Research parking lot — post-release magnitude / volatility

Recorded 2026-09-24. This is a preserved research proposal, **not** an approved trading setup, a modification to the frozen Phase 1 protocol, or permission to open its sealed 2023+ confirmation outcomes.

## Why this was proposed

The Phase 1 pre-2023 EURUSD/USDJPY study of four USD release series did not establish a reliable delayed *directional* drift. That result does not rule out a different question: whether particular macro-release families predict the **size, volatility, excursion, or timing** of the subsequent move, without predicting its sign. A volatility effect alone is not a profitable trade; an entry, exit, risk, and cost model would still need independent evaluation.

## Possible new, separately frozen study

1. Define release packages and macro families before looking at new outcomes; retain exact event IDs, revisions, actual, forecast, previous, revised previous, units, missingness, timestamp, and co-release conflicts. Do not count several releases in one package, or EURUSD and USDJPY reactions to one release, as independent macro episodes.
2. Use the existing broker-time H1/H4 candles for an initial feasibility inventory: eligible releases and represented years by family and pair; complete path coverage and gaps; pre-release volatility baseline; post-release absolute return, range, MFE/MAE, and time-to-excursion at declared horizons. Compare with matched non-release periods or an explicitly specified baseline, not zero alone. Respect information availability and use only completed pre-entry bars for baselines.
3. Broaden the candidate family/year universe only under a **new protocol** with declared inclusion, exclusions, scoring, horizons, multiplicity control, and chronological partitions. The previously inspected pre-2023 data are discovery material. The 2023+ Phase 1 confirmation partition stays sealed until a distinct, frozen hypothesis and analysis plan justify its use; once opened for a new study it cannot remain "untouched" for subsequent selections.
4. Audit provider-vintage uncertainty and historical broker-clock alignment before any live-usable release-time claim. A retrospective calendar export cannot by itself prove that its forecast, revision, or package was available at a proposed entry time.
5. If a robust magnitude effect appears, separately test a small number of predeclared, event-specific execution contracts on matched paths, including spread, slippage, financing, gaps, ambiguous intrabar stop/target order, and overlapping event exposure. Require prospective/demo observation before treating a frozen contract as supported for deployment.

## Tick-data priority

The owner generally holds trades for **42–60 H4 candles** (roughly 7–10 trading days), not 42–60 hours. Full historical tick collection is **not a prerequisite** for the initial H4-scale magnitude study. It could later resolve exact Bid/Ask entry and exit prices, transient announcement spreads, and same-bar stop/target ordering for a *specific* execution candidate. M1 bars do not replace ticks for those questions, but neither should tick acquisition delay the higher-level research. The MT5 manual Ticks-tab check found 2026 EURUSD and USDJPY ticks; older coverage remains unverified and slow to request.

## Decision gate

For now, this is a parked alternative to the FMS registered-recipe direction. Do not commission an implementation or open sealed outcomes merely because this note exists. Compare its value with the FMS lineage first, then choose one narrow, auditable next experiment.

---

# Current priority — discover defensible FMS registered setups

Recorded 2026-09-24. The clean Fyodor Terminal on the `canvas` branch of `C:\dev\NO-AI` is already operational as a bridge and frontend. This repository is the isolated FMS research environment. Research here must not mutate the terminal's bridge/frontend or publish a candidate there automatically. The intended later handoff is a versioned, reviewed setup for **demo-account forward observation**, not an order-sending strategy or a profitability claim.

## What the available data can and cannot establish

Economic-calendar values plus broker OHLC can support a conservative study of delayed, H4-scale event-specific setups: release/package classification, later-bar entry, completed-pre-entry volatility, declared stop/target/expiry, and price-path outcomes. They do **not** prove historical point-in-time forecast availability, exact historical Bid/Ask fills, slippage, or whether a stop or target touched first inside one OHLC bar. Keep those uncertainties explicit; use pessimistic and sensitivity cases where appropriate. Historical retrospective cases and prospective first-seen cases must be labeled separately.

## Proposed research sequence

1. Make an episode ledger keyed by immutable simultaneous-release package. Preserve event IDs, revisions, actual/forecast/previous/revised-previous, units, missingness, broker clock, and co-release contradictions. Count one macro episode once, even when several events or currency pairs are involved. Mark later scheduled releases during each proposed holding period.
2. Perform a **read-only eligibility/provenance inventory before choosing by performance**: complete H4 paths, gaps, distinct episodes and years by family/pair, usable input fields, calendar-vintage uncertainty, and later-release overlap. This is the first milestone, not a backtest search.
3. Select one pilot family/pair using data quality and an articulated economic rationale, not the best historical return. Write an exact recipe charter before measuring its outcome: package membership, scoring and orientation, continuation or rejection, information-availability rule, first eligible entry, ATR lookback, stop, target, expiry, costs, gap handling, and same-bar ambiguity. A narrow declared comparison is acceptable; a large optimized grid is not the starting point.
4. Evaluate **all** eligible episodes on matched paths, including losses, expiries, unresolved and unavailable paths. Show target-before-stop separately from eventual target touches; gross and cost-stressed R; adverse/favorable excursion; year-by-year results; overlap exposure; and sensitivity to pessimistic intrabar ordering. A positive average driven by a few trades or one period is not enough.
5. Keep discovery, confirmation, and prospective observation distinct. Old FMS and inspected Phase 1 results are hypothesis-generating history, not fresh validation. Do not open the sealed 2023+ Phase 1 returns or tune against them without a new, explicit frozen protocol. If no genuinely independent historical slice remains, say so and rely on prospective first-seen evidence instead of relabeling reused years as holdout.
6. Only a reviewed candidate receives an immutable recipe/version and activation boundary for demo observation. A separate append-only research capture should store each live calendar version, receipt time, clock evidence, decision, no-trade, and eventual outcome. The existing terminal calendar bridge is a rolling display feed, not this immutable ledger. Frontend integration comes after the research contract is credible; the frontend should consume decisions, not calculate or promote setups.

No numerical significance threshold, minimum event count, or approval gate is silently fixed by this note. Those choices must be specified before the corresponding outcomes are inspected, with uncertainty reflecting the number of *independent episodes* and the number of hypotheses tried. Failure to find a robust setup is an acceptable outcome; expanding the search until one wins is not.

## Quarantined old-FMS reference

An independent agent's 2026-09-24 report says the old 51-setup lineage may be traced from `PRACTICAL_PATTERN_DEFINITIONS` in the old `server.py`, through `registered_reaction_profiles.json` and `historicalBenchmark.experimentId`, to SQLite `fms_experiments`, `fms_qualification_audits`, and `metadata[fms_raw_audit:<experimentId>]`; `macro_signal.py` and two reconciliation/materialization scripts reportedly define the old scoring and derivation. **This chain has not been verified in this repository.** It is a locator for a future bounded provenance audit, not a current registry, validated evidence, or permission to import old code, UI, or a 23 GB database. The old handoff's different vintages and known direction/timing defects still apply. If a compact evidence bundle is later made, pin exact source commit, file hashes, extraction date, definitions, experiment IDs, case-level lineage, exclusions, and limitations. Keep it read-only and separate from newly registered recipes.
