import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { CalendarRepository } from '../data/calendarLoader.js';
import { CandleRepository, type CandleSeries } from '../data/candleLoader.js';
import { discoverFXPairs } from '../data/pairDiscovery.js';
import { AnalyticsService } from '../analytics/analyticsService.js';
import { gapCrossesWeekend } from '../analytics/eventAligner.js';
import type { ParsedEventRelease, ScoringMode } from '../shared/types.js';
import { resolveResearchDataSource } from '../data/dataSourceResolver.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const source = resolveResearchDataSource(repoRoot);
const { calendarPath, candlesDir } = source;
const outputPath = path.join(repoRoot, 'lab', 'audit_exports', 'codex_quant_audit.json');

const round8 = (value: number): number => Math.round(value * 1e8) / 1e8;

function quantileType7(values: number[], percentile: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].map(round8).sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];
  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  return round8(sorted[lower] + (index - lower) * (sorted[upper] - sorted[lower]));
}

function distributionAudit(values: number[], observation: number) {
  const sorted = [...values].map(round8).sort((a, b) => a - b);
  const x = round8(observation);
  if (x === 0) {
    return {
      n: sorted.length,
      p75Type7: quantileType7(sorted, 75),
      strictLowerCount: null,
      strictLowerRank: null,
      tieCount: 0,
      tieRatePct: 0,
      lowerRank: null,
      upperRank: null,
    };
  }
  const lowerCount = sorted.filter((value) => value < x).length;
  const tieCount = sorted.filter((value) => value === x).length;
  return {
    n: sorted.length,
    p75Type7: quantileType7(sorted, 75),
    strictLowerCount: lowerCount,
    strictLowerRank: round8((lowerCount / sorted.length) * 100),
    tieCount,
    tieRatePct: round8((tieCount / sorted.length) * 100),
    lowerRank: round8((lowerCount / sorted.length) * 100),
    upperRank: round8(((lowerCount + tieCount) / sorted.length) * 100),
  };
}

function score(delta: number, threshold: number | null, priorN: number, mode: ScoringMode, minHistory = 20) {
  if (mode === 'walkForward' && priorN < minHistory) return null;
  const canonicalDelta = round8(delta);
  if (canonicalDelta === 0) return 1;
  if (threshold === null) return null;
  const magnitude = Math.abs(canonicalDelta) > threshold ? 3 : 2;
  return canonicalDelta > 0 ? magnitude : -magnitude;
}

function firstAtOrAfter(times: number[], timestamp: number): number {
  let low = 0;
  let high = times.length - 1;
  let answer = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (times[middle] >= timestamp) {
      answer = middle;
      high = middle - 1;
    } else {
      low = middle + 1;
    }
  }
  return answer;
}

function independentPrices(release: ParsedEventRelease, pair: string, candles: CandleSeries) {
  const index = firstAtOrAfter(candles.times, release.timestamp);
  if (index < 0) return null;
  const p0 = candles.opens[index];
  const position = pair.slice(0, 3) === release.currency ? 'base' : 'quote';
  const horizons = [1, 2, 4, 12, 24, 42].map((horizon) => {
    const candleIndex = index + horizon - 1;
    if (candleIndex >= candles.times.length) return { horizon, closeTimestamp: null, close: null };
    const close = candles.closes[candleIndex];
    const rawPairSimpleReturn = close / p0 - 1;
    return {
      horizon,
      closeTimestamp: candles.times[candleIndex],
      close,
      rawPairSimpleReturn,
      eventCurrencySimpleReturn: position === 'base' ? rawPairSimpleReturn : p0 / close - 1,
      normalizedLogReturn: (position === 'base' ? 1 : -1) * Math.log(close / p0),
    };
  });
  return {
    position,
    p0Index: index,
    p0Timestamp: candles.times[index],
    p0,
    priorCandle: index > 0 ? {
      timestamp: candles.times[index - 1],
      open: candles.opens[index - 1],
      close: candles.closes[index - 1],
    } : null,
    horizons,
  };
}

