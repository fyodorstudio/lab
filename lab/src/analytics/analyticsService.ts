import {
  CalendarRepository,
} from '../data/calendarLoader.js';
import { CandleRepository } from '../data/candleLoader.js';
import {
  FXPairInfo,
  OverviewMetrics,
  PatternQueryFilters,
  PatternResponse,
  DistributionResponse,
  EventObservation,
  EventScore,
  HorizonStatistics,
  ScoreMatrixData,
  PercentileThresholdRow,
  ThresholdDetails,
  ScoringMode,
  ParsedEventRelease,
} from '../shared/types.js';
import {
  calculateDistributionStats,
  createHistogramBins,
  calculateQuantile,
  calculatePercentileRank,
  calculateStrictLowerPercentileRank,
  calculateTieMetrics,
  canonicalizeNumber,
  formatWithUnit,
  TieMetrics,
  formatBrokerServerDateTime,
} from '../shared/utils.js';
import { calculateEventThresholds, scoreDelta, getScoreClassificationReason } from './eventScorer.js';
import { alignEventToCandles } from './eventAligner.js';
import { calculateHorizonStatistics, calculateScoreMatrix } from './statisticsEngine.js';
import { getPairsForCurrency } from '../data/pairDiscovery.js';
import {
  DEFAULT_THRESHOLD_PERCENTILE,
  DEFAULT_SCORING_MODE,
  DEFAULT_MIN_WALK_FORWARD_HISTORY,
  FLOAT_EPSILON,
  RETROSPECTIVE_WARNING,
  WALK_FORWARD_LABEL,
  RETROSPECTIVE_LABEL,
  EVENT_FAMILIES,
} from '../shared/constants.js';

export interface IAnalyticsService {
  getOverview(): Promise<OverviewMetrics>;
  getCurrencies(): Promise<string[]>;
  getEvents(currency: string, family?: string): Promise<Array<{ eventId: string; eventSeriesKey: string; revision: number | null; countryCode: string; eventName: string; family: string; count: number; importance: string; averageReleasesPerActiveMonth: number; identityWarning?: string }>>;
  getPairs(currency: string): Promise<FXPairInfo[]>;
  getDistribution(currency: string, eventName: string, percentile?: number, eventId?: string, eventSeriesKey?: string): Promise<{ surprise: DistributionResponse; momentum: DistributionResponse }>;
  getPattern(query: PatternQueryFilters): Promise<PatternResponse>;
  getObservations(query: PatternQueryFilters, page?: number, pageSize?: number, sortBy?: string, sortDir?: 'asc' | 'desc'): Promise<{ total: number; page: number; pageSize: number; items: EventObservation[] }>;
  getRawEventInspection(
    eventId: string,
    valueId: string,
    pair: string,
    thresholdPercentile?: number,
    scoringMode?: ScoringMode,
    minHistory?: number
  ): Promise<any>;
  getFamilyComparison(currency: string, pair?: string): Promise<any[]>;
  getDataQuality(): Promise<any>;
}

export class AnalyticsService implements IAnalyticsService {
  private calendarRepo: CalendarRepository;
  private candleRepo: CandleRepository;
  private pairsMap: Map<string, FXPairInfo>;

  constructor(
    calendarRepo: CalendarRepository,
    candleRepo: CandleRepository,
    pairsMap: Map<string, FXPairInfo>
  ) {
    this.calendarRepo = calendarRepo;
    this.candleRepo = candleRepo;
    this.pairsMap = pairsMap;
  }

  public async getOverview(): Promise<OverviewMetrics> {
    const baseMetrics = this.calendarRepo.getMetrics();
    const allPairs = Array.from(this.pairsMap.values());
    let totalCandles = 0;
    let minMarketTs = Infinity;
    let maxMarketTs = -Infinity;

    for (const pair of allPairs) {
      if (pair.barCount > 0) {
        totalCandles += pair.barCount;
        if (pair.earliestTimestamp > 0 && pair.earliestTimestamp < minMarketTs) {
          minMarketTs = pair.earliestTimestamp;
        }
        if (pair.latestTimestamp > maxMarketTs) {
          maxMarketTs = pair.latestTimestamp;
        }
      }
    }

    return {
      ...(baseMetrics || {
        calendarRecordCount: 0,
        fxInstrumentCount: 0,
        h1CandleCount: 0,
        calendarDateRange: { min: '', max: '', minTs: 0, maxTs: 0 },
        marketDateRange: { min: '', max: '', minTs: 0, maxTs: 0 },
        availableCurrencies: [],
        totalEventNamesCount: 0,
        availableFamiliesCount: 10,
        missingActualCount: 0,
        missingForecastCount: 0,
        missingPreviousCount: 0,
        completeAFPCount: 0,
        parsedValueFailuresCount: 0,
        rejectedRowCount: 0,
        malformedTimestampCount: 0,
        duplicateTimestampCount: 0,
        unknownFamilyCount: 0,
        duplicateCandleIssues: [],
      }),
      fxInstrumentCount: allPairs.length,
      h1CandleCount: totalCandles,
      marketDateRange: {
        minTs: Number.isFinite(minMarketTs) ? minMarketTs : 0,
        maxTs: Number.isFinite(maxMarketTs) ? maxMarketTs : 0,
        min: Number.isFinite(minMarketTs) ? new Date(minMarketTs * 1000).toISOString().slice(0, 10) : '',
        max: Number.isFinite(maxMarketTs) ? new Date(maxMarketTs * 1000).toISOString().slice(0, 10) : '',
      },
    };
  }

  public async getCurrencies(): Promise<string[]> {
    const metrics = this.calendarRepo.getMetrics();
    return metrics ? metrics.availableCurrencies : [];
  }

  public async getEvents(currency: string, family?: string): Promise<Array<{ eventId: string; eventSeriesKey: string; revision: number | null; countryCode: string; eventName: string; family: string; count: number; importance: string; averageReleasesPerActiveMonth: number; identityWarning?: string }>> {
    const releases = this.calendarRepo.getParsedReleases().filter((r) => r.currency.toUpperCase() === currency.toUpperCase());
    const eventMap = new Map<string, { eventId: string; eventSeriesKey: string; revision: number | null; countryCode: string; eventName: string; family: string; count: number; importance: string; activeMonths: Set<string> }>();

    for (const r of releases) {
      if (family && r.eventFamily.toLowerCase() !== family.toLowerCase()) {
        continue;
      }
      const existing = eventMap.get(r.eventSeriesKey);
      if (!existing) {
        eventMap.set(r.eventSeriesKey, {
          eventId: r.eventId,
          eventSeriesKey: r.eventSeriesKey,
          revision: r.revision,
          countryCode: r.countryCode,
          eventName: r.eventName,
          family: r.eventFamily,
          count: 1,
          importance: r.importance,
          activeMonths: new Set([r.date.slice(0, 7)]),
        });
      } else {
        existing.count++;
        existing.activeMonths.add(r.date.slice(0, 7));
      }
    }

    const result = Array.from(eventMap.values()).map(({ activeMonths, ...series }) => {
      const averageReleasesPerActiveMonth = series.count / Math.max(1, activeMonths.size);
      const identityWarning = /pmi/i.test(series.eventName) && averageReleasesPerActiveMonth > 1.5
        ? series.revision === null
          ? 'This legacy event_id averages more than 1.5 releases per active month and may combine flash/final stages; the legacy file lacks period/revision metadata.'
          : 'This revision-specific source series still averages more than 1.5 releases per active month and may contain flash/final duplication; inspect its period and revision metadata before interpreting it as one monthly release stage.'
        : undefined;
      return { ...series, averageReleasesPerActiveMonth, identityWarning };
    });

    result.sort((a, b) => b.count - a.count);
    return result;
  }

