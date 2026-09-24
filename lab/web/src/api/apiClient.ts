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

export interface FXPairInfo {
  pair: string;
  base: string;
  quote: string;
  filename: string;
  barCount: number;
  earliestDate: string;
  latestDate: string;
}

export interface EventListItem {
  eventId: string;
  eventSeriesKey: string;
  revision: number | null;
  countryCode: string;
  eventName: string;
  family: string;
  count: number;
  importance: string;
  averageReleasesPerActiveMonth: number;
  identityWarning?: string;
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
  horizon: number;
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
  surpriseScore: number | null;
  momentumScore: number | null;
  n: number;
  medianReturn: number | null;
  meanReturn: number | null;
  positiveDirectionRate: number | null;
}

export interface ScoreMatrixData {
  horizon: number;
  matrix: ScoreMatrixCell[][];
}

export interface ResearchHealth {
  sampleSize: number;
  completeAFPCount: number;
  missingValueExclusions: number;
  simultaneousReleaseCount: number;
  weekendCrossingCount: number;
  nonWeekendGapCount: number;
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
  query: any;
  health: ResearchHealth;
  horizons: HorizonStatistics[];
  samplePaths: Array<{
    eventId: string;
    valueId: string;
    timestamp: number;
    date: string;
    surpriseScore: number | null;
    momentumScore: number | null;
    p0: number | null;
    returns: Array<number | null>;
  }>;
  totalMatchingPaths: number;
  scoreMatrix: ScoreMatrixData;
  scoreMatrices?: Record<number, ScoreMatrixData>;
  availablePairs: string[];
  horizonBins?: Record<number, HistogramBin[]>;
}

export interface EventObservation {
  eventId: string;
  valueId: string;
  timestamp: number;
  date: string;
  currency: string;
  countryCode: string;
  eventName: string;
  eventFamily: string;
  importance: string;
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
  surprisePercentileRank?: number | null;
  momentumPercentileRank?: number | null;
  unit?: string;
  hasCompleteAFP: boolean;
  simultaneousReleaseCount: number;
  simultaneousEvents: string[];
  surpriseScore: number | null;
  momentumScore: number | null;
  pair: string;
  eventCurrencyPosition: 'base' | 'quote';
  directionMultiplier: 1 | -1;
  p0Timestamp: number | null;
  p0: number | null;
  returns: Array<number | null>;
  logReturns?: Array<number | null>;
  rawReturns: Array<number | null>;
  crossesWeekend: boolean;
  crossesNonWeekendGap: boolean;
  isFridayRelease: boolean;
}

const BASE_URL = '/api';

export async function fetchOverview(): Promise<OverviewMetrics> {
  const res = await fetch(`${BASE_URL}/overview`);
  if (!res.ok) throw new Error(`Failed to fetch overview: ${res.statusText}`);
  return res.json();
}

export async function fetchCurrencies(): Promise<string[]> {
  const res = await fetch(`${BASE_URL}/currencies`);
  if (!res.ok) throw new Error(`Failed to fetch currencies: ${res.statusText}`);
  return res.json();
}

export async function fetchEvents(currency: string, family?: string): Promise<EventListItem[]> {
  let url = `${BASE_URL}/events?currency=${encodeURIComponent(currency)}`;
  if (family && family !== 'all') {
    url += `&family=${encodeURIComponent(family)}`;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch events: ${res.statusText}`);
  return res.json();
}

export async function fetchPairs(currency: string): Promise<FXPairInfo[]> {
  const res = await fetch(`${BASE_URL}/pairs?currency=${encodeURIComponent(currency)}`);
  if (!res.ok) throw new Error(`Failed to fetch pairs: ${res.statusText}`);
  return res.json();
}

export async function fetchDistribution(
  currency: string,
  eventName: string,
  percentile: number = 75,
  eventId?: string,
  eventSeriesKey?: string
): Promise<{ surprise: DistributionResponse; momentum: DistributionResponse }> {
  const eventIdParam = eventId ? `&eventId=${encodeURIComponent(eventId)}` : '';
  const eventSeriesParam = eventSeriesKey ? `&eventSeriesKey=${encodeURIComponent(eventSeriesKey)}` : '';
  const res = await fetch(
    `${BASE_URL}/distribution?currency=${encodeURIComponent(currency)}&eventName=${encodeURIComponent(
      eventName
    )}&percentile=${percentile}${eventIdParam}${eventSeriesParam}`
  );
  if (!res.ok) throw new Error(`Failed to fetch distribution: ${res.statusText}`);
  return res.json();
}

export async function fetchPattern(query: any): Promise<PatternResponse> {
  const res = await fetch(`${BASE_URL}/pattern`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(query),
  });
  if (!res.ok) throw new Error(`Failed to fetch pattern: ${res.statusText}`);
  return res.json();
}

export async function fetchObservations(
  query: any,
  page: number = 1,
  pageSize: number = 50,
  sortBy: string = 'timestamp',
  sortDir: 'asc' | 'desc' = 'desc'
): Promise<{ total: number; page: number; pageSize: number; items: EventObservation[] }> {
  const res = await fetch(`${BASE_URL}/observations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, page, pageSize, sortBy, sortDir }),
  });
  if (!res.ok) throw new Error(`Failed to fetch observations: ${res.statusText}`);
  return res.json();
}

export async function fetchInspect(
  eventId: string,
  valueId: string,
  pair: string,
  percentile: number = 75,
  scoringMode: string = 'retrospective',
  minHistory: number = 20
): Promise<any> {
  const res = await fetch(
    `${BASE_URL}/inspect?eventId=${encodeURIComponent(eventId)}&valueId=${encodeURIComponent(
      valueId
    )}&pair=${encodeURIComponent(pair)}&percentile=${percentile}&scoringMode=${encodeURIComponent(
      scoringMode
    )}&minHistory=${minHistory}`
  );
  if (!res.ok) throw new Error(`Failed to inspect event: ${res.statusText}`);
  return res.json();
}

export async function fetchFamilyComparison(currency: string, pair?: string): Promise<any[]> {
  let url = `${BASE_URL}/family-comparison?currency=${encodeURIComponent(currency)}`;
  if (pair) url += `&pair=${encodeURIComponent(pair)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch family comparison: ${res.statusText}`);
  return res.json();
}

export async function fetchDataQuality(): Promise<any> {
  const res = await fetch(`${BASE_URL}/data-quality`);
  if (!res.ok) throw new Error(`Failed to fetch data quality: ${res.statusText}`);
  return res.json();
}
