# FMS v1: the 51 frozen registered setups

## Why this file exists

This is the small, human-readable isolation of the old FMS v1 registry. It explains what the **51 registered setups** were, how they were produced, what their evidence does and does not mean, and where the original proof lives.

This file is documentation, not executable logic. It does not replace the original immutable experiments or their raw event/candle paths.

## The shortest accurate explanation

The 51 were not 51 generic indicators. Each row was a separately registered contract tying together:

1. one market;
2. one exact economic-event family or package;
3. one rule for turning Actual, Forecast, and Previous into a directional score;
4. either following that score or rejecting it;
5. sometimes an ordinary-magnitude or Long/Short-only filter;
6. one fixed entry, stop, target, and expiry contract; and
7. one immutable experiment ID holding the historical evidence.

The first registry contained **47** setups on 7 markets. Four reviewed major-cross setups were later appended, producing the **51** shown in the old Setups dock:

| Stage | Markets added | Count |
| --- | --- | ---: |
| Registered Reaction v4, 2026-08-29 | EURUSD 9, GBPUSD 5, USDJPY 13, AUDUSD 5, USDCAD 7, NZDUSD 5, USDCHF 3 | 47 |
| Major-cross addition, activated 2026-09-06 | AUDJPY 2, EURCAD 1, EURJPY 1 | +4 |
| Frozen v1 total | 10 markets | **51** |

Later H1-entry, execution-successor, context, and FMS v2 research were overlays or challengers. They were not the origin of these 51 identities and should not be silently folded into a clean v1 rebuild.

## How a setup was calculated

### 1. Match an exact event package

A recipe first matched a declared event family, such as US payrolls, Japanese inflation, or Euro-area composite/services PMI. A package could contain several exact broker-calendar titles. The setup only applied when its declared identity matched; unrelated releases were not supposed to borrow its result.

### 2. Convert the release into information points

The five frozen scoring policies were:

| Policy | Meaning |
| --- | --- |
| `momentum_only` | Compare Actual with Previous; ignore Forecast. |
| `surprise_only` | Compare Actual with Forecast; ignore Previous. |
| `agreement_no_bonus` | Use both comparisons, but do not add an extra point when they agree. |
| `forecast_quality` | Use both comparisons, but suppress a Forecast comparison when its gap was anomalous relative to prior, already-known history. |
| `baseline` | Use the original surprise and momentum points and add an agreement bonus when both non-zero directions agree. |

Each event rule also knew whether a higher number was economically positive or negative for its currency, and then oriented that currency result to the quoted pair.

### 3. Follow or reject the score

- `follow` means continuation: trade in the scored pair direction.
- `reject` means contrarian/rejection: reverse the scored pair direction.
- `ordinary-only` means the release had to fall in the ordinary relative-magnitude cohort.
- `long-only` or `short-only` means the other direction produced no setup.

### 4. Apply the frozen trade contract

The registered execution used the first H4 boundary strictly after release, with the entry price read from the corresponding H1 open. Risk distance was based on the most recently completed H4 Wilder ATR(14). The stop was an ATR multiple, the target was an R multiple of that stop distance, and expiry was a fixed number of H4 candles.

The explored grid was:

- stop: `0.5, 0.75, 1, 1.25, 1.5, 2 ATR`;
- target: `0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4R`;
- expiry: `6, 12, 18, 30, 42, 60 H4`.

The contract was selected on the older 70% development partition using development lower-95 expectancy first, then development average R. The later 30% chronological partition was an audit and was not supposed to choose the contract. Results included a three-pip execution stress, but excluded spread, commission, slippage, swap, and real fills.

If both stop and target were touched inside the same H1 candle, M1 data was used when available; unresolved same-candle order remained ambiguous rather than being guessed.

## What the evidence actually found

All 51 survived with a positive later gross average under their frozen contract, but that does **not** mean all 51 showed a reliable directional event reaction.

The later reaction profiles classify the 51 as:

| Later price-behaviour label | Count |
| --- | ---: |
| No dependable reaction | 26 |
| Continuation | 10 |
| Volatility only | 9 |
| Delayed continuation | 6 |

That distinction is central:

- **TP-before-SL rate is not directional accuracy.**
- **Positive average R is not proof that price consistently respected the event result.**
- A low TP rate can coexist with positive average R because trades may expire at a partial gain, targets and stops are asymmetric, or a minority of large winners outweigh losses.
- A high TP rate can belong to a small target and says nothing by itself about expectancy.
- `continuation` in the reaction column means continuation in the registered arrow's direction. A recipe that rejects the economic score can therefore still have a continuation reaction profile after that reversal has defined the arrow.

