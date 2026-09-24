import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import readline from 'readline';
import {
  SPLIT_TIMESTAMP,
  SPLIT_DATE_STRING,
  EXPECTED_CALENDAR_SHA256,
  EXPECTED_SCHEMA_VERSION,
  EXPECTED_SOURCE_FOLDER,
  CANDIDATE_HOLDING_HORIZONS,
  REQUIRED_PRE_ENTRY_H4_PERIODS,
  CandidateHoldingHorizon,
  MacroFamily,
  SourceManifestVerification,
  CalendarReleaseRecord,
  SimultaneousPackage,
  ExactSeriesInventory,
  H4BlockStatus,
  HoldingHorizonAudit,
  EntryBoundaryStatus,
  EpisodePairCoverage,
  EpisodeCoverageSummary,
  PairIntegritySummary,
  PairHorizonAggregate,
  NumericDistribution,
  HorizonOverlapAudit,
  FmsInventoryResult,
} from './fmsInventoryTypes.js';

/**
 * Computes SHA-256 hash of a file on disk deterministically.
 */
export async function computeSha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', (err) => reject(err));
  });
}

/**
 * Normalizes event name (trims, removes redundant spaces, normalizes quotes)
 */
export function normalizeEventName(eventName: string): string {
  if (!eventName) return '';
  return eventName.trim().replace(/\s+/g, ' ');
}

/**
 * Non-claiming macro-family taxonomy rules.
 * Ambiguous or unclassified events strictly receive 'Unclassified'.
 */
const MACRO_FAMILY_RULES: Array<{ family: MacroFamily; keywords: string[] }> = [
  {
    family: 'Central Bank / Rates',
    keywords: [
      'interest rate',
      'fomc',
      'monetary policy',
      'rate statement',
      'rate decision',
      'bank rate',
      'discount rate',
      'repo rate',
      'target rate',
      'cash rate',
      'reserve ratio',
      'central bank',
      'ecb press conference',
      'fed interest rate',
      'fed speech',
      'mpc rate',
    ],
  },
  {
    family: 'Inflation',
    keywords: [
      'cpi',
      'hicp',
      'ppi',
      'pce',
      'price index',
      'inflation',
      'deflator',
      'cost of living',
      'import price',
      'export price',
    ],
  },
  {
    family: 'Labor / Employment',
    keywords: [
      'nonfarm',
      'payroll',
      'unemployment',
      'employment',
      'jobless',
      'adp',
      'job openings',
      'jolts',
      'wages',
      'earnings',
      'labor',
      'labour',
      'claimant',
      'participation rate',
      'layoffs',
      'workforce',
    ],
  },
  {
    family: 'National Accounts / Growth',
    keywords: ['gdp', 'gnp', 'gross domestic', 'economic growth', 'gross national'],
  },
  {
    family: 'Business Surveys / PMI',
    keywords: [
      'pmi',
      'ism',
      'ifo',
      'zew',
      'cbi',
      'sentiment',
      'empire state',
      'philly fed',
      'philadelphia fed',
      'michigan',
      'business climate',
      'kansas fed',
      'richmond fed',
      'dallas fed',
      'leading index',
      'tankan',
      'svme',
    ],
  },
  {
    family: 'Consumer / Retail',
    keywords: [
      'retail sales',
      'consumer confidence',
      'consumer spending',
      'personal spending',
      'household spending',
      'auto sales',
      'vehicle sales',
      'redbook',
    ],
  },
  {
    family: 'Production / Activity',
    keywords: [
      'industrial production',
      'factory orders',
      'manufacturing production',
      'capacity utilization',
      'durable goods',
      'capital expenditure',
      'machine tool',
      'mining production',
      'industrial output',
    ],
  },
  {
    family: 'Housing / Construction',
    keywords: [
      'housing',
      'building permits',
      'home sales',
      'mortgage',
      'house price',
      'construction',
      'nahb',
      'case-shiller',
      'new home',
      'existing home',
      'pending home',
    ],
  },
  {
    family: 'International Trade',
    keywords: [
      'trade balance',
      'current account',
      'exports',
      'imports',
      'merchandise trade',
      'terms of trade',
      'trade deficit',
      'trade surplus',
    ],
  },
  {
    family: 'Government / Fiscal',
    keywords: ['budget balance', 'treasury budget', 'fiscal balance', 'government budget'],
  },
];

