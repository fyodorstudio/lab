import { describe, it, expect } from 'vitest';
import {
  calculateNextH4Boundary,
  getH4BlockStatus,
  evaluatePreEntry,
  evaluateHoldingHorizon,
  deduplicateSimultaneousPackages,
  buildExactSeriesInventory,
  classifyMacroFamily,
  buildH4Grid,
  classifyGap,
} from '../src/research/fmsInventoryEngine.js';
import {
  SPLIT_TIMESTAMP,
  CalendarReleaseRecord,
  CandidateHoldingHorizon,
} from '../src/research/fmsInventoryTypes.js';

describe('FMS Eligibility and Provenance Inventory Engine', () => {
  describe('1. Package Deduplication & Cross-Currency Collision', () => {
    it('collapses multiple simultaneous releases into exactly ONE macro episode', () => {
      const ts = 1620387000; // Friday 15:30 broker time
      const mockReleases: CalendarReleaseRecord[] = [
        {
          valueId: 'v1',
          eventId: '840030016',
          timestamp: ts,
          currency: 'USD',
          countryCode: 'US',
          revision: 0,
          eventName: 'Nonfarm Payrolls',
          seriesKey: 'USD:US:840030016:r0',
          hasActual: true,
          hasForecast: true,
          hasPrevious: true,
          hasRevisedPrevious: false,
          hasUnit: true,
          hasTimestamp: true,
          hasCompleteAFP: true,
          hasCompleteAFPRevP: false,
          macroFamily: 'Labor / Employment',
        },
        {
          valueId: 'v2',
          eventId: '840030015',
          timestamp: ts,
          currency: 'USD',
          countryCode: 'US',
          revision: 0,
          eventName: 'Unemployment Rate',
          seriesKey: 'USD:US:840030015:r0',
          hasActual: true,
          hasForecast: true,
          hasPrevious: true,
          hasRevisedPrevious: false,
          hasUnit: true,
          hasTimestamp: true,
          hasCompleteAFP: true,
          hasCompleteAFPRevP: false,
          macroFamily: 'Labor / Employment',
        },
        {
          valueId: 'v3',
          eventId: '840030014',
          timestamp: ts,
          currency: 'USD',
          countryCode: 'US',
          revision: 0,
          eventName: 'Average Hourly Earnings m/m',
          seriesKey: 'USD:US:840030014:r0',
          hasActual: true,
          hasForecast: true,
          hasPrevious: true,
          hasRevisedPrevious: false,
          hasUnit: true,
          hasTimestamp: true,
          hasCompleteAFP: true,
          hasCompleteAFPRevP: false,
          macroFamily: 'Labor / Employment',
        },
      ];

      const packages = deduplicateSimultaneousPackages(mockReleases);
      expect(packages.length).toBe(1);
      expect(packages[0].releaseCount).toBe(3);
      expect(packages[0].currencies).toEqual(['USD']);
      expect(packages[0].hasCrossCurrencyCollision).toBe(false);
      expect(packages[0].seriesKeys).toHaveLength(3);
    });

    it('flags same-time cross-currency collisions when multiple currencies co-release', () => {
      const ts = 1620387000;
      const collidingReleases: CalendarReleaseRecord[] = [
        {
          valueId: 'v_us',
          eventId: '840030016',
          timestamp: ts,
          currency: 'USD',
          countryCode: 'US',
          revision: 0,
          eventName: 'Nonfarm Payrolls',
          seriesKey: 'USD:US:840030016:r0',
          hasActual: true,
          hasForecast: true,
          hasPrevious: true,
          hasRevisedPrevious: false,
          hasUnit: true,
          hasTimestamp: true,
          hasCompleteAFP: true,
          hasCompleteAFPRevP: false,
          macroFamily: 'Labor / Employment',
        },
        {
          valueId: 'v_ca',
          eventId: '124010001',
          timestamp: ts,
          currency: 'CAD',
          countryCode: 'CA',
          revision: 0,
          eventName: 'Net Change in Employment',
          seriesKey: 'CAD:CA:124010001:r0',
          hasActual: true,
          hasForecast: true,
          hasPrevious: true,
          hasRevisedPrevious: false,
          hasUnit: true,
          hasTimestamp: true,
          hasCompleteAFP: true,
          hasCompleteAFPRevP: false,
          macroFamily: 'Labor / Employment',
        },
      ];

      const packages = deduplicateSimultaneousPackages(collidingReleases);
      expect(packages.length).toBe(1);
      expect(packages[0].hasCrossCurrencyCollision).toBe(true);
      expect(packages[0].collidingCurrencies).toEqual(['CAD', 'USD']);
    });
  });

  describe('2. Exact-Series Isolation', () => {
    it('isolates different countries with identical event names into distinct series', () => {
      const ts = 1600000000;
      const releases: CalendarReleaseRecord[] = [
        {
          valueId: 'fr1',
          eventId: '250500001',
          timestamp: ts,
          currency: 'EUR',
          countryCode: 'FR',
          revision: 1,
          eventName: 'S&P Global Manufacturing PMI',
          seriesKey: 'EUR:FR:250500001:r1',
          hasActual: true,
          hasForecast: true,
          hasPrevious: true,
          hasRevisedPrevious: false,
          hasUnit: true,
          hasTimestamp: true,
          hasCompleteAFP: true,
          hasCompleteAFPRevP: false,
          macroFamily: 'Business Surveys / PMI',
        },
        {
          valueId: 'de1',
          eventId: '276500001',
          timestamp: ts + 1800,
          currency: 'EUR',
          countryCode: 'DE',
          revision: 1,
          eventName: 'S&P Global Manufacturing PMI',
          seriesKey: 'EUR:DE:276500001:r1',
          hasActual: true,
          hasForecast: true,
          hasPrevious: true,
          hasRevisedPrevious: false,
          hasUnit: true,
          hasTimestamp: true,
          hasCompleteAFP: true,
          hasCompleteAFPRevP: false,
          macroFamily: 'Business Surveys / PMI',
        },
      ];

      const inventory = buildExactSeriesInventory(releases);
      expect(inventory.length).toBe(2);
      expect(inventory.map((s) => s.seriesKey)).toEqual([
        'EUR:DE:276500001:r1',
        'EUR:FR:250500001:r1',
      ]);
      expect(inventory[0].countryCode).not.toBe(inventory[1].countryCode);
    });

    it('isolates revision stages of the same event into distinct series', () => {
      const releases: CalendarReleaseRecord[] = [
        {
          valueId: 'de_r1',
          eventId: '276500001',
          timestamp: 1600000000,
          currency: 'EUR',
          countryCode: 'DE',
          revision: 1,
          eventName: 'S&P Global Manufacturing PMI',
          seriesKey: 'EUR:DE:276500001:r1',
          hasActual: true,
          hasForecast: true,
          hasPrevious: true,
          hasRevisedPrevious: false,
          hasUnit: true,
          hasTimestamp: true,
          hasCompleteAFP: true,
          hasCompleteAFPRevP: false,
          macroFamily: 'Business Surveys / PMI',
        },
        {
          valueId: 'de_r3',
          eventId: '276500001',
          timestamp: 1600600000,
          currency: 'EUR',
          countryCode: 'DE',
          revision: 3,
          eventName: 'S&P Global Manufacturing PMI',
          seriesKey: 'EUR:DE:276500001:r3',
          hasActual: true,
          hasForecast: true,
          hasPrevious: true,
          hasRevisedPrevious: false,
          hasUnit: true,
          hasTimestamp: true,
          hasCompleteAFP: true,
          hasCompleteAFPRevP: false,
          macroFamily: 'Business Surveys / PMI',
        },
      ];

      const inventory = buildExactSeriesInventory(releases);
      expect(inventory.length).toBe(2);
      expect(inventory.map((s) => s.revision)).toEqual([1, 3]);
    });
  });

  describe('3. Strictly Later H4-Boundary Entry', () => {
    it('calculates the next H4 boundary strictly after release timestamp', () => {
      // 15:30 broker time (55,800s from midnight)
      const baseDay = 1600041600; // Monday 00:00:00
      const t1530 = baseDay + 15 * 3600 + 1800; // 15:30
      const nextH4 = calculateNextH4Boundary(t1530);
      expect(nextH4).toBe(baseDay + 16 * 3600); // 16:00:00
      expect(nextH4).toBeGreaterThan(t1530);

      // 12:00:00 exact boundary release
      const t1200 = baseDay + 12 * 3600;
      const nextH4FromExact = calculateNextH4Boundary(t1200);
      expect(nextH4FromExact).toBe(baseDay + 16 * 3600); // strictly later boundary (16:00:00)
      expect(nextH4FromExact).toBeGreaterThan(t1200);

      // 00:00:00 exact midnight release
      const t0000 = baseDay;
      const nextH4FromMidnight = calculateNextH4Boundary(t0000);
      expect(nextH4FromMidnight).toBe(baseDay + 4 * 3600); // 04:00:00
      expect(nextH4FromMidnight).toBeGreaterThan(t0000);
    });
  });

  describe('4. Missing H1 Bars within an H4 Period', () => {
    it('classifies an H4 block with 4 contiguous bars as COMPLETE', () => {
      const start = 1600041600; // Monday 00:00:00
      const times = new Set([start, start + 3600, start + 7200, start + 10800]);
      expect(getH4BlockStatus(start, times)).toBe('COMPLETE');
    });

    it('classifies an H4 block with 1, 2, or 3 bars as INCOMPLETE_MISSING_H1_BARS', () => {
      const start = 1600041600;
      // Missing bar at start + 7200
      const timesMissingOne = new Set([start, start + 3600, start + 10800]);
      expect(getH4BlockStatus(start, timesMissingOne)).toBe('INCOMPLETE_MISSING_H1_BARS');

      // Only 1 bar
      const timesOnlyOne = new Set([start]);
      expect(getH4BlockStatus(start, timesOnlyOne)).toBe('INCOMPLETE_MISSING_H1_BARS');
    });

    it('fails pre-entry coverage when missing H1 bars occur in the 14-period lookback', () => {
      const baseDay = 1600041600; // Monday 00:00:00
      const tEntry = baseDay + 16 * 3600; // 16:00:00
      const times = new Set<number>();

      // Populate 14 blocks backwards from tEntry, but leave bar missing in block -3
      for (let b = tEntry - 14 * 14400; b < tEntry; b += 14400) {
        times.add(b);
        times.add(b + 3600);
        if (b !== tEntry - 3 * 14400) {
          times.add(b + 7200);
        }
        times.add(b + 10800);
      }
      times.add(tEntry);
      times.add(tEntry + 3600);
      times.add(tEntry + 7200);
      times.add(tEntry + 10800);

      const grid = buildH4Grid(times, tEntry - 20 * 14400, tEntry + 14400);
      const preEntry = evaluatePreEntry(tEntry, grid, tEntry - 20 * 14400);

      expect(preEntry.hasMissingBars).toBe(true);
      expect(preEntry.has14).toBe(false);
    });
  });

  describe('5. Weekend Closure vs Weekday Gap Detection', () => {
    it('classifies an empty block on Saturday or Sunday as WEEKEND_CLOSURE', () => {
      // 2021-05-08 12:00:00 UTC is Saturday
      const satNoon = 1620475200; // Saturday 12:00:00
      const times = new Set<number>();
      expect(getH4BlockStatus(satNoon, times)).toBe('WEEKEND_CLOSURE');
    });

    it('classifies an empty block on a Wednesday as WEEKDAY_GAP', () => {
      // 2021-05-05 12:00:00 UTC is Wednesday
      const wedNoon = 1620216000; // Wednesday 12:00:00
      const times = new Set<number>();
      expect(getH4BlockStatus(wedNoon, times)).toBe('WEEKDAY_GAP');
    });

    it('skips weekend closures during holding traversal but stops and fails on weekday gaps', () => {
      // Start holding on Friday 16:00:00
      const fri1600 = 1620403200; // Friday 2021-05-07 16:00:00
      const times = new Set<number>();

      // Friday 16:00 block complete
      times.add(fri1600);
      times.add(fri1600 + 3600);
      times.add(fri1600 + 7200);
      times.add(fri1600 + 10800);

      // Friday 20:00 block complete
      const fri2000 = fri1600 + 14400;
      times.add(fri2000);
      times.add(fri2000 + 3600);
      times.add(fri2000 + 7200);
      times.add(fri2000 + 10800);

      // Saturday & Sunday empty (weekend closure)

      // Monday 00:00 block complete
      const mon0000 = 1620604800; // Monday 2021-05-10 00:00:00
      times.add(mon0000);
      times.add(mon0000 + 3600);
      times.add(mon0000 + 7200);
      times.add(mon0000 + 10800);

      const grid = buildH4Grid(times, fri1600, mon0000 + 28800);
      const releasesByTs = new Map<number, CalendarReleaseRecord[]>();

      // Evaluate 3 H4 periods
      // Expected: Friday 16:00 (period 1), Friday 20:00 (period 2), weekend skipped (crossesWeekend=true), Monday 00:00 (period 3)
      // Since evaluateHoldingHorizon accepts CandidateHoldingHorizon, let's test with 6 periods where Tuesday has weekday gap:
      // Monday 04:00 has a weekday gap (missing)
      const audit = evaluateHoldingHorizon(
        fri1600,
        6 as CandidateHoldingHorizon,
        grid,
        mon0000 + 28800,
        releasesByTs,
        'USD',
        'EUR'
      );

      expect(audit.crossesWeekend).toBe(true);
      expect(audit.crossesWeekdayGap).toBe(true);
      expect(audit.isComplete).toBe(false);
    });
  });

  describe('6. Pair-Specific Coverage & Missing History Isolation', () => {
    it('marks Pair A eligible while disqualifying Pair B with missing pre-2023 history', () => {
      const baseDay = 1600041600; // Monday 00:00:00
      const tEntry = baseDay + 16 * 3600;

      // Pair A (e.g. EURUSD): complete pre-entry and holding bars
      const pairATimes = new Set<number>();
      for (let b = tEntry - 20 * 14400; b < tEntry + 10 * 14400; b += 14400) {
        pairATimes.add(b);
        pairATimes.add(b + 3600);
        pairATimes.add(b + 7200);
        pairATimes.add(b + 10800);
      }
      const gridA = buildH4Grid(pairATimes, tEntry - 20 * 14400, tEntry + 10 * 14400);

      // Pair B (e.g. USDMXN): zero bars in this range (earliest is in 2025)
      const preEntryA = evaluatePreEntry(tEntry, gridA, tEntry - 20 * 14400);
      const preEntryB = evaluatePreEntry(tEntry, new Map(), 1764118800); // 2025 earliest

      expect(preEntryA.status).toBe('OPEN_MARKET');
      expect(preEntryA.has14).toBe(true);

      expect(preEntryB.status).toBe('MISSING_HISTORY');
      expect(preEntryB.has14).toBe(false);
    });
  });

  describe('7. Exclusion of Paths Crossing 2023-01-01 Boundary', () => {
    it('permits candidate hold when path closes before 2023 but excludes path extending across boundary', () => {
      // Release on 2022-12-30 08:00:00 (Friday)
      // SPLIT_TIMESTAMP is 1672531200 (2023-01-01 00:00:00)
      const tRel = SPLIT_TIMESTAMP - 36 * 3600; // ~36 hours before 2023
      const tEntry = calculateNextH4Boundary(tRel); // tRel + delta

      const times = new Set<number>();
      // Populate bars leading up to and past SPLIT_TIMESTAMP
      for (let b = tEntry - 20 * 14400; b <= SPLIT_TIMESTAMP + 10 * 14400; b += 14400) {
        times.add(b);
        times.add(b + 3600);
        times.add(b + 7200);
        times.add(b + 10800);
      }

      const grid = buildH4Grid(times, tEntry - 20 * 14400, SPLIT_TIMESTAMP + 10 * 14400);
      const releasesByTs = new Map<number, CalendarReleaseRecord[]>();

      // 6 H4 periods (24 hours) closes before 2023-01-01 00:00:00 -> Allowed
      const audit6 = evaluateHoldingHorizon(tEntry, 6, grid, SPLIT_TIMESTAMP + 10 * 14400, releasesByTs, 'USD', 'EUR');
      expect(audit6.crosses2023Boundary).toBe(false);
      expect(audit6.isComplete).toBe(true);

      // 30 H4 periods (120 hours) extends into January 2023 -> Excluded
      const audit30 = evaluateHoldingHorizon(tEntry, 30, grid, SPLIT_TIMESTAMP + 10 * 14400, releasesByTs, 'USD', 'EUR');
      expect(audit30.crosses2023Boundary).toBe(true);
      expect(audit30.isComplete).toBe(false);
      expect(audit30.exitTimestamp).toBeNull();
    });
  });

  describe('8. Gap Classification Regression Tests', () => {
    it('classifies a standard Friday-to-Monday market closure as PURE_WEEKEND', () => {
      // Friday 2015-01-02 23:00 UTC to Monday 2015-01-05 00:00 UTC
      const fri23 = Date.UTC(2015, 0, 2, 23, 0, 0) / 1000;
      const mon00 = Date.UTC(2015, 0, 5, 0, 0, 0) / 1000;
      const res = classifyGap(fri23, mon00);

      expect(res.classification).toBe('PURE_WEEKEND');
      expect(res.gapHours).toBe(49);
      expect(res.missingHours).toBe(48);
    });

    it('classifies a weekend-plus-weekday holiday gap as WEEKDAY_OR_MIXED', () => {
      // Friday 2017-12-29 23:00 UTC to Tuesday 2018-01-02 09:00 UTC (82 hours gap)
      // New Year's holiday gap on EURUSD/USDJPY
      const fri23 = 1514588400; // Friday 2017-12-29 23:00 UTC
      const tue09 = 1514883600; // Tuesday 2018-01-02 09:00 UTC
      const res = classifyGap(fri23, tue09);

      expect(res.classification).toBe('WEEKDAY_OR_MIXED');
      expect(res.gapHours).toBe(82);
      expect(res.missingHours).toBe(81);
    });

    it('classifies a multi-year gap (e.g. USDHKD 48,329 hours) as WEEKDAY_OR_MIXED, never as weekend', () => {
      // USDHKD physical gap: 2017-03-24 22:00:00 UTC to 2022-09-28 15:00:00 UTC
      const startTs = 1490392800; // 2017-03-24 22:00:00 UTC
      const endTs = 1664377200; // 2022-09-28 15:00:00 UTC
      const res = classifyGap(startTs, endTs);

      expect(res.classification).toBe('WEEKDAY_OR_MIXED');
      expect(res.gapHours).toBe(48329);
      expect(res.missingHours).toBe(48328);
    });

    it('classifies a pure weekday intraday gap as WEEKDAY_OR_MIXED', () => {
      // Wednesday 12:00:00 UTC to Wednesday 15:00:00 UTC (3 hours gap, 2 missing hours)
      const wed12 = 1620216000;
      const wed15 = wed12 + 3 * 3600;
      const res = classifyGap(wed12, wed15);

      expect(res.classification).toBe('WEEKDAY_OR_MIXED');
      expect(res.gapHours).toBe(3);
      expect(res.missingHours).toBe(2);
    });
  });
});
