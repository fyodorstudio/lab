import { calculateQuantile, canonicalizeNumber } from '../shared/utils.js';
import { ContrastResult, HorizonMetrics, REPORTING_MIN_CELL_N, ALL_5X5_CELL_KEYS } from './types.js';
import { EventScore } from '../shared/types.js';

/**
 * Computes comprehensive descriptive horizon metrics for an array of valid returns.
 */
export function computeHorizonMetrics(horizon: number, rawReturns: Array<number | null>): HorizonMetrics {
  const valid = rawReturns.filter((v): v is number => v !== null && Number.isFinite(v));
  const n = valid.length;

  if (n === 0) {
    return {
      horizon,
      n: 0,
      mean: null,
      median: null,
      stdDev: null,
      min: null,
      max: null,
      p10: null,
      p25: null,
      p50: null,
      p75: null,
      p90: null,
      positiveCount: 0,
      negativeCount: 0,
      zeroCount: 0,
      positiveDirectionRate: null,
    };
  }

  const sorted = [...valid].sort((a, b) => a - b);
  const sum = valid.reduce((acc, v) => acc + v, 0);
  const mean = sum / n;

  let variance = 0;
  if (n > 1) {
    variance = valid.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (n - 1);
  }
  const stdDev = n > 1 ? Math.sqrt(variance) : 0;

  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  const p10 = calculateQuantile(sorted, 10);
  const p25 = calculateQuantile(sorted, 25);
  const p50 = calculateQuantile(sorted, 50);
  const p75 = calculateQuantile(sorted, 75);
  const p90 = calculateQuantile(sorted, 90);
  const median = p50;

  let positiveCount = 0;
  let negativeCount = 0;
  let zeroCount = 0;

  for (const v of valid) {
    if (v > 1e-9) positiveCount++;
    else if (v < -1e-9) negativeCount++;
    else zeroCount++;
  }

  const positiveDirectionRate = n > 0 ? positiveCount / n : null;

  return {
    horizon,
    n,
    mean: canonicalizeNumber(mean),
    median: canonicalizeNumber(median),
    stdDev: canonicalizeNumber(stdDev),
    min: canonicalizeNumber(min),
    max: canonicalizeNumber(max),
    p10: canonicalizeNumber(p10),
    p25: canonicalizeNumber(p25),
    p50: canonicalizeNumber(p50),
    p75: canonicalizeNumber(p75),
    p90: canonicalizeNumber(p90),
    positiveCount,
    negativeCount,
    zeroCount,
    positiveDirectionRate: canonicalizeNumber(positiveDirectionRate),
  };
}

/**
 * Computes binomial coefficient C(n, k).
 */
export function combinationsCount(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  const c = Math.min(k, n - k);
  let res = 1;
  for (let i = 1; i <= c; i++) {
    res = (res * (n - c + i)) / i;
  }
  return Math.round(res);
}

/**
 * Two-tailed permutation test.
 * - Uses exact combinatorial enumeration when combinations <= 50,000.
 * - Uses seeded Monte Carlo (100,000 trials, seed 42840030) when combinations > 50,000.
 */
export function computePermutationTest(
  groupA: number[],
  groupB: number[]
): {
  pValue: number;
  method: 'exact' | 'seeded_monte_carlo';
  details: string;
} | null {
  const nA = groupA.length;
  const nB = groupB.length;
  if (nA < 1 || nB < 1) return null;

  const sumA = groupA.reduce((s, v) => s + v, 0);
  const sumB = groupB.reduce((s, v) => s + v, 0);
  const meanA = sumA / nA;
  const meanB = sumB / nB;
  const observedDiff = Math.abs(meanA - meanB);

  const combined = [...groupA, ...groupB];
  const totalN = combined.length;
  const totalSum = sumA + sumB;

  const totalComb = combinationsCount(totalN, nA);

  if (totalComb <= 50000) {
    // Exact combinatorial enumeration
    let countGreater = 0;

    // Recursive combination generator
    const indices = new Array<number>(nA);
    const recurse = (startIdx: number, depth: number, currentSumA: number) => {
      if (depth === nA) {
        const meanPermA = currentSumA / nA;
        const meanPermB = (totalSum - currentSumA) / nB;
        if (Math.abs(meanPermA - meanPermB) >= observedDiff - 1e-12) {
          countGreater++;
        }
        return;
      }
      for (let i = startIdx; i <= totalN - (nA - depth); i++) {
        indices[depth] = i;
        recurse(i + 1, depth + 1, currentSumA + combined[i]);
      }
    };

    recurse(0, 0, 0);

    const pValue = countGreater / totalComb;
    return {
      pValue: canonicalizeNumber(pValue)!,
      method: 'exact',
      details: `Exact combinatorial permutation test across all ${totalComb.toLocaleString()} partitions`,
    };
  } else {
    // Seeded Monte Carlo permutation test with 100,000 iterations
    const numTrials = 100000;
    const SEED = 42840030;
    let seed = SEED;
    const lcg = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    let countGreater = 0;
    const shuffled = [...combined];

    for (let t = 0; t < numTrials; t++) {
      for (let i = totalN - 1; i > 0; i--) {
        const j = Math.floor(lcg() * (i + 1));
        const tmp = shuffled[i];
        shuffled[i] = shuffled[j];
        shuffled[j] = tmp;
      }

      let permSumA = 0;
      for (let i = 0; i < nA; i++) permSumA += shuffled[i];
      const permSumB = totalSum - permSumA;

      const permDiff = Math.abs(permSumA / nA - permSumB / nB);
      if (permDiff >= observedDiff - 1e-12) {
        countGreater++;
      }
    }

    const pValue = (countGreater + 1) / (numTrials + 1);
    return {
      pValue: canonicalizeNumber(pValue)!,
      method: 'seeded_monte_carlo',
      details: `Seeded Monte Carlo permutation test with ${numTrials.toLocaleString()} iterations (seed: ${SEED}) across ${totalComb.toLocaleString()} theoretical combinations`,
    };
  }
}