export function classifyMacroFamily(eventName: string): MacroFamily {
  if (!eventName) return 'Unclassified';
  const lower = eventName.toLowerCase();
  for (const rule of MACRO_FAMILY_RULES) {
    for (const kw of rule.keywords) {
      if (lower.includes(kw)) {
        return rule.family;
      }
    }
  }
  return 'Unclassified';
}

/**
 * Calculates the strictly later H4 boundary timestamp.
 * In broker trade-server time, H4 boundaries start at midnight (00:00:00)
 * and advance by 14,400 seconds (4 hours).
 * For any release timestamp T:
 * entry = floor(T / 14400) * 14400 + 14400
 * This ensures entry is strictly later than T (entry > T).
 */
export function calculateNextH4Boundary(releaseTimestamp: number): number {
  return Math.floor(releaseTimestamp / 14400) * 14400 + 14400;
}

/**
 * Evaluates the status of an H4 block starting at `startTs` (multiple of 14400).
 * It expects four contiguous H1 candle timestamps:
 * t0 = startTs
 * t1 = startTs + 3600
 * t2 = startTs + 7200
 * t3 = startTs + 10800
 */
export function getH4BlockStatus(startTs: number, timestampSet: Set<number>): H4BlockStatus {
  const has0 = timestampSet.has(startTs);
  const has1 = timestampSet.has(startTs + 3600);
  const has2 = timestampSet.has(startTs + 7200);
  const has3 = timestampSet.has(startTs + 10800);
  const count = (has0 ? 1 : 0) + (has1 ? 1 : 0) + (has2 ? 1 : 0) + (has3 ? 1 : 0);

  if (count === 4) {
    return 'COMPLETE';
  }

  if (count === 0) {
    // Check if the 4-hour window falls entirely within Saturday or Sunday
    let isWeekend = true;
    for (let t = startTs; t < startTs + 14400; t += 3600) {
      const day = new Date(t * 1000).getUTCDay();
      if (day !== 0 && day !== 6) {
        isWeekend = false;
        break;
      }
    }
    return isWeekend ? 'WEEKEND_CLOSURE' : 'WEEKDAY_GAP';
  }

  return 'INCOMPLETE_MISSING_H1_BARS';
}

export type GapClassification = 'PURE_WEEKEND' | 'WEEKDAY_OR_MIXED';

/**
 * Classifies a missing interval between two consecutive H1 candle timestamps.
 * A gap is a pure weekend closure only if ALL missing hours are Saturday/Sunday broker-clock hours.
 * If it contains any missing weekday hour (Monday–Friday), it is classified as WEEKDAY_OR_MIXED.
 */
export function classifyGap(
  prevTs: number,
  nextTs: number
): {
  classification: GapClassification;
  gapHours: number;
  missingHours: number;
} {
  const gapHours = (nextTs - prevTs) / 3600;
  if (gapHours <= 1) {
    throw new Error(`classifyGap called with non-gap timestamps: ${prevTs} to ${nextTs}`);
  }
  const missingHours = gapHours - 1;

  let allWeekend = true;
  for (let t = prevTs + 3600; t < nextTs; t += 3600) {
    const day = new Date(t * 1000).getUTCDay();
    if (day !== 0 && day !== 6) {
      allWeekend = false;
      break;
    }
  }

  return {
    classification: allWeekend ? 'PURE_WEEKEND' : 'WEEKDAY_OR_MIXED',
    gapHours,
    missingHours,
  };
}

/**
 * Reads ONLY the timestamp column from an MT5 H1 candle CSV.
 * Strictly avoids reading, parsing, or storing OHLC prices, volume, or spread.
 */
export async function loadCandleTimestampsOnly(filePath: string): Promise<number[]> {
  const times: number[] = [];
  const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let isHeader = true;
  for await (const line of rl) {
    if (isHeader) {
      isHeader = false;
      continue;
    }
    if (!line.trim()) continue;

    const commaIdx = line.indexOf(',');
    const tsStr = commaIdx === -1 ? line : line.slice(0, commaIdx);
    const ts = parseInt(tsStr, 10);
    if (Number.isFinite(ts) && ts > 0) {
      times.push(ts);
    }
  }

  return times;
}

