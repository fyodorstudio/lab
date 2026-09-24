# FMS rebuild and recovery handoff

Prepared: 2026-09-23

Purpose: preserve the useful intent, research knowledge, evidence lineage, owner observations, and recoverable files from the old Fyodor repository before rebuilding FMS from scratch. This is a research handoff, not an instruction to reuse the old application architecture.

## Read this first

The old repository contains two different research lines that must not be merged accidentally:

1. **Registered-trade FMS lineage:** the frozen event/pair recipes, arrows, entry/SL/TP/expiry contracts, reviewed H1/context variants, and the later 17 approved v2 execution successors.
2. **Direction-first event-respect campaign:** a separate attempt to discover which event families reliably move which pairs in the direction implied by the release. Its corrected v4 challenge produced zero challenge-supported candidates. It produced monitoring hypotheses, not registered trades.

The practical owner objective was always simple:

> Produce more useful registered setups, or a genuinely better explicit version of an existing setup, then collect new forward data. The catalogue, research article, audit UI, and diagnostics exist to support that result; they are not the result themselves.

Do not copy the old bridge, giant server, UI composition, caches, or route structure merely because they contain FMS code. Rebuild a small domain model and import only evidence that can be traced.

## Critical preservation warning

The visible checkout is currently commit `90aac0f` (`bridge haul`). The later v2 catalogue and execution-successor implementation is not present in this working tree. It is recoverable from commit `3e3c208`.

Preserve both:

- the entire Git history, preferably as a Git bundle or an untouched copy of the repository including `.git`;
- the external SQLite research database:
  `C:\Users\Administrator\AppData\Local\Fyodor Trading Terminal\fyodor-research.sqlite3`.

The SQLite file was approximately 23.3 GB when inspected. Stop the old bridge before copying it so the database and WAL state cannot change during the copy.

## Product intent

FMS is a local manual-trading research system. It must never send orders, promise profitability, or silently promote a research result.

The desired end product is an event-family x currency-pair catalogue answering:

- What event or immutable simultaneous-release package occurred?
- Was the result objectively favorable, unfavorable, contradictory, incomplete, or orientation-unknown?
- Which currency did the information concern?
- After base/quote orientation, should the pair direction be up or down?
- Does the registered recipe use continuation or rejection treatment?
- How often did price move in that registered direction?
- How far and how quickly did it move?
- How much adverse movement occurred first?
- How often did TP1, TP2, TP3, and other declared targets occur before the declared stop and expiry?
- How stable was the behavior through time, not merely in a pooled sample?
- What happened after activation on immutable first-seen releases?

The owner explicitly wanted event-specific treatment. Different economic releases are different problems; there is no requirement that every event use the same entry, stop, target, or duration.

Event-aware management of a trade that is already open when new information arrives is a late-game goal. First establish the reliable event/pair catalogue and fixed execution baselines.

## Essential vocabulary

- **Recipe/setup/pattern:** exact pair, release or release-package membership, scoring rules, evidence orientation, continuation/rejection treatment, optional cohort/context, and execution contract.
- **Evidence direction:** what the economic evidence says about the relevant currency.
- **Trade direction:** evidence direction after base/quote orientation and continuation or rejection treatment.
- **Surprise:** Actual versus Forecast.
- **Momentum:** Actual versus Previous.
- **Live captured:** complete immutable first-seen package and decision captured before the eligible entry.
- **Recovered offline:** reconstructed historical evidence. It must remain separate from prospective evidence.
- **Activation boundary:** the timestamp after which a new registered version is allowed to own new decisions.
- **Historical replay:** use the contract that was active at the event time. Never rewrite an old arrow using a later recipe.
- **MFE/MAE:** favorable/adverse excursion, not realized return.
- **TP before SL:** target was reached before stop under the declared ordering rules. An eventual TP touch after SL is not a win.

## Non-negotiable research invariants

