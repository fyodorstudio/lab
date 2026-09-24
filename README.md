# Macroeconomic Post-Release Quantitative Workstation

> **Current research priority (2026-09-24):** Discover and validate a small number of defensible FMS setups for *demo* forward testing, with no guaranteed edge. Start at the [FMS research roadmap](docs/FMS_RESEARCH_ROADMAP.md) and [documentation map](docs/README.md). The timestamp-only [eligibility inventory](lab/research/FMS_ELIGIBILITY_INVENTORY.md) is complete; it is not a profitability result. The H1 workstation described below is existing software and historical Phase 1 context, **not** an approved trading strategy. Some old counts and roadmap language below predate the latest inventory; follow the linked generated report for current counts.

A macroeconomic quantitative research workstation for investigating post-release FX market reaction dynamics across 1–42 H1 trading horizons following scheduled economic events. See [`CODEX_QUANT_AUDIT.md`](docs/CODEX_QUANT_AUDIT.md) before drawing research conclusions.

---

## 1. Overview & Architecture

This workstation correlates macroeconomic news release outcomes (Actual vs. Forecast and Actual vs. Previous) with physical H1 forex candle price action, enabling empirical exploration of market reaction paths without lookahead bias or fabricated data.

### Repository Layout

```
GEMINI/                           <- Root Repository Directory (C:\dev\Fyodor Math Lab\GEMINI)
├── package.json                  <- Root scripts forwarding to lab/
├── .gitignore                    <- Git exclusion for build artifacts and dependencies
├── README.md                     <- Master architectural and methodology documentation
├── raw_data/                     <- [STRICT READ-ONLY] Legacy empirical source data/fallback
│   ├── economic calendar/        <- Legacy repaired master historical calendar CSV
│   ├── fyodor_candles/           <- Legacy FX instrument H1 candle CSV files
│   └── research paper / ...      <- Academic and empirical reference materials
├── tools/mt5/                    <- Versioned MT5 exporter source and v3.1 export snapshots
│
└── lab/                          <- Quantitative Research Engine & Web UI
    ├── package.json              <- Lab dependencies (concurrently, express, vite, vitest, etc.)
    ├── tsconfig.json             <- TypeScript compilation configuration
    ├── vitest.config.ts          <- Automated test configuration
    ├── src/
    │   ├── shared/               <- Data models, types, constants, and math utilities
    │   ├── data/                 <- CSV streaming parsers, candle indexers, pair discovery
    │   ├── analytics/            <- Scorer, alignment engine, statistics & 5x5 matrix
    │   ├── server/               <- Express REST API routes, CSV/JSON exporters
    │   └── cli/                  <- Data ingestion and forensic audit CLI
    ├── tests/                    <- Vitest unit and integration test suite (run npm test for current count)
    └── web/                      <- Reactive Research Dashboard (React, Tailwind, Lucide)
        ├── src/
        │   ├── components/       <- H1–H42 path charts, 5x5 matrix, distribution tables
        │   └── views/            <- Pattern Explorer, Event Table, Inspector, Overview, Audit
        └── index.html            <- Light/Dark mode anti-flicker theme bootstrap
```

---

## 2. Quickstart & Execution

The workstation uses `concurrently` to launch both the backend analytics server and the Vite web client concurrently with a single command.

### Installation

From the repository root (`C:\dev\Fyodor Math Lab\GEMINI`):
```bash
cd lab
npm install
npm run install:all # installs root and web client dependencies
```

### Running Development Server

To start both the API server (port 3000) and web workstation (port 5173) simultaneously:
```bash
npm run dev
```
*(Or run `npm run dev` directly from the GEMINI root)*

Open your browser to:
```
http://localhost:5173
```

### Running Tests

```bash
npm test
```
Executes the current automated suite covering:
- Empirical percentile rank calculations and sorting logic
- Post-release candle alignment and zero lookahead enforcement
- Currency quotation direction normalization ($Q = +1$ vs $Q = -1$)
- Numerical token cleaning (handling `%`, `K`, `M`, revisions)
- Simultaneous event cluster detection
- 5x5 Surprise vs. Momentum classification matrices
- Percentile transparency and step-by-step mathematical audit breakdowns

### Production Build

```bash
npm run build
```
Compiles TypeScript server to `lab/dist/` and bundles web assets to `lab/web/dist/`.

---

## 3. Mathematical Methodology & Data Integrity

### 10-Family Macroeconomic Taxonomy
Every economic calendar release is classified into one of 10 structured families:
1. `Inflation` (CPI, PPI, PCE, Import/Export Prices)
2. `Employment` (Nonfarm Payrolls, Unemployment Rate, Jobless Claims, ADP)
3. `Central Bank` (Interest Rate Decisions, FOMC Minutes, Press Conferences)
4. `Growth / GDP` (Quarterly & Annual GDP, GDP Deflator)
5. `Retail / Consumption` (Retail Sales, Consumer Spending, Personal Income)
6. `Business Sentiment / PMI` (Manufacturing PMI, Services PMI, ISM)
7. `Housing` (Building Permits, Housing Starts, Existing/New Home Sales)
8. `Trade / External` (Trade Balance, Current Account)
9. `Leading / Other Indicators` (Consumer Confidence, Michigan Sentiment)
10. `Other` (Unclassified releases)

