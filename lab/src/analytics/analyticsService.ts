import {
  CalendarRepository,
} from '../data/calendarLoader.js';
import { CandleRepository } from '../data/candleLoader.js';
import { FXPairInfo, OverviewMetrics, PatternQueryFilters, PatternResponse, DistributionResponse, EventObservation, EventScore, HorizonStatistics, ScoreMatrixData, PercentileThresholdRow, ThresholdDetails } from '../shared/types.js';
import { calculateDistributionStats, createHistogramBins, calculateQuantile, calculatePercentileRank, formatWithUnit } from '../shared/utils.js';
import { calculateEventThresholds, scoreDelta, getScoreClassificationReason } from './eventScorer.js';
import { alignEventToCandles } from './eventAligner.js';
import { calculateHorizonStatistics, calculateScoreMatrix } from './statisticsEngine.js';
import { getPairsForCurrency } from '../data/pairDiscovery.js';
import { DEFAULT_THRESHOLD_PERCENTILE, RETROSPECTIVE_WARNING, EVENT_FAMILIES } from '../shared/constants.js';

export interface IAnalyticsService {
  getOverview(): Promise<OverviewMetrics>;
  getCurrencies(): Promise<string[]>;
  getEvents(currency: string, family?: string): Promise<Array<{ eventName: string; family: string; count: number; importance: string }>>;
  getPairs(currency: string): Promise<FXPairInfo[]>;
  getDistribution(currency: string, eventName: string, percentile?: number): Promise<{ surprise: DistributionResponse; momentum: DistributionResponse }>;
  getPattern(query: PatternQueryFilters): Promise<PatternResponse>;
  getObservations(query: PatternQueryFilters, page?: number, pageSize?: number, sortBy?: string, sortDir?: 'asc' | 'desc'): Promise<{ total: number; page: number; pageSize: number; items: EventObservation[] }>;
  getRawEventInspection(eventId: string, valueId: string, pair: string, thresholdPercentile?: number): Promise<any>;
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

  public async getEvents(currency: string, family?: string): Promise<Array<{ eventName: string; family: string; count: number; importance: string }>> {
    const releases = this.calendarRepo.getParsedReleases().filter((r) => r.currency.toUpperCase() === currency.toUpperCase());
    const eventMap = new Map<string, { family: string; count: number; importance: string }>();

    for (const r of releases) {
      if (family && r.eventFamily.toLowerCase() !== family.toLowerCase()) {
        continue;
      }
      const existing = eventMap.get(r.eventName);
      if (!existing) {
        eventMap.set(r.eventName, {
          family: r.eventFamily,
          count: 1,
          importance: r.importance,
        });
      } else {
        existing.count++;
      }
    }

    const result = Array.from(eventMap.entries()).map(([eventName, data]) => ({
      eventName,
      family: data.family,
      count: data.count,
      importance: data.importance,
    }));

    result.sort((a, b) => b.count - a.count);
    return result;
  }

  public async getPairs(currency: string): Promise<FXPairInfo[]> {
    return getPairsForCurrency(this.pairsMap, currency);
  }

