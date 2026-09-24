import { EventScore } from '../shared/types.js';
import { CoReleaseCoherenceStatus } from './coReleaseCoherence.js';

export const SPLIT_TIMESTAMP = 1672531200; // 2023-01-01 00:00:00 broker trade-server time
export const SPLIT_DATE_STRING = '2023-01-01 00:00:00';
export const EXPECTED_CALENDAR_SHA256 = '76062b8f6747d38b530d086780f2dfcf0b0bde59690bfdf4458c7519d4e6be2e';
export const EXPECTED_SCHEMA_VERSION = 'fyodor-mt5-research-export/3.1.0';
export const EXPECTED_SOURCE_FOLDER = 'FyodorResearchExport_v3_20260923_234930_server';
export const BASELINE_COMMIT = '7ba2530';

export const REPORTING_MIN_CELL_N = 5; // Minimum cell size required for formal two-sample hypothesis testing

export const ALL_5X5_CELL_KEYS: string[] = [
  'S+3_M+3', 'S+3_M+2', 'S+3_M+1', 'S+3_M-2', 'S+3_M-3',
  'S+2_M+3', 'S+2_M+2', 'S+2_M+1', 'S+2_M-2', 'S+2_M-3',
  'S+1_M+3', 'S+1_M+2', 'S+1_M+1', 'S+1_M-2', 'S+1_M-3',
  'S-2_M+3', 'S-2_M+2', 'S-2_M+1', 'S-2_M-2', 'S-2_M-3',
  'S-3_M+3', 'S-3_M+2', 'S-3_M+1', 'S-3_M-2', 'S-3_M-3',
];

export interface TargetSeriesDefinition {
  displayName: string;
  seriesKey: string;
  eventId: string;
  countryCode: string;
  currency: string;
  revision: number;
  economicInterpretation: string;
}

export const TARGET_SERIES_DEFINITIONS: TargetSeriesDefinition[] = [
  {
    displayName: 'USD CPI m/m',
    seriesKey: 'USD:US:840030005:r0',
    eventId: '840030005',
    countryCode: 'US',
    currency: 'USD',
    revision: 0,
    economicInterpretation: 'Headline monthly consumer price inflation. Beats signal higher short-term nominal rate expectations; misses signal disinflation / Fed easing expectations.',
  },
  {
    displayName: 'USD Core CPI m/m',
    seriesKey: 'USD:US:840030006:r0',
    eventId: '840030006',
    countryCode: 'US',
    currency: 'USD',
    revision: 0,
    economicInterpretation: 'Core monthly consumer price inflation excluding volatile food and energy components. Primary gauge of sticky underlying consumer inflation.',
  },
  {
    displayName: 'USD Core PCE m/m',
    seriesKey: 'USD:US:840010001:r0',
    eventId: '840010001',
    countryCode: 'US',
    currency: 'USD',
    revision: 0,
    economicInterpretation: 'Core personal consumption expenditures price index. The Federal Reserve\'s preferred official inflation target measure.',
  },
  {
    displayName: 'USD Nonfarm Payrolls',
    seriesKey: 'USD:US:840030016:r0',
    eventId: '840030016',
    countryCode: 'US',
    currency: 'USD',
    revision: 0,
    economicInterpretation: 'Headline net monthly change in nonfarm employment. Primary labor market pulse; large positive surprises convey economic expansion and tighter monetary policy.',
  },
];

export interface SeriesPreflightAudit {
  displayName: string;
  seriesKey: string;
  eventId: string;
  revision: number;
  totalReleasesInExport: number;
  completeAFPCount: number;
  incompleteAFPCount: number;
  explorationTotalReleases: number;
  confirmationTotalReleases: number;
  // EURUSD boundary audit
  eurusdExplorationH42CrossingCount: number;
  eurusdEligibleExplorationCount: number;
  // USDJPY boundary audit
  usdjpyExplorationH42CrossingCount: number;
  usdjpyEligibleExplorationCount: number;
  pairBoundaryMismatchCount: number;
  // Walk-forward scores in Exploration (using EURUSD eligible set)
  surpriseScoresExploration: {
    p3: number;
    p2: number;
    p1: number;
    m2: number;
    m3: number;
  };
  momentumScoresExploration: {
    p3: number;
    p2: number;
    p1: number;
    m2: number;
    m3: number;
  };
  // Full 25-cell 5x5 matrix including zero-count cells
  matrix5x5Exploration: Record<string, number>;
  primaryContrastPowerStatus: 'ADEQUATE' | 'UNDERPOWERED';
  powerRationale: string;
}

export interface Phase1PreflightManifest {
  manifestVersion: string;
  generatedAt: string;
  baselineCommit: string;
  splitBoundaryBrokerTime: string;
  splitBoundaryTimestamp: number;
  timestampLoadingMethod: string;
  sourceVerification: {
    exportRoot: string;
    schemaVersion: string;
    calendarPath: string;
    calendarSha256: string;
    hashMatchesExpected: boolean;
    totalCalendarRows: number;
    candleFilesCount: number;
  };
  knownPriorExposures: Array<{
    valueId: string;
    series: string;
    brokerDate: string;
    splitPeriod: 'EXPLORATION' | 'CONFIRMATION';
    disposition: string;
  }>;
  seriesAudits: Record<string, SeriesPreflightAudit>;
  familyMultiplicityRule: {
    plannedFamilyK: number;
    reportingThresholdN: number;
    omittedUnderpoweredCount: number;
    evaluatedEligibleCount: number;
    policy: string;
  };
}