### Strict Dynamic Currency Normalization
To prevent inverse-reaction distortion, price movement is normalized based on the release currency's position in the traded instrument pair:
- **Base Currency Position** ($Q = +1$): e.g., USD in `USDJPY`. A price increase indicates USD appreciation.
- **Quote Currency Position** ($Q = -1$): e.g., USD in `EURUSD`. A price decrease indicates USD appreciation.

For event currency in the pair base position:
$$r_h = \frac{P_h}{P_0} - 1$$
For event currency in the quote position:
$$r_h = \frac{P_0}{P_h} - 1$$
The separately preserved symmetric log return is $Q\ln(P_h/P_0)$.

Where:
- $P_0$: Open of the first complete H1 bar beginning at or after the release timestamp.
- $\text{Close}_h$: Closing price of the $h$-th trading bar following $P_0$ ($h \in [1, 42]$).

### Descriptive Positive Direction Rate
The system calculates the **Positive Direction Rate %**:
$$\text{Positive Direction Rate}_h = \frac{|\{i : \text{normalizedReturn}_{i, h} > 0\}|}{N}$$
> [!NOTE]
> This is a purely descriptive measure of directional response and event currency strengthening. It is **not** a trading win rate and does not account for bid/ask spread, slippage, or holding fees.

---

## 4. Percentile Transparency & Auditable Scoring

To ensure complete mathematical audibility, scoring is fully transparent and derived from real disk data:

### Empirical Percentile Rank
For any release with absolute delta $\delta = |A - F|$, its empirical percentile rank within the historical distribution of non-zero deltas is:
$$\text{Percentile Rank} = \frac{|\{v \in \text{historicalNonzeroDeltas} : v < \delta\}|}{N} \times 100$$

Threshold quantiles use Hyndman–Fan type 7 linear interpolation: index $(N-1)p$.

### Numerical Threshold Table (P50–P95)
Displayed directly alongside delta distribution histograms:
- Shows the actual numerical values behind P50, P60, P70, P75, P80, P85, P90, and P95.
- Uses the event's original native units (`%`, `K`, `M`, index points).
- Clearly highlights the active classification boundary (default $P_{75}$).

### 5×5 Reaction Scoring System
Releases are independently scored on two dimensions:
- **Surprise Score ($S$)**: Actual vs. Forecast ($A - F$)
- **Momentum Score ($M$)**: Actual vs. Previous ($A - P$)

| Score | Meaning | Mathematical Condition |
| :---: | :--- | :--- |
| **+3** | Large Positive | $\Delta > 0$ and $|\Delta| > \text{Threshold}_{P75}$ |
| **+2** | Moderate Positive | $\Delta > 0$ and $|\Delta| \le \text{Threshold}_{P75}$ |
| **+1** | In-Line / Equal | $\Delta = 0$ (within numerical tolerance $10^{-6}$) |
| **-2** | Moderate Negative | $\Delta < 0$ and $|\Delta| \le \text{Threshold}_{P75}$ |
| **-3** | Large Negative | $\Delta < 0$ and $|\Delta| > \text{Threshold}_{P75}$ |

### Raw Event Inspector
Provides a step-by-step mathematical breakdown for every historical event release:
1. Inputs: Actual ($A$), Forecast ($F$), Previous ($P$).
2. Signed & Absolute Deltas with original units.
3. Historical distribution sample size $N$ and $P_{50} \dots P_{95}$ reference thresholds.
4. Observation's exact empirical percentile rank (e.g. `P96.4`).
5. Formal mathematical justification for the assigned categorical score.

---

## 5. UI Features & User Experience

- **Light & Dark Mode Compatibility**: Full theme support toggled seamlessly via the Theme button immediately adjacent to the Export button in the top navigation bar. System preference detection and persistent preference in `localStorage`.
- **Interactive H1–H42 Horizon Chart**: Interactive SVG curve supporting Median, Mean, and P10–P90 confidence band overlays, individual event path inspection, and non-destructive visual P5–P95 outlier clamping.
- **Export Modal**: Download raw observation records, aggregate horizon statistics, distribution histogram bins, or 5×5 score matrices in CSV or structured JSON.
- **Forensic Research Health Panel**: Real-time sample health indicators displaying complete A/F/P counts, missing value exclusions, simultaneous release clusters, and weekend crossing warnings.

---

## 6. Anti-Hallucination & Data Integrity Covenant

This application operates under a strict anti-hallucination covenant:
- **Zero Mock Data**: Never substitutes synthetic, randomized, or mock numbers for raw calendar observations.
- **Scoped Lookahead Control**: Walk-forward percentile classification uses only observations with earlier timestamps. This does not by itself remove every possible backtest bias.
- **Timestamp Convention**: Calendar and candle integers are treated as broker trade-server wall-clock values, not silently converted to UTC.
- **Source Selection**: `FYODOR_EXPORT_ROOT` may select an explicit complete v3.1 export; otherwise the newest complete v3.1 export is used, with `raw_data/` as a legacy fallback.
- **Timestamp Provenance**: V3.1 records broker/server identity and the snapshot server-minus-GMT offset; historical DST conversion is deliberately not inferred.
- **Physical Reproducibility**: Every metric is reproducible from the selected manifested export (or the documented legacy fallback).
- **Non-Destructive Outlier Handling**: Statistical distributions preserve 100% of historical samples without silent clipping or truncation.
