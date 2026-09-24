import { DistributionStats, HistogramBin } from './types.js';
import { CANONICAL_DECIMALS, FLOAT_EPSILON } from './constants.js';

/**
 * Deterministically rounds a number to canonical decimal places to eliminate IEEE-754 floating noise.
 */
export function canonicalizeNumber(val: number | null | undefined, decimals: number = CANONICAL_DECIMALS): number | null {
  if (val === null || val === undefined || !Number.isFinite(val)) return null;
  const factor = Math.pow(10, decimals);
  const rounded = Math.round(val * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/**
 * Calculates empirical quantile using linear interpolation between closest ranks.
 * Expects array to be pre-sorted ascending.
 */
export function calculateQuantile(sortedValues: number[], percentile: number): number | null {
  if (!sortedValues || sortedValues.length === 0) return null;
  if (sortedValues.length === 1) return canonicalizeNumber(sortedValues[0]);
  if (percentile <= 0) return canonicalizeNumber(sortedValues[0]);
  if (percentile >= 100) return canonicalizeNumber(sortedValues[sortedValues.length - 1]);

  const index = (percentile / 100) * (sortedValues.length - 1);
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);

  if (lowerIndex === upperIndex) {
    return canonicalizeNumber(sortedValues[lowerIndex]);
  }

  const fraction = index - lowerIndex;
  const raw = sortedValues[lowerIndex] + fraction * (sortedValues[upperIndex] - sortedValues[lowerIndex]);
  return canonicalizeNumber(raw);
}

export function calculateMean(values: number[]): number | null {
  if (!values || values.length === 0) return null;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
  }
  return canonicalizeNumber(sum / values.length);
}

export function calculateMedian(sortedValues: number[]): number | null {
  return calculateQuantile(sortedValues, 50);
}

export function calculateDistributionStats(values: number[]): DistributionStats {
  if (!values || values.length === 0) {
    return {
      n: 0,
      min: null,
      max: null,
      mean: null,
      median: null,
      p10: null,
      p25: null,
      p50: null,
      p60: null,
      p70: null,
      p75: null,
      p80: null,
      p85: null,
      p90: null,
      p95: null,
    };
  }

  const sorted = [...values].map(v => canonicalizeNumber(v)!).sort((a, b) => a - b);
  return {
    n: sorted.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: calculateMean(sorted),
    median: calculateMedian(sorted),
    p10: calculateQuantile(sorted, 10),
    p25: calculateQuantile(sorted, 25),
    p50: calculateQuantile(sorted, 50),
    p60: calculateQuantile(sorted, 60),
    p70: calculateQuantile(sorted, 70),
    p75: calculateQuantile(sorted, 75),
    p80: calculateQuantile(sorted, 80),
    p85: calculateQuantile(sorted, 85),
    p90: calculateQuantile(sorted, 90),
    p95: calculateQuantile(sorted, 95),
  };
}

/**
 * Creates histogram bins from numeric values
 */
export function createHistogramBins(values: number[], targetBinCount: number = 15): HistogramBin[] {
  if (!values || values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);

  if (min === max) {
    return [
      {
        binStart: min,
        binEnd: max,
        count: values.length,
        frequency: 1.0,
      },
    ];
  }

  const span = max - min;
  const binWidth = span / targetBinCount;
  const bins: HistogramBin[] = [];

  for (let i = 0; i < targetBinCount; i++) {
    const binStart = min + i * binWidth;
    const binEnd = i === targetBinCount - 1 ? max : min + (i + 1) * binWidth;
    bins.push({
      binStart,
      binEnd,
      count: 0,
      frequency: 0,
    });
  }

  for (const val of values) {
    let placed = false;
    for (let i = 0; i < bins.length; i++) {
      const isLast = i === bins.length - 1;
      if ((val >= bins[i].binStart && val < bins[i].binEnd) || (isLast && val <= bins[i].binEnd)) {
        bins[i].count++;
        placed = true;
        break;
      }
    }
    if (!placed && bins.length > 0) {
      bins[bins.length - 1].count++;
    }
  }

  for (const bin of bins) {
    bin.frequency = bin.count / values.length;
  }

  return bins;
}

export function formatBrokerServerDateTime(unixSeconds: number): string {
  // The integer is deliberately rendered without a timezone suffix. MT5
  // calendar functions use trade-server time; the repository has no broker
  // timezone metadata with which to convert this wall clock to verified UTC.
  return new Date(unixSeconds * 1000).toISOString().replace('.000Z', '');
}