1. Preserve Actual, Forecast, Previous, revisions, units, missingness, and package membership. Do not collapse them into one vague direction field.
2. Score simultaneous releases as immutable packages. Preserve agreement, contradiction, missing forecast, forecast guard, revision conflict, and unknown orientation.
3. Convert currency direction to pair direction deterministically. Favorable base news and favorable quote news imply opposite pair directions.
4. Never substitute evidence direction for trade direction. A rejection recipe intentionally trades opposite the raw economic reading.
5. Entry must occur after information availability. The old default was the first strictly later H4 open; reviewed variants used H1. The candle containing a release is not automatically a valid post-information entry.
6. ATR must use completed pre-entry candles. The old default was H4 Wilder ATR(14).
7. Preserve gaps, unavailable history, ambiguous same-candle SL/TP ordering, missing paths, and unresolved outcomes.
8. Keep target-before-stop results separate from eventual target touches.
9. Chronological holdout reused after model selection is not fresh validation. Say so explicitly.
10. Releases shared across pairs are correlated macro episodes, not independent confirmations.
11. All old results are gross. No spread, slippage, commission, or swap model was validated.
12. A new recipe or correction requires a new explicit version and activation boundary. Preserve the original.
13. Research code must never auto-promote a favorable row. Publication must use an explicit reviewed allowlist.
14. Display timezone must never participate in financial eligibility or candle ordering.

## Historical story

### 1. Frozen v1 registered baseline

The original system built event/pair recipes from broker calendar values and MT5 candles. A recipe declared release membership, score/orientation, continuation or rejection behavior, and a fixed execution contract. Runtime signals and arrows used immutable activation boundaries.

An early inventory found 47 registered profiles on seven pairs and 5,191 included recipe/release rows. Later source preparation expanded the pinned registered inventory to 51 recipe identities across 10 markets with 5,664 included saved cases. These case counts are not independent portfolio releases because recipes and pairs share macro episodes.

The readable label **FMS v1** was intended only as a display name for this frozen baseline. It must not rename stored model IDs, pattern IDs, hashes, registrations, or outcomes.

### 2. Direction-basis defect and correction

Research found 21 profiles where raw economic-evidence direction differed from the selected contract's actual trade direction. A generator incorrectly used evidence direction when materializing some research profiles.

The corrected rule used the frozen selected-contract outcome keyed by case ID and failed if direction was missing. All 47 affected-era profiles were regenerated into a separate artifact directory rather than silently overwriting lineage.

Example: AUDUSD business-confidence experiment E051 changed from an incorrect later execution average near `-0.177419R` to `+0.209677R` over 31 evaluable cases, matching the saved experiment. This was a research-materialization defect, not permission to rewrite every runtime contract.

One USDJPY US-payroll context approval depended on flawed directional research. Its old performance was withheld and the context was later retired prospectively while historical pre-retirement cases retained the contract active at their event time.

### 3. Entry-timing research

The owner repeatedly asked whether entry should be closer to the release instead of waiting for H4.

- The first H1/H4 campaign made 871 acquisition requests; 864 returned data. It initially matched 1,332 of 5,191 cases because uninterrupted elapsed-hour coverage excluded many weekend paths.
- A separately frozen trading-session revision allowed declared weekend closures and matched 4,617 of 5,191 cases.
- Development selected H1 for 20 recipes; eight retained positive paired later uplift and positive H1 expectancy under the declared screen.
- Exact active-contract follow-up retained those eight as research candidates: AUDUSD US producer inflation, EURUSD retail sales, GBPUSD US non-manufacturing business activity, USDCAD US consumer inflation, USDCHF producer inflation, USDCHF US employment, USDJPY labor wages, and USDJPY US producer-inflation rejection.
- These remained candidates because the first H1 candle after a scheduled release does not prove the complete Actual/Forecast/Previous package had reached FMS before the entry.
- A recent M1/H1/H4 comparison had only 26 fully matched cases out of 170 recent recipe cases. No universal M1 or release-time entry was selected.
- Pre-H4 reaction measurement covered 4,746 cases. Mean directional pre-H4 movement differed by recipe and did not support the universal claim that every setup misses its edge by waiting for H4.

Conclusion: release-near entry remains researchable per event, but the evidence did not justify moving every recipe or arrow to the release candle.

### 4. Support/resistance and market-structure research

Owner audits repeatedly observed that support and resistance behave more like zones or boxes than single exact prices. Useful hypotheses included:

- target versus nearest barrier or barrier ladder;
- target buffers before a barrier;
- stop buffers beyond a barrier to distinguish a true break;
- entry inside support/resistance, breakout, rejection, and support/resistance role transition;
- multi-scale H4/D1/W1 zones;
- limit-entry candidates when the first market entry is in the middle of a poor location;
- partial exits, fixed-time exits, trailing exits, and runners;
- scheduled-event contamination while a trade remains open.

