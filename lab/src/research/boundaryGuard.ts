import { SPLIT_TIMESTAMP } from './types.js';
import { findFirstCandleIndex } from '../data/candleLoader.js';
import { ParsedEventRelease } from '../shared/types.js';

/**
 * Returns true if the release timestamp is strictly before the 2023-01-01 00:00:00 boundary.
 */
export function isExploration(timestamp: number): boolean {
  return timestamp < SPLIT_TIMESTAMP;
}

/**
 * Returns true if the release timestamp is on or after the 2023-01-01 00:00:00 boundary.
 */
export function isConfirmation(timestamp: number): boolean {
  return timestamp >= SPLIT_TIMESTAMP;
}

/**
 * Computes the closing timestamp of the 42nd trading bar (H42).
 * Each H1 candle represents a 1-hour interval [candleTime, candleTime + 3600).
 * Therefore the close of candle K is candleTimes[K] + 3600.
 */
export function computeH42CloseTimestamp(p0Index: number, candleTimes: number[]): number | null {
  if (p0Index < 0 || p0Index + 41 >= candleTimes.length) {
    return null;
  }
  const h42Start = candleTimes[p0Index + 41];
  return h42Start + 3600;
}

/**
 * Evaluates whether the required H42 price path reaches beyond the 2023-01-01 boundary.
 *
 * Boundary condition:
 * - If h42CloseTimestamp <= SPLIT_TIMESTAMP: the entire H42 path completed at or before 2023-01-01 00:00:00. Allowed.
 * - If h42CloseTimestamp > SPLIT_TIMESTAMP: the path extends into 2023 (Confirmation territory). Excluded.
 * - If h42CloseTimestamp is null (insufficient candle history): Fails closed. Excluded.
 */
export function doesH42CrossSplit(h42CloseTimestamp: number | null): boolean {
  if (h42CloseTimestamp === null) {
    return true; // fail-closed if trailing bars are missing
  }
  return h42CloseTimestamp > SPLIT_TIMESTAMP;
}

/**
 * Filters releases prior to computing any returns.
 * Any release occurring in Confirmation (ts >= SPLIT_TIMESTAMP) or whose
 * H42 path reaches beyond SPLIT_TIMESTAMP is discarded before price calculation.
 */
export function filterExplorationReleasesBeforeReturns(
  releases: ParsedEventRelease[],
  candleTimes: number[]
): ParsedEventRelease[] {
  const eligible: ParsedEventRelease[] = [];

  for (const release of releases) {
    // 1. Must be chronologically in Exploration
    if (!isExploration(release.timestamp)) {
      continue;
    }

    // 2. Locate P0 candle index
    const p0Index = findFirstCandleIndex(candleTimes, release.timestamp);
    if (p0Index === -1) {
      continue;
    }

    // 3. Compute H42 close timestamp
    const h42Close = computeH42CloseTimestamp(p0Index, candleTimes);
    if (doesH42CrossSplit(h42Close)) {
      continue;
    }

    eligible.push(release);
  }

  return eligible;
}

/**
 * Hard fail-closed runtime guard.
 * Asserts that no release or candle timestamp touches the sealed Confirmation period.
 */
export function assertStrictlyExploration(timestamps: number[]): void {
  for (const ts of timestamps) {
    if (ts >= SPLIT_TIMESTAMP) {
      throw new Error(
        `CRITICAL RESEARCH BOUNDARY VIOLATION: Encountered timestamp ${ts} (>= ${SPLIT_TIMESTAMP} / 2023-01-01 00:00:00). ` +
        `The Confirmation sample is strictly sealed. Price and return outcomes for Confirmation are forbidden in Phase 1.`
      );
    }
  }
}