async function auditCase(
  calendar: CalendarRepository,
  candles: CandleRepository,
  service: AnalyticsService,
  eventId: string,
  valueId: string,
  pair: string
) {
  const release = calendar.getParsedReleases().find((row) => row.eventId === eventId && row.valueId === valueId);
  if (!release) throw new Error(`Missing audit release ${eventId}/${valueId}`);
  const sourceSeries = calendar.getReleasesForEvent(
    release.currency,
    release.eventName,
    eventId,
    release.eventSeriesKey
  );
  const pairCandles = await candles.loadPair(pair);
  if (!pairCandles) throw new Error(`Missing candles for ${pair}`);

  const makeMode = async (mode: ScoringMode) => {
    const reference = (mode === 'walkForward'
      ? sourceSeries.filter((row) => row.timestamp < release.timestamp)
      : sourceSeries
    ).filter((row) => row.hasCompleteAFP);
    const surprisePopulation = reference
      .map((row) => row.surpriseAbsDelta === null ? null : round8(row.surpriseAbsDelta))
      .filter((value): value is number => value !== null && value > 1e-9);
    const momentumPopulation = reference
      .map((row) => row.momentumAbsDelta === null ? null : round8(row.momentumAbsDelta))
      .filter((value): value is number => value !== null && value > 1e-9);
    const surpriseMagnitude = round8(release.surpriseAbsDelta ?? NaN);
    const momentumMagnitude = round8(release.momentumAbsDelta ?? NaN);
    const surpriseDistribution = distributionAudit(surprisePopulation, surpriseMagnitude);
    const momentumDistribution = distributionAudit(momentumPopulation, momentumMagnitude);
    const engine = await service.getRawEventInspection(eventId, valueId, pair, 75, mode, 20);
    return {
      referenceCutoff: mode === 'walkForward' ? `timestamp < ${release.timestamp}` : 'full source event_id + revision history',
      surprise: {
        ...surpriseDistribution,
        independentScore: score(release.surpriseDelta!, surpriseDistribution.p75Type7, surpriseDistribution.n, mode),
        engineThreshold: engine.surpriseAudit.selectedClassificationBoundary.threshold,
        engineRank: engine.surpriseAudit.strictLowerPercentileRank,
        engineTieCount: engine.surpriseAudit.tieCount,
        engineScore: engine.scores.surpriseScore,
      },
      momentum: {
        ...momentumDistribution,
        independentScore: score(release.momentumDelta!, momentumDistribution.p75Type7, momentumDistribution.n, mode),
        engineThreshold: engine.momentumAudit.selectedClassificationBoundary.threshold,
        engineRank: engine.momentumAudit.strictLowerPercentileRank,
        engineTieCount: engine.momentumAudit.tieCount,
        engineScore: engine.scores.momentumScore,
      },
    };
  };

  const prices = independentPrices(release, pair, pairCandles);
  const engine = await service.getRawEventInspection(eventId, valueId, pair, 75, 'retrospective', 20);
  return {
    identity: {
      eventSeriesKey: release.eventSeriesKey,
      eventId,
      valueId,
      countryCode: release.countryCode,
      currency: release.currency,
      eventName: release.eventName,
      periodTimestamp: release.periodTimestamp,
      revision: release.revision,
      sourceFile: release.sourceFile,
    },
    raw: {
      timestamp: release.timestamp,
      brokerServerDateTime: release.date,
      actualRaw: release.actualRaw,
      forecastRaw: release.forecastRaw,
      previousRaw: release.previousRaw,
      revisedPreviousRaw: release.revisedPreviousRaw,
    },
    parsed: {
      actual: release.actual,
      forecast: release.forecast,
      previous: release.previous,
      revisedPrevious: release.revisedPrevious,
      surpriseDelta: release.surpriseDelta,
      surpriseAbsDelta: release.surpriseAbsDelta,
      momentumDelta: release.momentumDelta,
      momentumAbsDelta: release.momentumAbsDelta,
    },
    simultaneous: {
      count: release.simultaneousReleaseCount,
      others: release.simultaneousEventIdentities,
    },
    retrospective: await makeMode('retrospective'),
    walkForward: await makeMode('walkForward'),
    independentPrices: prices,
    enginePriceCheck: {
      p0Timestamp: engine.alignment.p0Timestamp,
      p0: engine.alignment.p0,
      horizons: [1, 2, 4, 12, 24, 42].map((horizon) => ({
        horizon,
        rawPairSimpleReturn: engine.alignment.rawReturns[horizon - 1],
        eventCurrencySimpleReturn: engine.alignment.returns[horizon - 1],
        normalizedLogReturn: engine.alignment.logReturns[horizon - 1],
      })),
      crossesWeekend: engine.alignment.crossesWeekend,
      crossesNonWeekendGap: engine.alignment.crossesNonWeekendGap,
    },
  };
}