However, the bounded entry-known H4 structure campaign tested 12 declared variants and produced zero survivors. Nearest-zone hard target caps and sequential multi-zone exits did not produce supported successors. D1/weekly structure remained a distinct deferred hypothesis.

Important counterexample: AUDUSD US payroll cleanly reached +1R even though its target lay beyond a visible resistance zone. Therefore every barrier cannot become a deterministic hard cap. Structure should be studied probabilistically: reversal probability, break probability, excursion after first touch, and interaction with event family/direction.

### 5. Direction-first event-respect campaign

This campaign was deliberately separate from the registered-trade model. Its question was:

> Which event families, on which pairs, repeatedly move in the direction implied by Actual versus Forecast, by how much, with how much adverse movement, and does the relationship repeat on first-seen releases after activation?

Corrected v4 frozen lineage:

- 19 markets met coverage; nine were blocked for insufficient declared H4 history or missing source work.
- Development atlas: 3,070 event-family x pair x horizon rows.
- 28 family rows passed literal development gates.
- Nine candidates survived the multiple-comparison funnel and were declared before challenge evidence opened.
- Challenge result: **zero challenge-supported**, seven prospective-only, two rejected.
- Prospective activation: Unix `1789439876` (15 Sep 2026 09:37:56 Jakarta).
- Prospective rows were direction monitors only: no entry, SL, TP, order, or automatic promotion.

Seven prospective-only monitors:

- AUDUSD business sentiment / 30 H4
- AUDUSD trade balance / 12 H4
- EURAUD trade balance / 12 H4
- EURGBP retail headline / 30 H4
- AUDCHF trade balance / 12 H4
- EURCHF GDP / 6 H4
- AUDJPY trade balance / 3 H4

Rejected in later chronology:

- EURCAD producer inflation / 12 H4
- USDJPY composite + services PMI / 3 H4

Conclusion: this campaign did not authorize execution optimization or a registered successor. Its R5 execution stage was blocked by the honest zero-survivor result.

### 6. Common-policy catalogue

The v4 catalogue evaluated all 51 registered recipe identities across 459 common reference contracts:

- stop: 1 completed-pre-entry H4 ATR;
- targets: 0.5R, 1R, and 2R;
- horizons: 6, 12, and 30 H4 candles.

It retained exact attempts, evaluable cases, unavailable paths, ambiguous same-bar ordering, TP-before-SL outcomes, eventual target touches, signed movement, excursions, chronology, and economic versus trade alignment.

The catalogue was descriptive because historical cross-source clock alignment was not yet verified. Its manifest deliberately set `successorTimingEligible: false`.

An event-specific selection pass chose the best development result separately for each recipe over the frozen nine-contract grid. Thirty selections had positive development and reused-holdout gross expectancy; 21 did not. These were 30 descriptive leads, not registrations.

### 7. Clock-basis finding

Calendar timestamps are broker trade-server time. Historical source preparation initially compared them with Python receipt/candle assumptions without a proven period-specific mapping.

Old acknowledgement samples showed a roughly three-hour difference between EA server clocks and bridge UTC receipt clocks. That alone could not establish a historical timezone or DST schedule.

A later live sample established, for the then-current broker/session:

- UTC sample `1789460761`;
- native server time `1789471561`;
- native M1 open `1789471560`;
- native H4 open `1789459200`;
- explicit Python history returned the same native candle opens.

Therefore old calendar arrows must not be shifted relative to candles merely by subtracting three hours. The unsafe comparison was UTC receipt/decision time versus native release/entry time.

The later design retained contemporaneous EA GMT/server mapping and required a broker-catalog/day-scoped M1/H4 calibration before freezing a new decision. Stale, unavailable, mismatched, or transition-period clocks failed closed as `awaiting_clock_verification`. Old records were not backfilled or recalculated.

### 8. FMS v2 execution-successor study

This is the most developed recoverable attempt at a polished version.

Question: for each existing event/pair recipe, could a different fixed H4 stop, target, and expiry improve the exact fixed-H4 baseline on the same complete path without changing event identity, scoring, direction, or event family?

Every recipe received the same declared 480-contract grid:

- stops: 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, and 3 ATR;
- targets: 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, and 4R;
- expiries: 6, 12, 18, 30, 42, and 60 H4 candles;
- entry: first strictly later H4 open;
- ATR: completed pre-entry H4 Wilder ATR(14);
- path cohort: complete valid maximum 60-H4 path;
- gaps preserved; ambiguous same-H4 ordering retained and scored stop-first only for selection;
- selection: maximum development pessimistic mean gross R with deterministic tie-breaks;
- chronological reused holdout revealed only after development selection.

