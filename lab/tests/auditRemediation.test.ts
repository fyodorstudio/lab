import { describe, it, expect, beforeAll } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { CalendarRepository } from '../src/data/calendarLoader.js';
import { CandleRepository } from '../src/data/candleLoader.js';
import { discoverFXPairs } from '../src/data/pairDiscovery.js';
import { AnalyticsService } from '../src/analytics/analyticsService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Forensic Audit Remediation Verification Tests', () => {
  let analyticsService: AnalyticsService;

  beforeAll(async () => {
    const repoRoot = path.resolve(__dirname, '../..');
    const calendarPath = path.join(
      repoRoot,
      'raw_data',
      'economic calendar',
      'fyodor_calendar_master_history_repaired.csv'
    );
    const candlesDir = path.join(repoRoot, 'raw_data', 'fyodor_candles');

    const calendarRepo = new CalendarRepository(calendarPath);
    await calendarRepo.load();

    const pairsMap = discoverFXPairs(candlesDir);
    const candleRepo = new CandleRepository(candlesDir, pairsMap);

    analyticsService = new AnalyticsService(calendarRepo, candleRepo, pairsMap);
  }, 30000);

  describe('1. Data Quality Counters & Hygiene', () => {
    it('provides real forensic metrics without hardcoded zeros', async () => {
      const quality = await analyticsService.getDataQuality();
      expect(quality).toBeDefined();
      expect(quality.overview).toBeDefined();

      const { overview } = quality;
      expect(overview.calendarRecordCount).toBe(126469);
      expect(typeof overview.rejectedRowCount).toBe('number');
      expect(typeof overview.malformedTimestampCount).toBe('number');
      expect(typeof overview.duplicateTimestampCount).toBe('number');
      expect(typeof overview.unknownFamilyCount).toBe('number');
      expect(overview.rejectedRowCount).toBe(0); // Validated CSV integrity
      expect(overview.malformedTimestampCount).toBe(0);
      expect(overview.duplicateTimestampCount).toBeGreaterThan(0); // Real multi-releases detected
    });
  });

  describe('2. Multi-Horizon Score Matrix Computation', () => {
    it('precomputes score matrices across all key horizons (1, 4, 8, 12, 24, 42)', async () => {
      const pattern = await analyticsService.getPattern({
        currency: 'USD',
        eventName: 'CPI y/y',
        pair: 'EURUSD',
        thresholdPercentile: 75,
        horizon: 4,
      });

      expect(pattern.scoreMatrices).toBeDefined();
      expect(pattern.scoreMatrices![1]).toBeDefined();
      expect(pattern.scoreMatrices![4]).toBeDefined();
      expect(pattern.scoreMatrices![8]).toBeDefined();
      expect(pattern.scoreMatrices![12]).toBeDefined();
      expect(pattern.scoreMatrices![24]).toBeDefined();
      expect(pattern.scoreMatrices![42]).toBeDefined();

      // Ensure horizon 4 matrix differs from horizon 1 matrix
      const h1Mean = pattern.scoreMatrices![1].matrix[0][0].meanReturn;
      const h4Mean = pattern.scoreMatrices![4].matrix[0][0].meanReturn;
      // If there are observations in (0,0), returns will change over 4 hours vs 1 hour
      if (pattern.scoreMatrices![1].matrix[0][0].count > 0 && pattern.scoreMatrices![4].matrix[0][0].count > 0) {
        expect(h1Mean).not.toBe(h4Mean);
      }
    });

    it('dynamically computes score matrix for non-standard requested horizon (e.g. H18)', async () => {
      const pattern = await analyticsService.getPattern({
        currency: 'USD',
        eventName: 'CPI y/y',
        pair: 'EURUSD',
        thresholdPercentile: 75,
        horizon: 18,
      });

      expect(pattern.scoreMatrices![18]).toBeDefined();
      expect(pattern.scoreMatrix.horizon).toBe(18);
    });
  });

  describe('3. Robust Filter Parameter Handling', () => {
    it('filters correctly by Date Range using ISO strings', async () => {
      const allPattern = await analyticsService.getPattern({
        currency: 'USD',
        eventName: 'CPI y/y',
        pair: 'EURUSD',
      });

      const dateFiltered = await analyticsService.getPattern({
        currency: 'USD',
        eventName: 'CPI y/y',
        pair: 'EURUSD',
        startDate: '2018-01-01',
        endDate: '2020-12-31',
      });

      expect(dateFiltered.health.sampleSize).toBeGreaterThan(0);
      expect(dateFiltered.health.sampleSize).toBeLessThan(allPattern.health.sampleSize);
    });

    it('filters correctly by Day of Week (both array and single number)', async () => {
      // CPI is often released on Tuesday (2), Wednesday (3), or Thursday (4)
      const wednesdayArray = await analyticsService.getPattern({
        currency: 'USD',
        eventName: 'CPI y/y',
        pair: 'EURUSD',
        dayOfWeek: [3],
      });

      const wednesdaySingle = await analyticsService.getPattern({
        currency: 'USD',
        eventName: 'CPI y/y',
        pair: 'EURUSD',
        dayOfWeek: 3 as any,
      });

      expect(wednesdayArray.health.sampleSize).toBe(wednesdaySingle.health.sampleSize);
      expect(wednesdayArray.health.sampleSize).toBeGreaterThan(0);
    });

    it('filters correctly by Simultaneous releases using both aliases', async () => {
      // 1. Simultaneous / only alias test (CPI y/y is consistently co-released with CPI m/m)
      const simPattern = await analyticsService.getPattern({
        currency: 'USD',
        eventName: 'CPI y/y',
        pair: 'EURUSD',
        simultaneousFilter: 'simultaneous',
      });

      const onlyPattern = await analyticsService.getPattern({
        currency: 'USD',
        eventName: 'CPI y/y',
        pair: 'EURUSD',
        simultaneousFilter: 'only' as any,
      });

      expect(simPattern.health.sampleSize).toBe(onlyPattern.health.sampleSize);
      expect(simPattern.health.sampleSize).toBeGreaterThan(0);

      // 2. Isolated / exclude alias test (equivalently excludes all co-releases)
      const isolatedPattern = await analyticsService.getPattern({
        currency: 'USD',
        eventName: 'CPI y/y',
        pair: 'EURUSD',
        simultaneousFilter: 'isolated',
      });

      const excludePattern = await analyticsService.getPattern({
        currency: 'USD',
        eventName: 'CPI y/y',
        pair: 'EURUSD',
        simultaneousFilter: 'exclude' as any,
      });

      expect(isolatedPattern.health.sampleSize).toBe(excludePattern.health.sampleSize);
    });

    it('filters correctly by Weekend crossings using both aliases', async () => {
      const excludeWeekendCrossing = await analyticsService.getPattern({
        currency: 'USD',
        eventName: 'CPI y/y',
        pair: 'EURUSD',
        weekendFilter: 'excludeCrossingWeekend',
      });

      const excludeCrossingAlias = await analyticsService.getPattern({
        currency: 'USD',
        eventName: 'CPI y/y',
        pair: 'EURUSD',
        weekendFilter: 'exclude_crossing' as any,
      });

      expect(excludeWeekendCrossing.health.sampleSize).toBe(excludeCrossingAlias.health.sampleSize);
      expect(excludeWeekendCrossing.health.sampleSize).toBeGreaterThan(0);
    });
  });
});
