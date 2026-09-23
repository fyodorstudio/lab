import { describe, it, expect, beforeAll } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  canonicalizeNumber,
  calculateStrictLowerPercentileRank,
  calculateTieMetrics,
  calculatePercentileRank,
  calculateQuantile,
} from '../src/shared/utils.js';
import { scoreDelta, getScoreClassificationReason } from '../src/analytics/eventScorer.js';
import { alignEventToCandles } from '../src/analytics/eventAligner.js';
import { CalendarRepository } from '../src/data/calendarLoader.js';
import { CandleRepository } from '../src/data/candleLoader.js';
import { discoverFXPairs } from '../src/data/pairDiscovery.js';
import { AnalyticsService } from '../src/analytics/analyticsService.js';
import { FLOAT_EPSILON, CANONICAL_DECIMALS } from '../src/shared/constants.js';
import type { CandleSeries } from '../src/data/candleLoader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Walk-Forward and Strict-Lower Percentile Research Integrity', () => {
  describe('Canonical Numeric Comparison & Floating-Point Safety', () => {
    it('canonicalizes floating-point values to 8 decimal places deterministically', () => {
      const floatA = 0.1 + 0.2; // 0.30000000000000004
      const floatB = 0.3;
      expect(floatA).not.toBe(floatB);
      expect(canonicalizeNumber(floatA)).toBe(canonicalizeNumber(floatB));
      expect(canonicalizeNumber(floatA)).toBe(0.3);
    });

    it('handles null, undefined, NaN, and infinity safely in canonicalizeNumber', () => {
      expect(canonicalizeNumber(null)).toBeNull();
      expect(canonicalizeNumber(undefined)).toBeNull();
      expect(canonicalizeNumber(NaN)).toBeNull();
      expect(canonicalizeNumber(Infinity)).toBeNull();
      expect(canonicalizeNumber(-Infinity)).toBeNull();
    });

    it('strictly requires absDelta > threshold + epsilon for magnitude 3 score', () => {
      const threshold = 0.20;
      // Exact tie: absDelta == threshold -> must stay magnitude 2
      expect(scoreDelta(1.20, 1.00, threshold)).toBe(2);
      expect(scoreDelta(0.80, 1.00, threshold)).toBe(-2);

      // Slightly within epsilon of threshold: must stay magnitude 2
      expect(scoreDelta(1.20 + 0.5 * FLOAT_EPSILON, 1.00, threshold)).toBe(2);

      // Strictly exceeds threshold: magnitude 3
      expect(scoreDelta(1.2001, 1.00, threshold)).toBe(3);
      expect(scoreDelta(0.7999, 1.00, threshold)).toBe(-3);
    });

    it('assigns score +1 and null percentile rank for exact match (|A - F| <= epsilon)', () => {
      expect(scoreDelta(1.00, 1.00, 0.20)).toBe(1);
      expect(scoreDelta(1.00 + 0.5 * FLOAT_EPSILON, 1.00, 0.20)).toBe(1);
    });
  });

  describe('Strict-Lower Percentile Rank & Tie Diagnostics', () => {
    it('computes strict-lower rank count(v < x) / N * 100 on reference population', () => {
      const population = [0.10, 0.20, 0.30, 0.40, 0.50];
      // 0.10: 0 values strictly less -> 0.0%
      expect(calculateStrictLowerPercentileRank(population, 0.10)).toBe(0.0);
      // 0.30: 2 values strictly less -> 2/5 * 100 = 40.0%
      expect(calculateStrictLowerPercentileRank(population, 0.30)).toBe(40.0);
      // 0.50: 4 values strictly less -> 4/5 * 100 = 80.0%
      expect(calculateStrictLowerPercentileRank(population, 0.50)).toBe(80.0);
      // 0.60: all 5 values strictly less -> 100.0%
      expect(calculateStrictLowerPercentileRank(population, 0.60)).toBe(100.0);
      // 0.05: below all elements -> 0.0%
      expect(calculateStrictLowerPercentileRank(population, 0.05)).toBe(0.0);
    });

    it('computes tie metrics (tieCount, tieRate, lowerRank, upperRank, band) correctly', () => {
      // 10 elements with duplicate 0.20 repeated 3 times
      const population = [0.10, 0.20, 0.20, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80];
      const metrics = calculateTieMetrics(population, 0.20);
      expect(metrics).not.toBeNull();
      expect(metrics!.tieCount).toBe(3);
      // tieRate is expressed as a percentage: 3/10 * 100 = 30.0%
      expect(metrics!.tieRate).toBe(30.0);
      // lowerRank: 1 element (0.10) < 0.20 -> 10.0%
      expect(metrics!.lowerRank).toBe(10.0);
      // upperRank: (1 + 3) / 10 -> 40.0%
      expect(metrics!.upperRank).toBe(40.0);
      expect(metrics!.band).toBe('P10.0–P40.0');
    });

    it('generic calculatePercentileRank works on arbitrary signed values without <= 0 assumption', () => {
      const signedDistribution = [-0.5, -0.2, -0.1, 0.0, 0.3, 0.5];
      // Value -0.2: elements <= -0.2 are -0.5 and -0.2 (2 elements out of 6) -> 33.3%
      const rank = calculatePercentileRank(signedDistribution, -0.2);
      expect(rank).not.toBeNull();
      expect(rank).toBe(33.3);
    });
  });

  describe('Currency Return Normalization & Symmetric Log Returns', () => {
    const baseTime = 1700000000;
    const series: CandleSeries = {
      pair: 'EURUSD',
      times: [baseTime, baseTime + 3600, baseTime + 7200],
      opens: [1.1000, 1.1050, 1.1100],
      highs: [1.1060, 1.1110, 1.1160],
      lows: [1.0990, 1.1040, 1.1090],
      closes: [1.1050, 1.1100, 1.1150],
    };

    it('computes exact base currency simple return and log return for EUR in EURUSD', () => {
      const res = alignEventToCandles(baseTime, 'EUR', 'EURUSD', series);
      expect(res.eventCurrencyPosition).toBe('base');
      expect(res.directionMultiplier).toBe(1);

      // Base currency return is Pt / P0 - 1
      const p0 = 1.1000;
      const p1 = 1.1050;
      const expectedSimple = p1 / p0 - 1;
      const expectedLog = Math.log(p1 / p0);

      expect(res.returns[0]).toBeCloseTo(expectedSimple, 8);
      expect(res.logReturns[0]).toBeCloseTo(expectedLog, 8);
      expect(res.rawReturns[0]).toBeCloseTo(expectedSimple, 8);
    });

    it('computes exact quote currency simple return P0/Pt - 1 and symmetric log return for USD in EURUSD', () => {
      const res = alignEventToCandles(baseTime, 'USD', 'EURUSD', series);
      expect(res.eventCurrencyPosition).toBe('quote');
      expect(res.directionMultiplier).toBe(-1);

      const p0 = 1.1000;
      const p1 = 1.1050;
      // Quote currency simple return is P0 / Pt - 1
      const expectedSimple = p0 / p1 - 1;
      // Symmetric normalized log return is Q * ln(Pt / P0) = -1 * ln(Pt / P0)
      const expectedLog = -1 * Math.log(p1 / p0);

      expect(res.returns[0]).toBeCloseTo(expectedSimple, 8);
      expect(res.logReturns[0]).toBeCloseTo(expectedLog, 8);
      // Raw pair return is Pt / P0 - 1
      expect(res.rawReturns[0]).toBeCloseTo(p1 / p0 - 1, 8);
    });
  });

  describe('Walk-Forward Methodology & Temporal Isolation', () => {
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

    it('requires minimum prior history (N >= 20) in walk-forward mode before scoring', async () => {
      const query = {
        currency: 'USD',
        eventName: 'CPI m/m',
        pair: 'EURUSD',
        scoringMode: 'walkForward' as const,
        minHistory: 20,
      };

      const result = await service.getPattern(query);
      const samplePaths = result.samplePaths;
      expect(samplePaths.length).toBeGreaterThan(30);

      // Earliest observations (where prior N < 20) must have null score in walk-forward mode
      const earlyObs = samplePaths[0];
      expect(earlyObs.surpriseScore).toBeNull();
      expect(earlyObs.momentumScore).toBeNull();

      // Later observations (where prior N >= 20) have scores assigned
      const lateObs = samplePaths[samplePaths.length - 1];
      expect(lateObs.surpriseScore).not.toBeNull();
    });

    it('enforces timestamp-batching: events at the same timestamp cannot leak into each others history', async () => {
      // Find releases that occurred simultaneously at the exact same timestamp
      const allReleases = (service as any).calendarRepo.getParsedReleases();
      const timestampMap = new Map<number, any[]>();
      for (const r of allReleases) {
        if (!r.hasCompleteAFP || r.currency !== 'USD') continue;
        const list = timestampMap.get(r.timestamp) || [];
        list.push(r);
        timestampMap.set(r.timestamp, list);
      }

      const simultaneousTimestamp = Array.from(timestampMap.entries()).find(
        ([_, releases]) => releases.length >= 2
      );
      expect(simultaneousTimestamp).toBeDefined();

      const [ts, releasesAtTs] = simultaneousTimestamp!;
      const ev1 = releasesAtTs[0];

      // Inspect ev1 under walk-forward mode
      const inspect1 = await service.getRawEventInspection(
        ev1.eventId,
        ev1.valueId,
        'EURUSD',
        75,
        'walkForward',
        20
      );
      expect(inspect1).toBeDefined();
      expect(inspect1.scoringMode).toBe('walkForward');

      // The historical distribution size must be strictly prior: timestamp < ts
      const priorCount = inspect1.surpriseAudit.priorValidObservations;
      const allPriorReleases = allReleases.filter(
        (r: any) =>
          r.currency === ev1.currency &&
          r.eventName === ev1.eventName &&
          r.hasCompleteAFP &&
          r.surpriseAbsDelta !== null &&
          r.surpriseAbsDelta > FLOAT_EPSILON &&
          r.timestamp < ts
      );
      expect(priorCount).toBe(allPriorReleases.length);
    });

    it('retrospective mode applies strict-lower rank definition to all observations', async () => {
      const inspectionRetro = await service.getRawEventInspection(
        '115719',
        '',
        'EURUSD',
        75,
        'retrospective',
        20
      );

      if (inspectionRetro && inspectionRetro.parsedRelease.surpriseAbsDelta !== null) {
        const sDelta = inspectionRetro.parsedRelease.surpriseAbsDelta;
        if (sDelta > FLOAT_EPSILON) {
          // Percentile rank must be strict-lower: count(v < x) / N * 100
          expect(inspectionRetro.surpriseAudit.strictLowerPercentileRank).not.toBeNull();
          expect(inspectionRetro.surpriseAudit.observationPercentileRank).toBe(
            inspectionRetro.surpriseAudit.strictLowerPercentileRank
          );
          expect(inspectionRetro.surpriseAudit.tieCount).toBeGreaterThanOrEqual(1);
          expect(inspectionRetro.surpriseAudit.percentileBand).toBeTruthy();
        } else {
          // Exact zero delta
          expect(inspectionRetro.surpriseAudit.observationPercentileRank).toBeNull();
          expect(inspectionRetro.surpriseAudit.percentileBand).toContain('exact match');
        }
      }
    });

    it('verifies that walk-forward mode does not label itself as "Backtest-Safe"', async () => {
      const inspectWF = await service.getRawEventInspection(
        '115719',
        '',
        'EURUSD',
        75,
        'walkForward',
        20
      );

      if (inspectWF) {
        expect(inspectWF.classificationModeLabel).not.toContain('Backtest-Safe');
        expect(inspectWF.classificationModeLabel).toContain('Walk-Forward');
      }
    });
  });
});