/**
 * Currency to relevant FX pairs map based on exported symbols.
 */
export const CURRENCY_RELEVANT_PAIRS_MAP: Record<string, string[]> = {
  USD: [
    'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'NZDUSD', 'USDCAD',
    'USDSEK', 'USDSGD', 'USDHKD', 'USDNOK', 'USDPLN', 'USDHUF', 'USDTRY',
    'USDDKK', 'USDCZK', 'USDCNH', 'USDMXN', 'USDZAR',
  ],
  EUR: [
    'EURUSD', 'EURGBP', 'EURJPY', 'EURCHF', 'EURAUD', 'EURCAD', 'EURNZD',
    'EURSEK', 'EURNOK', 'EURTRY', 'EURPLN', 'EURHUF', 'EURMXN', 'EURZAR', 'EURHKD',
  ],
  GBP: [
    'GBPUSD', 'EURGBP', 'GBPJPY', 'GBPCHF', 'GBPAUD', 'GBPCAD', 'GBPNZD',
    'GBPMXN', 'GBPZAR',
  ],
  JPY: [
    'USDJPY', 'EURJPY', 'GBPJPY', 'AUDJPY', 'CADJPY', 'CHFJPY', 'NZDJPY', 'SGDJPY',
  ],
  AUD: [
    'AUDUSD', 'EURAUD', 'GBPAUD', 'AUDJPY', 'AUDCAD', 'AUDCHF', 'AUDNZD',
  ],
  CAD: [
    'USDCAD', 'EURCAD', 'GBPCAD', 'AUDCAD', 'NZDCAD', 'CADJPY', 'CADCHF',
  ],
  CHF: [
    'USDCHF', 'EURCHF', 'GBPCHF', 'AUDCHF', 'NZDCHF', 'CADCHF', 'CHFJPY',
  ],
  NZD: [
    'NZDUSD', 'EURNZD', 'GBPNZD', 'AUDNZD', 'NZDCAD', 'NZDCHF', 'NZDJPY',
  ],
};

/**
 * Returns pair's other currency given one currency.
 */
export function getPairCounterCurrency(pair: string, currency: string): string {
  const currUpper = currency.toUpperCase();
  const pairUpper = pair.toUpperCase();
  if (pairUpper.startsWith(currUpper)) {
    return pairUpper.slice(currUpper.length);
  }
  if (pairUpper.endsWith(currUpper)) {
    return pairUpper.slice(0, pairUpper.length - currUpper.length);
  }
  return '';
}

/**
 * Builds precomputed H4 status grid for a pair.
 */
export function buildH4Grid(
  timeSet: Set<number>,
  startTs: number = 1420070400, // 2015-01-01 00:00:00
  endTs: number = SPLIT_TIMESTAMP
): Map<number, H4BlockStatus> {
  const grid = new Map<number, H4BlockStatus>();
  for (let b = startTs; b < endTs; b += 14400) {
    grid.set(b, getH4BlockStatus(b, timeSet));
  }
  return grid;
}

/**
 * Evaluates pre-entry coverage (14 completed H4 periods).
 */