The 51 are best preserved as a historical recipe catalogue and hypothesis source. They are not 51 proven live trading systems.

## Complete 51-row catalogue

`Later evidence` is: **evaluable later trades / stressed gross average R / TP-before-SL rate**. Ambiguous same-candle trades are excluded from the evaluable execution count. The reaction diagnosis may use a slightly larger path sample because it can describe price movement even where exact TP/SL ordering was ambiguous.

| Market | Exact setup key | Information and mapping | Frozen contract | Later evidence | Later reaction diagnosis | Immutable experiment |
| --- | --- | --- | --- | --- | --- | --- |
| AUDJPY | `audjpy-jpy-industrial-output` | momentum only; follow | SL 1.25 ATR / TP 3R / 42 H4 | 37 / +0.448R / 32.4% | no dependable reaction | `FMS-AUDJPY-H4-E013` |
| AUDJPY | `audjpy-jpy-inflation-short` | forecast quality; follow; short-only | SL 0.5 ATR / TP 0.5R / 30 H4 | 26 / +0.210R / 80.8% | no dependable reaction | `FMS-AUDJPY-H4-E015` |
| AUDUSD | `audusd-business-confidence-rejection` | momentum only; reject | SL 1.5 ATR / TP 0.5R / 30 H4 | 31 / +0.122R / 80.6% | continuation | `FMS-AUDUSD-H4-E051` |
| AUDUSD | `audusd-ism-manufacturing-employment-package` | forecast quality; reject; ordinary-only | SL 0.75 ATR / TP 4R / 12 H4 | 44 / +0.052R / 20.5% | no dependable reaction | `FMS-AUDUSD-H4-E055` |
| AUDUSD | `audusd-s-p-global-manufacturing-pmi` | momentum only; follow | SL 2 ATR / TP 0.5R / 6 H4 | 36 / +0.001R / 55.6% | no dependable reaction | `FMS-AUDUSD-H4-E057` |
| AUDUSD | `audusd-us-payroll-package` | agreement no bonus; reject; ordinary-only | SL 1.5 ATR / TP 1R / 30 H4 | 31 / +0.051R / 54.8% | volatility only | `FMS-AUDUSD-H4-E058` |
| AUDUSD | `audusd-us-producer-inflation` | momentum only; follow | SL 2 ATR / TP 2R / 12 H4 | 32 / +0.195R / 18.8% | continuation | `FMS-AUDUSD-H4-E050` |
| EURCAD | `eurcad-eur-consumer-sentiment` | momentum only; follow | SL 2 ATR / TP 3R / 12 H4 | 39 / +0.112R / 0.0% | continuation | `FMS-EURCAD-H4-E019` |
| EURJPY | `eurjpy-eur-composite-services-pmi` | momentum only; follow | SL 0.5 ATR / TP 1.5R / 30 H4 | 33 / +0.287R / 51.5% | continuation | `FMS-EURJPY-H4-E021` |
| EURUSD | `eurusd-business-climate-indicator-package` | surprise only; follow; ordinary-only | SL 1 ATR / TP 1R / 6 H4 | 27 / +0.073R / 55.6% | no dependable reaction | `FMS-EURUSD-H4-E283` |
| EURUSD | `eurusd-consumer-sentiment-restored` | forecast quality; follow | SL 1 ATR / TP 2R / 30 H4 | 26 / +0.385R / 50.0% | no dependable reaction | `FMS-EURUSD-H4-E291` |
| EURUSD | `eurusd-cpi-package` | agreement no bonus; follow; ordinary-only | SL 2 ATR / TP 4R / 30 H4 | 73 / +0.056R / 6.8% | no dependable reaction | `FMS-EURUSD-H4-E284` |
| EURUSD | `eurusd-ism-manufacturing-employment-package` | forecast quality; reject; ordinary-only | SL 2 ATR / TP 1R / 6 H4 | 42 / +0.041R / 28.6% | no dependable reaction | `FMS-EURUSD-H4-E286` |
| EURUSD | `eurusd-retail-sales-m-m-package` | baseline; follow | SL 2 ATR / TP 4R / 30 H4 | 28 / +0.025R / 0.0% | volatility only | `FMS-EURUSD-H4-E287` |
| EURUSD | `eurusd-s-p-global-composite-pmi-package` | surprise only; follow; ordinary-only | SL 2 ATR / TP 0.5R / 6 H4 | 25 / +0.098R / 64.0% | no dependable reaction | `FMS-EURUSD-H4-E288` |
| EURUSD | `eurusd-us-payroll-short-restored` | forecast quality; follow; short-only | SL 2 ATR / TP 1R / 6 H4 | 14 / +0.250R / 35.7% | continuation | `FMS-EURUSD-H4-E289` |
| EURUSD | `eurusd-us-producer-inflation-cooling-restored` | forecast quality; follow; long-only | SL 2 ATR / TP 1.25R / 18 H4 | 11 / +0.525R / 54.5% | no dependable reaction | `FMS-EURUSD-H4-E293` |
| EURUSD | `us-industrial-output-directional` | forecast quality; follow | SL 1.5 ATR / TP 0.5R / 12 H4 | 31 / +0.073R / 74.2% | no dependable reaction | `FMS-EURUSD-H4-E282` |
| GBPUSD | `gbpusd-average-weekly-earnings-regular-pay-y-y-package` | surprise only; reject | SL 2 ATR / TP 2R / 12 H4 | 16 / +0.439R / 25.0% | no dependable reaction | `FMS-GBPUSD-H4-E063` |
| GBPUSD | `gbpusd-gdp-sales-q-q-package` | forecast quality; reject | SL 2 ATR / TP 1R / 12 H4 | 17 / +0.097R / 41.2% | no dependable reaction | `FMS-GBPUSD-H4-E065` |
| GBPUSD | `gbpusd-ism-non-manufacturing-business-activity-package` | forecast quality; follow | SL 2 ATR / TP 1R / 6 H4 | 30 / +0.053R / 20.0% | volatility only | `FMS-GBPUSD-H4-E066` |
| GBPUSD | `gbpusd-us-industrial-output` | forecast quality; follow | SL 1 ATR / TP 0.5R / 6 H4 | 32 / +0.034R / 75.0% | continuation | `FMS-GBPUSD-H4-E062` |
| GBPUSD | `gbpusd-us-labor-claims` | agreement no bonus; follow; ordinary-only | SL 2 ATR / TP 4R / 60 H4 | 131 / +0.171R / 15.2% | delayed continuation | `FMS-GBPUSD-H4-E061` |
| NZDUSD | `nzdusd-gdp-annual-change-package` | momentum only; reject | SL 1 ATR / TP 4R / 12 H4 | 21 / +0.348R / 14.3% | continuation | `FMS-NZDUSD-H4-E048` |
| NZDUSD | `nzdusd-gdp-sales-q-q-package` | momentum only; follow | SL 1 ATR / TP 1R / 30 H4 | 16 / +0.108R / 62.5% | no dependable reaction | `FMS-NZDUSD-H4-E049` |
| NZDUSD | `nzdusd-us-payroll-package` | surprise only; reject; ordinary-only | SL 2 ATR / TP 1R / 60 H4 | 27 / +0.162R / 61.5% | volatility only | `FMS-NZDUSD-H4-E052` |
| NZDUSD | `nzdusd-us-producer-inflation` | momentum only; follow | SL 2 ATR / TP 2R / 12 H4 | 32 / +0.218R / 25.0% | no dependable reaction | `FMS-NZDUSD-H4-E044` |
| NZDUSD | `nzdusd-us-trade-balance` | momentum only; follow | SL 1.5 ATR / TP 4R / 30 H4 | 62 / +0.055R / 12.9% | volatility only | `FMS-NZDUSD-H4-E045` |
| USDCAD | `usdcad-canada-retail-sales` | momentum only; follow | SL 1.5 ATR / TP 4R / 30 H4 | 30 / +0.193R / 19.4% | no dependable reaction | `FMS-USDCAD-H4-E045` |
| USDCAD | `usdcad-gdp-annualized-q-q-package` | agreement no bonus; reject; ordinary-only | SL 1.5 ATR / TP 0.5R / 12 H4 | 26 / +0.019R / 73.1% | delayed continuation | `FMS-USDCAD-H4-E049` |
| USDCAD | `usdcad-gdp-sales-q-q-package` | momentum only; reject | SL 1.5 ATR / TP 4R / 60 H4 | 11 / +0.422R / 30.0% | no dependable reaction | `FMS-USDCAD-H4-E050` |
| USDCAD | `usdcad-ism-manufacturing-employment-package` | forecast quality; reject; ordinary-only | SL 1 ATR / TP 2R / 12 H4 | 44 / +0.087R / 38.6% | volatility only | `FMS-USDCAD-H4-E051` |
| USDCAD | `usdcad-s-p-global-composite-pmi-package` | surprise only; reject | SL 2 ATR / TP 0.5R / 12 H4 | 27 / +0.062R / 74.1% | delayed continuation | `FMS-USDCAD-H4-E052` |
| USDCAD | `usdcad-us-consumer-inflation` | agreement no bonus; follow | SL 1.5 ATR / TP 4R / 60 H4 | 80 / +0.067R / 16.2% | volatility only | `FMS-USDCAD-H4-E043` |
| USDCAD | `usdcad-us-producer-inflation` | momentum only; follow | SL 2 ATR / TP 1R / 30 H4 | 30 / +0.228R / 60.0% | continuation | `FMS-USDCAD-H4-E044` |
| USDCHF | `usdchf-fed-industrial-production-m-m-package` | momentum only; reject | SL 2 ATR / TP 2R / 6 H4 | 29 / +0.002R / 3.4% | delayed continuation | `FMS-USDCHF-H4-E052` |
| USDCHF | `usdchf-ppi-m-m-package` | momentum only; follow; ordinary-only | SL 1.5 ATR / TP 0.5R / 6 H4 | 26 / +0.012R / 61.5% | no dependable reaction | `FMS-USDCHF-H4-E053` |
| USDCHF | `usdchf-us-employment-release` | momentum only; reject | SL 2 ATR / TP 0.5R / 6 H4 | 37 / +0.007R / 56.8% | delayed continuation | `FMS-USDCHF-H4-E054` |
| USDJPY | `usdjpy-adjusted-current-account-package` | surprise only; reject; ordinary-only | SL 1 ATR / TP 0.5R / 6 H4 | 21 / +0.083R / 71.4% | volatility only | `FMS-USDJPY-H4-E076` |
| USDJPY | `usdjpy-consumer-confidence-index` | forecast quality; reject; ordinary-only | SL 1 ATR / TP 1R / 6 H4 | 24 / +0.137R / 54.2% | no dependable reaction | `FMS-USDJPY-H4-E077` |
| USDJPY | `usdjpy-fed-industrial-production-m-m-package` | forecast quality; reject; ordinary-only | SL 2 ATR / TP 0.5R / 30 H4 | 34 / +0.014R / 67.6% | no dependable reaction | `FMS-USDJPY-H4-E078` |
| USDJPY | `usdjpy-industrial-production-forecast-1-month-ahead-m-m-package` | baseline; reject | SL 2 ATR / TP 0.5R / 6 H4 | 21 / +0.178R / 61.9% | no dependable reaction | `FMS-USDJPY-H4-E082` |
| USDJPY | `usdjpy-ism-non-manufacturing-business-activity-package` | forecast quality; follow; ordinary-only | SL 2 ATR / TP 4R / 60 H4 | 30 / +0.091R / 10.3% | no dependable reaction | `FMS-USDJPY-H4-E081` |
| USDJPY | `usdjpy-jpy-inflation` | forecast quality; follow | SL 2 ATR / TP 1R / 30 H4 | 65 / +0.109R / 51.5% | no dependable reaction | `FMS-USDJPY-H4-E075` |
| USDJPY | `usdjpy-jpy-labor-wages` | forecast quality; follow | SL 0.75 ATR / TP 4R / 6 H4 | 25 / +0.508R / 12.0% | continuation | `FMS-USDJPY-H4-E074` |
| USDJPY | `usdjpy-us-consumer-sentiment` | momentum only; follow | SL 2 ATR / TP 1R / 60 H4 | 111 / +0.125R / 56.2% | volatility only | `FMS-USDJPY-H4-E073` |
| USDJPY | `usdjpy-us-employment-release` | surprise only; reject | SL 2 ATR / TP 2R / 6 H4 | 36 / +0.084R / 8.3% | delayed continuation | `FMS-USDJPY-H4-E083` |
| USDJPY | `usdjpy-us-manufacturing-employment` | forecast quality; follow | SL 2 ATR / TP 0.5R / 60 H4 | 58 / +0.098R / 73.2% | no dependable reaction | `FMS-USDJPY-H4-E068` |
| USDJPY | `usdjpy-us-payroll-package` | baseline; reject; ordinary-only | SL 0.75 ATR / TP 0.5R / 30 H4 | 26 / +0.095R / 73.1% | no dependable reaction | `FMS-USDJPY-H4-E084` |
| USDJPY | `usdjpy-us-producer-inflation-rejection` | surprise only; reject | SL 1 ATR / TP 2R / 6 H4 | 32 / +0.081R / 28.1% | no dependable reaction | `FMS-USDJPY-H4-E067` |
| USDJPY | `usdjpy-us-trade-balance-ordinary` | surprise only; follow; ordinary-only | SL 2 ATR / TP 0.5R / 30 H4 | 38 / +0.144R / 76.3% | continuation | `FMS-USDJPY-H4-E070` |

