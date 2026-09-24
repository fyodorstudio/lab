import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

import { CalendarRepository } from '../data/calendarLoader.js';
import { CandleRepository } from '../data/candleLoader.js';
import { discoverFXPairs } from '../data/pairDiscovery.js';
import { resolveResearchDataSource } from '../data/dataSourceResolver.js';
import { calculateQuantile, canonicalizeNumber } from '../shared/utils.js';
import { scoreDelta } from '../analytics/eventScorer.js';
import { FLOAT_EPSILON } from '../shared/constants.js';

import {
  SPLIT_TIMESTAMP,
  SPLIT_DATE_STRING,
  EXPECTED_CALENDAR_SHA256,
  EXPECTED_SCHEMA_VERSION,
  EXPECTED_SOURCE_FOLDER,
  BASELINE_COMMIT,
  TARGET_SERIES_DEFINITIONS,
  ExplorationSeriesOutcomes,
  IndividualEventRecord,
} from './types.js';
import {
  assertStrictlyExploration,
  filterExplorationReleasesBeforeReturns,
} from './boundaryGuard.js';
import { computeEventReturns, AlignedExplorationPath } from './delayedReturns.js';
import {
  computeHorizonMetrics,
  computeContrast,
  adjustMultipleTesting,
  buildComplete5x5Matrix,
} from './statistics.js';
import { EventScore, ParsedEventRelease } from '../shared/types.js';
import { evaluateCoReleaseCoherence, CoReleaseCoherenceStatus } from './coReleaseCoherence.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');

interface ScoredObservationPair {
  release: ParsedEventRelease;
  surpriseScore: EventScore;
  momentumScore: EventScore;
  eurusdEligible: boolean;
  usdjpyEligible: boolean;
  eurusdPath?: AlignedExplorationPath;
  usdjpyPath?: AlignedExplorationPath;
  coReleaseCoherence: CoReleaseCoherenceStatus;
}

