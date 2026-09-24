export const SPLIT_TIMESTAMP = 1672531200; // 2023-01-01 00:00:00 broker trade-server time
export const SPLIT_DATE_STRING = '2023-01-01 00:00:00';
export const EXPECTED_CALENDAR_SHA256 = '76062b8f6747d38b530d086780f2dfcf0b0bde59690bfdf4458c7519d4e6be2e';
export const EXPECTED_SCHEMA_VERSION = 'fyodor-mt5-research-export/3.1.0';
export const EXPECTED_SOURCE_FOLDER = 'FyodorResearchExport_v3_20260923_234930_server';

export const CANDIDATE_HOLDING_HORIZONS = [6, 12, 30, 42, 60] as const;
export type CandidateHoldingHorizon = typeof CANDIDATE_HOLDING_HORIZONS[number];

export const REQUIRED_PRE_ENTRY_H4_PERIODS = 14;

export type MacroFamily =
  | 'Inflation'
  | 'Labor / Employment'
  | 'Central Bank / Rates'
  | 'National Accounts / Growth'
  | 'Business Surveys / PMI'
  | 'Consumer / Retail'
  | 'Production / Activity'
  | 'Housing / Construction'
  | 'International Trade'
  | 'Government / Fiscal'
  | 'Unclassified';

export interface SourceManifestVerification {
  exportRoot: string;
  manifestPath: string;
  schemaVersion: string;
  exporterVersion: string;
  terminalBuild: string;
  accountCompany: string;
  accountServer: string;
  calendarSha256ExpectedPinned: string;
  calendarSha256Calculated: string;
  calendarSha256MatchesPinned: boolean;
  totalCalendarRowsInExport: number;
  totalPre2023Releases: number;
  candleFilesExportedDeclared: number;
  candleFilesVerifiedOnDisk: number;
  allCandleFilesHashed: boolean;
  candleHashes: Record<string, string>; // pair -> sha256
}

export interface CalendarReleaseRecord {
  valueId: string;
  eventId: string;
  timestamp: number;
  periodTimestamp: number | null;
  currency: string;
  countryCode: string;
  revision: number | null;
  eventName: string; // presentation label only
  seriesKey: string; // currency:country:event_id:revision
  hasActual: boolean;
  hasForecast: boolean;
  hasPrevious: boolean;
  hasRevisedPrevious: boolean;
  hasUnit: boolean;
  hasTimestamp: boolean;
  hasCompleteAFP: boolean;
  hasCompleteAFPRevP: boolean;
  macroFamily: MacroFamily;
}

export interface SimultaneousPackage {
  packageId: string;
  timestamp: number;
  brokerDateTime: string;
  releaseCount: number;
  currencies: string[];
  hasCrossCurrencyCollision: boolean;
  collidingCurrencies: string[];
  seriesKeys: string[];
  releases: Array<{
    valueId: string;
    seriesKey: string;
    eventName: string;
    currency: string;
    countryCode: string;
    hasCompleteAFP: boolean;
  }>;
}

export interface ExactSeriesInventory {
  seriesKey: string;
  currency: string;
  countryCode: string;
  eventId: string;
  revision: number | null;
  eventNameLabel: string;
  macroFamily: MacroFamily;
  totalReleases: number;
  representedYears: number[];
  actualCount: number;
  actualPct: number;
  forecastCount: number;
  forecastPct: number;
  previousCount: number;
  previousPct: number;
  revisedPreviousCount: number;
  revisedPreviousPct: number;
  completeAfPCount: number;
  completeAfPPct: number;
  completeAfPRevPPct: number;
  unitCount: number;
  unitPct: number;
  validTimestampCount: number;
  validTimestampPct: number;
}

export type H4BlockStatus =
  | 'COMPLETE'
  | 'WEEKEND_CLOSURE'
  | 'WEEKDAY_GAP'
  | 'INCOMPLETE_MISSING_H1_BARS';

export interface HoldingHorizonAudit {
  horizonH4: CandidateHoldingHorizon;
  isComplete: boolean;
  exitTimestamp: number | null;
  crossesWeekend: boolean;
  crossesWeekdayGap: boolean;
  hasMissingH1Bars: boolean;
  crosses2023Boundary: boolean;
  laterBaseReleaseRows: number;
  laterBaseTimestampPackages: number;
  laterQuoteReleaseRows: number;
  laterQuoteTimestampPackages: number;
  laterPairReleaseRows: number;
  laterPairTimestampPackages: number;
}

export type EntryBoundaryStatus =
  | 'OPEN_MARKET'
  | 'WEEKEND_BLOCKED'
  | 'WEEKDAY_GAP'
  | 'MISSING_HISTORY';