async function main() {
  const calendar = new CalendarRepository(calendarPath, source.manifest);
  await calendar.load();
  const pairs = discoverFXPairs(candlesDir);
  const candles = new CandleRepository(candlesDir, pairs);
  const service = new AnalyticsService(calendar, candles, pairs);
  const rows = calendar.getParsedReleases();

  const pmiRows = rows.filter((row) => row.currency === 'EUR' && row.eventName === 'S&P Global Manufacturing PMI');
  const byEventSeries = Array.from(new Set(pmiRows.map((row) => row.eventSeriesKey))).map((eventSeriesKey) => {
    const series = pmiRows.filter((row) => row.eventSeriesKey === eventSeriesKey);
    const activeMonths = new Set(series.map((row) => row.date.slice(0, 7))).size;
    return {
      eventSeriesKey,
      eventId: series[0].eventId,
      revision: series[0].revision,
      countryCode: series[0].countryCode,
      rows: series.length,
      activeMonths,
      releasesPerActiveMonth: round8(series.length / activeMonths),
      completeAFP: series.filter((row) => row.hasCompleteAFP).length,
    };
  }).sort((a, b) => a.eventSeriesKey.localeCompare(b.eventSeriesKey));

  const cases = await Promise.all([
    auditCase(calendar, candles, service, '840030005', '229745', 'EURUSD'),
    auditCase(calendar, candles, service, '840030005', '229744', 'USDJPY'),
    auditCase(calendar, candles, service, '840030005', '229741', 'EURUSD'),
    auditCase(calendar, candles, service, '840030006', '229757', 'EURUSD'),
    auditCase(calendar, candles, service, '840010001', '115719', 'EURUSD'),
    auditCase(calendar, candles, service, '999500001', '118422', 'EURUSD'),
    auditCase(calendar, candles, service, '840030016', '277623', 'EURUSD'),
  ]);

  const candleIntegrity = [];
  for (const pair of pairs.keys()) {
    const series = await candles.loadPair(pair);
    if (!series) continue;
    let duplicateTimestamps = 0;
    let outOfOrderTimestamps = 0;
    let nonHourlyTimestamps = 0;
    let weekendGaps = 0;
    let nonWeekendGaps = 0;
    let invalidOhlcRows = 0;
    for (let index = 0; index < series.times.length; index++) {
      if (series.times[index] % 3600 !== 0) nonHourlyTimestamps++;
      if (series.highs[index] < Math.max(series.opens[index], series.closes[index]) ||
          series.lows[index] > Math.min(series.opens[index], series.closes[index])) {
        invalidOhlcRows++;
      }
      if (index === 0) continue;
      const gap = series.times[index] - series.times[index - 1];
      if (gap === 0) duplicateTimestamps++;
      if (gap < 0) outOfOrderTimestamps++;
      if (gap > 3600) {
        if (gapCrossesWeekend(series.times[index - 1], series.times[index])) weekendGaps++;
        else nonWeekendGaps++;
      }
    }
    candleIntegrity.push({
      pair,
      rows: series.times.length,
      duplicateTimestamps,
      outOfOrderTimestamps,
      nonHourlyTimestamps,
      weekendGaps,
      nonWeekendGaps,
      invalidOhlcRows,
    });
  }

  const rawKeySet = new Set<string>();
  let duplicateEventValueRows = 0;
  for (const row of calendar.getRawRows()) {
    const key = `${row.eventId}:${row.valueId}`;
    if (rawKeySet.has(key)) duplicateEventValueRows++;
    rawKeySet.add(key);
  }

  const fileBytes = fs.readFileSync(calendarPath);
  const evidence = {
    generatedAt: new Date().toISOString(),
    methodology: {
      quantile: 'Hyndman-Fan type 7 / index=(N-1)*p with linear interpolation',
      rank: 'strict-lower count(v < x) / N * 100 after 8-decimal canonicalization',
      population: 'valid complete-A/F/P, nonzero absolute deltas within one MetaQuotes event_id + revision series',
      timestamp: 'broker trade-server wall-clock; snapshot server-minus-GMT offset is manifested but historical DST offsets are not reconstructed',
    },
    source: {
      path: path.relative(repoRoot, calendarPath).replace(/\\/g, '/'),
      sha256: crypto.createHash('sha256').update(fileBytes).digest('hex'),
      bytes: fileBytes.length,
      rows: rows.length,
      duplicateEventValueRows,
      kind: source.kind,
      label: source.label,
      manifest: source.manifest,
    },
    candleIntegrity: {
      pairCount: candleIntegrity.length,
      totalRows: candleIntegrity.reduce((sum, pair) => sum + pair.rows, 0),
      totals: {
        duplicateTimestamps: candleIntegrity.reduce((sum, pair) => sum + pair.duplicateTimestamps, 0),
        outOfOrderTimestamps: candleIntegrity.reduce((sum, pair) => sum + pair.outOfOrderTimestamps, 0),
        nonHourlyTimestamps: candleIntegrity.reduce((sum, pair) => sum + pair.nonHourlyTimestamps, 0),
        weekendGaps: candleIntegrity.reduce((sum, pair) => sum + pair.weekendGaps, 0),
        nonWeekendGaps: candleIntegrity.reduce((sum, pair) => sum + pair.nonWeekendGaps, 0),
        invalidOhlcRows: candleIntegrity.reduce((sum, pair) => sum + pair.invalidOhlcRows, 0),
      },
      byPair: candleIntegrity,
    },
    eurPmiIdentityAudit: {
      pooledDisplayNameRows: pmiRows.length,
      pooledActiveMonths: new Set(pmiRows.map((row) => row.date.slice(0, 7))).size,
      byEventSeries,
      finding: 'The v3.1 period/revision fields split each MetaQuotes event_id into source-declared revision/stage series. These identities are used independently throughout the analytics pipeline.',
    },
    externalCrossChecks: [
      {
        eventId: '840030005', valueId: '229745', field: 'actual', rawValue: 0.2,
        externalValue: 0.2, classification: 'Actual matches official BLS July 2025 CPI release',
        source: 'https://www.bls.gov/news.release/archives/cpi_08122025.htm',
      },
      {
        eventId: '840030005', valueId: '229745', field: 'forecast', rawValue: 0.6,
        externalValue: 0.2, classification: 'Forecast discrepancy; cause unknown (provider consensus difference vs repair/extraction defect cannot be resolved from repository)',
        source: 'Reuters poll reported by https://www.investing.com/news/economy/us-inflation-rises-in-july-in-line-with-expectations-4185127',
      },
      {
        eventId: '840010001', valueId: '115719', field: 'actual', rawValue: 0.3,
        externalValue: 0.3, classification: 'Actual matches official BEA August 2020 core PCE price index release',
        source: 'https://www.bea.gov/news/2020/personal-income-and-outlays-august-2020',
      },
    ],
    cases,
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${path.relative(repoRoot, outputPath)} (${cases.length} real-data cases)`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