export function evaluatePreEntry(
  tEntry: number,
  h4Grid: Map<number, H4BlockStatus>,
  earliestBarTs: number
): {
  status: EntryBoundaryStatus;
  completedCount: number;
  has14: boolean;
  preEntryReason: 'CLEAN_14' | 'MISSING_HISTORY' | 'WEEKDAY_GAP' | 'MISSING_H1_BARS';
  crossesWeekdayGap: boolean;
  hasMissingBars: boolean;
} {
  if (tEntry < earliestBarTs) {
    return {
      status: 'MISSING_HISTORY',
      completedCount: 0,
      has14: false,
      preEntryReason: 'MISSING_HISTORY',
      crossesWeekdayGap: false,
      hasMissingBars: false,
    };
  }

  const entryBlockStatus = h4Grid.get(tEntry) ?? 'MISSING_HISTORY';
  let status: EntryBoundaryStatus;
  if (entryBlockStatus === 'COMPLETE') {
    status = 'OPEN_MARKET';
  } else if (entryBlockStatus === 'WEEKEND_CLOSURE') {
    status = 'WEEKEND_BLOCKED';
  } else if (entryBlockStatus === 'WEEKDAY_GAP' || entryBlockStatus === 'INCOMPLETE_MISSING_H1_BARS') {
    status = 'WEEKDAY_GAP';
  } else {
    status = 'MISSING_HISTORY';
  }

  let completedCount = 0;
  let b = tEntry - 14400;
  let crossesWeekdayGap = false;
  let hasMissingBars = false;

  while (completedCount < REQUIRED_PRE_ENTRY_H4_PERIODS) {
    if (b < earliestBarTs) {
      break;
    }
    const st = h4Grid.get(b);
    if (!st) {
      break;
    }

    if (st === 'COMPLETE') {
      completedCount++;
      b -= 14400;
    } else if (st === 'WEEKEND_CLOSURE') {
      b -= 14400; // skip weekend closure
    } else if (st === 'WEEKDAY_GAP') {
      crossesWeekdayGap = true;
      break; // fail closed
    } else if (st === 'INCOMPLETE_MISSING_H1_BARS') {
      hasMissingBars = true;
      break; // fail closed
    }
  }

  let preEntryReason: 'CLEAN_14' | 'MISSING_HISTORY' | 'WEEKDAY_GAP' | 'MISSING_H1_BARS';
  if (completedCount >= REQUIRED_PRE_ENTRY_H4_PERIODS && !crossesWeekdayGap && !hasMissingBars) {
    preEntryReason = 'CLEAN_14';
  } else if (crossesWeekdayGap) {
    preEntryReason = 'WEEKDAY_GAP';
  } else if (hasMissingBars) {
    preEntryReason = 'MISSING_H1_BARS';
  } else {
    preEntryReason = 'MISSING_HISTORY';
  }

  const has14 = preEntryReason === 'CLEAN_14';

  return {
    status,
    completedCount,
    has14,
    preEntryReason,
    crossesWeekdayGap,
    hasMissingBars,
  };
}

export function findFirstIndexGreaterThan(arr: number[], target: number): number {
  let low = 0;
  let high = arr.length - 1;
  let ans = arr.length;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (arr[mid] > target) {
      ans = mid;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }
  return ans;
}

