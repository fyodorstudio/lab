import { beforeAll, describe, expect, it } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { AnalyticsService } from '../src/analytics/analyticsService.js';
import { CalendarRepository } from '../src/data/calendarLoader.js';
import { CandleRepository, type CandleSeries } from '../src/data/candleLoader.js';
import { discoverFXPairs } from '../src/data/pairDiscovery.js';
import type { ParsedEventRelease } from '../src/shared/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function release(valueId: string, timestamp: number, delta: number): ParsedEventRelease {
  const actual = 100 + delta;
  return {
    eventId: 'TEST_EVENT',
    valueId,
    timestamp,
    date: new Date(timestamp * 1000).toISOString().replace('.000Z', ''),
    currency: 'USD',
    countryCode: 'US',
    eventName: 'Synthetic Identity Test',
    normalizedEventName: 'Synthetic Identity Test',
    eventSeriesKey: 'USD:US:TEST_EVENT',
    eventFamily: 'Other',
    importance: 'high',
    actualRaw: String(actual),
    forecastRaw: '100',
    previousRaw: '100',
    revisedPreviousRaw: null,
    actual,
    forecast: 100,
    previous: 100,
    revisedPrevious: null,
    surpriseDelta: delta,
    momentumDelta: delta,
    surpriseAbsDelta: Math.abs(delta),
    momentumAbsDelta: Math.abs(delta),
    hasCompleteAFP: true,
    simultaneousReleaseCount: 1,
    simultaneousEvents: [],
    simultaneousEventIdentities: [],
    sourceFile: 'synthetic.csv',
  };
}

describe('Confirmed quantitative audit defects and invariants', () => {
  let service: AnalyticsService;
  let calendarRepo: CalendarRepository;

  beforeAll(async () => {
    const repoRoot = path.resolve(__dirname, '../..');
    const calendarPath = path.join(repoRoot, 'raw_data', 'economic calendar', 'fyodor_calendar_master_history_repaired.csv');
    const candlesDir = path.join(repoRoot, 'raw_data', 'fyodor_candles');
    calendarRepo = new CalendarRepository(calendarPath);
    await calendarRepo.load();
    const pairs = discoverFXPairs(candlesDir);
    service = new AnalyticsService(calendarRepo, new CandleRepository(candlesDir, pairs), pairs);
  }, 30000);

  it('separates same-name EUR PMI populations by MetaQuotes event_id', async () => {
    const matching = (await service.getEvents('EUR')).filter(
      (series) => series.eventName === 'S&P Global Manufacturing PMI'
    );
    expect(matching).toHaveLength(5);
    expect(matching.map((series) => series.eventId).sort()).toEqual(
      ['250500001', '276500001', '380500001', '724500001', '999500001']
    );
    expect(matching.find((series) => series.eventId === '999500001')?.count).toBe(281);
    expect(matching.find((series) => series.eventId === '999500001')?.identityWarning).toContain('flash/final');

    await expect(
      service.getDistribution('EUR', 'S&P Global Manufacturing PMI', 75)
    ).rejects.toThrow(/Ambiguous event name/);
  });

  it('preserves source identity and source filename on parsed observations', () => {
    const row = calendarRepo.getParsedReleases().find((item) => item.valueId === '229745');
    expect(row?.eventSeriesKey).toBe('USD:US:840030005');
    expect(row?.sourceFile).toBe('fyodor_calendar_master_history_repaired.csv');
  });

  it('uses the same eligible population for displayed thresholds and scoring', async () => {
    const distribution = await service.getDistribution('EUR', 'S&P Global Manufacturing PMI', 75, '999500001');
    const inspection = await service.getRawEventInspection('999500001', '118422', 'EURUSD', 75, 'retrospective', 20);
    expect(distribution.surprise.selectedThresholdValue).toBe(
      inspection.surpriseAudit.selectedClassificationBoundary.threshold
    );
    expect(distribution.surprise.nonZeroDeltasCount).toBe(inspection.surpriseAudit.historicalDistributionN);
  });

  it('computes score matrices from the filtered sample, not the unfiltered series', async () => {
    const pattern = await service.getPattern({
      currency: 'USD',
      eventName: 'CPI y/y',
      eventId: '840030007',
      pair: 'EURUSD',
      startDate: '2019-01-01',
      endDate: '2020-12-31',
      surpriseScore: 3,
      scoringMode: 'retrospective',
    });
    const matrixN = pattern.scoreMatrix.matrix.flat().reduce((sum, cell) => sum + cell.n, 0);
    expect(matrixN).toBe(pattern.horizons[0].n);
    expect(matrixN).toBeGreaterThan(0);
  });

  it('batches equal timestamps and suppresses exact-zero scores below minimum history', async () => {
    const start = Date.UTC(2024, 0, 1, 0, 0, 0) / 1000;
    const prior = Array.from({ length: 20 }, (_, index) => release(String(index), start + index * 7200, index + 1));
    const sharedTimestamp = start + 50 * 7200;
    const releases = [...prior, release('same-a', sharedTimestamp, 0), release('same-b', sharedTimestamp, 30)];

    const fakeCalendar = {
      getReleasesForEvent: () => releases,
    };
    const times = Array.from({ length: 200 }, (_, index) => start + index * 3600);
    const series: CandleSeries = {
      pair: 'EURUSD',
      times,
      opens: times.map(() => 1.1),
      highs: times.map(() => 1.11),
      lows: times.map(() => 1.09),
      closes: times.map(() => 1.101),
    };
    const fakeCandles = { loadPair: async () => series };
    const pairs = new Map([
      ['EURUSD', { pair: 'EURUSD', base: 'EUR', quote: 'USD', filename: 'synthetic.csv', barCount: 200, earliestTimestamp: times[0], latestTimestamp: times.at(-1)!, earliestDate: '', latestDate: '' }],
    ]);
    const syntheticService = new AnalyticsService(fakeCalendar as any, fakeCandles as any, pairs);

    const withTwenty = await syntheticService.getObservations({
      currency: 'USD', eventName: 'Synthetic Identity Test', eventId: 'TEST_EVENT', pair: 'EURUSD',
      scoringMode: 'walkForward', minHistory: 20,
    }, 1, 100, 'timestamp', 'asc');
    const sameTimestamp = withTwenty.items.filter((item) => item.timestamp === sharedTimestamp);
    expect(sameTimestamp).toHaveLength(2);
    expect(sameTimestamp.map((item) => item.priorSurpriseN)).toEqual([20, 20]);
    expect(sameTimestamp.find((item) => item.valueId === 'same-a')?.surpriseScore).toBe(1);

    const withTwentyOne = await syntheticService.getObservations({
      currency: 'USD', eventName: 'Synthetic Identity Test', eventId: 'TEST_EVENT', pair: 'EURUSD',
      scoringMode: 'walkForward', minHistory: 21,
    }, 1, 100, 'timestamp', 'asc');
    expect(withTwentyOne.items.find((item) => item.valueId === 'same-a')?.surpriseScore).toBeNull();
  });
});