  public async getDistribution(
    currency: string,
    eventName: string,
    percentile: number = DEFAULT_THRESHOLD_PERCENTILE
  ): Promise<{ surprise: DistributionResponse; momentum: DistributionResponse }> {
    const releases = this.calendarRepo.getReleasesForEvent(currency, eventName);

    const surpriseAbsDeltas: number[] = [];
    const momentumAbsDeltas: number[] = [];
    const nonzeroSurpriseAbs: number[] = [];
    const nonzeroMomentumAbs: number[] = [];

    for (const r of releases) {
      if (r.surpriseAbsDelta !== null) {
        surpriseAbsDeltas.push(r.surpriseAbsDelta);
        if (r.surpriseAbsDelta > 1e-12) nonzeroSurpriseAbs.push(r.surpriseAbsDelta);
      }
      if (r.momentumAbsDelta !== null) {
        momentumAbsDeltas.push(r.momentumAbsDelta);
        if (r.momentumAbsDelta > 1e-12) nonzeroMomentumAbs.push(r.momentumAbsDelta);
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
      meaning: `${percentile}% of historical nonzero absolute surprise deltas |A - F| are <= ${sFormatted}, and ${100 - percentile}% are > ${sFormatted}`,
      scoreBoundaryDescription: `|A - F| <= ${sFormatted} -> magnitude score 2; |A - F| > ${sFormatted} -> magnitude score 3`,
    };

    const mThreshVal = thresholds.momentumThreshold;
    const mFormatted = formatWithUnit(mThreshVal, unit);
    const mDetails: ThresholdDetails = {
      percentile,
      thresholdValue: mThreshVal,
      formattedThreshold: mFormatted,
      meaning: `${percentile}% of historical nonzero absolute momentum deltas |A - P| are <= ${mFormatted}, and ${100 - percentile}% are > ${mFormatted}`,
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
    const pair = query.pair || 'EURUSD';

    const releases = this.calendarRepo.getReleasesForEvent(currency, eventName);

    // Calculate historical thresholds for this exact event
    const nonzeroSurpriseAbs: number[] = [];
    const nonzeroMomentumAbs: number[] = [];

    for (const r of releases) {
      if (r.surpriseAbsDelta !== null && r.surpriseAbsDelta > 1e-12) {
        nonzeroSurpriseAbs.push(r.surpriseAbsDelta);
      }
      if (r.momentumAbsDelta !== null && r.momentumAbsDelta > 1e-12) {
        nonzeroMomentumAbs.push(r.momentumAbsDelta);
      }
    }

    const thresholds = calculateEventThresholds(nonzeroSurpriseAbs, nonzeroMomentumAbs, percentile);
    const sortedSurprise = [...nonzeroSurpriseAbs].sort((a, b) => a - b);
    const sortedMomentum = [...nonzeroMomentumAbs].sort((a, b) => a - b);

    const allObservations: EventObservation[] = [];
    const filteredObservations: EventObservation[] = [];

    for (const r of releases) {
      // Score calculation
      const surpriseScore = r.hasCompleteAFP
        ? scoreDelta(r.actual, r.forecast, thresholds.surpriseThreshold)
        : null;

      const momentumScore = r.hasCompleteAFP
        ? scoreDelta(r.actual, r.previous, thresholds.momentumThreshold)
        : null;

      const surprisePercentileRank = (r.hasCompleteAFP && r.surpriseAbsDelta !== null)
        ? calculatePercentileRank(sortedSurprise, r.surpriseAbsDelta)
        : null;

      const momentumPercentileRank = (r.hasCompleteAFP && r.momentumAbsDelta !== null)
        ? calculatePercentileRank(sortedMomentum, r.momentumAbsDelta)
        : null;

      // Candle alignment
      const alignment = alignEventToCandles(r.timestamp, currency, pair, candleSeries);

      const obs: EventObservation = {
        ...r,
        surpriseScore,
        momentumScore,
        surprisePercentileRank,
        momentumPercentileRank,
        pair,
        eventCurrencyPosition: alignment.eventCurrencyPosition,
        directionMultiplier: alignment.directionMultiplier,
        p0Timestamp: alignment.p0Timestamp,
        p0: alignment.p0,
        returns: alignment.returns,
        rawReturns: alignment.rawReturns,
        crossesWeekend: alignment.crossesWeekend,
        isFridayRelease: alignment.isFridayRelease,
      };

      allObservations.push(obs);

      // Filtering criteria
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
    const scoreMatrix = calculateScoreMatrix(allObservations, targetHorizon);

    // Precompute matrices for all key research horizons so UI switches seamlessly
    const scoreMatrices: Record<number, ScoreMatrixData> = {
      1: calculateScoreMatrix(allObservations, 1),
      4: calculateScoreMatrix(allObservations, 4),
      8: calculateScoreMatrix(allObservations, 8),
      12: calculateScoreMatrix(allObservations, 12),
      24: calculateScoreMatrix(allObservations, 24),
      42: calculateScoreMatrix(allObservations, 42),
    };
    if (!scoreMatrices[targetHorizon]) {
      scoreMatrices[targetHorizon] = scoreMatrix;
    }

    // Build warnings
    const warnings: string[] = [];
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

    return {
      query,
      health: {
        sampleSize: n,
        completeAFPCount: filteredObservations.filter((o) => o.hasCompleteAFP).length,
        missingValueExclusions: allObservations.length - allObservations.filter((o) => o.hasCompleteAFP).length,
        simultaneousReleaseCount: simultaneousCount,
        weekendCrossingCount: weekendCount,
        fridayReleaseCount: filteredObservations.filter((o) => o.isFridayRelease).length,
        pair: selectedPair,
        eventCurrencyPosition: selectedPair.slice(0, 3) === currency ? 'base' : 'quote',
        dataResolution: 'H1',
        p0AlignmentRule: 'First complete H1 candle beginning at or after event timestamp',
        thresholdPercentile: query.thresholdPercentile || DEFAULT_THRESHOLD_PERCENTILE,
        retrospectiveClassificationWarning: RETROSPECTIVE_WARNING,
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
    thresholdPercentile: number = DEFAULT_THRESHOLD_PERCENTILE
  ): Promise<any> {
    const rawRows = this.calendarRepo.getRawRows();
    const rawRow = rawRows.find((r) => r.eventId === eventId && (r.valueId === valueId || !valueId));

    if (!rawRow) {
      return null;
    }

    const releases = this.calendarRepo.getReleasesForEvent(rawRow.currency, rawRow.eventName);
    const parsedRelease = releases.find((r) => r.eventId === eventId && r.valueId === valueId) || releases[0];

    // Historical threshold calculation
    const nonzeroSurpriseAbs: number[] = [];
    const nonzeroMomentumAbs: number[] = [];
    for (const r of releases) {
      if (r.surpriseAbsDelta !== null && r.surpriseAbsDelta > 1e-12) nonzeroSurpriseAbs.push(r.surpriseAbsDelta);
      if (r.momentumAbsDelta !== null && r.momentumAbsDelta > 1e-12) nonzeroMomentumAbs.push(r.momentumAbsDelta);
    }
    const thresholds = calculateEventThresholds(nonzeroSurpriseAbs, nonzeroMomentumAbs, thresholdPercentile);
    const sortedSurprise = [...nonzeroSurpriseAbs].sort((a, b) => a - b);
    const sortedMomentum = [...nonzeroMomentumAbs].sort((a, b) => a - b);
    const unit = parsedRelease.unit || releases.find((r) => r.unit)?.unit;

    const surpriseScore = parsedRelease.hasCompleteAFP
      ? scoreDelta(parsedRelease.actual, parsedRelease.forecast, thresholds.surpriseThreshold)
      : null;
    const momentumScore = parsedRelease.hasCompleteAFP
      ? scoreDelta(parsedRelease.actual, parsedRelease.previous, thresholds.momentumThreshold)
      : null;

    const surprisePercentileRank = (parsedRelease.hasCompleteAFP && parsedRelease.surpriseAbsDelta !== null)
      ? calculatePercentileRank(sortedSurprise, parsedRelease.surpriseAbsDelta)
      : null;
    const momentumPercentileRank = (parsedRelease.hasCompleteAFP && parsedRelease.momentumAbsDelta !== null)
      ? calculatePercentileRank(sortedMomentum, parsedRelease.momentumAbsDelta)
      : null;

    const surprisePercentileTable: PercentileThresholdRow[] = [50, 60, 70, 75, 80, 85, 90, 95].map((p) => {
      const val = calculateQuantile(sortedSurprise, p);
      return { percentile: p, label: `P${p}`, threshold: val, formattedThreshold: formatWithUnit(val, unit) };
    });

    const momentumPercentileTable: PercentileThresholdRow[] = [50, 60, 70, 75, 80, 85, 90, 95].map((p) => {
      const val = calculateQuantile(sortedMomentum, p);
      return { percentile: p, label: `P${p}`, threshold: val, formattedThreshold: formatWithUnit(val, unit) };
    });

    const surpriseAudit = {
      name: 'Surprise (|Actual - Forecast|)',
      actual: parsedRelease.actual,
      comparison: parsedRelease.forecast,
      comparisonType: 'Forecast' as const,
      rawDelta: parsedRelease.surpriseDelta,
      absDelta: parsedRelease.surpriseAbsDelta,
      historicalDistributionN: nonzeroSurpriseAbs.length,
      percentileTable: surprisePercentileTable,
      observationPercentileRank: surprisePercentileRank,
      selectedClassificationBoundary: {
        percentile: thresholdPercentile,
        threshold: thresholds.surpriseThreshold,
        formatted: formatWithUnit(thresholds.surpriseThreshold, unit),
      },
      result: surpriseScore,
      reason: getScoreClassificationReason('Surprise', parsedRelease.actual, parsedRelease.forecast, parsedRelease.surpriseAbsDelta, thresholds.surpriseThreshold, thresholdPercentile, surpriseScore),
    };

    const momentumAudit = {
      name: 'Momentum (|Actual - Previous|)',
      actual: parsedRelease.actual,
      comparison: parsedRelease.previous,
      comparisonType: 'Previous' as const,
      rawDelta: parsedRelease.momentumDelta,
      absDelta: parsedRelease.momentumAbsDelta,
      historicalDistributionN: nonzeroMomentumAbs.length,
      percentileTable: momentumPercentileTable,
      observationPercentileRank: momentumPercentileRank,
      selectedClassificationBoundary: {
        percentile: thresholdPercentile,
        threshold: thresholds.momentumThreshold,
        formatted: formatWithUnit(thresholds.momentumThreshold, unit),
      },
      result: momentumScore,
      reason: getScoreClassificationReason('Momentum', parsedRelease.actual, parsedRelease.previous, parsedRelease.momentumAbsDelta, thresholds.momentumThreshold, thresholdPercentile, momentumScore),
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
            date: new Date(candleSeries.times[i] * 1000).toISOString(),
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
      },
      surpriseAudit,
      momentumAudit,
      thresholds: {
        percentile: thresholdPercentile,
        surpriseThreshold: thresholds.surpriseThreshold,
        momentumThreshold: thresholds.momentumThreshold,
        historicalSampleSize: releases.length,
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
        rawReturns: alignment.rawReturns,
        crossesWeekend: alignment.crossesWeekend,
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

    return {
      overview,
      pairsAudit: pairs.map((p) => ({
        pair: p.pair,
        base: p.base,
        quote: p.quote,
        sourceFilename: p.filename,
        barCount: p.barCount,
        earliestDate: p.earliestDate,
        latestDate: p.latestDate,
      })),
      duplicateResolution: 'Autoritative single source file candles_{PAIR}_H1.csv selected for each instrument.',
    };
  }
}
