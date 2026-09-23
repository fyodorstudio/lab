export type EventScore = -3 | -2 | 1 | 2 | 3 | null;

export type EventImportance = 'high' | 'medium' | 'low';

export type EventFamily =
  | 'Inflation'
  | 'Employment'
  | 'Growth'
  | 'Activity'
  | 'Consumption'
  | 'PMI / Surveys'
  | 'Housing'
  | 'Trade'
  | 'Central Bank'
  | 'Other';

export interface CalendarRawRow {
  eventId: string;
  valueId: string;
  timestamp: number; // Unix seconds UTC
  currency: string;
  countryCode: string;
  eventName: string;
  importance: string;
  actualRaw: string | null;
  forecastRaw: string | null;
  previousRaw: string | null;
  revisedPreviousRaw: string | null;
}

export interface ParsedEventRelease {
  eventId: string;
  valueId: string;
  timestamp: number;
  date: string;
  currency: string;
  countryCode: string;
  eventName: string;
  normalizedEventName: string;
  eventFamily: EventFamily;
  importance: EventImportance | string;

  actualRaw: string | null;
  forecastRaw: string | null;
  previousRaw: string | null;
  revisedPreviousRaw: string | null;

  actual: number | null;
  forecast: number | null;
  previous: number | null;
  revisedPrevious: number | null;

  surpriseDelta: number | null;
  momentumDelta: number | null;
  surpriseAbsDelta: number | null;
  momentumAbsDelta: number | null;

  hasCompleteAFP: boolean;
  simultaneousReleaseCount: number;
  simultaneousEvents: string[];
  unit?: string;
}

export interface EventObservation extends ParsedEventRelease {
  surpriseScore: EventScore;
  momentumScore: EventScore;
  surprisePercentileRank: number | null; // e.g. 96.4 for P96.4
  momentumPercentileRank: number | null; // e.g. 82.1 for P82.1

  pair: string;
  eventCurrencyPosition: 'base' | 'quote';
  directionMultiplier: 1 | -1;

  p0Timestamp: number | null;
  p0: number | null;
  returns: Array<number | null>; // H1 to H42 returns (normalized)
  rawReturns: Array<number | null>; // raw pair returns

  crossesWeekend: boolean;
  isFridayRelease: boolean;
}

export interface DistributionStats {
  n: number;
  min: number | null;
  max: number | null;
  mean: number | null;
  median: number | null;
  p10: number | null;
  p25: number | null;
  p50: number | null;
  p60: number | null;
  p70: number | null;
  p75: number | null;
  p80: number | null;
  p85: number | null;
  p90: number | null;
  p95: number | null;
}

export interface HistogramBin {
  binStart: number;
  binEnd: number;
  count: number;
  frequency: number;
}

export interface PercentileThresholdRow {
  percentile: number;
  label: string;
  threshold: number | null;
  formattedThreshold: string;
}

export interface ThresholdDetails {
  percentile: number;
  thresholdValue: number | null;
  formattedThreshold: string;
  meaning: string;
  scoreBoundaryDescription: string;
}

export interface DistributionResponse {
  stats: DistributionStats;
  bins: HistogramBin[];
  selectedThresholdValue: number | null;
  thresholdPercentile: number;
  allDeltasCount: number;
  nonZeroDeltasCount: number;
  unit?: string;
  percentileTable?: PercentileThresholdRow[];
  thresholdDetails?: ThresholdDetails;
}

export interface HorizonStatistics {
  horizon: number; // 1 to 42
  n: number;
  mean: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  p10: number | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p90: number | null;
  positiveDirectionCount: number;
  negativeDirectionCount: number;
  zeroCount: number;
  positiveDirectionRate: number | null;
  negativeDirectionRate: number | null;
}

export interface ScoreMatrixCell {
  surpriseScore: EventScore;
  momentumScore: EventScore;
  n: number;
  medianReturn: number | null;
  meanReturn: number | null;
  positiveDirectionRate: number | null;
}

export interface ScoreMatrixData {
  horizon: number;
  matrix: ScoreMatrixCell[][]; // 5x5 for surprise (-3, -2, 1, 2, 3) x momentum (-3, -2, 1, 2, 3)
}

export interface PatternQueryFilters {
  currency: string;
  eventName: string;
  pair?: string;
  horizon?: number; // Selected horizon for score matrix (default 1)
  surpriseScore?: EventScore | 'all';
  momentumScore?: EventScore | 'all';
  importance?: string;
  dateStart?: number;
  dateEnd?: number;
  startDate?: string;
  endDate?: string;
  dayOfWeek?: number[] | number; // 0=Sunday, 1=Monday... 6=Saturday
  thresholdPercentile?: number; // default 75
  requireCompleteAFP?: boolean; // default true
  simultaneousFilter?: 'all' | 'isolated' | 'simultaneous' | 'exclude' | 'only';
  weekendFilter?: 'all' | 'excludeFriday' | 'excludeCrossingWeekend' | 'exclude_crossing' | 'only_crossing';
  trimOutliers?: boolean;
}

export interface ResearchHealth {
  sampleSize: number;
  completeAFPCount: number;
  missingValueExclusions: number;
  simultaneousReleaseCount: number;
  weekendCrossingCount: number;
  fridayReleaseCount: number;
  pair: string;
  eventCurrencyPosition: 'base' | 'quote';
  dataResolution: string;
  p0AlignmentRule: string;
  thresholdPercentile: number;
  retrospectiveClassificationWarning: string;
  warnings: string[];
}

export interface PatternResponse {
  query: PatternQueryFilters;
  health: ResearchHealth;
  horizons: HorizonStatistics[];
  samplePaths: Array<{
    eventId: string;
    valueId: string;
    timestamp: number;
    date: string;
    surpriseScore: EventScore;
    momentumScore: EventScore;
    p0: number | null;
    returns: Array<number | null>;
  }>;
  totalMatchingPaths: number;
  scoreMatrix: ScoreMatrixData;
  scoreMatrices?: Record<number, ScoreMatrixData>; // Precomputed matrices for key horizons H1, H4, H8, H12, H24, H42
  availablePairs: string[];
  horizonBins?: Record<number, HistogramBin[]>;
}

export interface FXPairInfo {
  pair: string;
  base: string;
  quote: string;
  filename: string;
  barCount: number;
  earliestTimestamp: number;
  latestTimestamp: number;
  earliestDate: string;
  latestDate: string;
}

export interface OverviewMetrics {
  calendarRecordCount: number;
  fxInstrumentCount: number;
  h1CandleCount: number;
  calendarDateRange: { min: string; max: string; minTs: number; maxTs: number };
  marketDateRange: { min: string; max: string; minTs: number; maxTs: number };
  availableCurrencies: string[];
  totalEventNamesCount: number;
  availableFamiliesCount: number;
  missingActualCount: number;
  missingForecastCount: number;
  missingPreviousCount: number;
  completeAFPCount: number;
  parsedValueFailuresCount: number;
  rejectedRowCount: number;
  malformedTimestampCount: number;
  duplicateTimestampCount: number;
  unknownFamilyCount: number;
  duplicateCandleIssues: string[];
}