Result:

- 15 positive reused-history leads without an exact v1 comparator;
- 18 exact matched fixed-H4 improvement leads;
- 18 nonpositive rows;
- 41 recipes had an exact fixed-H4 runtime comparator;
- 17 of the 18 matched leads were explicitly allowlisted as v2 successors;
- one USDJPY manufacturing-employment lead was excluded because a context overlay meant it was not an exact comparison with composite runtime behavior.

Research hash: `121a36ce7f2d5ba6514f6c465e9fe225ee29db9f88cbfcf62974ec00042f6730`

Manifest hash: `8db181578f595a8d18a4c1b947df4c7fb05324d75ff506a32fe38f4e6d37920e`

Registry activation: `1789896633`

Registry hash: `531381d685bf01316f7dfa86d937a6a5c896f500085c7abb25f653f3ddc5ce36`

Approved successors:

| ID | Recipe | v1 execution | v2 execution |
|---|---|---|---|
| FMS-V2-EXEC-001 | AUDJPY / `audjpy-jpy-inflation-short` | 0.5 ATR / 0.5R / 30 H4 | 0.5 ATR / 4R / 12 H4 |
| FMS-V2-EXEC-002 | AUDUSD / `audusd-business-confidence-rejection` | 1.5 ATR / 0.5R / 30 H4 | 3 ATR / 0.25R / 12 H4 |
| FMS-V2-EXEC-003 | EURCAD / `eurcad-eur-consumer-sentiment` | 2 ATR / 3R / 12 H4 | 0.75 ATR / 3R / 18 H4 |
| FMS-V2-EXEC-004 | EURJPY / `eurjpy-eur-composite-services-pmi` | 0.5 ATR / 1.5R / 30 H4 | 0.75 ATR / 4R / 42 H4 |
| FMS-V2-EXEC-005 | EURUSD / `eurusd-cpi-package` | 2 ATR / 4R / 30 H4 | 1.5 ATR / 4R / 30 H4 |
| FMS-V2-EXEC-006 | EURUSD / `eurusd-ism-manufacturing-employment-package` | 2 ATR / 1R / 6 H4 | 0.75 ATR / 4R / 12 H4 |
| FMS-V2-EXEC-007 | EURUSD / `eurusd-us-payroll-short-restored` | 2 ATR / 1R / 6 H4 | 0.5 ATR / 4R / 30 H4 |
| FMS-V2-EXEC-008 | EURUSD / `eurusd-us-producer-inflation-cooling-restored` | 2 ATR / 1.25R / 18 H4 | 2 ATR / 4R / 60 H4 |
| FMS-V2-EXEC-009 | EURUSD / `us-industrial-output-directional` | 1.5 ATR / 0.5R / 12 H4 | 0.75 ATR / 2.5R / 60 H4 |
| FMS-V2-EXEC-010 | GBPUSD / `gbpusd-gdp-sales-q-q-package` | 2 ATR / 1R / 12 H4 | 2 ATR / 3R / 60 H4 |
| FMS-V2-EXEC-011 | NZDUSD / `nzdusd-gdp-annual-change-package` | 1 ATR / 4R / 12 H4 | 1.25 ATR / 4R / 60 H4 |
| FMS-V2-EXEC-012 | NZDUSD / `nzdusd-gdp-sales-q-q-package` | 1 ATR / 1R / 30 H4 | 0.5 ATR / 2.5R / 6 H4 |
| FMS-V2-EXEC-013 | USDCAD / `usdcad-canada-retail-sales` | 1.5 ATR / 4R / 30 H4 | 2 ATR / 4R / 30 H4 |
| FMS-V2-EXEC-014 | USDCAD / `usdcad-us-producer-inflation` | 2 ATR / 1R / 30 H4 | 3 ATR / 4R / 60 H4 |
| FMS-V2-EXEC-015 | USDCHF / `usdchf-fed-industrial-production-m-m-package` | 2 ATR / 2R / 6 H4 | 2 ATR / 4R / 60 H4 |
| FMS-V2-EXEC-016 | USDJPY / `usdjpy-us-employment-release` | 2 ATR / 2R / 6 H4 | 2 ATR / 4R / 30 H4 |
| FMS-V2-EXEC-017 | USDJPY / `usdjpy-us-trade-balance-ordinary` | 2 ATR / 0.5R / 30 H4 | 1.5 ATR / 4R / 30 H4 |

