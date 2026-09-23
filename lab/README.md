# Macroeconomic News & FX H1 Post-Release Research Workstation

A high-performance quantitative research workstation built in TypeScript to investigate how major FX currencies behave after scheduled macroeconomic announcements across **1 to 42 H1 trading bars**.

---

## 1. What the Application Does

The workstation answers the central empirical research question:
> *"When a specific economic event produces a specific Actual-vs-Forecast ($S_{\text{delta}}$) and Actual-vs-Previous ($M_{\text{delta}}$) result, how does the affected currency tend to behave over the following 1–42 H1 trading bars?"*

Key Capabilities:
- **Descriptive & Forensic**: 100% reproducible from verified raw files on disk. Zero synthetic data, zero outcome faking, zero lookahead bias.
- **Relative Magnitude Scoring**: Evaluates surprise and momentum deltas against the historical distribution of the exact event using empirical percentiles (e.g., P75).
- **Contamination-Free H1 Alignment**: Anchors price measurement at $P_0$ (the open of the first complete H1 candle beginning at or after announcement timestamp), preventing pre-announcement contamination.
- **Directional Normalization**: Multiplies returns by $Q = +1$ (base) or $Q = -1$ (quote) so positive normalized returns always signify currency appreciation.
- **Trading Bar Counting**: Gaps over weekends are accurately skipped in bar sequences while flagging weekend crossing for sample hygiene.
- **Simultaneous Release Detection**: Identifies clustered announcements (e.g. Core PCE + Personal Income + Spending) to prevent erroneous attribution.

---

## 2. Architecture

```text
lab/
├── package.json               # Root scripts (ingest, test, build, dev, start)
├── tsconfig.json              # TypeScript ESM configuration
├── generated-cache/           # Pre-indexed metadata (gitignored)
├── exports/                   # Target folder for CSV / JSON exports
├── src/
│   ├── shared/
│   │   ├── types.ts           # Shared TypeScript interfaces (EventObservation, Scores, Stats)
│   │   ├── constants.ts       # Currencies, Families, Percentiles, Disclosures
│   │   └── utils.ts           # Empirical quantiles, mean, median, histogram binning
│   ├── data/
│   │   ├── numericParser.ts   # Robust parser for %, K, M, B, commas, negatives, zeros
│   │   ├── csvReader.ts       # Streaming CSV line parser handling quotes and commas
│   │   ├── calendarLoader.ts  # Ingestion and cataloging of 126,469 calendar records
│   │   ├── candleLoader.ts    # Binary search indexing for 1.55M H1 candle bars
│   │   ├── pairDiscovery.ts   # Auto-discovery of 51 FX pairs & base/quote mapping
│   │   └── cacheManager.ts    # Disk cache serializer
│   ├── analytics/
│   │   ├── eventScorer.ts     # Magnitude percentile & delta scoring engine (-3..+3)
│   │   ├── eventAligner.ts    # P0 candle anchor & H1..H42 sequencing
│   │   ├── statisticsEngine.ts# Mean, Median, Quantiles, Positive Direction Rate, 5x5 Matrix
│   │   ├── familyClassifier.ts# 10 Macroeconomic family classifications
│   │   ├── simultaneousDetector.ts # Same currency/timestamp clustering
│   │   └── analyticsService.ts# IAnalyticsService interface implementation
│   ├── server/
│   │   ├── routes.ts          # Express REST API endpoints
│   │   └── server.ts          # Backend HTTP server and static file provider
│   └── cli/
│       └── ingest.ts          # Fast indexer CLI command (`npm run ingest`)
├── web/                       # Desktop React + Vite + Tailwind Research UI
│   ├── src/
│   │   ├── components/        # Charts (H1-H42, Positive Rate, Histograms, 5x5 Matrix)
│   │   ├── views/             # Pattern Explorer, Event Explorer, Inspector, Overview, Quality
│   │   └── api/apiClient.ts   # Type-safe client for backend
└── tests/                     # Comprehensive Vitest automated test suite
```

---

## 3. Installation & Getting Started

### Prerequisites
- Node.js v20+
- npm v10+

### Step 1: Install Dependencies
```bash
cd lab
npm install
npm install --prefix web
```

### Step 2: Build the Raw Data Index
Parses `raw_data/economic calendar/` and `raw_data/fyodor_candles/` and builds the fast-lookup index in `lab/generated-cache/`:
```bash
npm run ingest
```
*(Ingestion indexes 126,469 calendar records and 1,548,208 H1 candles in ~3.8 seconds).*

### Step 3: Run Automated Tests
```bash
npm test
```
Runs 33 unit and end-to-end integration tests with deterministic fixtures and real raw data audits.