export async function runExplorationStudy(): Promise<{
  manifest: any;
  eurusdOutcomes: Record<string, ExplorationSeriesOutcomes>;
  usdjpyOutcomes: Record<string, ExplorationSeriesOutcomes>;
  familyMultiplicity: any;
}> {
  const source = resolveResearchDataSource(repoRoot);

  if (!source.root.includes(EXPECTED_SOURCE_FOLDER)) {
    throw new Error(`Source mismatch: expected ${EXPECTED_SOURCE_FOLDER}, got ${source.root}`);
  }

  const fileBuffer = fs.readFileSync(source.calendarPath);
  const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  if (hash !== EXPECTED_CALENDAR_SHA256) {
    throw new Error(`Hash mismatch: expected ${EXPECTED_CALENDAR_SHA256}, got ${hash}`);
  }

  const calendarRepo = new CalendarRepository(source.calendarPath, source.manifest);
  await calendarRepo.load();

  // Index full calendar across all series by currency and timestamp for co-release coherence lookup
  const allCalendarReleases = calendarRepo.getParsedReleases();
  const calendarByCurrencyTimestamp = new Map<string, ParsedEventRelease[]>();
  for (const rel of allCalendarReleases) {
    const key = `${rel.currency.toUpperCase()}_${rel.timestamp}`;
    let list = calendarByCurrencyTimestamp.get(key);
    if (!list) {
      list = [];
      calendarByCurrencyTimestamp.set(key, list);
    }
    list.push(rel);
  }

  const pairs = await discoverFXPairs(source.candlesDir);
  const candleRepo = new CandleRepository(source.candlesDir, pairs);
  const eurusdCandles = await candleRepo.loadPair('EURUSD');
  const usdjpyCandles = await candleRepo.loadPair('USDJPY');

  if (!eurusdCandles || !usdjpyCandles) {
    throw new Error('Failed to load EURUSD or USDJPY candles');
  }

  const eurusdOutcomes: Record<string, ExplorationSeriesOutcomes> = {};
  const usdjpyOutcomes: Record<string, ExplorationSeriesOutcomes> = {};
  const primaryRawPValues: Array<{ key: string; pValue: number | null }> = [];

  for (const target of TARGET_SERIES_DEFINITIONS) {
    const rawReleases = calendarRepo.getReleasesForEvent('USD', '', target.eventId, target.seriesKey);
    const sortedReleases = [...rawReleases].sort((a, b) => a.timestamp - b.timestamp);

    // 1. FILTER BEFORE COMPUTING RETURNS SEPARATELY FOR EURUSD AND USDJPY
    const eurusdEligibleReleases = filterExplorationReleasesBeforeReturns(sortedReleases, eurusdCandles.times);
    const usdjpyEligibleReleases = filterExplorationReleasesBeforeReturns(sortedReleases, usdjpyCandles.times);

    // Assert strictly Exploration for all eligible timestamps
    assertStrictlyExploration(eurusdEligibleReleases.map((r) => r.timestamp));
    assertStrictlyExploration(usdjpyEligibleReleases.map((r) => r.timestamp));

    const eurusdEligibleIds = new Set(eurusdEligibleReleases.map((r) => r.valueId));
    const usdjpyEligibleIds = new Set(usdjpyEligibleReleases.map((r) => r.valueId));

    // 2. Perform strictly prior Walk-Forward Scoring
    const timestampGroups = new Map<number, ParsedEventRelease[]>();
    for (const r of sortedReleases) {
      let g = timestampGroups.get(r.timestamp);
      if (!g) {
        g = [];
        timestampGroups.set(r.timestamp, g);
      }
      g.push(r);
    }

    const runningSurprise: number[] = [];
    const runningMomentum: number[] = [];
    const minHistory = 20;
    const percentile = 75;

    const scoredObservations: ScoredObservationPair[] = [];

    for (const group of timestampGroups.values()) {
      const sortedPriorS = [...runningSurprise].sort((a, b) => a - b);
      const sortedPriorM = [...runningMomentum].sort((a, b) => a - b);

      const hasMinS = sortedPriorS.length >= minHistory;
      const hasMinM = sortedPriorM.length >= minHistory;

      const sThresh = hasMinS ? calculateQuantile(sortedPriorS, percentile) : null;
      const mThresh = hasMinM ? calculateQuantile(sortedPriorM, percentile) : null;

      for (const r of group) {
        const isEurusdEligible = eurusdEligibleIds.has(r.valueId);
        const isUsdjpyEligible = usdjpyEligibleIds.has(r.valueId);

        if (!isEurusdEligible && !isUsdjpyEligible) continue;

        const isComplete = r.hasCompleteAFP;
        if (!isComplete) continue;

        let surpriseScore: EventScore = null;
        if (r.actual !== null && r.forecast !== null && r.surpriseAbsDelta !== null) {
          const sAbs = canonicalizeNumber(r.surpriseAbsDelta)!;
          if (sAbs <= FLOAT_EPSILON && hasMinS) {
            surpriseScore = 1;
          } else if (hasMinS && sThresh !== null) {
            surpriseScore = scoreDelta(r.actual, r.forecast, sThresh);
          }
        }

        let momentumScore: EventScore = null;
        if (r.actual !== null && r.previous !== null && r.momentumAbsDelta !== null) {
          const mAbs = canonicalizeNumber(r.momentumAbsDelta)!;
          if (mAbs <= FLOAT_EPSILON && hasMinM) {
            momentumScore = 1;
          } else if (hasMinM && mThresh !== null) {
            momentumScore = scoreDelta(r.actual, r.previous, mThresh);
          }
        }

        if (surpriseScore === null) continue;

        // Evaluate co-release directional coherence across the entire loaded calendar at this currency and timestamp
        const concurrentAll = calendarByCurrencyTimestamp.get(`${r.currency.toUpperCase()}_${r.timestamp}`) || [r];
        const coherence = evaluateCoReleaseCoherence(r, concurrentAll);

        // Compute returns ONLY if eligible for that specific pair
        const eurusdPath = isEurusdEligible
          ? computeEventReturns(r.timestamp, 'USD', 'EURUSD', eurusdCandles)
          : undefined;

        const usdjpyPath = isUsdjpyEligible
          ? computeEventReturns(r.timestamp, 'USD', 'USDJPY', usdjpyCandles)
          : undefined;

        scoredObservations.push({
          release: r,
          surpriseScore,
          momentumScore,
          eurusdEligible: isEurusdEligible,
          usdjpyEligible: isUsdjpyEligible,
          eurusdPath,
          usdjpyPath,
          coReleaseCoherence: coherence,
        });
      }

      // Append valid observations from group to running history
      for (const r of group) {
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

    // Process pair outcomes
    const buildSeriesOutcomes = (
      pair: string,
      filterPair: (obs: ScoredObservationPair) => boolean,
      getPath: (obs: ScoredObservationPair) => AlignedExplorationPath
    ): ExplorationSeriesOutcomes => {
      const pairObs = scoredObservations.filter(filterPair);
      const position = pair.startsWith('USD') ? 'base' : 'quote';

      // Cumulative horizons H1..H42
      const cumAll = Array.from({ length: 42 }, (_, i) => {
        const returns = pairObs.map((obs) => getPath(obs).cumulativeSimpleReturns[i]);
        return computeHorizonMetrics(i + 1, returns);
      });

      const posObs = pairObs.filter((obs) => obs.surpriseScore === 3);
      const negObs = pairObs.filter((obs) => obs.surpriseScore === -3);

      const cumPos = Array.from({ length: 42 }, (_, i) => {
        const returns = posObs.map((obs) => getPath(obs).cumulativeSimpleReturns[i]);
        return computeHorizonMetrics(i + 1, returns);
      });

      const cumNeg = Array.from({ length: 42 }, (_, i) => {
        const returns = negObs.map((obs) => getPath(obs).cumulativeSimpleReturns[i]);
        return computeHorizonMetrics(i + 1, returns);
      });

      // Delayed horizons H2..H42
      const delayedAll = Array.from({ length: 41 }, (_, idx) => {
        const h = idx + 2;
        const returns = pairObs.map((obs) => getPath(obs).delayedSimpleReturns[h - 1]);
        return computeHorizonMetrics(h, returns);
      });

      const delayedPos = Array.from({ length: 41 }, (_, idx) => {
        const h = idx + 2;
        const returns = posObs.map((obs) => getPath(obs).delayedSimpleReturns[h - 1]);
        return computeHorizonMetrics(h, returns);
      });

      const delayedNeg = Array.from({ length: 41 }, (_, idx) => {
        const h = idx + 2;
        const returns = negObs.map((obs) => getPath(obs).delayedSimpleReturns[h - 1]);
        return computeHorizonMetrics(h, returns);
      });

      // Contrasts
      const primaryContrastH12Delayed = computeContrast(
        12,
        'delayed',
        posObs.map((obs) => getPath(obs).delayedSimpleReturns[11]),
        negObs.map((obs) => getPath(obs).delayedSimpleReturns[11])
      );

      const secondaryContrastH4Delayed = computeContrast(
        4,
        'delayed',
        posObs.map((obs) => getPath(obs).delayedSimpleReturns[3]),
        negObs.map((obs) => getPath(obs).delayedSimpleReturns[3])
      );

      const secondaryContrastH24Delayed = computeContrast(
        24,
        'delayed',
        posObs.map((obs) => getPath(obs).delayedSimpleReturns[23]),
        negObs.map((obs) => getPath(obs).delayedSimpleReturns[23])
      );

      const secondaryContrastH1Cumulative = computeContrast(
        1,
        'cumulative',
        posObs.map((obs) => getPath(obs).cumulativeSimpleReturns[0]),
        negObs.map((obs) => getPath(obs).cumulativeSimpleReturns[0])
      );

      const secondaryContrastH12Cumulative = computeContrast(
        12,
        'cumulative',
        posObs.map((obs) => getPath(obs).cumulativeSimpleReturns[11]),
        negObs.map((obs) => getPath(obs).cumulativeSimpleReturns[11])
      );

      // Full 25-cell 5x5 interaction matrix including zero-count cells
      const cellReturnsMap = new Map<string, number[]>();
      for (const obs of pairObs) {
        if (obs.surpriseScore === null || obs.momentumScore === null) continue;
        const key = `S${obs.surpriseScore > 0 ? '+' + obs.surpriseScore : obs.surpriseScore}_M${obs.momentumScore > 0 ? '+' + obs.momentumScore : obs.momentumScore}`;
        let list = cellReturnsMap.get(key);
        if (!list) {
          list = [];
          cellReturnsMap.set(key, list);
        }
        const ret = getPath(obs).delayedSimpleReturns[11];
        if (ret !== null && Number.isFinite(ret)) list.push(ret);
      }
      const matrix5x5H12Delayed = buildComplete5x5Matrix(cellReturnsMap);

      // Chronological stability: early vs late Exploration halves
      const halfN = Math.floor(pairObs.length / 2);
      const earlyObs = pairObs.slice(0, halfN);
      const lateObs = pairObs.slice(halfN);

      const earlyPos = earlyObs.filter((o) => o.surpriseScore === 3).map((o) => getPath(o).delayedSimpleReturns[11]);
      const earlyNeg = earlyObs.filter((o) => o.surpriseScore === -3).map((o) => getPath(o).delayedSimpleReturns[11]);
      const latePos = lateObs.filter((o) => o.surpriseScore === 3).map((o) => getPath(o).delayedSimpleReturns[11]);
      const lateNeg = lateObs.filter((o) => o.surpriseScore === -3).map((o) => getPath(o).delayedSimpleReturns[11]);

      const earlyContrast = computeContrast(12, 'delayed', earlyPos, earlyNeg);
      const lateContrast = computeContrast(12, 'delayed', latePos, lateNeg);

      const stabilitySummary =
        earlyContrast.meanDifference !== null && lateContrast.meanDifference !== null
          ? Math.sign(earlyContrast.meanDifference) === Math.sign(lateContrast.meanDifference)
            ? 'Sign of mean difference agreed between earlier and later Exploration periods.'
            : 'Sign of mean difference flipped between earlier and later Exploration periods (chronologically unstable).'
          : 'Insufficient sample to determine stability sign agreement.';

      // Co-release pairwise coherence analysis at H12 delayed
      const coherentObs = pairObs.filter((o) => o.coReleaseCoherence === 'COHERENT');
      const conflictingObs = pairObs.filter((o) => o.coReleaseCoherence === 'CONFLICTING');
      const isolatedObs = pairObs.filter((o) => o.coReleaseCoherence === 'ISOLATED');
      const unclassifiedObs = pairObs.filter((o) => o.coReleaseCoherence === 'UNCLASSIFIED');

      const coherentStats = computeHorizonMetrics(12, coherentObs.map((o) => getPath(o).delayedSimpleReturns[11]));
      const conflictingStats = computeHorizonMetrics(12, conflictingObs.map((o) => getPath(o).delayedSimpleReturns[11]));
      const isolatedStats = computeHorizonMetrics(12, isolatedObs.map((o) => getPath(o).delayedSimpleReturns[11]));
      const unclassifiedStats = computeHorizonMetrics(12, unclassifiedObs.map((o) => getPath(o).delayedSimpleReturns[11]));

      const coherenceSummary = `Pairwise coherent: N=${coherentStats.n}, Pairwise conflicting: N=${conflictingStats.n}, Isolated: N=${isolatedStats.n}, Unclassified simultaneous: N=${unclassifiedStats.n}.`;

      // Sensitivity: isolated vs simultaneous releases
      const isoContrast = computeContrast(
        12,
        'delayed',
        isolatedObs.filter((o) => o.surpriseScore === 3).map((o) => getPath(o).delayedSimpleReturns[11]),
        isolatedObs.filter((o) => o.surpriseScore === -3).map((o) => getPath(o).delayedSimpleReturns[11])
      );

      const simObs = pairObs.filter((o) => o.release.simultaneousReleaseCount > 1);
      const simContrast = computeContrast(
        12,
        'delayed',
        simObs.filter((o) => o.surpriseScore === 3).map((o) => getPath(o).delayedSimpleReturns[11]),
        simObs.filter((o) => o.surpriseScore === -3).map((o) => getPath(o).delayedSimpleReturns[11])
      );

      const weekendCrossingCount = pairObs.filter((o) => getPath(o).crossesWeekend).length;
      const nonWeekendGapCount = pairObs.filter((o) => getPath(o).crossesNonWeekendGap).length;

      // Outlier influence analysis: leave-one-out
      const sortedPosH12 = [...posObs]
        .map((o) => ({ valueId: o.release.valueId, date: o.release.date, delayedReturnH12: getPath(o).delayedSimpleReturns[11]! }))
        .filter((o) => o.delayedReturnH12 !== null && Number.isFinite(o.delayedReturnH12))
        .sort((a, b) => Math.abs(b.delayedReturnH12) - Math.abs(a.delayedReturnH12));

      const sortedNegH12 = [...negObs]
        .map((o) => ({ valueId: o.release.valueId, date: o.release.date, delayedReturnH12: getPath(o).delayedSimpleReturns[11]! }))
        .filter((o) => o.delayedReturnH12 !== null && Number.isFinite(o.delayedReturnH12))
        .sort((a, b) => Math.abs(b.delayedReturnH12) - Math.abs(a.delayedReturnH12));

      const meanExcludingTopPos =
        sortedPosH12.length > 1
          ? sortedPosH12.slice(1).reduce((s, o) => s + o.delayedReturnH12, 0) / (sortedPosH12.length - 1)
          : null;

      const meanExcludingTopNeg =
        sortedNegH12.length > 1
          ? sortedNegH12.slice(1).reduce((s, o) => s + o.delayedReturnH12, 0) / (sortedNegH12.length - 1)
          : null;

      // Event-level individual paths
      const individualEventPaths: IndividualEventRecord[] = pairObs.map((obs) => {
        const pathData = getPath(obs);
        return {
          valueId: obs.release.valueId,
          date: obs.release.date,
          timestamp: obs.release.timestamp,
          actual: obs.release.actual,
          forecast: obs.release.forecast,
          previous: obs.release.previous,
          surpriseDelta: obs.release.surpriseDelta,
          momentumDelta: obs.release.momentumDelta,
          surpriseScore: obs.surpriseScore,
          momentumScore: obs.momentumScore,
          p0: pathData.p0,
          h1Close: pathData.h1Close,
          cumulativeReturns: pathData.cumulativeSimpleReturns,
          delayedReturns: pathData.delayedSimpleReturns,
          simultaneousReleaseCount: obs.release.simultaneousReleaseCount,
          simultaneousEvents: obs.release.simultaneousEvents,
          coReleaseCoherence: obs.coReleaseCoherence,
          crossesWeekend: pathData.crossesWeekend,
          crossesNonWeekendGap: pathData.crossesNonWeekendGap,
        };
      });

      return {
        seriesKey: target.seriesKey,
        displayName: target.displayName,
        pair,
        currencyPosition: position,
        eligibleN: pairObs.length,
        cumulativeHorizonsAll: cumAll,
        cumulativeHorizonsLargePosSurprise: cumPos,
        cumulativeHorizonsLargeNegSurprise: cumNeg,
        delayedHorizonsAll: delayedAll,
        delayedHorizonsLargePosSurprise: delayedPos,
        delayedHorizonsLargeNegSurprise: delayedNeg,
        primaryContrastH12Delayed,
        secondaryContrastH4Delayed,
        secondaryContrastH24Delayed,
        secondaryContrastH1Cumulative,
        secondaryContrastH12Cumulative,
        matrix5x5H12Delayed,
        chronologicalStabilityH12Delayed: {
          earlyHalf: { n: earlyObs.length, meanPosDiff: earlyContrast.meanDifference, medianPosDiff: earlyContrast.medianDifference },
          lateHalf: { n: lateObs.length, meanPosDiff: lateContrast.meanDifference, medianPosDiff: lateContrast.medianDifference },
          stabilitySummary,
        },
        coReleaseCoherenceH12Delayed: {
          coherent: { n: coherentStats.n, meanDelayedH12: coherentStats.mean, medianDelayedH12: coherentStats.median },
          conflicting: { n: conflictingStats.n, meanDelayedH12: conflictingStats.mean, medianDelayedH12: conflictingStats.median },
          isolated: { n: isolatedStats.n, meanDelayedH12: isolatedStats.mean, medianDelayedH12: isolatedStats.median },
          unclassified: { n: unclassifiedStats.n, meanDelayedH12: unclassifiedStats.mean, medianDelayedH12: unclassifiedStats.median },
          summary: coherenceSummary,
        },
        sensitivity: {
          isolatedOnlyH12: { n: isolatedObs.length, meanPosDiff: isoContrast.meanDifference, medianPosDiff: isoContrast.medianDifference },
          simultaneousH12: { n: simObs.length, meanPosDiff: simContrast.meanDifference, medianPosDiff: simContrast.medianDifference },
          weekendCrossingCount,
          nonWeekendGapCount,
        },
        outlierInfluence: {
          top3DriversPos: sortedPosH12.slice(0, 3),
          top3DriversNeg: sortedNegH12.slice(0, 3),
          meanExcludingTopDriverPos: canonicalizeNumber(meanExcludingTopPos),
          meanExcludingTopDriverNeg: canonicalizeNumber(meanExcludingTopNeg),
        },
        individualEventPaths,
      };
    };

    const eurusdRes = buildSeriesOutcomes(
      'EURUSD',
      (o) => o.eurusdEligible && o.eurusdPath !== undefined,
      (o) => o.eurusdPath!
    );

    const usdjpyRes = buildSeriesOutcomes(
      'USDJPY',
      (o) => o.usdjpyEligible && o.usdjpyPath !== undefined,
      (o) => o.usdjpyPath!
    );

    eurusdOutcomes[target.seriesKey] = eurusdRes;
    usdjpyOutcomes[target.seriesKey] = usdjpyRes;

    primaryRawPValues.push({
      key: target.displayName,
      pValue: eurusdRes.primaryContrastH12Delayed.permutationPValue,
    });
  }

  // Adjust multiple testing across the 4 primary contrasts on EURUSD
  const familyAdjK4 = adjustMultipleTesting(primaryRawPValues, 4);
  const familyAdjK2 = adjustMultipleTesting(primaryRawPValues, 2);

  const manifest = {
    protocolVersion: '1.1.0',
    generatedAt: new Date().toISOString(),
    baselineCommit: BASELINE_COMMIT,
    splitBoundaryBrokerTime: SPLIT_DATE_STRING,
    splitBoundaryTimestamp: SPLIT_TIMESTAMP,
    sourceHash: hash,
    schemaVersion: EXPECTED_SCHEMA_VERSION,
    status: 'COMPLETE',
  };

  return {
    manifest,
    eurusdOutcomes,
    usdjpyOutcomes,
    familyMultiplicity: {
      familyK4Penalty: familyAdjK4,
      familyK2EvaluatedSubset: familyAdjK2,
    },
  };
}

if (process.argv[1] && process.argv[1].endsWith('runExploration.ts')) {
  runExplorationStudy()
    .then((result) => {
      const outputPath = path.join(repoRoot, 'lab', 'research', 'phase1_exploration.json');
      fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf8');
      console.log(`Exploration analysis written to: ${outputPath}`);
    })
    .catch((err) => {
      console.error('Exploration run failed:', err);
      process.exit(1);
    });
}