export function computeDistribution(values: number[]): NumericDistribution {
  if (values.length === 0) {
    return { median: 0, mean: 0, min: 0, max: 0, p25: 0, p75: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const mean = sum / n;
  const min = sorted[0];
  const max = sorted[n - 1];

  const quantile = (p: number): number => {
    if (n === 1) return sorted[0];
    const index = (n - 1) * p;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    return sorted[lower] + weight * (sorted[upper] - sorted[lower]);
  };

  return {
    median: quantile(0.5),
    mean,
    min,
    max,
    p25: quantile(0.25),
    p75: quantile(0.75),
  };
}

/**
 * Evaluates candidate holding horizon (6, 12, 30, 42, 60 H4 periods).
 * Uses strictly the pair's base and quote currencies, never a generic multi-currency package index.
 */
export function evaluateHoldingHorizon(
  tEntry: number,
  horizonH4: CandidateHoldingHorizon,
  h4Grid: Map<number, H4BlockStatus>,
  latestBarTs: number,
  pre2023ReleasesByTimestamp: Map<number, CalendarReleaseRecord[]>,
  pairBaseCurrency: string,
  pairQuoteCurrency: string,
  sortedReleaseTimestamps?: number[]
): HoldingHorizonAudit {
  let completedCount = 0;
  let b = tEntry;
  let crossesWeekend = false;
  let crossesWeekdayGap = false;
  let hasMissingH1Bars = false;
  let crosses2023Boundary = false;
  let exitTimestamp: number | null = null;

  while (completedCount < horizonH4) {
    // Check if the current H4 block extends beyond SPLIT_TIMESTAMP
    if (b + 14400 > SPLIT_TIMESTAMP) {
      crosses2023Boundary = true;
      break;
    }

    const st = h4Grid.get(b);
    if (!st) {
      // Reached beyond precomputed grid (at or after 2023-01-01)
      crosses2023Boundary = true;
      break;
    }

    if (st === 'COMPLETE') {
      completedCount++;
      if (completedCount === horizonH4) {
        exitTimestamp = b + 14400;
        break;
      }
      b += 14400;
    } else if (st === 'WEEKEND_CLOSURE') {
      crossesWeekend = true;
      b += 14400;
    } else if (st === 'WEEKDAY_GAP') {
      crossesWeekdayGap = true;
      break; // fail closed
    } else if (st === 'INCOMPLETE_MISSING_H1_BARS') {
      hasMissingH1Bars = true;
      break; // fail closed
    }
  }

  const isComplete =
    completedCount === horizonH4 &&
    !crossesWeekdayGap &&
    !hasMissingH1Bars &&
    !crosses2023Boundary &&
    exitTimestamp !== null;

  let laterBaseReleaseRows = 0;
  let laterQuoteReleaseRows = 0;
  let laterPairReleaseRows = 0;
  const basePackages = new Set<number>();
  const quotePackages = new Set<number>();
  const pairPackages = new Set<number>();

  if (exitTimestamp !== null) {
    if (sortedReleaseTimestamps && sortedReleaseTimestamps.length > 0) {
      const startIdx = findFirstIndexGreaterThan(sortedReleaseTimestamps, tEntry);
      for (let i = startIdx; i < sortedReleaseTimestamps.length; i++) {
        const ts = sortedReleaseTimestamps[i];
        if (ts >= exitTimestamp) break;
        const rels = pre2023ReleasesByTimestamp.get(ts);
        if (!rels) continue;
        let tsHasBase = false;
        let tsHasQuote = false;
        for (const r of rels) {
          if (r.currency === pairBaseCurrency) {
            laterBaseReleaseRows++;
            tsHasBase = true;
          }
          if (r.currency === pairQuoteCurrency) {
            laterQuoteReleaseRows++;
            tsHasQuote = true;
          }
        }
        if (tsHasBase) basePackages.add(ts);
        if (tsHasQuote) quotePackages.add(ts);
        if (tsHasBase || tsHasQuote) pairPackages.add(ts);
      }
    } else {
      for (const [ts, rels] of pre2023ReleasesByTimestamp.entries()) {
        if (ts > tEntry && ts < exitTimestamp) {
          let tsHasBase = false;
          let tsHasQuote = false;
          for (const r of rels) {
            if (r.currency === pairBaseCurrency) {
              laterBaseReleaseRows++;
              tsHasBase = true;
            }
            if (r.currency === pairQuoteCurrency) {
              laterQuoteReleaseRows++;
              tsHasQuote = true;
            }
          }
          if (tsHasBase) basePackages.add(ts);
          if (tsHasQuote) quotePackages.add(ts);
          if (tsHasBase || tsHasQuote) pairPackages.add(ts);
        }
      }
    }
    laterPairReleaseRows = laterBaseReleaseRows + laterQuoteReleaseRows;
  }

  return {
    horizonH4,
    isComplete,
    exitTimestamp,
    crossesWeekend,
    crossesWeekdayGap,
    hasMissingH1Bars,
    crosses2023Boundary,
    laterBaseReleaseRows,
    laterBaseTimestampPackages: basePackages.size,
    laterQuoteReleaseRows,
    laterQuoteTimestampPackages: quotePackages.size,
    laterPairReleaseRows,
    laterPairTimestampPackages: pairPackages.size,
  };
}

/**
 * Groups calendar rows into simultaneous release packages.
 */
export function deduplicateSimultaneousPackages(
  releases: CalendarReleaseRecord[]
): SimultaneousPackage[] {
  const map = new Map<number, CalendarReleaseRecord[]>();
  for (const r of releases) {
    let list = map.get(r.timestamp);
    if (!list) {
      list = [];
      map.set(r.timestamp, list);
    }
    list.push(r);
  }

  const sortedTimestamps = Array.from(map.keys()).sort((a, b) => a - b);
  const packages: SimultaneousPackage[] = [];

  for (const ts of sortedTimestamps) {
    const group = map.get(ts)!;
    const currencies = Array.from(new Set(group.map((r) => r.currency))).sort();
    const seriesKeys = Array.from(new Set(group.map((r) => r.seriesKey))).sort();

    // Deterministic package ID
    const seriesHash = crypto
      .createHash('sha256')
      .update(seriesKeys.join('|'))
      .digest('hex')
      .slice(0, 12);
    const packageId = `pkg_${ts}_${seriesHash}`;

    const hasCrossCurrencyCollision = currencies.length > 1;
    const collidingCurrencies = hasCrossCurrencyCollision ? currencies : [];

    packages.push({
      packageId,
      timestamp: ts,
      brokerDateTime: new Date(ts * 1000).toISOString().replace('T', ' ').slice(0, 19),
      releaseCount: group.length,
      currencies,
      hasCrossCurrencyCollision,
      collidingCurrencies,
      seriesKeys,
      releases: group.map((r) => ({
        valueId: r.valueId,
        seriesKey: r.seriesKey,
        eventName: r.eventName,
        currency: r.currency,
        countryCode: r.countryCode,
        hasCompleteAFP: r.hasCompleteAFP,
      })),
    });
  }

  return packages;
}

/**
 * Builds input completeness inventory for exact calendar series.
 */
export function buildExactSeriesInventory(
  releases: CalendarReleaseRecord[]
): ExactSeriesInventory[] {
  const seriesMap = new Map<string, {
    seriesKey: string;
    currency: string;
    countryCode: string;
    eventId: string;
    revision: number | null;
    eventNameLabel: string;
    macroFamily: MacroFamily;
    releases: CalendarReleaseRecord[];
    years: Set<number>;
  }>();

  for (const r of releases) {
    let entry = seriesMap.get(r.seriesKey);
    if (!entry) {
      entry = {
        seriesKey: r.seriesKey,
        currency: r.currency,
        countryCode: r.countryCode,
        eventId: r.eventId,
        revision: r.revision,
        eventNameLabel: r.eventName,
        macroFamily: r.macroFamily,
        releases: [],
        years: new Set(),
      };
      seriesMap.set(r.seriesKey, entry);
    }
    entry.releases.push(r);
    const yr = new Date(r.timestamp * 1000).getUTCFullYear();
    entry.years.add(yr);
  }

  const summaries: ExactSeriesInventory[] = [];

  for (const entry of seriesMap.values()) {
    const total = entry.releases.length;
    let actualCount = 0;
    let forecastCount = 0;
    let previousCount = 0;
    let revisedPreviousCount = 0;
    let completeAfPCount = 0;
    let completeAfPRevPCount = 0;
    let unitCount = 0;
    let validTimestampCount = 0;

    for (const r of entry.releases) {
      if (r.hasActual) actualCount++;
      if (r.hasForecast) forecastCount++;
      if (r.hasPrevious) previousCount++;
      if (r.hasRevisedPrevious) revisedPreviousCount++;
      if (r.hasCompleteAFP) completeAfPCount++;
      if (r.hasCompleteAFPRevP) completeAfPRevPCount++;
      if (r.hasUnit) unitCount++;
      if (r.hasTimestamp) validTimestampCount++;
    }

    summaries.push({
      seriesKey: entry.seriesKey,
      currency: entry.currency,
      countryCode: entry.countryCode,
      eventId: entry.eventId,
      revision: entry.revision,
      eventNameLabel: entry.eventNameLabel,
      macroFamily: entry.macroFamily,
      totalReleases: total,
      representedYears: Array.from(entry.years).sort(),
      actualCount,
      actualPct: total > 0 ? (actualCount / total) * 100 : 0,
      forecastCount,
      forecastPct: total > 0 ? (forecastCount / total) * 100 : 0,
      previousCount,
      previousPct: total > 0 ? (previousCount / total) * 100 : 0,
      revisedPreviousCount,
      revisedPreviousPct: total > 0 ? (revisedPreviousCount / total) * 100 : 0,
      completeAfPCount,
      completeAfPPct: total > 0 ? (completeAfPCount / total) * 100 : 0,
      completeAfPRevPPct: total > 0 ? (completeAfPRevPCount / total) * 100 : 0,
      unitCount,
      unitPct: total > 0 ? (unitCount / total) * 100 : 0,
      validTimestampCount,
      validTimestampPct: total > 0 ? (validTimestampCount / total) * 100 : 0,
    });
  }

  summaries.sort((a, b) => b.totalReleases - a.totalReleases || a.seriesKey.localeCompare(b.seriesKey));
  return summaries;
}