### Step 4: Run Development Mode
To run the backend server and Vite dev server:
```bash
# Terminal 1: Backend server
npm run dev

# Terminal 2: Frontend dev server
npm run dev:web
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### Step 5: Production Build & Run
```bash
npm run build
npm start
```
Open [http://localhost:3000](http://localhost:3000).

---

## 4. Methodological Formulations

### 4.1 Scoring Formula
For every economic release:
- $A$ = Actual release value
- $F$ = Consensus forecast value
- $P$ = Previous historical value (preserved separately from `revised_previous`)

$$S_{\text{delta}} = A - F$$
$$M_{\text{delta}} = A - P$$

*Note: Sign describes mathematical relation only, not directional market sentiment.*

### 4.2 Relative Magnitude Percentile Classification
Deltas across different indicators (e.g. Nonfarm Payrolls vs CPI) cannot share universal thresholds. Magnitude is calculated against the historical distribution of the **exact selected event**:
- Surprise magnitude: $|A - F|$
- Momentum magnitude: $|A - P|$

Threshold $P_{\text{thresh}}$ is determined from **nonzero** absolute deltas (default: **75th percentile**).

**Allowed Scores**:
$$\text{EventScore} \in \{-3, -2, 1, 2, 3, \text{null}\}$$

- Neutral / Equal:
  - If $A = F \implies \text{Surprise Score} = +1$
  - If $A = P \implies \text{Momentum Score} = +1$
- Nonzero Deltas:
  - $A > \text{comparison}$ and $|\Delta| \le P_{\text{thresh}} \implies +2$ (Positive Medium)
  - $A > \text{comparison}$ and $|\Delta| > P_{\text{thresh}} \implies +3$ (Positive Large)
  - $A < \text{comparison}$ and $|\Delta| \le P_{\text{thresh}} \implies -2$ (Negative Medium)
  - $A < \text{comparison}$ and $|\Delta| > P_{\text{thresh}} \implies -3$ (Negative Large)

### 4.3 Missing Value Rule
A release is scored **only** when $A, F,$ and $P$ all exist as finite numbers.
If any value is missing or invalid:
$$\text{surpriseScore} = \text{null}, \quad \text{momentumScore} = \text{null}$$
*(Zero is preserved as legitimate numeric 0 and is never treated as missing).*

### 4.4 H1 Candle Alignment Rule
$P_0$ is defined as the **OPEN** of the first complete H1 candle beginning **at or after** the announcement timestamp:
- 13:30 release $\implies P_0 = \text{14:00 open}$
- 13:01 release $\implies P_0 = \text{14:00 open}$
- 14:00 release $\implies P_0 = \text{14:00 open}$
- 14:00:01 release $\implies P_0 = \text{15:00 open}$

This eliminates pre-announcement drift contamination and ensures all post-release returns represent strictly post-news trading bars.

### 4.5 Currency Normalization
- $Q_{\text{base}} = +1$
- $Q_{\text{quote}} = -1$

$$\text{rawPairReturn}_h = \frac{P_h}{P_0} - 1$$
$$\text{normalizedReturn}_h = Q \times \text{rawPairReturn}_h$$

Where $P_h$ is the close of the $h$-th post-event H1 bar ($h \in [1, 42]$).
- Positive normalized return $\implies$ Event currency strengthened.
- Negative normalized return $\implies$ Event currency weakened.

### 4.6 Trading Bar Sequencing & Weekend Handling
- Sequences count **available trading bars**. Empty weekend hours (Saturday/Sunday) are skipped.
- Paths crossing a market weekend gap (> 3600s between bars) are flagged (`crossesWeekend: true`), enabling dedicated filtering.
- Friday releases are flagged (`isFridayRelease: true`).

### 4.7 Simultaneous Release Detection
Multiple releases occurring for the same currency at the same timestamp are detected and clustered. The workstation flags simultaneous counts (up to 24 concurrent announcements) and provides isolation filters (`All`, `Isolated Only`, `Simultaneous Only`).

### 4.8 Positive Direction Rate
$$\text{Positive Direction Rate} = \frac{\operatorname{count}(\text{normalizedReturn} > 0)}{\operatorname{count}(\text{valid normalizedReturn})}$$
*(Descriptive metric; not a trading win rate).*

---

## 5. Research Limitations Disclosed in UI

1. **H1 Granularity**: H1 data cannot measure the immediate intrahour announcement spike (first seconds/minutes).
2. **P0 Anchor**: $P_0$ starts at the first complete H1 bar at/after announcement.
3. **Mathematical Signs**: $+3$ or $-3$ reflect mathematical deviations from forecasts, not economic bullishness or trading advice.
4. **Attribution Confounding**: Clustered simultaneous releases can confound price reaction attribution.
5. **Retrospective Sample Warning**: Thresholds calculated across the historical sample are descriptive and not lookahead-safe trading backtests.
6. **No Profitability Claims**: Historical price distributions do not guarantee future market behavior.

---

## 6. Future Python Integration Contract

The service boundary is strictly decoupled from the UI via the `IAnalyticsService` interface:
```typescript
interface IAnalyticsService {
  getOverview(): Promise<OverviewMetrics>;
  getCurrencies(): Promise<string[]>;
  getEvents(currency: string, family?: string): Promise<EventListItem[]>;
  getPairs(currency: string): Promise<FXPairInfo[]>;
  getDistribution(currency: string, eventName: string, percentile?: number): Promise<DistributionResponse>;
  getPattern(query: PatternQueryFilters): Promise<PatternResponse>;
  getObservations(query: PatternQueryFilters, page?: number, pageSize?: number): Promise<PagedObservations>;
  getRawEventInspection(eventId: string, valueId: string, pair: string, percentile?: number): Promise<AuditDetails>;
  getFamilyComparison(currency: string, pair?: string): Promise<FamilyComparisonRow[]>;
  getDataQuality(): Promise<DataQualityAudit>;
}
```
A future Python FastAPI / Flask microservice implementing this same JSON contract can provide:
- High-order econometrics
- HAC / Newey-West standard errors
- Bootstrap confidence intervals
- Vector autoregression (VAR)
- Machine learning feature attribution
without changing a single line of React frontend code.