These successors are reused-history hypotheses, not proven future edges. Some have low TP-before-SL rates but positive gross expectancy because the winner size is large; this is why both win rate and gross R distribution must be reported.

The intended lifecycle was: old arrows remain v1; only new qualifying signals after activation can use v2; each signal stores `registeredVersion` and exact execution; closed signals are never reopened or rescored.

The old application integration around this work became unstable and was not trustworthy enough to reuse wholesale. Preserve the registry and research evidence independently from the runtime/UI implementation.

## Owner audit findings worth carrying forward

The database contains 21 review notes: 20 substantive notes marked `documented` and one disposable unlabeled `test`. `Documented` means discussed and preserved, not approved.

Key findings from those notes:

- EURUSD industrial output: genuine directional failure after reaching only +0.41R toward a +0.5R target; no evaluator defect.
- EURUSD September manufacturing/payroll/retail cluster: some trades reached their intended direction much later, but required surviving substantial adverse movement and later releases. This supports a declared stop/duration study, not retroactive wins.
- NZDUSD US payroll: target sat beyond an entry-known resistance band; price peaked inside the band then reversed. Credible target-versus-barrier weakness.
- USDCAD producer inflation: clean +1R followed by further favorable movement. Useful runner/trailing hypothesis, but only one case.
- NZDUSD producer inflation: stopped by about 1.35 pips; surviving required materially more stop room before costs. Joint stop/duration/target candidate, not a mislabeled winner.
- USDJPY producer-inflation rejection: profitable expiry near strong support; extending duration would later have been worse. Supports fixed-time/trailing comparison, not indiscriminate longer expiry.
- USDJPY consumer sentiment: direction failed and target lay beyond support. It is both a direction and placement concern.
- USDJPY labor wages: reached about +1.99R then stopped while the target was much farther away. Long-lookback structure and target/horizon candidate.
- NZDUSD trade balance: several resistance zones stood before the target and the entry was poorly located. Supports target-ladder and limit-entry research.
- AUDUSD payroll: target beyond resistance still won. This is the essential counterexample to deterministic barrier caps.
- USDJPY payroll: stop-first before a later intended-direction move; pre-stop MFE was only about +0.47R. It remains a loss and a near-target/stop/duration hypothesis.
- GBPUSD non-manufacturing activity: conservative +1R won; a hypothetical deeper target was not plainly better because price reversed first.
- USDCAD composite PMI: direction failed before target placement mattered.
- USDCHF employment: long entry immediately above a listed resistance band failed. Breakout/location and role-transition candidate.
- EURUSD manufacturing employment: entry occurred inside support and target beyond it; the much later move was contaminated by later information.
- AUDUSD manufacturing employment: wide-box structure may have supported the entry, but +4R target/duration was ambitious; eventual much-later touch is not a win.
- USDCAD manufacturing employment: came within roughly 2.4 pips of +2R then reversed. This supports a bounded target-buffer study but is highly vulnerable to hindsight overfit.
- USDJPY employment: clean +2R is a positive control against assuming every nearby resistance requires a larger stop.
- USDJPY consumer confidence: stopped while trend opposed the trade; later decline followed another release. Trend conflict and intervening-event example.

The exact original owner wording remains in SQLite table `fms_review_notes`. The reviewed interpretations are also preserved in `docs/Development Logs/FMS v2 Research.md`.

## Database inventory observed on 2026-09-23

Read-only counts from the external SQLite database:

| Table | Rows |
|---|---:|
| `release_observations` | 883 |
| `paper_cases` | 246 |
| `fms_sequences` | 30 |
| `fms_experiments` | 995 |
| `fms_candidates` | 4 |
| `fms_qualification_audits` | 1,063 |
| `fms_sweeps` | 0 |
| `fms_live_decisions` | 45 |
| `fms_live_execution_observations` | 0 |
| `fms_review_notes` | 21 |

These counts describe the database at inspection time, not a frozen publication. Do not treat the database as one coherent final model; use versioned artifacts and hashes for published claims.

## What to preserve

### Priority 1: irreplaceable owner/research state