  public async getPairs(currency: string): Promise<FXPairInfo[]> {
    return getPairsForCurrency(this.pairsMap, currency);
  }

  public async getDistribution(
    currency: string,
    eventName: string,
    percentile: number = DEFAULT_THRESHOLD_PERCENTILE,
    eventId?: string,
    eventSeriesKey?: string
  ): Promise<{ surprise: DistributionResponse; momentum: DistributionResponse }> {
    const releases = this.calendarRepo.getReleasesForEvent(currency, eventName, eventId, eventSeriesKey);

    const surpriseAbsDeltas: number[] = [];
    const momentumAbsDeltas: number[] = [];
    const nonzeroSurpriseAbs: number[] = [];
    const nonzeroMomentumAbs: number[] = [];

    for (const r of releases) {
      // Distribution tables must use the same complete-A/F/P eligibility rule
      // as retrospective and walk-forward scoring populations.
      if (!r.hasCompleteAFP) continue;
      if (r.surpriseAbsDelta !== null) {
        surpriseAbsDeltas.push(r.surpriseAbsDelta);
        const canonical = canonicalizeNumber(r.surpriseAbsDelta)!;
        if (canonical > FLOAT_EPSILON) nonzeroSurpriseAbs.push(canonical);
      }
      if (r.momentumAbsDelta !== null) {
        momentumAbsDeltas.push(r.momentumAbsDelta);
        const canonical = canonicalizeNumber(r.momentumAbsDelta)!;
        if (canonical > FLOAT_EPSILON) nonzeroMomentumAbs.push(canonical);
      }
    }

    const thresholds = calculateEventThresholds(nonzeroSurpriseAbs, nonzeroMomentumAbs, percentile);

    const surpriseStats = calculateDistributionStats(surpriseAbsDeltas);
    const momentumStats = calculateDistributionStats(momentumAbsDeltas);

    const sortedSurprise = [...nonzeroSurpriseAbs].sort((a, b) => a - b);
    const sortedMomentum = [...nonzeroMomentumAbs].sort((a, b) => a - b);

    const unit = releases.find((r) => r.unit)?.unit;

    const sPercentiles: PercentileThresholdRow[] = [50, 60, 70, 75, 80, 85, 90, 95].map((p) => {
      const val = calculateQuantile(sortedSurprise, p);
      return {
        percentile: p,
        label: `P${p}`,
        threshold: val,
        formattedThreshold: formatWithUnit(val, unit),
      };
    });

    const mPercentiles: PercentileThresholdRow[] = [50, 60, 70, 75, 80, 85, 90, 95].map((p) => {
      const val = calculateQuantile(sortedMomentum, p);
      return {
        percentile: p,
        label: `P${p}`,
        threshold: val,
        formattedThreshold: formatWithUnit(val, unit),
      };
    });

    const sThreshVal = thresholds.surpriseThreshold;
    const sFormatted = formatWithUnit(sThreshVal, unit);
    const sDetails: ThresholdDetails = {
      percentile,
      thresholdValue: sThreshVal,
      formattedThreshold: sFormatted,
      meaning: `P${percentile} of the sorted nonzero |A - F| population using linear interpolation at index (N - 1) * ${percentile}/100 = ${sFormatted}`,
      scoreBoundaryDescription: `|A - F| <= ${sFormatted} -> magnitude score 2; |A - F| > ${sFormatted} -> magnitude score 3`,
    };

    const mThreshVal = thresholds.momentumThreshold;
    const mFormatted = formatWithUnit(mThreshVal, unit);
    const mDetails: ThresholdDetails = {
      percentile,
      thresholdValue: mThreshVal,
      formattedThreshold: mFormatted,
      meaning: `P${percentile} of the sorted nonzero |A - P| population using linear interpolation at index (N - 1) * ${percentile}/100 = ${mFormatted}`,
      scoreBoundaryDescription: `|A - P| <= ${mFormatted} -> magnitude score 2; |A - P| > ${mFormatted} -> magnitude score 3`,
    };

    return {
      surprise: {
        stats: surpriseStats,
        bins: createHistogramBins(surpriseAbsDeltas, 15),
        selectedThresholdValue: thresholds.surpriseThreshold,
        thresholdPercentile: percentile,
        allDeltasCount: surpriseAbsDeltas.length,
        nonZeroDeltasCount: nonzeroSurpriseAbs.length,
        unit,
        percentileTable: sPercentiles,
        thresholdDetails: sDetails,
      },
      momentum: {
        stats: momentumStats,
        bins: createHistogramBins(momentumAbsDeltas, 15),
        selectedThresholdValue: thresholds.momentumThreshold,
        thresholdPercentile: percentile,
        allDeltasCount: momentumAbsDeltas.length,
        nonZeroDeltasCount: nonzeroMomentumAbs.length,
        unit,
        percentileTable: mPercentiles,
        thresholdDetails: mDetails,
      },
    };
  }