## Registry composition

| Dimension | Count |
| --- | --- |
| Momentum-only scoring | 17 |
| Forecast-quality scoring | 17 |
| Surprise-only scoring | 9 |
| Agreement without bonus | 5 |
| Baseline scoring | 3 |
| Follow/continuation mapping | 30 |
| Reject/contrarian mapping | 21 |
| Both directions allowed | 48 |
| Short-only | 2 |
| Long-only | 1 |
| All magnitudes | 34 |
| Ordinary-magnitude only | 17 |

## Why several rows look strange

- `EURCAD consumer sentiment` has 0% TP-before-SL but +0.112R later average. Its 3R target was never reached first; the positive average came from expiry closes. The old source explicitly warned of roughly 74% holdout expiry.
- Very small positive later averages such as +0.001R, +0.002R, or +0.007R are economically fragile and should not be treated as meaningful edge after unmeasured costs.
- Some rows have large average R but very small samples, such as `EURUSD producer-inflation cooling` at later N 11. This is a lead for renewed research, not certainty.
- The reaction label and trade outcome answer different questions. The old GBPUSD labor-claims example could follow the arrow initially, give back the move, and still finish at the stop.

## Where the original evidence lives

### Smallest useful preservation set

1. **This file** — human-readable identity, contract, later result, and experiment map.
2. `Main/mt5-bridge/registered_reaction_profiles.json` — all 51 later reaction/path profiles and their experiment IDs. Current size is about 2.97 MB. SHA-256 at the time of this summary: `521850E417EB7DCA0CA9B94A1A2A10ED2E66C476F0DFC19A0547E8A5100CC2A9`.
3. `%LOCALAPPDATA%/Fyodor Trading Terminal/fyodor-research.sqlite3` — the immutable experiment configurations/results and qualification audits. It is about 23.3 GB because it contains much more than these 51 setups. Do not delete it until the 51 referenced experiment rows and their required event/candle provenance have been deliberately exported.
4. `Main/mt5-bridge/macro_signal.py` — the old scoring, pair orientation, ATR, entry, outcome, ambiguity, partition, and research calculations.
5. `docs/Development Logs/Fyodor Macro Signal Research.md` — the human research narrative, especially **Registered Reaction v4 Implementation Result - 2026-08-29**.

