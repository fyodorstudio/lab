import { describe, it, expect, beforeAll } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { calculatePercentileRank, formatWithUnit } from '../src/shared/utils.js';
import { getScoreClassificationReason } from '../src/analytics/eventScorer.js';
import { CalendarRepository } from '../src/data/calendarLoader.js';
import { CandleRepository } from '../src/data/candleLoader.js';
import { discoverFXPairs } from '../src/data/pairDiscovery.js';
import { AnalyticsService } from '../src/analytics/analyticsService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Percentile Transparency & Auditability Engine', () => {
  describe('calculatePercentileRank', () => {
    it('returns null for empty array or null value', () => {
      expect(calculatePercentileRank([], 0.5)).toBeNull();
      expect(calculatePercentileRank([0.1, 0.2], null as any)).toBeNull();
      expect(calculatePercentileRank([0.1, 0.2], NaN)).toBeNull();
    });

    it('computes exact empirical percentile rank: (count <= val) / N * 100', () => {
      // 10 sorted non-zero deltas: 0.10 to 1.00
      const sorted = [0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90, 1.00];

      // 0.50 is the 5th value: exactly 5 values <= 0.50 -> 50.0%
      expect(calculatePercentileRank(sorted, 0.50)).toBe(50.0);

      // 0.75: 7 values (0.10..0.70) <= 0.75 -> 7 / 10 * 100 = 70.0%
      expect(calculatePercentileRank(sorted, 0.75)).toBe(70.0);

      // 1.00: all 10 values <= 1.00 -> 100.0%
      expect(calculatePercentileRank(sorted, 1.00)).toBe(100.0);

      // 0.05: below all elements -> 0.0%
      expect(calculatePercentileRank(sorted, 0.05)).toBe(0.0);

      // 1.50: above all elements -> 100.0%
      expect(calculatePercentileRank(sorted, 1.50)).toBe(100.0);
    });

    it('handles repeated values correctly', () => {
      const sorted = [0.1, 0.2, 0.2, 0.2, 0.5];
      // Value 0.2: 4 elements (0.1, 0.2, 0.2, 0.2) <= 0.2 -> 4/5 * 100 = 80.0%
      expect(calculatePercentileRank(sorted, 0.2)).toBe(80.0);
    });
  });

  describe('formatWithUnit', () => {
    it('formats numbers with units appropriately', () => {
      expect(formatWithUnit(0.25, '%')).toBe('0.25%');
      expect(formatWithUnit(150, 'K')).toBe('150.0K');
      expect(formatWithUnit(3.14159, 'M', 3)).toBe('3.14M');
      expect(formatWithUnit(0.12)).toBe('0.12');
      expect(formatWithUnit(null, '%')).toBe('N/A');
      expect(formatWithUnit(NaN, '%')).toBe('N/A');
    });
  });

  describe('getScoreClassificationReason', () => {
    it('generates mathematical justifications for all 5 score categories', () => {
      // In-line / Equal (+1)
      const reasonInline = getScoreClassificationReason('Surprise', 2.0, 2.0, 0.0, 0.20, 75, 1);
      expect(reasonInline).toContain('Inline/Neutral (+1)');

      // Large positive surprise (+3)
      const reasonP3 = getScoreClassificationReason('Surprise', 2.5, 2.0, 0.50, 0.20, 75, 3);
      expect(reasonP3).toContain('Large Positive (+3)');
      expect(reasonP3).toContain('|Delta| (0.500) > P75 (0.200)');

      // Moderate positive surprise (+2)
      const reasonP2 = getScoreClassificationReason('Surprise', 2.15, 2.0, 0.15, 0.20, 75, 2);
      expect(reasonP2).toContain('Medium Positive (+2)');
      expect(reasonP2).toContain('|Delta| (0.150) <= P75 (0.200)');

      // Moderate negative surprise (-2)
      const reasonM2 = getScoreClassificationReason('Surprise', 1.85, 2.0, 0.15, 0.20, 75, -2);
      expect(reasonM2).toContain('Medium Negative (-2)');
      expect(reasonM2).toContain('|Delta| (0.150) <= P75 (0.200)');

      // Large negative surprise (-3)
      const reasonM3 = getScoreClassificationReason('Surprise', 1.5, 2.0, 0.50, 0.20, 75, -3);
      expect(reasonM3).toContain('Large Negative (-3)');
      expect(reasonM3).toContain('|Delta| (0.500) > P75 (0.200)');
    });
  });

  describe('Integrated Distribution & Audit Model', () => {
    let service: AnalyticsService;

    beforeAll(async () => {
      const repoRoot = path.resolve(__dirname, '../..');
      const calendarCsv = path.join(
        repoRoot,
        'raw_data',
        'economic calendar',
        'fyodor_calendar_master_history_repaired.csv'
      );
      const candlesDir = path.join(repoRoot, 'raw_data', 'fyodor_candles');
      const calendarRepo = new CalendarRepository(calendarCsv);
      await calendarRepo.load();
      const pairsMap = discoverFXPairs(candlesDir);
      const candleRepo = new CandleRepository(candlesDir, pairsMap);
      service = new AnalyticsService(calendarRepo, candleRepo, pairsMap);
    }, 30000);

    it('returns complete P50..P95 percentile table in getDistribution', async () => {
      const dist = await service.getDistribution('USD', 'CPI m/m', 75);
      expect(dist).toBeDefined();
      expect(dist.surprise).toBeDefined();
      expect(dist.surprise.percentileTable).toBeInstanceOf(Array);
      expect(dist.surprise.percentileTable.length).toBe(8); // P50, P60, P70, P75, P80, P85, P90, P95

      const p75Row = dist.surprise.percentileTable.find((r) => r.label === 'P75');
      expect(p75Row).toBeDefined();
      expect(p75Row?.threshold).not.toBeNull();
      expect(typeof p75Row?.threshold).toBe('number');
      expect(dist.surprise.thresholdDetails.percentile).toBe(75);
      expect(dist.surprise.thresholdDetails.meaning).toContain('linear interpolation');
      expect(dist.surprise.thresholdDetails.scoreBoundaryDescription).toContain('magnitude score');
    });

    it('provides observation percentile rank and step-by-step audit in getRawEventInspection', async () => {
      const events = await service.getObservations({
        currency: 'USD',
        eventName: 'CPI m/m',
        pair: 'EURUSD',
      }, 1, 10);

      expect(events.items.length).toBeGreaterThan(0);
      const first = events.items[0];

      // Observation has computed percentile ranks (or null if delta is null)
      if (first.actual !== null && first.forecast !== null) {
        expect(first.surprisePercentileRank).not.toBeNull();
        expect(typeof first.surprisePercentileRank).toBe('number');
        expect(first.surprisePercentileRank).toBeGreaterThanOrEqual(0);
        expect(first.surprisePercentileRank).toBeLessThanOrEqual(100);
      }

      // Check inspection endpoint
      const inspection = await service.getRawEventInspection(first.eventId, first.valueId, 'EURUSD', 75);
      expect(inspection).toBeDefined();
      expect(inspection.surpriseAudit).toBeDefined();
      expect(inspection.momentumAudit).toBeDefined();
      expect(inspection.surpriseAudit.reason).toBeTruthy();
      expect(inspection.surpriseAudit.percentileTable.length).toBe(8);
    });
  });
});