  /**
   * Helper to build fully aligned EventObservations matching query.
   */
  private async buildObservations(
    query: PatternQueryFilters,
    candleSeries: any
  ): Promise<{ allObservations: EventObservation[]; filteredObservations: EventObservation[] }> {
    const currency = query.currency.toUpperCase();
    const eventName = query.eventName;
    const percentile = query.thresholdPercentile || DEFAULT_THRESHOLD_PERCENTILE;
    const scoringMode: ScoringMode = query.scoringMode || DEFAULT_SCORING_MODE;
    const minHistory = query.minHistory ?? DEFAULT_MIN_WALK_FORWARD_HISTORY;
    const pair = query.pair || 'EURUSD';

    const releases = this.calendarRepo.getReleasesForEvent(currency, eventName, query.eventId, query.eventSeriesKey);

    // Sort chronologically ascending by timestamp
    const sortedReleases = [...releases].sort((a, b) => a.timestamp - b.timestamp);

    const allObservations: EventObservation[] = [];
    const filteredObservations: EventObservation[] = [];

    if (scoringMode === 'retrospective') {
      // Retrospective mode: reference population is all nonzero absolute deltas from the selected historical sample
      const nonzeroSurpriseAbs: number[] = [];
      const nonzeroMomentumAbs: number[] = [];

      for (const r of sortedReleases) {
        if (r.hasCompleteAFP) {
          if (r.surpriseAbsDelta !== null && r.surpriseAbsDelta > FLOAT_EPSILON) {
            nonzeroSurpriseAbs.push(canonicalizeNumber(r.surpriseAbsDelta)!);
          }
          if (r.momentumAbsDelta !== null && r.momentumAbsDelta > FLOAT_EPSILON) {
            nonzeroMomentumAbs.push(canonicalizeNumber(r.momentumAbsDelta)!);
          }
        }
      }

      const thresholds = calculateEventThresholds(nonzeroSurpriseAbs, nonzeroMomentumAbs, percentile);
      const sortedSurprise = [...nonzeroSurpriseAbs].sort((a, b) => a - b);
      const sortedMomentum = [...nonzeroMomentumAbs].sort((a, b) => a - b);

      for (const r of sortedReleases) {
        const hasA = r.actual !== null;
        const hasF = r.forecast !== null;
        const hasP = r.previous !== null;
        const isComplete = r.hasCompleteAFP;

        // Surprise score and strict-lower rank
        let surpriseScore: EventScore = null;
        let surprisePercentileRank: number | null = null;
        let surpriseTieCount = 0;
        let surpriseTieRate = 0;
        let surpriseLowerRank: number | null = null;
        let surpriseUpperRank: number | null = null;
        let surpriseReason: string | undefined;

        if (isComplete && hasA && hasF && r.surpriseAbsDelta !== null) {
          const sAbs = canonicalizeNumber(r.surpriseAbsDelta)!;
          if (sAbs <= FLOAT_EPSILON) {
            surpriseScore = 1;
            surprisePercentileRank = null; // Exact match: N/A
            surpriseReason = getScoreClassificationReason('Surprise', r.actual, r.forecast, sAbs, thresholds.surpriseThreshold, percentile, surpriseScore, { scoringMode: 'retrospective' });
          } else {
            surpriseScore = scoreDelta(r.actual, r.forecast, thresholds.surpriseThreshold);
            surprisePercentileRank = calculateStrictLowerPercentileRank(sortedSurprise, sAbs);
            const tieMetrics = calculateTieMetrics(sortedSurprise, sAbs);
            if (tieMetrics) {
              surpriseTieCount = tieMetrics.tieCount;
              surpriseTieRate = tieMetrics.tieRate;
              surpriseLowerRank = tieMetrics.lowerRank;
              surpriseUpperRank = tieMetrics.upperRank;
            }
            surpriseReason = getScoreClassificationReason('Surprise', r.actual, r.forecast, sAbs, thresholds.surpriseThreshold, percentile, surpriseScore, { scoringMode: 'retrospective', tieMetrics });
          }
        }

        // Momentum score and strict-lower rank
        let momentumScore: EventScore = null;
        let momentumPercentileRank: number | null = null;
        let momentumTieCount = 0;
        let momentumTieRate = 0;
        let momentumLowerRank: number | null = null;
        let momentumUpperRank: number | null = null;
        let momentumReason: string | undefined;

        if (isComplete && hasA && hasP && r.momentumAbsDelta !== null) {
          const mAbs = canonicalizeNumber(r.momentumAbsDelta)!;
          if (mAbs <= FLOAT_EPSILON) {
            momentumScore = 1;
            momentumPercentileRank = null; // Exact match: N/A
            momentumReason = getScoreClassificationReason('Momentum', r.actual, r.previous, mAbs, thresholds.momentumThreshold, percentile, momentumScore, { scoringMode: 'retrospective' });
          } else {
            momentumScore = scoreDelta(r.actual, r.previous, thresholds.momentumThreshold);
            momentumPercentileRank = calculateStrictLowerPercentileRank(sortedMomentum, mAbs);
            const tieMetrics = calculateTieMetrics(sortedMomentum, mAbs);
            if (tieMetrics) {
              momentumTieCount = tieMetrics.tieCount;
              momentumTieRate = tieMetrics.tieRate;
              momentumLowerRank = tieMetrics.lowerRank;
              momentumUpperRank = tieMetrics.upperRank;
            }
            momentumReason = getScoreClassificationReason('Momentum', r.actual, r.previous, mAbs, thresholds.momentumThreshold, percentile, momentumScore, { scoringMode: 'retrospective', tieMetrics });
          }
        }

        const alignment = alignEventToCandles(r.timestamp, currency, pair, candleSeries);

        const obs: EventObservation = {
          ...r,
          surpriseScore,
          momentumScore,
          surprisePercentileRank,
          momentumPercentileRank,
          scoringMode,
          priorSurpriseN: sortedSurprise.length,
          priorMomentumN: sortedMomentum.length,
          surpriseTieCount,
          surpriseTieRate,
          surpriseLowerRank,
          surpriseUpperRank,
          momentumTieCount,
          momentumTieRate,
          momentumLowerRank,
          momentumUpperRank,
          surpriseThresholdUsed: thresholds.surpriseThreshold,
          momentumThresholdUsed: thresholds.momentumThreshold,
          surpriseScoreReason: surpriseReason,
          momentumScoreReason: momentumReason,
          pair,
          eventCurrencyPosition: alignment.eventCurrencyPosition,
          directionMultiplier: alignment.directionMultiplier,
          p0Timestamp: alignment.p0Timestamp,
          p0: alignment.p0,
          returns: alignment.returns,
          logReturns: alignment.logReturns,
          rawReturns: alignment.rawReturns,
          crossesWeekend: alignment.crossesWeekend,
          crossesNonWeekendGap: alignment.crossesNonWeekendGap,
          isFridayRelease: alignment.isFridayRelease,
        };

        allObservations.push(obs);
      }
    } else {
      // Walk-Forward mode: timestamp-batched!
      // Group releases by timestamp:
      const timestampGroups = new Map<number, ParsedEventRelease[]>();
      for (const r of sortedReleases) {
        let group = timestampGroups.get(r.timestamp);
        if (!group) {
          group = [];
          timestampGroups.set(r.timestamp, group);
        }
        group.push(r);
      }

      const runningSurprise: number[] = [];
      const runningMomentum: number[] = [];

      for (const groupReleases of timestampGroups.values()) {
        // Compute current thresholds from strictly prior history (timestamp < current.timestamp)
        const sortedPriorSurprise = [...runningSurprise].sort((a, b) => a - b);
        const sortedPriorMomentum = [...runningMomentum].sort((a, b) => a - b);

        const hasMinSurprise = sortedPriorSurprise.length >= minHistory;
        const hasMinMomentum = sortedPriorMomentum.length >= minHistory;

        const sThreshold = hasMinSurprise
          ? calculateQuantile(sortedPriorSurprise, percentile)
          : null;
        const mThreshold = hasMinMomentum
          ? calculateQuantile(sortedPriorMomentum, percentile)
          : null;

        for (const r of groupReleases) {
          const hasA = r.actual !== null;
          const hasF = r.forecast !== null;
          const hasP = r.previous !== null;
          const isComplete = r.hasCompleteAFP;

          let surpriseScore: EventScore = null;
          let surprisePercentileRank: number | null = null;
          let surpriseTieCount = 0;
          let surpriseTieRate = 0;
          let surpriseLowerRank: number | null = null;
          let surpriseUpperRank: number | null = null;
          let surpriseReason: string | undefined;

          if (isComplete && hasA && hasF && r.surpriseAbsDelta !== null) {
            const sAbs = canonicalizeNumber(r.surpriseAbsDelta)!;
            if (sAbs <= FLOAT_EPSILON && hasMinSurprise) {
              surpriseScore = 1;
              surprisePercentileRank = null; // Exact match: N/A
              surpriseReason = getScoreClassificationReason('Surprise', r.actual, r.forecast, sAbs, sThreshold, percentile, surpriseScore, { scoringMode: 'walkForward', priorN: sortedPriorSurprise.length, minHistory });
            } else if (hasMinSurprise && sThreshold !== null) {
              surpriseScore = scoreDelta(r.actual, r.forecast, sThreshold);
              surprisePercentileRank = calculateStrictLowerPercentileRank(sortedPriorSurprise, sAbs);
              const tieMetrics = calculateTieMetrics(sortedPriorSurprise, sAbs);
              if (tieMetrics) {
                surpriseTieCount = tieMetrics.tieCount;
                surpriseTieRate = tieMetrics.tieRate;
                surpriseLowerRank = tieMetrics.lowerRank;
                surpriseUpperRank = tieMetrics.upperRank;
              }
              surpriseReason = getScoreClassificationReason('Surprise', r.actual, r.forecast, sAbs, sThreshold, percentile, surpriseScore, { scoringMode: 'walkForward', priorN: sortedPriorSurprise.length, minHistory, tieMetrics });
            } else {
              surpriseScore = null;
              surprisePercentileRank = null;
              surpriseReason = getScoreClassificationReason('Surprise', r.actual, r.forecast, sAbs, null, percentile, null, { scoringMode: 'walkForward', priorN: sortedPriorSurprise.length, minHistory });
            }
          }

          let momentumScore: EventScore = null;
          let momentumPercentileRank: number | null = null;
          let momentumTieCount = 0;
          let momentumTieRate = 0;
          let momentumLowerRank: number | null = null;
          let momentumUpperRank: number | null = null;
          let momentumReason: string | undefined;

          if (isComplete && hasA && hasP && r.momentumAbsDelta !== null) {
            const mAbs = canonicalizeNumber(r.momentumAbsDelta)!;
            if (mAbs <= FLOAT_EPSILON && hasMinMomentum) {
              momentumScore = 1;
              momentumPercentileRank = null; // Exact match: N/A
              momentumReason = getScoreClassificationReason('Momentum', r.actual, r.previous, mAbs, mThreshold, percentile, momentumScore, { scoringMode: 'walkForward', priorN: sortedPriorMomentum.length, minHistory });
            } else if (hasMinMomentum && mThreshold !== null) {
              momentumScore = scoreDelta(r.actual, r.previous, mThreshold);
              momentumPercentileRank = calculateStrictLowerPercentileRank(sortedPriorMomentum, mAbs);
              const tieMetrics = calculateTieMetrics(sortedPriorMomentum, mAbs);
              if (tieMetrics) {
                momentumTieCount = tieMetrics.tieCount;
                momentumTieRate = tieMetrics.tieRate;
                momentumLowerRank = tieMetrics.lowerRank;
                momentumUpperRank = tieMetrics.upperRank;
              }
              momentumReason = getScoreClassificationReason('Momentum', r.actual, r.previous, mAbs, mThreshold, percentile, momentumScore, { scoringMode: 'walkForward', priorN: sortedPriorMomentum.length, minHistory, tieMetrics });
            } else {
              momentumScore = null;
              momentumPercentileRank = null;
              momentumReason = getScoreClassificationReason('Momentum', r.actual, r.previous, mAbs, null, percentile, null, { scoringMode: 'walkForward', priorN: sortedPriorMomentum.length, minHistory });
            }
          }

          const alignment = alignEventToCandles(r.timestamp, currency, pair, candleSeries);

          const obs: EventObservation = {
            ...r,
            surpriseScore,
            momentumScore,
            surprisePercentileRank,
            momentumPercentileRank,
            scoringMode,
            priorSurpriseN: sortedPriorSurprise.length,
            priorMomentumN: sortedPriorMomentum.length,
            surpriseTieCount,
            surpriseTieRate,
            surpriseLowerRank,
            surpriseUpperRank,
            momentumTieCount,
            momentumTieRate,
            momentumLowerRank,
            momentumUpperRank,
            surpriseThresholdUsed: sThreshold,
            momentumThresholdUsed: mThreshold,
            surpriseScoreReason: surpriseReason,
            momentumScoreReason: momentumReason,
            pair,
            eventCurrencyPosition: alignment.eventCurrencyPosition,
            directionMultiplier: alignment.directionMultiplier,
            p0Timestamp: alignment.p0Timestamp,
            p0: alignment.p0,
            returns: alignment.returns,
            logReturns: alignment.logReturns,
            rawReturns: alignment.rawReturns,
            crossesWeekend: alignment.crossesWeekend,
            crossesNonWeekendGap: alignment.crossesNonWeekendGap,
            isFridayRelease: alignment.isFridayRelease,
          };

          allObservations.push(obs);
        }

        // AFTER EVERY observation at timestamp T has been scored:
        // Add valid observations from T to the running history
        for (const r of groupReleases) {
          if (r.hasCompleteAFP) {
            if (r.surpriseAbsDelta !== null && r.surpriseAbsDelta > FLOAT_EPSILON) {
              runningSurprise.push(canonicalizeNumber(r.surpriseAbsDelta)!);
            }
            if (r.momentumAbsDelta !== null && r.momentumAbsDelta > FLOAT_EPSILON) {
              runningMomentum.push(canonicalizeNumber(r.momentumAbsDelta)!);
            }
          }
        }
      }
    }

    // Apply filtering criteria to allObservations
    for (const obs of allObservations) {
      if (query.requireCompleteAFP !== false && !obs.hasCompleteAFP) {
        continue;
      }

      if (query.surpriseScore !== undefined && query.surpriseScore !== 'all') {
        if (obs.surpriseScore !== query.surpriseScore) continue;
      }

      if (query.momentumScore !== undefined && query.momentumScore !== 'all') {
        if (obs.momentumScore !== query.momentumScore) continue;
      }

      if (query.importance && query.importance !== 'all') {
        if (obs.importance.toLowerCase() !== query.importance.toLowerCase()) continue;
      }

      // Date filtering (supports unix timestamps or ISO date strings YYYY-MM-DD)
      const effectiveDateStart = query.dateStart
        ?? (query.startDate ? Math.floor(new Date(query.startDate).getTime() / 1000) : undefined);
      const effectiveDateEnd = query.dateEnd
        ?? (query.endDate ? Math.floor(new Date(query.endDate + 'T23:59:59Z').getTime() / 1000) : undefined);

      if (effectiveDateStart !== undefined && !isNaN(effectiveDateStart) && obs.timestamp < effectiveDateStart) continue;
      if (effectiveDateEnd !== undefined && !isNaN(effectiveDateEnd) && obs.timestamp > effectiveDateEnd) continue;

      // Day of week filtering (supports number array or single number)
      if (query.dayOfWeek !== undefined && (query.dayOfWeek as any) !== 'all') {
        const day = new Date(obs.timestamp * 1000).getUTCDay();
        if (Array.isArray(query.dayOfWeek)) {
          if (query.dayOfWeek.length > 0 && !query.dayOfWeek.includes(day)) continue;
        } else if (typeof query.dayOfWeek === 'number') {
          if (day !== query.dayOfWeek) continue;
        }
      }

      // Simultaneous releases filter
      if ((query.simultaneousFilter === 'isolated' || query.simultaneousFilter === 'exclude') && obs.simultaneousReleaseCount > 1) {
        continue;
      }
      if ((query.simultaneousFilter === 'simultaneous' || query.simultaneousFilter === 'only') && obs.simultaneousReleaseCount <= 1) {
        continue;
      }

      // Weekend crossing filter
      if (query.weekendFilter === 'excludeFriday' && obs.isFridayRelease) {
        continue;
      }
      if ((query.weekendFilter === 'excludeCrossingWeekend' || query.weekendFilter === 'exclude_crossing') && obs.crossesWeekend) {
        continue;
      }
      if (query.weekendFilter === 'only_crossing' && !obs.crossesWeekend) {
        continue;
      }

      filteredObservations.push(obs);
    }

    return { allObservations, filteredObservations };
  }