export interface EpisodePairCoverage {
  pair: string;
  entryTimestamp: number;
  entryStatus: EntryBoundaryStatus;
  preEntryCompletedH4Count: number;
  preEntryHas14Completed: boolean;
  preEntryCrossesWeekdayGap: boolean;
  preEntryHasMissingH1Bars: boolean;
  holdingHorizons: Record<CandidateHoldingHorizon, HoldingHorizonAudit>;
}

export interface EpisodeCoverageSummary {
  packageId: string;
  timestamp: number;
  brokerDateTime: string;
  currencies: string[];
  hasCrossCurrencyCollision: boolean;
  collidingCurrencies: string[];
  seriesKeys: string[];
  pairCoverage: Record<string, EpisodePairCoverage>;
}

export interface PairIntegritySummary {
  pair: string;
  filename: string;
  sha256: string;
  totalBars: number;
  pre2023Bars: number;
  coverageLabel: string;
  earliestBarTimestamp: number | null;
  earliestDate: string | null;
  latestPre2023BarTimestamp: number | null;
  latestPre2023Date: string | null;
  latestFullExportBarTimestamp: number | null;
  latestFullExportDate: string | null;
  latestBarTimestamp: number | null;
  latestDate: string | null;
  pureWeekendGapsPre2023: number;
  weekdayOrMixedGapsPre2023: number;
  weekendGapsPre2023: number;
  weekdayGapsPre2023: number;
  maxGapHoursPre2023: number;
  maxGapStartPre2023: string | null;
  maxGapEndPre2023: string | null;
}

export interface NumericDistribution {
  median: number;
  mean: number;
  min: number;
  max: number;
  p25: number;
  p75: number;
}

export interface HorizonOverlapAudit {
  cleanHoldingEpisodes: number; // explicit denominator
  episodesWithBaseOverlap: number;
  episodesWithQuoteOverlap: number;
  episodesWithPairOverlap: number;
  pctWithPairOverlap: number;
  pairReleaseRowsDistribution: NumericDistribution;
  pairTimestampPackagesDistribution: NumericDistribution;
}

export interface PairHorizonAggregate {
  pair: string;
  baseCurrency: string;
  quoteCurrency: string;
  evaluatedEpisodes: number;
  // Mutually exclusive entry status at T_entry
  openMarketEntries: number;
  weekendBlockedEntries: number;
  weekdayGapBlockedEntries: number;
  missingHistoryBlockedEntries: number;
  // 14 pre-entry periods (evaluated for openMarketEntries)
  eligiblePreEntry14: number;
  preEntryMissingHistory: number;
  preEntryWeekdayGap: number;
  preEntryMissingH1Bars: number;
  // Mutually exclusive holding horizon outcomes (for eligiblePreEntry14)
  eligibleHorizons: Record<CandidateHoldingHorizon, number>;
  boundaryExclusions: Record<CandidateHoldingHorizon, number>;
  weekdayGapExclusions: Record<CandidateHoldingHorizon, number>;
  missingBarExclusions: Record<CandidateHoldingHorizon, number>;
  // Derived overlap metrics across clean complete paths
  overlapAudits: Record<CandidateHoldingHorizon, HorizonOverlapAudit>;
}

export interface SeriesPairEligibility {
  seriesKey: string;
  eventNameLabel: string;
  macroFamily: MacroFamily;
  currency: string;
  countryCode: string;
  pair: string;
  distinctPackagesCount: number;
  completeInputCount: number;
  completeInputPct: number;
  representedYears: number[];
  representedYearsLabel: string;
  crossCurrencyCollisionCount: number;
  crossCurrencyCollisionPct: number;
  openMarketEntries: number;
  cleanPreEntry14: number;
  cleanPathsByHorizon: Record<CandidateHoldingHorizon, number>;
  // Joint Intersections on the SAME Timestamp Package
  completeInputsAndCleanPre14: number;
  completeInputsAndCleanPathsByHorizon: Record<CandidateHoldingHorizon, number>;
}

export interface FmsInventoryResult {
  generatedAt: string;
  manifest: SourceManifestVerification;
  splitBoundary: {
    timestamp: number;
    dateString: string;
  };
  totalCalendarRowsInExport: number;
  totalPre2023Releases: number;
  totalPre2023TimestampPackages: number;
  crossCurrencyCollisionPackagesCount: number;
  seriesSummaries: ExactSeriesInventory[];
  pairIntegritySummaries: PairIntegritySummary[];
  aggregateCoverageByPairAndHorizon: Record<string, PairHorizonAggregate>;
  seriesPairEligibility: SeriesPairEligibility[];
  sampleEpisodes: EpisodeCoverageSummary[];
  episodesJsonlFile: string;
  seriesPairCsvFile?: string;
}