### Why the giant `server.py` is not the clean source to copy

The old runtime declarations live in `PRACTICAL_PATTERN_DEFINITIONS` inside `Main/mt5-bridge/server.py`. That file mixed registry declarations with API routes, storage, scheduling, presentation, and several later overlays. It also gained a SQLite reconciliation layer for corrected experiment provenance. Copying the whole file would carry the architectural tangle into the new app.

For a clean rebuild, use the 51 exact keys and experiment IDs above as the index, export only those immutable experiment records, and write a small versioned data manifest. Reimplement the calculation from a separately reviewed specification; do not transplant the old server wholesale.

## What must remain immutable if v1 is rebuilt

For every historical arrow, preserve together:

- market and exact event/package membership;
- score policy and pair-orientation version;
- continuation or rejection mapping;
- direction and magnitude cohort filters;
- entry boundary;
- ATR known at entry;
- stop, target, and expiry;
- ambiguous/missing-data state;
- experiment ID, configuration hash, and dataset fingerprint;
- the contract version active at that event time.

Changing any one of those creates a new version. It must not rewrite an old v1 arrow.

## What should be researched again for a clean FMS

The old 51 should seed hypotheses, not dictate the new catalogue. The cleaner objective is the one the owner stated later:

> For each event family and affected pair, measure whether price follows or rejects the objective release information, how often it does so, how far it moves, how quickly it moves, and how often each declared TP is reached before each declared SL.

That new work should report separately:

1. economic-score correctness;
2. direction-respect rate at fixed horizons;
3. MFE, MAE, and time-to-threshold distributions;
4. TP-before-SL rates for TP1, TP2, TP3, and other predeclared levels;
5. expiry outcomes;
6. uncertainty, sample size, year coverage, and concentration;
7. gross results versus later measured live costs.

The most important lesson from v1 is that those measurements must stay separate. Combining them into one headline created much of the confusion around what a “registered setup” actually proved.