/**
 * Mann-Whitney U test (Wilcoxon rank-sum test) for two independent groups.
 */
export function mannWhitneyUTest(groupA: number[], groupB: number[]): number | null {
  const nA = groupA.length;
  const nB = groupB.length;
  if (nA < 1 || nB < 1) return null;

  interface TaggedItem {
    value: number;
    group: 'A' | 'B';
  }

  const combined: TaggedItem[] = [
    ...groupA.map((v) => ({ value: v, group: 'A' as const })),
    ...groupB.map((v) => ({ value: v, group: 'B' as const })),
  ].sort((a, b) => a.value - b.value);

  // Assign average ranks for ties
  const ranks = new Array<number>(combined.length);
  let i = 0;
  while (i < combined.length) {
    let j = i;
    while (j < combined.length - 1 && Math.abs(combined[j + 1].value - combined[j].value) <= 1e-9) {
      j++;
    }
    const avgRank = (i + 1 + j + 1) / 2;
    for (let k = i; k <= j; k++) {
      ranks[k] = avgRank;
    }
    i = j + 1;
  }

  let rankSumA = 0;
  for (let k = 0; k < combined.length; k++) {
    if (combined[k].group === 'A') {
      rankSumA += ranks[k];
    }
  }

  const uA = rankSumA - (nA * (nA + 1)) / 2;
  const uB = nA * nB - uA;
  const uMin = Math.min(uA, uB);

  const meanU = (nA * nB) / 2;
  const sigmaU = Math.sqrt((nA * nB * (nA + nB + 1)) / 12);
  if (sigmaU === 0) return 1.0;

  const z = (Math.abs(uMin - meanU) - 0.5) / sigmaU;
  const p = 2 * (1 - standardNormalCdf(z));
  return Math.min(1.0, Math.max(0.0, canonicalizeNumber(p)!));
}

function standardNormalCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp((-x * x) / 2);
  const poly = ((((1.330274429 * t - 1.821255978) * t + 1.781477937) * t - 0.356563782) * t + 0.319381530) * t;
  const prob = 1 - d * poly;
  return x >= 0 ? prob : 1 - prob;
}

/**
 * Computes the contrast between Large Positive (+3) and Large Negative (-3) Surprise.
 */
