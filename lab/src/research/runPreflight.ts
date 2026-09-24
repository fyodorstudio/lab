import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

import { CalendarRepository } from '../data/calendarLoader.js';
import { resolveResearchDataSource } from '../data/dataSourceResolver.js';
import { calculateQuantile, canonicalizeNumber } from '../shared/utils.js';
import { scoreDelta } from '../analytics/eventScorer.js';
import { findFirstCandleIndex } from '../data/candleLoader.js';
import { FLOAT_EPSILON } from '../shared/constants.js';

import {
  SPLIT_TIMESTAMP,
  SPLIT_DATE_STRING,
  EXPECTED_CALENDAR_SHA256,
  EXPECTED_SCHEMA_VERSION,
  EXPECTED_SOURCE_FOLDER,
  BASELINE_COMMIT,
  REPORTING_MIN_CELL_N,
  ALL_5X5_CELL_KEYS,
  TARGET_SERIES_DEFINITIONS,
  Phase1PreflightManifest,
  SeriesPreflightAudit,
} from './types.js';
import { isExploration, computeH42CloseTimestamp, doesH42CrossSplit } from './boundaryGuard.js';
import { loadCandleTimestampsOnly } from './timestampLoader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');

export async function generatePreflightAudit(): Promise<Phase1PreflightManifest> {
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
  const metrics = calendarRepo.getMetrics();

  // STRICTLY TIMESTAMP-ONLY: load candle timestamps directly without parsing OHLC prices
  const eurusdCandlePath = path.join(source.candlesDir, 'candles_EURUSD_H1.csv');
  const usdjpyCandlePath = path.join(source.candlesDir, 'candles_USDJPY_H1.csv');

  const eurusdTimes = await loadCandleTimestampsOnly(eurusdCandlePath);
  const usdjpyTimes = await loadCandleTimestampsOnly(usdjpyCandlePath);

  if (eurusdTimes.length === 0 || usdjpyTimes.length === 0) {
    throw new Error('Failed to load candle timestamps for EURUSD or USDJPY');
  }

  // Count discovered candle files
  const candleFiles = fs.readdirSync(source.candlesDir).filter((f) => f.endsWith('_H1.csv'));

  const knownPriorExposures = [
    { valueId: '229745', series: 'USD CPI m/m', brokerDate: '2025-08-12 15:30', splitPeriod: 'CONFIRMATION' as const, disposition: 'Sealed. Exclude from primary Confirmation tests; retain as disclosed sensitivity.' },
    { valueId: '229744', series: 'USD CPI m/m', brokerDate: '2025-07-15 15:30', splitPeriod: 'CONFIRMATION' as const, disposition: 'Sealed. Exclude from primary Confirmation tests; retain as disclosed sensitivity.' },
    { valueId: '229741', series: 'USD CPI m/m', brokerDate: '2025-04-10 15:30', splitPeriod: 'CONFIRMATION' as const, disposition: 'Sealed. Exclude from primary Confirmation tests; retain as disclosed sensitivity.' },
    { valueId: '229757', series: 'USD Core CPI m/m', brokerDate: '2025-08-12 15:30', splitPeriod: 'CONFIRMATION' as const, disposition: 'Sealed. Exclude from primary Confirmation tests; retain as disclosed sensitivity.' },
    { valueId: '115719', series: 'USD Core PCE m/m', brokerDate: '2020-10-01 15:30', splitPeriod: 'EXPLORATION' as const, disposition: 'In Exploration. Prior audit calculation known; documented sensitivity item.' },
    { valueId: '118422', series: 'Eurozone Manufacturing PMI r1', brokerDate: '2020-09-23 11:00', splitPeriod: 'EXPLORATION' as const, disposition: 'In Exploration. EUR series outside primary USD family.' },
    { valueId: '277623', series: 'USD Nonfarm Payrolls', brokerDate: '2026-09-04 15:30', splitPeriod: 'CONFIRMATION' as const, disposition: 'Sealed. Exclude from primary Confirmation tests; retain as disclosed sensitivity.' },
  ];

  const seriesAudits: Record<string, SeriesPreflightAudit> = {};

  for (const target of TARGET_SERIES_DEFINITIONS) {
    const releases = calendarRepo.getReleasesForEvent('USD', '', target.eventId, target.seriesKey);
    const sorted = [...releases].sort((a, b) => a.timestamp - b.timestamp);

    // Group by timestamp for strictly prior walk-forward evaluation
    const timestampGroups = new Map<number, typeof sorted>();
    for (const r of sorted) {
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

    let completeAFPCount = 0;
    let incompleteAFPCount = 0;
    let explorationTotalReleases = 0;
    let confirmationTotalReleases = 0;

    let eurusdH42CrossingCount = 0;
    let eurusdEligibleCount = 0;
    let usdjpyH42CrossingCount = 0;
    let usdjpyEligibleCount = 0;
    let pairMismatchCount = 0;

    const surpriseScores = { p3: 0, p2: 0, p1: 0, m2: 0, m3: 0 };
    const momentumScores = { p3: 0, p2: 0, p1: 0, m2: 0, m3: 0 };

    // Initialize all 25 cells of the 5x5 matrix to 0
    const matrix5x5: Record<string, number> = {};
    for (const key of ALL_5X5_CELL_KEYS) {
      matrix5x5[key] = 0;
    }

    for (const group of timestampGroups.values()) {
      const sortedPriorS = [...runningSurprise].sort((a, b) => a - b);
      const sortedPriorM = [...runningMomentum].sort((a, b) => a - b);

      const hasMinS = sortedPriorS.length >= minHistory;
      const hasMinM = sortedPriorM.length >= minHistory;

      const sThresh = hasMinS ? calculateQuantile(sortedPriorS, percentile) : null;
      const mThresh = hasMinM ? calculateQuantile(sortedPriorM, percentile) : null;

      for (const r of group) {
        const isComplete = r.hasCompleteAFP;
        if (isComplete) completeAFPCount++;
        else incompleteAFPCount++;

        // Walk-forward scoring based strictly on metadata/deltas
        let sScore: number | null = null;
        if (isComplete && r.actual !== null && r.forecast !== null && r.surpriseAbsDelta !== null) {
          const sAbs = canonicalizeNumber(r.surpriseAbsDelta)!;
          if (sAbs <= FLOAT_EPSILON && hasMinS) {
            sScore = 1;
          } else if (hasMinS && sThresh !== null) {
            sScore = scoreDelta(r.actual, r.forecast, sThresh);
          }
        }

        let mScore: number | null = null;
        if (isComplete && r.actual !== null && r.previous !== null && r.momentumAbsDelta !== null) {
          const mAbs = canonicalizeNumber(r.momentumAbsDelta)!;
          if (mAbs <= FLOAT_EPSILON && hasMinM) {
            mScore = 1;
          } else if (hasMinM && mThresh !== null) {
            mScore = scoreDelta(r.actual, r.previous, mThresh);
          }
        }

        const isExplo = isExploration(r.timestamp);
        if (isExplo) {
          explorationTotalReleases++;
        } else {
          confirmationTotalReleases++;
        }

        // Boundary checks evaluated SEPARATELY for EURUSD and USDJPY using candle timestamps alone
        // 1. EURUSD H42 boundary check
        const eurusdP0Idx = findFirstCandleIndex(eurusdTimes, r.timestamp);
        const eurusdH42Close = computeH42CloseTimestamp(eurusdP0Idx, eurusdTimes);
        const eurusdCrosses = doesH42CrossSplit(eurusdH42Close);
        if (isExplo && eurusdCrosses) {
          eurusdH42CrossingCount++;
        }

        // 2. USDJPY H42 boundary check
        const usdjpyP0Idx = findFirstCandleIndex(usdjpyTimes, r.timestamp);
        const usdjpyH42Close = computeH42CloseTimestamp(usdjpyP0Idx, usdjpyTimes);
        const usdjpyCrosses = doesH42CrossSplit(usdjpyH42Close);
        if (isExplo && usdjpyCrosses) {
          usdjpyH42CrossingCount++;
        }

        const isEurusdEligible = isExplo && !eurusdCrosses && isComplete && sScore !== null;
        const isUsdjpyEligible = isExplo && !usdjpyCrosses && isComplete && sScore !== null;

        if (isEurusdEligible) eurusdEligibleCount++;
        if (isUsdjpyEligible) usdjpyEligibleCount++;
        if (isEurusdEligible !== isUsdjpyEligible) pairMismatchCount++;

        // For series-level surprise/momentum counts, use primary EURUSD eligible set
        if (isEurusdEligible && sScore !== null) {
          const sKey = sScore === 3 ? 'p3' : sScore === 2 ? 'p2' : sScore === 1 ? 'p1' : sScore === -2 ? 'm2' : 'm3';
          surpriseScores[sKey]++;

          if (mScore !== null) {
            const mKey = mScore === 3 ? 'p3' : mScore === 2 ? 'p2' : mScore === 1 ? 'p1' : mScore === -2 ? 'm2' : 'm3';
            momentumScores[mKey]++;
            const cellKey = `S${sScore > 0 ? '+' + sScore : sScore}_M${mScore > 0 ? '+' + mScore : mScore}`;
            matrix5x5[cellKey] = (matrix5x5[cellKey] || 0) + 1;
          }
        }
      }

      // Append to strictly prior history
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

    const isAdequate = surpriseScores.p3 >= REPORTING_MIN_CELL_N && surpriseScores.m3 >= REPORTING_MIN_CELL_N;
    const powerStatus = isAdequate ? 'ADEQUATE' : 'UNDERPOWERED';
    const powerRationale = isAdequate
      ? `Sample meets the exploratory reporting threshold (min(N+, N-) = min(${surpriseScores.p3}, ${surpriseScores.m3}) >= ${REPORTING_MIN_CELL_N}). Note that N remains small in absolute terms.`
      : `Sample falls below the minimum cell reporting threshold (min(N+, N-) = min(${surpriseScores.p3}, ${surpriseScores.m3}) < ${REPORTING_MIN_CELL_N}). Formal two-sample hypothesis testing is omitted to prevent calculating p-values on sample noise.`;

    seriesAudits[target.seriesKey] = {
      displayName: target.displayName,
      seriesKey: target.seriesKey,
      eventId: target.eventId,
      revision: target.revision,
      totalReleasesInExport: releases.length,
      completeAFPCount,
      incompleteAFPCount,
      explorationTotalReleases,
      confirmationTotalReleases,
      eurusdExplorationH42CrossingCount: eurusdH42CrossingCount,
      eurusdEligibleExplorationCount: eurusdEligibleCount,
      usdjpyExplorationH42CrossingCount: usdjpyH42CrossingCount,
      usdjpyEligibleExplorationCount: usdjpyEligibleCount,
      pairBoundaryMismatchCount: pairMismatchCount,
      surpriseScoresExploration: surpriseScores,
      momentumScoresExploration: momentumScores,
      matrix5x5Exploration: matrix5x5,
      primaryContrastPowerStatus: powerStatus,
      powerRationale,
    };
  }

  const manifest: Phase1PreflightManifest = {
    manifestVersion: '1.1.0',
    generatedAt: new Date().toISOString(),
    baselineCommit: BASELINE_COMMIT,
    splitBoundaryBrokerTime: SPLIT_DATE_STRING,
    splitBoundaryTimestamp: SPLIT_TIMESTAMP,
    timestampLoadingMethod: 'STRICTLY_TIMESTAMP_ONLY (loadCandleTimestampsOnly: reads column 0 only; OHLC prices never parsed or loaded)',
    sourceVerification: {
      exportRoot: source.root,
      schemaVersion: EXPECTED_SCHEMA_VERSION,
      calendarPath: source.calendarPath,
      calendarSha256: hash,
      hashMatchesExpected: hash === EXPECTED_CALENDAR_SHA256,
      totalCalendarRows: metrics?.calendarRecordCount ?? 0,
      candleFilesCount: candleFiles.length,
    },
    knownPriorExposures,
    seriesAudits,
    familyMultiplicityRule: {
      plannedFamilyK: 4,
      reportingThresholdN: REPORTING_MIN_CELL_N,
      omittedUnderpoweredCount: Object.values(seriesAudits).filter((s) => s.primaryContrastPowerStatus === 'UNDERPOWERED').length,
      evaluatedEligibleCount: Object.values(seriesAudits).filter((s) => s.primaryContrastPowerStatus === 'ADEQUATE').length,
      policy: 'Omitted underpowered series do not reduce the multiplicity penalty; they consume error budget under full K=4 family correction.',
    },
  };

  return manifest;
}

if (process.argv[1] && process.argv[1].endsWith('runPreflight.ts')) {
  generatePreflightAudit().then((manifest) => {
    const outputPath = path.join(repoRoot, 'lab', 'research', 'phase1_preflight.json');
    fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2), 'utf8');
    console.log(`Preflight manifest written to: ${outputPath}`);
    console.log(JSON.stringify(manifest, null, 2));
  }).catch((err) => {
    console.error('Preflight audit failed:', err);
    process.exit(1);
  });
}