- `C:\Users\Administrator\AppData\Local\Fyodor Trading Terminal\fyodor-research.sqlite3`
- this handoff file
- the repository's complete Git history, including commit `3e3c208`

### Priority 2: registered v1 evidence and domain rules

- `Main/mt5-bridge/macro_signal.py`
- `Main/mt5-bridge/fms_historical_evidence.py`
- `Main/mt5-bridge/registered_reaction_profiles.json`
- `Main/mt5-bridge/registered_market_context_profiles.json`
- `Main/mt5-bridge/registered_context_approval_evidence.json`
- `Main/mt5-bridge/registered_entry_review_evidence.json`
- `Main/mt5-bridge/registered_entry_reviews.py`
- `Main/mt5-bridge/registered_reaction_audits.py`
- `Main/mt5-bridge/support_resistance_execution_research.json`
- `Main/mt5-bridge/multi_zone_execution_research.json`

### Priority 3: v2 files recoverable from commit `3e3c208`

- `Main/mt5-bridge/registered_execution_successors.json`
- `Main/mt5-bridge/registered_execution_successors.py`
- `Main/src/app/features/fms-dock/fmsExecutionSuccessors.v1.json`
- `Main/src/app/features/fms-dock/fmsRecipeCatalogue.v4.json`
- `Main/src/app/features/fms-dock/FmsRecipeCatalogue.tsx`
- `Main/src/app/lib/fmsDisplayVersion.ts`

Treat the JSON registries and research artifacts as the useful payload. Treat the old React integration as a presentation reference only.

### Priority 4: versioned research artifacts

- `docs/Development Logs/artifacts/fms-v2-research-2026-09-15/`
- `docs/Development Logs/artifacts/fms-v2-research-2026-09-20/`
- `docs/Development Logs/artifacts/fms-entry-campaign-2026-09-06/`
- `docs/Development Logs/artifacts/fms-minute-campaign-2026-09-06/`
- `docs/Development Logs/artifacts/fms-direction-corrected-2026-09-06/`
- `docs/Development Logs/artifacts/fms-controlled-mining-2026-09-07/`
- `docs/Development Logs/artifacts/fms-exhaustion-ledger-2026-09-07.json`
- `docs/Development Logs/artifacts/fms-research-inventory-2026-09-06.json`

Preserve manifests, hashes, result JSON, reports, checkpoints, and candle fingerprints together. A result without its manifest and source hashes is only an anecdote.

### Priority 5: research runners worth reading, not blindly porting

- `scripts/fms_research_inventory.py`
- `scripts/fms_reconcile_profile_directions.py`
- `scripts/fms_entry_campaign.py`
- `scripts/fms_compare_entries.py`
- `scripts/fms_compare_entries_session.py`
- `scripts/fms_minute_campaign.py`
- `scripts/fms_compare_minute_entries.py`
- `scripts/fms_measure_pre_entry_reaction.py`
- `scripts/fms_review_active_entry_candidates.py`
- `scripts/fms_build_recipe_catalogue.py` from commit `3e3c208`
- `scripts/fms_publish_execution_successors.py` from commit `3e3c208`
- `Main/mt5-bridge/fms_reaction_campaign.py`

Port pure calculations only after writing a small input/output contract. Do not import the old `server.py` into offline research.

## What not to inherit automatically

- The old `Main/mt5-bridge/server.py` architecture.
- Bridge supervision, request queues, chart caches, or browser preload systems.
- Giant React components or duplicated FMS presentation logic.
- Old live/runtime state merely because it passed a test suite.
- Rounded display metrics when exact counts are available.
- Any claim that a later TP touch changed a stopped or expired result.
- Any source-clock correction that shifts historical records without contemporaneous evidence.
- Any setup marked “Needs Codex Review” as if it were approved.
- Any result lacking a manifest, exact recipe identity, cohort, activation boundary, and provenance.

## Recommended clean FMS architecture

Keep the rebuild small and layered:

```text
trusted MT5 calendar + OHLC input
  -> immutable release package ledger
  -> pure economic scoring/orientation
  -> pure pair-direction and recipe matching
  -> versioned registered recipe registry
  -> pure entry/SL/TP/expiry evaluator
  -> immutable decision/outcome ledger
  -> read-only chart arrows, catalogue, audit notes, and reports
```

Suggested ownership:

- `domain/events`: immutable releases, package membership, units, revisions, scoring inputs.
- `domain/recipes`: recipe identity, evidence direction, pair orientation, continuation/rejection, activation.
- `domain/execution`: entry, ATR, SL, TP, expiry, gaps, ambiguity, gross R.
- `domain/evidence`: chronological partitions, TP-before-SL ladder, excursions, uncertainty, provenance.
- `registries`: frozen v1 import and any explicitly approved new version.
- `research`: offline-only runners that consume frozen files, never the live bridge.
- `runtime`: match new packages to the registry and store exact versioned decisions.
- `presentation`: arrows and tables only; no financial fallback calculations.

The bridge should supply trusted MT5 data and health. It should not own recipe research or duplicate FMS calculations.

## Recommended rebuild sequence

1. Preserve Git history, SQLite, registries, and artifact directories before editing anything.
2. Define a small canonical event/package schema and candle schema.
3. Implement evidence direction and base/quote orientation with explicit examples.
4. Define immutable recipe identity and activation-boundary semantics.
5. Reimplement one pure fixed-H4 evaluator with gaps, expiry, ambiguity, and missing-path handling.
6. Import v1 recipes as frozen reference data; do not recreate them from rounded UI text.
7. Replay a small set of documented arrows and compare exact entry/SL/TP/result against the frozen audit artifact.
8. Build the literal event-family x pair catalogue with direction-respect, signed returns, MFE/MAE, chronology, and coverage.
9. Add a declared common-policy TP-before-SL ladder.
10. Only then inspect the 17 v2 successor hypotheses and decide manually which deserve forward observation in the new system.
11. Store every new live decision with recipe version, source clock, input package, execution, and first-seen provenance.
12. Add support/resistance, release-near entry, or event-aware management as separately versioned studies, never ad hoc runtime exceptions.

## Minimum report for every recipe

Every catalogue row should show:

- market and recipe ID;
- event/package membership;
- economic scoring and orientation;
- continuation/rejection treatment;
- release and entry clock basis;
- activation boundary and registered version;
- development, holdout, recent, and prospective partitions;
- attempted, evaluable, unavailable, ambiguous, TP, SL, and expiry counts;
- TP-before-SL rate for each declared target;
- eventual target-touch rate separately;
- mean/median gross R and uncertainty;
- signed final return, MFE, and MAE in ATR and price terms;
- represented years and positive-year breadth;
- overlap/correlation episode ID;
- frozen input/result hashes;
- exact limitations and approval state.

## Open hypotheses, ordered by usefulness

1. Build the event-family x pair direction catalogue cleanly from trusted data.
2. Recheck event-specific fixed execution using a declared grid and true matched cohorts.
3. Evaluate target and stop buffers around probabilistic zones, retaining break-through counterexamples.
4. Revisit H1/M1 entry only where complete package availability and candle coverage are proven.
5. Test partial/fixed-time/trailing exits on all eligible cases, not selected winners.
6. Account for overlapping pair exposure from one macro episode.
7. Add an intervening scheduled-release timeline for open trades.
8. Only after the above, study event-aware open-trade management.

## Known unresolved questions

- Which of the 17 v2 successors would survive genuinely new prospective evidence?
- Which historical clock periods and broker identities have trustworthy release-to-candle alignment?
- Can support/resistance zones add value probabilistically without becoming hindsight-drawn boxes?
- Can release-near entry be evaluated using actual package-receipt time rather than scheduled time?
- How should correlated signals from one macro episode be sized or counted?
- Which later moves were caused or contaminated by intervening scheduled releases?
- How much do real trading costs alter small positive gross edges?
- Which of the 21 configured crosses lacking early registered profiles have adequate data for honest discovery?

## Source documents used for this handoff

- `CONTEXT.md`
- `docs/Development Logs/Checklist.md`
- `docs/Development Logs/FMS Research Progress.md`
- `docs/Development Logs/FMS v2 Research.md`
- current registered JSON files under `Main/mt5-bridge/`
- read-only counts and review notes from `fyodor-research.sqlite3`
- v2 registry and file tree recovered from commit `3e3c208`

Where dated documents conflict, the later explicit v2-successor section supersedes earlier statements that there were zero v2 registrations. It does not supersede the separate event-respect campaign's zero-survivor result.

## Final principle

The old system's most valuable asset is not its code. It is the separation between immutable source facts, explicit recipe identity, chronological evidence, frozen execution, owner observations, and versioned decisions. Preserve that separation in the rebuild while discarding the tangled implementation.