export function computeContrast(
  horizon: number,
  horizonType: 'cumulative' | 'delayed',
  posReturns: Array<number | null>,
  negReturns: Array<number | null>
): ContrastResult {
  const posValid = posReturns.filter((v): v is number => v !== null && Number.isFinite(v));
  const negValid = negReturns.filter((v): v is number => v !== null && Number.isFinite(v));

  const nPos = posValid.length;
  const nNeg = negValid.length;

  const isUnderpowered = nPos < REPORTING_MIN_CELL_N || nNeg < REPORTING_MIN_CELL_N;
  const powerWarning = isUnderpowered
    ? `Underpowered for formal hypothesis testing: min(N+, N-) = min(${nPos}, ${nNeg}) < ${REPORTING_MIN_CELL_N}. Reported descriptively only.`
    : undefined;

  const posSorted = [...posValid].sort((a, b) => a - b);
  const negSorted = [...negValid].sort((a, b) => a - b);

  const posMean = nPos > 0 ? posValid.reduce((a, b) => a + b, 0) / nPos : null;
  const negMean = nNeg > 0 ? negValid.reduce((a, b) => a + b, 0) / nNeg : null;
  const meanDiff = posMean !== null && negMean !== null ? posMean - negMean : null;

  const posMedian = nPos > 0 ? calculateQuantile(posSorted, 50) : null;
  const negMedian = nNeg > 0 ? calculateQuantile(negSorted, 50) : null;
  const medianDiff = posMedian !== null && negMedian !== null ? posMedian - negMedian : null;

  // Permutation and rank-sum tests are run only when adequately powered
  const permRes = isUnderpowered ? null : computePermutationTest(posValid, negValid);
  const rankP = isUnderpowered ? null : mannWhitneyUTest(posValid, negValid);

  return {
    horizon,
    horizonType,
    groupPositiveN: nPos,
    groupNegativeN: nNeg,
    groupPositiveMean: canonicalizeNumber(posMean),
    groupNegativeMean: canonicalizeNumber(negMean),
    meanDifference: canonicalizeNumber(meanDiff),
    groupPositiveMedian: canonicalizeNumber(posMedian),
    groupNegativeMedian: canonicalizeNumber(negMedian),
    medianDifference: canonicalizeNumber(medianDiff),
    permutationPValue: permRes ? permRes.pValue : null,
    permutationMethod: permRes ? permRes.method : null,
    permutationDetails: permRes ? permRes.details : undefined,
    rankSumPValue: rankP !== null ? canonicalizeNumber(rankP) : null,
    isUnderpowered,
    powerWarning,
  };
}

/**
 * Builds the complete 25-cell 5x5 interaction matrix including zero-count cells.
 */
export function buildComplete5x5Matrix(
  cellReturnsMap: Map<string, number[]>
): Array<{
  cell: string;
  surpriseScore: EventScore;
  momentumScore: EventScore;
  n: number;
  meanReturn: number | null;
  medianReturn: number | null;
  positiveDirectionRate: number | null;
}> {
  const parseCellKey = (cell: string): { s: EventScore; m: EventScore } => {
    const parts = cell.split('_');
    const sStr = parts[0].replace('S', '');
    const mStr = parts[1].replace('M', '');
    return {
      s: parseInt(sStr, 10) as EventScore,
      m: parseInt(mStr, 10) as EventScore,
    };
  };

  return ALL_5X5_CELL_KEYS.map((cellKey) => {
    const { s, m } = parseCellKey(cellKey);
    const returns = cellReturnsMap.get(cellKey) || [];
    const stats = computeHorizonMetrics(12, returns);
    return {
      cell: cellKey,
      surpriseScore: s,
      momentumScore: m,
      n: stats.n,
      meanReturn: stats.mean,
      medianReturn: stats.median,
      positiveDirectionRate: stats.positiveDirectionRate,
    };
  });
}

/**
 * Multiple-testing adjustments:
 * - Holm-Bonferroni step-down
 * - Benjamini-Hochberg False Discovery Rate
 */
export function adjustMultipleTesting(
  rawPValues: Array<{ key: string; pValue: number | null }>,
  familySizeK: number
): Array<{ key: string; rawP: number | null; holmP: number | null; bhP: number | null }> {
  const validEntries = rawPValues.filter((e): e is { key: string; pValue: number } => e.pValue !== null);
  validEntries.sort((a, b) => a.pValue - b.pValue);

  const m = familySizeK;
  const holmMap = new Map<string, number>();
  const bhMap = new Map<string, number>();

  let maxPrevHolm = 0;
  for (let k = 0; k < validEntries.length; k++) {
    const entry = validEntries[k];
    const multiplier = m - k;
    const adjusted = Math.min(1.0, Math.max(maxPrevHolm, entry.pValue * multiplier));
    maxPrevHolm = adjusted;
    holmMap.set(entry.key, adjusted);
  }

  const mEval = validEntries.length;
  const bhAdjusted: Array<{ key: string; p: number }> = [];
  for (let k = 0; k < mEval; k++) {
    const entry = validEntries[k];
    const rank = k + 1;
    const adj = Math.min(1.0, (entry.pValue * m) / rank);
    bhAdjusted.push({ key: entry.key, p: adj });
  }

  let minNext = 1.0;
  for (let k = mEval - 1; k >= 0; k--) {
    minNext = Math.min(minNext, bhAdjusted[k].p);
    bhMap.set(bhAdjusted[k].key, minNext);
  }

  return rawPValues.map((e) => ({
    key: e.key,
    rawP: e.pValue !== null ? canonicalizeNumber(e.pValue) : null,
    holmP: e.pValue !== null && holmMap.has(e.key) ? canonicalizeNumber(holmMap.get(e.key)!) : null,
    bhP: e.pValue !== null && bhMap.has(e.key) ? canonicalizeNumber(bhMap.get(e.key)!) : null,
  }));
}