  public async getPattern(query: PatternQueryFilters): Promise<PatternResponse> {
    const currency = query.currency.toUpperCase();
    const availablePairs = getPairsForCurrency(this.pairsMap, currency).map((p) => p.pair);
    const selectedPair = query.pair && availablePairs.includes(query.pair.toUpperCase())
      ? query.pair.toUpperCase()
      : availablePairs[0] || 'EURUSD';

    query.pair = selectedPair;

    // Load candle series for selected pair
    const candleSeries = await this.candleRepo.loadPair(selectedPair);

    const { allObservations, filteredObservations } = await this.buildObservations(query, candleSeries);

    const horizons = calculateHorizonStatistics(filteredObservations);

    // Selected horizon for Score Matrix
    const targetHorizon = query.horizon && query.horizon >= 1 && query.horizon <= 42 ? query.horizon : 1;
    const scoreMatrix = calculateScoreMatrix(filteredObservations, targetHorizon);

    // Precompute matrices for all key research horizons so UI switches seamlessly
    const scoreMatrices: Record<number, ScoreMatrixData> = {
      1: calculateScoreMatrix(filteredObservations, 1),
      4: calculateScoreMatrix(filteredObservations, 4),
      8: calculateScoreMatrix(filteredObservations, 8),
      12: calculateScoreMatrix(filteredObservations, 12),
      24: calculateScoreMatrix(filteredObservations, 24),
      42: calculateScoreMatrix(filteredObservations, 42),
    };
    if (!scoreMatrices[targetHorizon]) {
      scoreMatrices[targetHorizon] = scoreMatrix;
    }

    // Build warnings
    const warnings: string[] = [];
    if (/pmi/i.test(query.eventName)) {
      const sourceSeries = this.calendarRepo.getReleasesForEvent(currency, query.eventName, query.eventId, query.eventSeriesKey);
      const activeMonths = new Set(sourceSeries.map((release) => release.date.slice(0, 7))).size;
      const cadence = sourceSeries.length / Math.max(1, activeMonths);
      if (cadence > 1.5) {
        const seriesIdentity = sourceSeries[0]?.eventSeriesKey ?? query.eventSeriesKey ?? 'unknown';
        warnings.push(sourceSeries[0]?.revision === null
          ? `IDENTITY WARNING: legacy series ${seriesIdentity} averages ${cadence.toFixed(2)} releases per active month and may combine flash/final stages. Period/revision metadata is unavailable.`
          : `IDENTITY WARNING: revision-specific series ${seriesIdentity} averages ${cadence.toFixed(2)} releases per active month. Inspect period/revision metadata before treating it as one monthly release stage.`);
      }
    }
    const n = filteredObservations.length;
    if (n === 0) {
      warnings.push('No observations match the current filter criteria.');
    } else if (n < 10) {
      warnings.push('Extremely small sample (N < 10). Interpret cautiously.');
    } else if (n < 30) {
      warnings.push('Small sample (N < 30). Interpret cautiously.');
    }

    const simultaneousCount = filteredObservations.filter((o) => o.simultaneousReleaseCount > 1).length;
    if (simultaneousCount > 0 && query.simultaneousFilter !== 'isolated') {
      warnings.push(
        `${simultaneousCount} of ${n} releases occurred simultaneously with other announcements for ${currency}. Price reaction attribution may be confounded.`
      );
    }

    const weekendCount = filteredObservations.filter((o) => o.crossesWeekend).length;
    if (weekendCount > 0 && query.weekendFilter !== 'excludeCrossingWeekend') {
      warnings.push(
        `${weekendCount} of ${n} paths cross a market weekend gap. Sunday open gaps may influence returns.`
      );
    }

    const nonWeekendGapCount = filteredObservations.filter((o) => o.crossesNonWeekendGap).length;
    if (nonWeekendGapCount > 0) {
      warnings.push(
        `${nonWeekendGapCount} of ${n} paths cross one or more missing non-weekend H1 timestamps. Horizons count available bars, so elapsed wall-clock time is longer for those paths.`
      );
    }

    const missingH42Count = filteredObservations.filter((o) => o.returns[41] === null).length;
    if (missingH42Count > 0) {
      warnings.push(
        `${missingH42Count} observations do not have complete 42-hour post-event market bars (near end of dataset).`
      );
    }

    const samplePaths = filteredObservations.slice(0, 100).map((o) => ({
      eventId: o.eventId,
      valueId: o.valueId,
      timestamp: o.timestamp,
      date: o.date,
      surpriseScore: o.surpriseScore,
      momentumScore: o.momentumScore,
      p0: o.p0,
      returns: o.returns,
      logReturns: o.logReturns,
    }));

    // Precompute full-sample 15-bin histogram distributions for all 42 horizons
    const horizonBins: Record<number, any[]> = {};
    for (let h = 1; h <= 42; h++) {
      const idx = h - 1;
      const validReturns: number[] = [];
      for (const obs of filteredObservations) {
        const r = obs.returns[idx];
        if (r !== null && Number.isFinite(r)) {
          validReturns.push(r);
        }
      }
      horizonBins[h] = createHistogramBins(validReturns, 15);
    }

    const scoringMode = query.scoringMode || DEFAULT_SCORING_MODE;
    const minHistory = query.minHistory || DEFAULT_MIN_WALK_FORWARD_HISTORY;

    return {
      query,
      health: {
        sampleSize: n,
        completeAFPCount: filteredObservations.filter((o) => o.hasCompleteAFP).length,
        missingValueExclusions: allObservations.length - allObservations.filter((o) => o.hasCompleteAFP).length,
        simultaneousReleaseCount: simultaneousCount,
        weekendCrossingCount: weekendCount,
        nonWeekendGapCount,
        fridayReleaseCount: filteredObservations.filter((o) => o.isFridayRelease).length,
        pair: selectedPair,
        eventCurrencyPosition: selectedPair.slice(0, 3) === currency ? 'base' : 'quote',
        dataResolution: 'H1',
        p0AlignmentRule: 'First complete H1 candle beginning at or after event timestamp',
        thresholdPercentile: query.thresholdPercentile || DEFAULT_THRESHOLD_PERCENTILE,
        scoringMode,
        minHistory,
        retrospectiveClassificationWarning: scoringMode === 'walkForward'
          ? 'Walk-forward mode calculates thresholds strictly from prior history (t < current). Minimum history requirement enforced.'
          : RETROSPECTIVE_WARNING,
        warnings,
      },
      horizons,
      samplePaths,
      totalMatchingPaths: n,
      scoreMatrix,
      scoreMatrices,
      availablePairs,
      horizonBins,
    };
  }