export interface HorizonMetrics {
  horizon: number; // 1 to 42
  n: number;
  mean: number | null;
  median: number | null;
  stdDev: number | null;
  min: number | null;
  max: number | null;
  p10: number | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p90: number | null;
  positiveCount: number;
  negativeCount: number;
  zeroCount: number;
  positiveDirectionRate: number | null;
}

export interface ContrastResult {
  horizon: number;
  horizonType: 'cumulative' | 'delayed';
  groupPositiveN: number;
  groupNegativeN: number;
  groupPositiveMean: number | null;
  groupNegativeMean: number | null;
  meanDifference: number | null; // mean(+3) - mean(-3)
  groupPositiveMedian: number | null;
  groupNegativeMedian: number | null;
  medianDifference: number | null; // median(+3) - median(-3)
  permutationPValue: number | null;
  permutationMethod: 'exact' | 'seeded_monte_carlo' | null;
  permutationDetails?: string;
  rankSumPValue: number | null; // Mann-Whitney U test
  isUnderpowered: boolean;
  powerWarning?: string;
}

export interface IndividualEventRecord {
  valueId: string;
  date: string;
  timestamp: number;
  actual: number | null;
  forecast: number | null;
  previous: number | null;
  surpriseDelta: number | null;
  momentumDelta: number | null;
  surpriseScore: EventScore;
  momentumScore: EventScore;
  p0: number | null;
  h1Close: number | null;
  cumulativeReturns: Array<number | null>; // H1..H42
  delayedReturns: Array<number | null>; // H1 (null), H2..H42
  simultaneousReleaseCount: number;
  simultaneousEvents: string[];
  coReleaseCoherence?: CoReleaseCoherenceStatus;
  crossesWeekend: boolean;
  crossesNonWeekendGap: boolean;
}

export interface ExplorationSeriesOutcomes {
  seriesKey: string;
  displayName: string;
  pair: string;
  currencyPosition: 'base' | 'quote';
  eligibleN: number;
  // Cumulative horizons H1..H42
  cumulativeHorizonsAll: HorizonMetrics[];
  cumulativeHorizonsLargePosSurprise: HorizonMetrics[];
  cumulativeHorizonsLargeNegSurprise: HorizonMetrics[];
  // Delayed horizons H2..H42 (close of H1 to close of Hh)
  delayedHorizonsAll: HorizonMetrics[];
  delayedHorizonsLargePosSurprise: HorizonMetrics[];
  delayedHorizonsLargeNegSurprise: HorizonMetrics[];
  // Primary contrast at H12 delayed
  primaryContrastH12Delayed: ContrastResult;
  // Secondary contrasts at H4 and H24 delayed
  secondaryContrastH4Delayed: ContrastResult;
  secondaryContrastH24Delayed: ContrastResult;
  // Secondary cumulative contrasts
  secondaryContrastH1Cumulative: ContrastResult;
  secondaryContrastH12Cumulative: ContrastResult;
  // Full 25-cell 5x5 interaction matrix at H12 delayed (includes N=0 cells)
  matrix5x5H12Delayed: Array<{
    cell: string;
    surpriseScore: EventScore;
    momentumScore: EventScore;
    n: number;
    meanReturn: number | null;
    medianReturn: number | null;
    positiveDirectionRate: number | null;
  }>;
  // Chronological stability: early vs late Exploration halves
  chronologicalStabilityH12Delayed: {
    earlyHalf: { n: number; meanPosDiff: number | null; medianPosDiff: number | null };
    lateHalf: { n: number; meanPosDiff: number | null; medianPosDiff: number | null };
    stabilitySummary: string;
  };
  // Co-release pairwise coherence analysis
  coReleaseCoherenceH12Delayed: {
    coherent: { n: number; meanDelayedH12: number | null; medianDelayedH12: number | null };
    conflicting: { n: number; meanDelayedH12: number | null; medianDelayedH12: number | null };
    isolated: { n: number; meanDelayedH12: number | null; medianDelayedH12: number | null };
    unclassified: { n: number; meanDelayedH12: number | null; medianDelayedH12: number | null };
    summary: string;
  };
  // Sensitivity checks
  sensitivity: {
    isolatedOnlyH12: { n: number; meanPosDiff: number | null; medianPosDiff: number | null };
    simultaneousH12: { n: number; meanPosDiff: number | null; medianPosDiff: number | null };
    weekendCrossingCount: number;
    nonWeekendGapCount: number;
  };
  // Outlier impact analysis
  outlierInfluence: {
    top3DriversPos: Array<{ valueId: string; date: string; delayedReturnH12: number }>;
    top3DriversNeg: Array<{ valueId: string; date: string; delayedReturnH12: number }>;
    meanExcludingTopDriverPos: number | null;
    meanExcludingTopDriverNeg: number | null;
  };
  // Full individual-event trajectories for audit inspection
  individualEventPaths: IndividualEventRecord[];
}