/**
 * Generic empirical percentile rank (0 to 100) of a value against sorted historical values.
 * Represents the percentage of historical values that are <= this value.
 * Fully supports arbitrary signed numbers (negative, zero, positive).
 */
export function calculatePercentileRank(
  sortedValues: number[],
  value: number,
  epsilon: number = FLOAT_EPSILON
): number | null {
  if (!sortedValues || sortedValues.length === 0) return null;
  if (!Number.isFinite(value)) return null;

  let count = 0;
  for (let i = 0; i < sortedValues.length; i++) {
    if (sortedValues[i] <= value + epsilon) {
      count++;
    } else {
      break;
    }
  }

  return canonicalizeNumber((count / sortedValues.length) * 100);
}

/**
 * Strict-lower empirical percentile rank: percentage of historical values that are STRICTLY smaller than value:
 * count(v < value - epsilon) / N * 100.
 */
export function calculateStrictLowerPercentileRank(
  sortedValues: number[],
  value: number,
  epsilon: number = FLOAT_EPSILON
): number | null {
  if (!sortedValues || sortedValues.length === 0) return null;
  if (!Number.isFinite(value)) return null;

  let count = 0;
  for (let i = 0; i < sortedValues.length; i++) {
    if (sortedValues[i] < value - epsilon) {
      count++;
    } else {
      break;
    }
  }

  return canonicalizeNumber((count / sortedValues.length) * 100);
}

export interface TieMetrics {
  tieCount: number;
  tieRate: number; // e.g. 15.0 for 15.0%
  lowerRank: number; // count(v < x) / N * 100
  upperRank: number; // count(v <= x) / N * 100
  band: string; // e.g. "P70.0–P85.0"
}

/**
 * Calculates tie diagnostics against sorted historical values using canonical epsilon comparison.
 */
export function calculateTieMetrics(
  sortedValues: number[],
  value: number,
  epsilon: number = FLOAT_EPSILON
): TieMetrics | null {
  if (!sortedValues || sortedValues.length === 0 || !Number.isFinite(value)) return null;

  const n = sortedValues.length;
  let lowerCount = 0;
  let tieCount = 0;
  let upperCount = 0;

  for (let i = 0; i < n; i++) {
    const v = sortedValues[i];
    if (v < value - epsilon) {
      lowerCount++;
      upperCount++;
    } else if (Math.abs(v - value) <= epsilon) {
      tieCount++;
      upperCount++;
    }
  }

  const lowerRank = canonicalizeNumber((lowerCount / n) * 100)!;
  const upperRank = canonicalizeNumber((upperCount / n) * 100)!;
  const tieRate = canonicalizeNumber((tieCount / n) * 100)!;

  return {
    tieCount,
    tieRate,
    lowerRank,
    upperRank,
    band: `P${lowerRank.toFixed(1)}–P${upperRank.toFixed(1)}`,
  };
}

/**
 * Formats a numerical threshold or delta value with its real unit (% , K, M, etc.).
 */
export function formatWithUnit(val: number | null, unit?: string, decimals: number = 3): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return 'N/A';

  if (unit === '%') {
    return `${val.toFixed(2)}%`;
  }

  if (unit === 'K' || unit === 'k') {
    if (Math.abs(val) >= 1000) {
      return `${(val / 1000).toFixed(1)}K`;
    }
    return `${val.toFixed(1)}K`;
  }

  if (unit === 'M' || unit === 'm') {
    if (Math.abs(val) >= 1e6) {
      return `${(val / 1e6).toFixed(2)}M`;
    }
    return `${val.toFixed(2)}M`;
  }

  if (unit === 'B' || unit === 'b') {
    if (Math.abs(val) >= 1e9) {
      return `${(val / 1e9).toFixed(2)}B`;
    }
    return `${val.toFixed(2)}B`;
  }

  // Float precision: if integer, show without trailing zeros; otherwise decimals
  if (Number.isInteger(val)) {
    return String(val);
  }

  const str = val.toFixed(decimals);
  // Strip trailing zeros if more than 2 decimals: e.g. 0.200 -> 0.20
  return parseFloat(str) === parseFloat(val.toFixed(2)) ? val.toFixed(2) : str;
}
