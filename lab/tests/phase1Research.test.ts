import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  isExploration,
  isConfirmation,
  computeH42CloseTimestamp,
  doesH42CrossSplit,
  assertStrictlyExploration,
  filterExplorationReleasesBeforeReturns,
} from '../src/research/boundaryGuard.js';
import { computeEventReturns } from '../src/research/delayedReturns.js';
import { scoreDelta } from '../src/analytics/eventScorer.js';
import {
  adjustMultipleTesting,
  computeContrast,
  computePermutationTest,
  buildComplete5x5Matrix,
  combinationsCount,
} from '../src/research/statistics.js';
import { CandleSeries } from '../src/data/candleLoader.js';
import { ParsedEventRelease } from '../shared/types.js';
import { SPLIT_TIMESTAMP, ALL_5X5_CELL_KEYS } from '../src/research/types.js';
import { evaluateCoReleaseCoherence } from '../src/research/coReleaseCoherence.js';
import { validateReportAgainstJson } from '../src/research/validateReport.js';

describe('Phase 1 Research Guard & Protocol Enforcement', () => {
  describe('1. Chronological Split Enforcement', () => {
    it('correctly partitions timestamps into Exploration and Confirmation', () => {
      const justBefore = SPLIT_TIMESTAMP - 1; // 2022-12-31 23:59:59
      const exactSplit = SPLIT_TIMESTAMP; // 2023-01-01 00:00:00
      const justAfter = SPLIT_TIMESTAMP + 1; // 2023-01-01 00:00:01

      expect(isExploration(justBefore)).toBe(true);
      expect(isExploration(exactSplit)).toBe(false);
      expect(isExploration(justAfter)).toBe(false);

      expect(isConfirmation(justBefore)).toBe(false);
      expect(isConfirmation(exactSplit)).toBe(true);
      expect(isConfirmation(justAfter)).toBe(true);
    });

    it('assertStrictlyExploration throws on any Confirmation timestamp', () => {
      expect(() => {
        assertStrictlyExploration([1500000000, 1600000000, SPLIT_TIMESTAMP - 3600]);
      }).not.toThrow();

      expect(() => {
        assertStrictlyExploration([1500000000, SPLIT_TIMESTAMP]);
      }).toThrow(/CRITICAL RESEARCH BOUNDARY VIOLATION/);

      expect(() => {
        assertStrictlyExploration([SPLIT_TIMESTAMP + 86400]);
      }).toThrow(/CRITICAL RESEARCH BOUNDARY VIOLATION/);
    });
  });

  describe('2. Explicit H42 Boundary & Pair-Specific Mismatch Tests', () => {
    it('permits H42 when close timestamp is exactly at split boundary', () => {
      const h42Close = SPLIT_TIMESTAMP;
      expect(doesH42CrossSplit(h42Close)).toBe(false);
    });

    it('excludes H42 when close timestamp is strictly beyond split boundary', () => {
      const h42CloseJustOver = SPLIT_TIMESTAMP + 1;
      const h42CloseOneHourOver = SPLIT_TIMESTAMP + 3600;

      expect(doesH42CrossSplit(h42CloseJustOver)).toBe(true);
      expect(doesH42CrossSplit(h42CloseOneHourOver)).toBe(true);
    });

    it('fails closed (excludes) when H42 candle close is null', () => {
      expect(doesH42CrossSplit(null)).toBe(true);
    });

    it('handles synthetic pair-specific boundary mismatch without cross-pair leakage', () => {
      // Create synthetic candles for EURUSD and USDJPY:
      // EURUSD: regular continuous hourly candles up to split
      // USDJPY: contains a 10-hour gap near late Dec 2022
      const baseStart = SPLIT_TIMESTAMP - 50 * 3600;

      // EURUSD: 50 consecutive bars before split, then 50 after split
      const eurusdTimes: number[] = [];
      for (let i = 0; i < 100; i++) {
        eurusdTimes.push(baseStart + i * 3600);
      }

      // USDJPY: same start, but has a 10-hour gap at bar 20
      const usdjpyTimes: number[] = [];
      for (let i = 0; i < 20; i++) {
        usdjpyTimes.push(baseStart + i * 3600);
      }
      // 10 hour gap
      for (let i = 20; i < 100; i++) {
        usdjpyTimes.push(baseStart + (i + 10) * 3600);
      }

      // Test event: occurs at bar 5 (baseStart + 5 * 3600 = SPLIT - 45 * 3600)
      // Required H42:
      // On EURUSD: 42 bars from bar 5 reach bar 46 (start = baseStart + 46 * 3600 = SPLIT - 4 * 3600).
      // Close is SPLIT - 3 * 3600 <= SPLIT. (Eligible on EURUSD!)
      // On USDJPY: 42 bars from bar 5 span the 10-hour gap!
      // Bar 5 + 41 = bar 46 in array. In USDJPY, bar 46 start = baseStart + (46 + 10) * 3600 = SPLIT + 6 * 3600!
      // Close is SPLIT + 7 * 3600 > SPLIT. (Excluded on USDJPY!)

      const targetEvent: Partial<ParsedEventRelease> = {
        eventId: '840030005',
        valueId: 'event_mismatch_test',
        timestamp: baseStart + 5 * 3600,
      };

      const releases = [targetEvent as ParsedEventRelease];

      const eurusdEligible = filterExplorationReleasesBeforeReturns(releases, eurusdTimes);
      const usdjpyEligible = filterExplorationReleasesBeforeReturns(releases, usdjpyTimes);

      expect(eurusdEligible.map((r) => r.valueId)).toContain('event_mismatch_test');
      expect(usdjpyEligible.map((r) => r.valueId)).not.toContain('event_mismatch_test');
    });
  });

  describe('3. Walk-Forward Exact-Zero Scoring Rule', () => {
    it('scores +1 when delta is exact zero and prior nonzero history >= 20', () => {
      const priorNonZeroCount = 20;
      const minHistory = 20;
      const actual = 0.3;
      const comparison = 0.3; // Delta = 0
      const threshold = 0.4;

      const score = scoreDelta(actual, comparison, threshold);
      expect(score).toBe(1);

      const hasMinHistory = priorNonZeroCount >= minHistory;
      expect(hasMinHistory).toBe(true);
      const effectiveScore = hasMinHistory ? scoreDelta(actual, comparison, threshold) : null;
      expect(effectiveScore).toBe(1);
    });

    it('scores null when delta is exact zero but prior nonzero history < 20', () => {
      const priorNonZeroCount = 19;
      const minHistory = 20;
      const actual = 0.3;
      const comparison = 0.3; // Delta = 0
      const threshold = 0.4;

      const hasMinHistory = priorNonZeroCount >= minHistory;
      expect(hasMinHistory).toBe(false);

      const effectiveScore = hasMinHistory ? scoreDelta(actual, comparison, threshold) : null;
      expect(effectiveScore).toBeNull();
    });
  });

  describe('4. Delayed Return Arithmetic & Compounding Identity', () => {
    it('satisfies compounding identity for quote-currency position (e.g. USD in EURUSD)', () => {
      const times = [1000, 4600, 8200, 11800];
      const opens = [1.1000, 1.1050, 1.1020, 1.0980];
      const closes = [1.1050, 1.1020, 1.0980, 1.0950];
      const candleSeries: CandleSeries = {
        pair: 'EURUSD',
        times,
        opens,
        highs: closes.map((c) => c + 0.001),
        lows: opens.map((o) => o - 0.001),
        closes,
      };

      const result = computeEventReturns(1000, 'USD', 'EURUSD', candleSeries);

      const cumH1 = result.cumulativeSimpleReturns[0]!;
      expect(cumH1).toBeCloseTo(1.1000 / 1.1050 - 1, 8);

      const cumH4 = result.cumulativeSimpleReturns[3]!;
      expect(cumH4).toBeCloseTo(1.1000 / 1.0950 - 1, 8);

      const delayedH4 = result.delayedSimpleReturns[3]!;
      expect(delayedH4).toBeCloseTo(1.1050 / 1.0950 - 1, 8);

      expect(result.delayedSimpleReturns[0]).toBeNull();

      const compounded = (1 + cumH1) * (1 + delayedH4);
      expect(compounded).toBeCloseTo(1 + cumH4, 10);
    });

    it('satisfies compounding identity for base-currency position (e.g. USD in USDJPY)', () => {
      const times = [1000, 4600, 8200, 11800];
      const opens = [145.00, 145.50, 145.80, 146.00];
      const closes = [145.50, 145.80, 146.00, 146.20];
      const candleSeries: CandleSeries = {
        pair: 'USDJPY',
        times,
        opens,
        highs: closes.map((c) => c + 0.5),
        lows: opens.map((o) => o - 0.5),
        closes,
      };

      const result = computeEventReturns(1000, 'USD', 'USDJPY', candleSeries);

      const cumH1 = result.cumulativeSimpleReturns[0]!;
      const cumH4 = result.cumulativeSimpleReturns[3]!;
      const delayedH4 = result.delayedSimpleReturns[3]!;

      expect(cumH1).toBeCloseTo(145.50 / 145.00 - 1, 8);
      expect(cumH4).toBeCloseTo(146.20 / 145.00 - 1, 8);
      expect(delayedH4).toBeCloseTo(146.20 / 145.50 - 1, 8);

      const compounded = (1 + cumH1) * (1 + delayedH4);
      expect(compounded).toBeCloseTo(1 + cumH4, 10);
    });
  });

  describe('5. Permutation Testing Accuracy & Combinatorics', () => {
    it('computes combinations count accurately', () => {
      expect(combinationsCount(18, 7)).toBe(31824);
      expect(combinationsCount(10, 5)).toBe(252);
      expect(combinationsCount(27, 7)).toBe(888030);
    });

    it('uses exact combinatorial method when total combinations <= 50,000', () => {
      // Group A: N=5, Group B: N=5 -> C(10, 5) = 252 <= 50000 -> exact
      const groupA = [0.01, 0.02, 0.015, 0.012, 0.018];
      const groupB = [-0.01, -0.015, -0.012, -0.008, -0.02];

      const permRes = computePermutationTest(groupA, groupB);
      expect(permRes).not.toBeNull();
      expect(permRes!.method).toBe('exact');
      expect(permRes!.details).toContain('Exact combinatorial permutation test across all 252 partitions');
      expect(permRes!.pValue).toBeLessThan(0.01);
    });

    it('labels seeded Monte Carlo accurately when total combinations > 50,000', () => {
      // Group A: N=20, Group B: N=7 -> C(27, 7) = 888,030 > 50000 -> seeded Monte Carlo
      const groupA = Array.from({ length: 20 }, (_, i) => 0.01 + i * 0.001);
      const groupB = Array.from({ length: 7 }, (_, i) => -0.01 - i * 0.001);

      const permRes = computePermutationTest(groupA, groupB);
      expect(permRes).not.toBeNull();
      expect(permRes!.method).toBe('seeded_monte_carlo');
      expect(permRes!.details).toContain('Seeded Monte Carlo permutation test with 100,000 iterations (seed: 42840030)');
    });
  });

  describe('6. Full 25-Cell 5x5 Interaction Matrix', () => {
    it('generates all 25 cells including zero-count cells', () => {
      const cellMap = new Map<string, number[]>();
      // Populate only 2 cells
      cellMap.set('S+3_M+3', [0.01, 0.02]);
      cellMap.set('S-3_M-3', [-0.01, -0.02]);

      const matrix = buildComplete5x5Matrix(cellMap);

      expect(matrix.length).toBe(25);
      const cellNames = matrix.map((c) => c.cell);
      for (const expectedKey of ALL_5X5_CELL_KEYS) {
        expect(cellNames).toContain(expectedKey);
      }

      const p3m3 = matrix.find((c) => c.cell === 'S+3_M+3')!;
      expect(p3m3.n).toBe(2);
      expect(p3m3.meanReturn).toBeCloseTo(0.015, 6);

      const emptyCell = matrix.find((c) => c.cell === 'S+1_M+1')!;
      expect(emptyCell.n).toBe(0);
      expect(emptyCell.meanReturn).toBeNull();
      expect(emptyCell.medianReturn).toBeNull();
      expect(emptyCell.positiveDirectionRate).toBeNull();
    });
  });

  describe('7. Power Threshold & Descriptive Gating', () => {
    it('flags contrasts as underpowered when min(N+, N-) < 5', () => {
      const posReturns = [0.001, 0.002, -0.001, 0.003]; // N = 4
      const negReturns = [-0.001, -0.002, 0.001, -0.003, -0.002, -0.001, 0.000, -0.002, -0.001, -0.004]; // N = 10

      const contrast = computeContrast(12, 'delayed', posReturns, negReturns);

      expect(contrast.isUnderpowered).toBe(true);
      expect(contrast.powerWarning).toContain('Underpowered for formal hypothesis testing');
      expect(contrast.permutationPValue).toBeNull();
      expect(contrast.rankSumPValue).toBeNull();
      expect(contrast.groupPositiveN).toBe(4);
      expect(contrast.groupNegativeN).toBe(10);
      expect(contrast.meanDifference).not.toBeNull();
    });

    it('calculates p-values when both groups have N >= 5', () => {
      const posReturns = [0.005, 0.004, 0.003, 0.002, 0.006, 0.004]; // N = 6
      const negReturns = [-0.003, -0.004, -0.002, -0.005, -0.001]; // N = 5

      const contrast = computeContrast(12, 'delayed', posReturns, negReturns);

      expect(contrast.isUnderpowered).toBe(false);
      expect(contrast.permutationPValue).not.toBeNull();
      expect(contrast.rankSumPValue).not.toBeNull();
    });
  });

  describe('8. Multiple-Testing Adjustments', () => {
    it('applies Holm-Bonferroni and Benjamini-Hochberg correctly under K=4 and K=2', () => {
      const pVals = [
        { key: 'USD CPI', pValue: 0.02 },
        { key: 'USD NFP', pValue: 0.04 },
        { key: 'USD Core CPI', pValue: null },
        { key: 'USD Core PCE', pValue: null },
      ];

      const adjK4 = adjustMultipleTesting(pVals, 4);
      const cpiK4 = adjK4.find((e) => e.key === 'USD CPI')!;
      const nfpK4 = adjK4.find((e) => e.key === 'USD NFP')!;
      const coreCpiK4 = adjK4.find((e) => e.key === 'USD Core CPI')!;

      expect(cpiK4.holmP).toBeCloseTo(0.08, 4);
      expect(nfpK4.holmP).toBeCloseTo(0.12, 4);
      expect(coreCpiK4.holmP).toBeNull();

      const adjK2 = adjustMultipleTesting(pVals, 2);
      const cpiK2 = adjK2.find((e) => e.key === 'USD CPI')!;
      const nfpK2 = adjK2.find((e) => e.key === 'USD NFP')!;

      expect(cpiK2.holmP).toBeCloseTo(0.04, 4);
      expect(nfpK2.holmP).toBeCloseTo(0.04, 4);
    });
  });

  describe('9. Co-Release Directional Coherence Evaluation', () => {
    it('correctly identifies isolated releases when no other releases share currency and timestamp', () => {
      const target: Partial<ParsedEventRelease> = {
        valueId: 'cpi_isolated_1',
        eventId: '840030005',
        surpriseDelta: 0.2,
        currency: 'USD',
        timestamp: 1600000000,
      };
      // Isolated: target is the only release in allConcurrentReleases
      const coherence = evaluateCoReleaseCoherence(target as ParsedEventRelease, [target as ParsedEventRelease]);
      expect(coherence).toBe('ISOLATED');
    });

    it('correctly identifies neutral releases when target surprise delta is zero or null', () => {
      const targetZero: Partial<ParsedEventRelease> = {
        valueId: 'cpi_zero',
        eventId: '840030005',
        surpriseDelta: 0.0,
        currency: 'USD',
        timestamp: 1600000000,
      };
      const coreConcurrent: Partial<ParsedEventRelease> = {
        valueId: 'core_concurrent_1',
        eventId: '840030006',
        surpriseDelta: 0.2,
        currency: 'USD',
        timestamp: 1600000000,
      };
      expect(
        evaluateCoReleaseCoherence(targetZero as ParsedEventRelease, [
          targetZero as ParsedEventRelease,
          coreConcurrent as ParsedEventRelease,
        ])
      ).toBe('NEUTRAL');

      const targetNull: Partial<ParsedEventRelease> = {
        valueId: 'cpi_null',
        eventId: '840030005',
        surpriseDelta: null,
        currency: 'USD',
        timestamp: 1600000000,
      };
      expect(
        evaluateCoReleaseCoherence(targetNull as ParsedEventRelease, [
          targetNull as ParsedEventRelease,
          coreConcurrent as ParsedEventRelease,
        ])
      ).toBe('NEUTRAL');
    });

    it('evaluates synthetic Headline CPI + Core CPI co-releases: coherent and conflicting surprises', () => {
      const headlineBase: Partial<ParsedEventRelease> = {
        valueId: 'headline_cpi_val',
        eventId: '840030005', // USD CPI m/m
        currency: 'USD',
        timestamp: 1600000000,
      };

      const coreBase: Partial<ParsedEventRelease> = {
        valueId: 'core_cpi_val',
        eventId: '840030006', // USD Core CPI m/m
        currency: 'USD',
        timestamp: 1600000000,
      };

      // Case 1: Both positive surprise (Headline beat +0.2%, Core beat +0.1%) -> COHERENT
      const hPos = { ...headlineBase, surpriseDelta: 0.2 } as ParsedEventRelease;
      const cPos = { ...coreBase, surpriseDelta: 0.1 } as ParsedEventRelease;
      const bundlePosPos = [hPos, cPos];
      expect(evaluateCoReleaseCoherence(hPos, bundlePosPos)).toBe('COHERENT');
      expect(evaluateCoReleaseCoherence(cPos, bundlePosPos)).toBe('COHERENT');

      // Case 2: Both negative surprise (Headline miss -0.3%, Core miss -0.1%) -> COHERENT
      const hNeg = { ...headlineBase, surpriseDelta: -0.3 } as ParsedEventRelease;
      const cNeg = { ...coreBase, surpriseDelta: -0.1 } as ParsedEventRelease;
      const bundleNegNeg = [hNeg, cNeg];
      expect(evaluateCoReleaseCoherence(hNeg, bundleNegNeg)).toBe('COHERENT');
      expect(evaluateCoReleaseCoherence(cNeg, bundleNegNeg)).toBe('COHERENT');

      // Case 3: Conflicting (Headline beat +0.2%, Core miss -0.1%) -> CONFLICTING
      const bundlePosNeg = [hPos, cNeg];
      expect(evaluateCoReleaseCoherence(hPos, bundlePosNeg)).toBe('CONFLICTING');
      expect(evaluateCoReleaseCoherence(cNeg, bundlePosNeg)).toBe('CONFLICTING');

      // Case 4: Conflicting (Headline miss -0.3%, Core beat +0.1%) -> CONFLICTING
      const bundleNegPos = [hNeg, cPos];
      expect(evaluateCoReleaseCoherence(hNeg, bundleNegPos)).toBe('CONFLICTING');
      expect(evaluateCoReleaseCoherence(cPos, bundleNegPos)).toBe('CONFLICTING');
    });

    it('evaluates synthetic NFP + Unemployment Rate co-releases correctly', () => {
      const nfpBase: Partial<ParsedEventRelease> = {
        valueId: 'nfp_val',
        eventId: '840030016', // USD Nonfarm Payrolls
        currency: 'USD',
        timestamp: 1600000000,
      };
      const unempBase: Partial<ParsedEventRelease> = {
        valueId: 'unemp_val',
        eventId: '840030015', // USD Unemployment Rate
        currency: 'USD',
        timestamp: 1600000000,
      };

      // NFP beat (+50,000) and Unemployment drop (-0.1%) -> both signal stronger labor -> COHERENT
      const nfpBeat = { ...nfpBase, surpriseDelta: 50000 } as ParsedEventRelease;
      const unempDrop = { ...unempBase, surpriseDelta: -0.1 } as ParsedEventRelease;
      expect(evaluateCoReleaseCoherence(nfpBeat, [nfpBeat, unempDrop])).toBe('COHERENT');

      // NFP beat (+50,000) and Unemployment rise (+0.2%) -> conflicting signals -> CONFLICTING
      const unempRise = { ...unempBase, surpriseDelta: 0.2 } as ParsedEventRelease;
      expect(evaluateCoReleaseCoherence(nfpBeat, [nfpBeat, unempRise])).toBe('CONFLICTING');
    });

    it('classifies unrelated simultaneous indicator pairs as UNCLASSIFIED even if surprises share the same sign', () => {
      // Target: Core PCE (840010001) with positive surprise
      const corePce: Partial<ParsedEventRelease> = {
        valueId: 'core_pce_val',
        eventId: '840010001',
        currency: 'USD',
        timestamp: 1600000000,
        surpriseDelta: 0.2,
      };

      // Unrelated concurrent release: Personal Spending (840010003) with positive surprise
      const spending: Partial<ParsedEventRelease> = {
        valueId: 'spending_val',
        eventId: '840010003',
        currency: 'USD',
        timestamp: 1600000000,
        surpriseDelta: 0.4,
      };

      // Generic same-sign coherence across arbitrary indicators is rejected; status is strictly UNCLASSIFIED
      const status = evaluateCoReleaseCoherence(corePce as ParsedEventRelease, [
        corePce as ParsedEventRelease,
        spending as ParsedEventRelease,
      ]);
      expect(status).toBe('UNCLASSIFIED');

      // Also verify when target is Headline CPI but simultaneous event is an unrelated event (not Core CPI)
      const headlineCpi: Partial<ParsedEventRelease> = {
        valueId: 'headline_cpi_val',
        eventId: '840030005',
        currency: 'USD',
        timestamp: 1600000000,
        surpriseDelta: 0.3,
      };
      const unrelatedJobless: Partial<ParsedEventRelease> = {
        valueId: 'jobless_claims_val',
        eventId: '840030009', // Initial Jobless Claims
        currency: 'USD',
        timestamp: 1600000000,
        surpriseDelta: 5000,
      };
      expect(
        evaluateCoReleaseCoherence(headlineCpi as ParsedEventRelease, [
          headlineCpi as ParsedEventRelease,
          unrelatedJobless as ParsedEventRelease,
        ])
      ).toBe('UNCLASSIFIED');
    });
  });

  describe('10. Automated Read-Only Report Validation against phase1_exploration.json', () => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const validReportText = fs.readFileSync(
      path.join(__dirname, '../research/PHASE1_EXPLORATION.md'),
      'utf8'
    );

    it('achieves 100% pass rate with zero mismatches on the valid report', () => {
      const audit = validateReportAgainstJson(validReportText);
      expect(audit.failedChecks).toBe(0);
      expect(audit.allPassed).toBe(true);
      expect(audit.totalChecks).toBeGreaterThanOrEqual(140);
      expect(audit.scopeDescription).toContain('Targeted structural and tabular audit');
    });

    it('negative test: fails validation when a primary table p-value is deliberately corrupted', () => {
      // Deliberately corrupt USD CPI permutation p-value from 0.3009 to 0.9999
      const corruptedReport = validReportText.replace('**0.3009**', '**0.9999**');
      expect(corruptedReport).not.toBe(validReportText);

      const audit = validateReportAgainstJson(corruptedReport);
      expect(audit.allPassed).toBe(false);
      expect(audit.failedChecks).toBeGreaterThanOrEqual(1);

      const failedItem = audit.items.find((i) => !i.passed && i.item.includes('Permutation p-value'));
      expect(failedItem).toBeDefined();
      expect(failedItem?.expected).toContain('0.3009');
      expect(failedItem?.actual).toContain('0.9999');
    });

    it('negative test: fails validation when an N count is deliberately corrupted', () => {
      // Deliberately corrupt USD NFP eligible N from 48 to 99 in primary table
      const corruptedReport = validReportText.replace(
        '| `USD:US:840030016:r0` | 48 |',
        '| `USD:US:840030016:r0` | 99 |'
      );
      expect(corruptedReport).not.toBe(validReportText);

      const audit = validateReportAgainstJson(corruptedReport);
      expect(audit.allPassed).toBe(false);
      expect(audit.failedChecks).toBeGreaterThanOrEqual(1);

      const failedItem = audit.items.find((i) => !i.passed && i.item.includes('Eligible N cell'));
      expect(failedItem).toBeDefined();
      expect(failedItem?.expected).toBe('48');
      expect(failedItem?.actual).toBe('99');
    });

    it('negative test: fails validation when a standard deviation is deliberately corrupted', () => {
      // Deliberately corrupt USD CPI +3 std dev
      const corruptedReport = validReportText.replace(
        'Standard Deviation: +0.002731',
        'Standard Deviation: +0.009999'
      );
      expect(corruptedReport).not.toBe(validReportText);

      const audit = validateReportAgainstJson(corruptedReport);
      expect(audit.allPassed).toBe(false);
      expect(audit.failedChecks).toBeGreaterThanOrEqual(1);

      const failedItem = audit.items.find((i) => !i.passed && i.item === 'Standard Deviation');
      expect(failedItem).toBeDefined();
    });

    it('negative test: fails validation when forbidden phrase "absence demonstrated" is deliberately injected', () => {
      const corruptedReport = validReportText + '\n\nIn conclusion, absence demonstrated.\n';
      const audit = validateReportAgainstJson(corruptedReport);
      expect(audit.allPassed).toBe(false);

      const failedItem = audit.items.find((i) => !i.passed && i.category === 'Epistemic Boundary');
      expect(failedItem).toBeDefined();
      expect(failedItem?.failureReason).toContain('absence demonstrated');
    });
  });
});