  public async getObservations(
    query: PatternQueryFilters,
    page: number = 1,
    pageSize: number = 50,
    sortBy: string = 'timestamp',
    sortDir: 'asc' | 'desc' = 'desc'
  ): Promise<{ total: number; page: number; pageSize: number; items: EventObservation[] }> {
    const currency = query.currency.toUpperCase();
    const availablePairs = getPairsForCurrency(this.pairsMap, currency).map((p) => p.pair);
    const selectedPair = query.pair && availablePairs.includes(query.pair.toUpperCase())
      ? query.pair.toUpperCase()
      : availablePairs[0] || 'EURUSD';

    query.pair = selectedPair;

    const candleSeries = await this.candleRepo.loadPair(selectedPair);
    const { filteredObservations } = await this.buildObservations(query, candleSeries);

    // Sorting
    filteredObservations.sort((a, b) => {
      let valA: any = (a as any)[sortBy];
      let valB: any = (b as any)[sortBy];

      if (valA === undefined || valA === null) valA = sortDir === 'asc' ? Infinity : -Infinity;
      if (valB === undefined || valB === null) valB = sortDir === 'asc' ? Infinity : -Infinity;

      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    const total = filteredObservations.length;
    const startIndex = (page - 1) * pageSize;
    const items = filteredObservations.slice(startIndex, startIndex + pageSize);

    return {
      total,
      page,
      pageSize,
      items,
    };
  }

  public async getRawEventInspection(
    eventId: string,
    valueId: string,
    pair: string,
    thresholdPercentile: number = DEFAULT_THRESHOLD_PERCENTILE,
    scoringMode: ScoringMode = DEFAULT_SCORING_MODE,
    minHistory: number = DEFAULT_MIN_WALK_FORWARD_HISTORY
  ): Promise<any> {
    const rawRows = this.calendarRepo.getRawRows();
    const rawRow = rawRows.find((r) => r.eventId === eventId && (r.valueId === valueId || !valueId));

    if (!rawRow) {
      return null;
    }

    const parsedRelease = this.calendarRepo.getParsedReleases().find(
      (release) => release.eventId === eventId && (release.valueId === valueId || !valueId)
    );
    if (!parsedRelease) return null;
    const releases = this.calendarRepo.getReleasesForEvent(
      rawRow.currency,
      rawRow.eventName,
      rawRow.eventId,
      parsedRelease.eventSeriesKey
    );
    const activeMonths = new Set(releases.map((release) => release.date.slice(0, 7))).size;
    const averageReleasesPerActiveMonth = releases.length / Math.max(1, activeMonths);
    const identityWarning = /pmi/i.test(rawRow.eventName) && averageReleasesPerActiveMonth > 1.5
      ? parsedRelease.revision === null
        ? 'This legacy source event_id may combine flash/final stages; period/revision metadata is unavailable.'
        : 'This revision-specific source series still has unusually high monthly cadence. Inspect its exported period/revision metadata before treating it as one release stage.'
      : null;

    // Reference populations depending on scoringMode
    const referenceReleases = scoringMode === 'walkForward'
      ? releases.filter((r) => r.timestamp < rawRow.timestamp)
      : releases;

    const nonzeroSurpriseAbs: number[] = [];
    const nonzeroMomentumAbs: number[] = [];
    for (const r of referenceReleases) {
      if (r.hasCompleteAFP) {
        if (r.surpriseAbsDelta !== null && r.surpriseAbsDelta > FLOAT_EPSILON) {
          nonzeroSurpriseAbs.push(canonicalizeNumber(r.surpriseAbsDelta)!);
        }
        if (r.momentumAbsDelta !== null && r.momentumAbsDelta > FLOAT_EPSILON) {
          nonzeroMomentumAbs.push(canonicalizeNumber(r.momentumAbsDelta)!);
        }
      }
    }

    const sortedSurprise = [...nonzeroSurpriseAbs].sort((a, b) => a - b);
    const sortedMomentum = [...nonzeroMomentumAbs].sort((a, b) => a - b);
    const unit = parsedRelease.unit || releases.find((r) => r.unit)?.unit;

    const hasMinSurprise = scoringMode === 'retrospective' || sortedSurprise.length >= minHistory;
    const hasMinMomentum = scoringMode === 'retrospective' || sortedMomentum.length >= minHistory;

    const surpriseThreshold = hasMinSurprise ? calculateQuantile(sortedSurprise, thresholdPercentile) : null;
    const momentumThreshold = hasMinMomentum ? calculateQuantile(sortedMomentum, thresholdPercentile) : null;

    const sAbs = parsedRelease.surpriseAbsDelta !== null ? canonicalizeNumber(parsedRelease.surpriseAbsDelta)! : null;
    const mAbs = parsedRelease.momentumAbsDelta !== null ? canonicalizeNumber(parsedRelease.momentumAbsDelta)! : null;

    // Surprise scoring & rank
    let surpriseScore: EventScore = null;
    let surprisePercentileRank: number | null = null;
    let surpriseTieMetrics: TieMetrics | null = null;
    let surpriseReason: string;

    if (parsedRelease.hasCompleteAFP && parsedRelease.actual !== null && parsedRelease.forecast !== null && sAbs !== null) {
      if (sAbs <= FLOAT_EPSILON && hasMinSurprise) {
        surpriseScore = 1;
        surprisePercentileRank = null; // Exact match: N/A
        surpriseReason = getScoreClassificationReason('Surprise', parsedRelease.actual, parsedRelease.forecast, sAbs, surpriseThreshold, thresholdPercentile, surpriseScore, { scoringMode, priorN: sortedSurprise.length, minHistory });
      } else if (hasMinSurprise && surpriseThreshold !== null) {
        surpriseScore = scoreDelta(parsedRelease.actual, parsedRelease.forecast, surpriseThreshold);
        surprisePercentileRank = calculateStrictLowerPercentileRank(sortedSurprise, sAbs);
        surpriseTieMetrics = calculateTieMetrics(sortedSurprise, sAbs);
        surpriseReason = getScoreClassificationReason('Surprise', parsedRelease.actual, parsedRelease.forecast, sAbs, surpriseThreshold, thresholdPercentile, surpriseScore, { scoringMode, priorN: sortedSurprise.length, minHistory, tieMetrics: surpriseTieMetrics });
      } else {
        surpriseScore = null;
        surprisePercentileRank = null;
        surpriseReason = getScoreClassificationReason('Surprise', parsedRelease.actual, parsedRelease.forecast, sAbs, null, thresholdPercentile, null, { scoringMode, priorN: sortedSurprise.length, minHistory });
      }
    } else {
      surpriseReason = 'Incomplete data: Actual or Forecast is missing (Score: N/A)';
    }

    // Momentum scoring & rank
    let momentumScore: EventScore = null;
    let momentumPercentileRank: number | null = null;
    let momentumTieMetrics: TieMetrics | null = null;
    let momentumReason: string;

    if (parsedRelease.hasCompleteAFP && parsedRelease.actual !== null && parsedRelease.previous !== null && mAbs !== null) {
      if (mAbs <= FLOAT_EPSILON && hasMinMomentum) {
        momentumScore = 1;
        momentumPercentileRank = null; // Exact match: N/A
        momentumReason = getScoreClassificationReason('Momentum', parsedRelease.actual, parsedRelease.previous, mAbs, momentumThreshold, thresholdPercentile, momentumScore, { scoringMode, priorN: sortedMomentum.length, minHistory });
      } else if (hasMinMomentum && momentumThreshold !== null) {
        momentumScore = scoreDelta(parsedRelease.actual, parsedRelease.previous, momentumThreshold);
        momentumPercentileRank = calculateStrictLowerPercentileRank(sortedMomentum, mAbs);
        momentumTieMetrics = calculateTieMetrics(sortedMomentum, mAbs);
        momentumReason = getScoreClassificationReason('Momentum', parsedRelease.actual, parsedRelease.previous, mAbs, momentumThreshold, thresholdPercentile, momentumScore, { scoringMode, priorN: sortedMomentum.length, minHistory, tieMetrics: momentumTieMetrics });
      } else {
        momentumScore = null;
        momentumPercentileRank = null;
        momentumReason = getScoreClassificationReason('Momentum', parsedRelease.actual, parsedRelease.previous, mAbs, null, thresholdPercentile, null, { scoringMode, priorN: sortedMomentum.length, minHistory });
      }
    } else {
      momentumReason = 'Incomplete data: Actual or Previous is missing (Score: N/A)';
    }

    const surprisePercentileTable: PercentileThresholdRow[] = [50, 60, 70, 75, 80, 85, 90, 95].map((p) => {
      const val = hasMinSurprise ? calculateQuantile(sortedSurprise, p) : null;
      return { percentile: p, label: `P${p}`, threshold: val, formattedThreshold: formatWithUnit(val, unit) };
    });

    const momentumPercentileTable: PercentileThresholdRow[] = [50, 60, 70, 75, 80, 85, 90, 95].map((p) => {
      const val = hasMinMomentum ? calculateQuantile(sortedMomentum, p) : null;
      return { percentile: p, label: `P${p}`, threshold: val, formattedThreshold: formatWithUnit(val, unit) };
    });

    const surpriseAudit = {
      name: 'Surprise (|Actual - Forecast|)',
      scoringMode,
      classificationModeLabel: scoringMode === 'walkForward' ? WALK_FORWARD_LABEL : RETROSPECTIVE_LABEL,
      referencePopulationIdentity: {
        eventSeriesKey: parsedRelease.eventSeriesKey,
        eventId: parsedRelease.eventId,
        countryCode: parsedRelease.countryCode,
        currency: parsedRelease.currency,
        eventName: parsedRelease.eventName,
        revision: parsedRelease.revision,
        periodTimestamp: parsedRelease.periodTimestamp,
        sourceSeriesObservations: releases.length,
        activeMonths,
        averageReleasesPerActiveMonth,
        identityWarning,
      },
      rawA: rawRow.actualRaw,
      rawF: rawRow.forecastRaw,
      parsedA: parsedRelease.actual,
      parsedF: parsedRelease.forecast,
      actual: parsedRelease.actual,
      comparison: parsedRelease.forecast,
      comparisonType: 'Forecast' as const,
      rawDelta: parsedRelease.surpriseDelta,
      absDelta: parsedRelease.surpriseAbsDelta,
      priorValidObservations: sortedSurprise.length,
      historicalDistributionN: sortedSurprise.length,
      minHistoryRequired: scoringMode === 'walkForward' ? minHistory : 0,
      hasSufficientHistory: hasMinSurprise,
      percentileTable: surprisePercentileTable,
      observationPercentileRank: surprisePercentileRank,
      strictLowerPercentileRank: surprisePercentileRank,
      tieCount: surpriseTieMetrics?.tieCount ?? 0,
      tieRate: surpriseTieMetrics?.tieRate ?? 0,
      percentileBand: surpriseTieMetrics?.band ?? (sAbs !== null && sAbs <= FLOAT_EPSILON ? 'N/A — exact match' : 'N/A'),
      selectedClassificationBoundary: {
        percentile: thresholdPercentile,
        threshold: surpriseThreshold,
        formatted: formatWithUnit(surpriseThreshold, unit),
      },
      result: surpriseScore,
      reason: surpriseReason,
    };

    const momentumAudit = {
      name: 'Momentum (|Actual - Previous|)',
      scoringMode,
      classificationModeLabel: scoringMode === 'walkForward' ? WALK_FORWARD_LABEL : RETROSPECTIVE_LABEL,
      rawA: rawRow.actualRaw,
      rawP: rawRow.previousRaw,
      parsedA: parsedRelease.actual,
      parsedP: parsedRelease.previous,
      actual: parsedRelease.actual,
      comparison: parsedRelease.previous,
      comparisonType: 'Previous' as const,
      rawDelta: parsedRelease.momentumDelta,
      absDelta: parsedRelease.momentumAbsDelta,
      priorValidObservations: sortedMomentum.length,
      historicalDistributionN: sortedMomentum.length,
      minHistoryRequired: scoringMode === 'walkForward' ? minHistory : 0,
      hasSufficientHistory: hasMinMomentum,
      percentileTable: momentumPercentileTable,
      observationPercentileRank: momentumPercentileRank,
      strictLowerPercentileRank: momentumPercentileRank,
      tieCount: momentumTieMetrics?.tieCount ?? 0,
      tieRate: momentumTieMetrics?.tieRate ?? 0,
      percentileBand: momentumTieMetrics?.band ?? (mAbs !== null && mAbs <= FLOAT_EPSILON ? 'N/A — exact match' : 'N/A'),
      selectedClassificationBoundary: {
        percentile: thresholdPercentile,
        threshold: momentumThreshold,
        formatted: formatWithUnit(momentumThreshold, unit),
      },
      result: momentumScore,
      reason: momentumReason,
    };

    // Candle series alignment
    const candleSeries = await this.candleRepo.loadPair(pair);
    const alignment = alignEventToCandles(rawRow.timestamp, rawRow.currency, pair, candleSeries);

    // Candle context (3 bars before, P0 bar, 5 bars after)
    let candleContext: any[] = [];
    if (candleSeries && alignment.p0Timestamp !== null) {
      const p0Idx = candleSeries.times.indexOf(alignment.p0Timestamp);
      if (p0Idx !== -1) {
        const start = Math.max(0, p0Idx - 3);
        const end = Math.min(candleSeries.times.length, p0Idx + 6);
        for (let i = start; i < end; i++) {
          candleContext.push({
            time: candleSeries.times[i],
            date: formatBrokerServerDateTime(candleSeries.times[i]),
            open: candleSeries.opens[i],
            high: candleSeries.highs[i],
            low: candleSeries.lows[i],
            close: candleSeries.closes[i],
            isP0: i === p0Idx,
            relativeBar: i - p0Idx,
          });
        }
      }
    }

    return {
      rawRow,
      parsedRelease: {
        ...parsedRelease,
        surprisePercentileRank,
        momentumPercentileRank,
        scoringMode,
      },
      scoringMode,
      classificationModeLabel: scoringMode === 'walkForward' ? WALK_FORWARD_LABEL : RETROSPECTIVE_LABEL,
      surpriseAudit,
      momentumAudit,
      thresholds: {
        percentile: thresholdPercentile,
        surpriseThreshold,
        momentumThreshold,
        historicalSampleSize: releases.length,
        priorValidSurpriseN: sortedSurprise.length,
        priorValidMomentumN: sortedMomentum.length,
      },
      scores: {
        surpriseScore,
        momentumScore,
      },
      alignment,
      candleContext,
    };
  }

  public async getFamilyComparison(currency: string, pair?: string): Promise<any[]> {
    const availablePairs = getPairsForCurrency(this.pairsMap, currency).map((p) => p.pair);
    const selectedPair = pair || availablePairs[0] || 'EURUSD';
    const candleSeries = await this.candleRepo.loadPair(selectedPair);

    const allReleases = this.calendarRepo.getParsedReleases().filter(
      (r) => r.currency.toUpperCase() === currency.toUpperCase() && r.hasCompleteAFP
    );

    const familyMap = new Map<string, EventObservation[]>();
    for (const fam of EVENT_FAMILIES) {
      familyMap.set(fam, []);
    }

    for (const r of allReleases) {
      const alignment = alignEventToCandles(r.timestamp, currency, selectedPair, candleSeries);
      const obs: EventObservation = {
        ...r,
        surpriseScore: null,
        momentumScore: null,
        surprisePercentileRank: null,
        momentumPercentileRank: null,
        pair: selectedPair,
        eventCurrencyPosition: alignment.eventCurrencyPosition,
        directionMultiplier: alignment.directionMultiplier,
        p0Timestamp: alignment.p0Timestamp,
        p0: alignment.p0,
        returns: alignment.returns,
        logReturns: alignment.logReturns,
        rawReturns: alignment.rawReturns,
        crossesWeekend: alignment.crossesWeekend,
        crossesNonWeekendGap: alignment.crossesNonWeekendGap,
        isFridayRelease: alignment.isFridayRelease,
      };

      const list = familyMap.get(r.eventFamily) || [];
      list.push(obs);
      familyMap.set(r.eventFamily, list);
    }

    const comparisonList: any[] = [];
    for (const fam of EVENT_FAMILIES) {
      const obsList = familyMap.get(fam) || [];
      const stats = calculateHorizonStatistics(obsList);

      const getMed = (h: number) => stats[h - 1]?.median ?? null;
      const getPos = (h: number) => stats[h - 1]?.positiveDirectionRate ?? null;

      comparisonList.push({
        family: fam,
        n: obsList.length,
        medianH1: getMed(1),
        medianH4: getMed(4),
        medianH8: getMed(8),
        medianH12: getMed(12),
        medianH24: getMed(24),
        medianH42: getMed(42),
        positiveH12: getPos(12),
        positiveH24: getPos(24),
        positiveH42: getPos(42),
      });
    }

    return comparisonList;
  }

  public async getDataQuality(): Promise<any> {
    const overview = await this.getOverview();
    const pairs = Array.from(this.pairsMap.values());
    const manifest = this.calendarRepo.getSourceMetadata();
    const isV31 = manifest.schema_version === 'fyodor-mt5-research-export/3.1.0';

    return {
      overview,
      calendarProvenance: {
        sourceFilename: isV31 ? 'calendar_releases.csv' : 'fyodor_calendar_master_history_repaired.csv',
        provider: isV31 ? 'MetaQuotes economic calendar via MetaTrader 5' : 'MetaQuotes / MetaTrader 5 economic calendar (inferred)',
        schemaVersion: manifest.schema_version || 'legacy/unversioned',
        exporterVersion: manifest.exporter_version || null,
        exportId: manifest.export_id || null,
        terminalCompany: manifest.terminal_company || null,
        accountCompany: manifest.account_company || null,
        accountServer: manifest.account_server || null,
        snapshotServerUtcOffsetSeconds: manifest.trade_server_minus_gmt_seconds_snapshot || null,
        timestampConvention: manifest.timestamp_convention || 'Broker trade-server wall-clock encoded as Unix-like seconds; historical UTC offsets are not preserved',
        preservedFields: isV31
          ? ['event_id', 'value_id', 'timestamp', 'period', 'revision', 'currency', 'country_code', 'event_name', 'importance', 'impact_type', 'event_code', 'event_type', 'sector', 'frequency', 'time_mode', 'unit', 'multiplier', 'digits', 'source_url', 'actual', 'forecast', 'previous', 'revised_previous', 'raw scaled integers']
          : ['event_id', 'value_id', 'timestamp', 'currency', 'country_code', 'event_name', 'importance', 'actual', 'forecast', 'previous', 'revised_previous'],
        missingMetaQuotesFields: isV31 ? [] : ['period', 'revision', 'frequency', 'unit', 'multiplier', 'digits', 'source_url', 'event_code'],
        provenanceStatus: isV31
          ? 'Manifested v3.1 exporter output; no calendar repair transform is applied by the lab.'
          : 'Legacy repaired file: repair transformation provenance is unknown.',
      },
      pairsAudit: pairs.map((p) => ({
        pair: p.pair,
        base: p.base,
        quote: p.quote,
        sourceFilename: p.filename,
        barCount: p.barCount,
        earliestDate: p.earliestDate,
        latestDate: p.latestDate,
      })),
      duplicateResolution: 'Authoritative single source file candles_{PAIR}_H1.csv selected for each instrument.',
    };
  }
}
