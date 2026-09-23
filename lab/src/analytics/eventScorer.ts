import { EventScore } from '../shared/types.js';
import { calculateQuantile } from '../shared/utils.js';

export interface EventThresholds {
  surpriseThreshold: number | null;
  momentumThreshold: number | null;
  surpriseNonZeroCount: number;
  momentumNonZeroCount: number;
}

/**
 * Calculates the magnitude threshold (e.g. 75th percentile)
 * from NONZERO absolute historical deltas for an exact event.
 */
export function calculateEventThresholds(
  nonzeroSurpriseAbsDeltas: number[],
  nonzeroMomentumAbsDeltas: number[],
  percentile: number = 75
): EventThresholds {
  const sortedSurprise = [...nonzeroSurpriseAbsDeltas].sort((a, b) => a - b);
  const sortedMomentum = [...nonzeroMomentumAbsDeltas].sort((a, b) => a - b);

  return {
    surpriseThreshold: calculateQuantile(sortedSurprise, percentile),
    momentumThreshold: calculateQuantile(sortedMomentum, percentile),
    surpriseNonZeroCount: sortedSurprise.length,
    momentumNonZeroCount: sortedMomentum.length,
  };
}

/**
 * Scores an individual delta relative to comparison value (F or P)
 * and historical magnitude threshold.
 *
 * Rule:
 * If actual == null or comparison == null -> null
 * If delta == 0 -> +1 (neutral/equal)
 * If delta > 0 and abs(delta) <= threshold -> +2 (positive medium)
 * If delta > 0 and abs(delta) > threshold -> +3 (positive large)
 * If delta < 0 and abs(delta) <= threshold -> -2 (negative medium)
 * If delta < 0 and abs(delta) > threshold -> -3 (negative large)
 */
export function scoreDelta(
  actual: number | null,
  comparison: number | null,
  threshold: number | null
): EventScore {
  if (actual === null || comparison === null || !Number.isFinite(actual) || !Number.isFinite(comparison)) {
    return null;
  }

  const delta = actual - comparison;
  const absDelta = Math.abs(delta);

  // Equal within floating point epsilon
  if (Math.abs(delta) < 1e-12) {
    return 1;
  }

  // If there is no historical threshold (e.g. only 0 deltas in history),
  // default to medium score
  const effectiveThreshold = threshold !== null && Number.isFinite(threshold) ? threshold : Infinity;

  if (delta > 0) {
    return absDelta > effectiveThreshold ? 3 : 2;
  } else {
    return absDelta > effectiveThreshold ? -3 : -2;
  }
}

/**
 * Explains the exact mathematical reason for an assigned score.
 */
export function getScoreClassificationReason(
  type: 'Surprise' | 'Momentum',
  actual: number | null,
  comparison: number | null,
  absDelta: number | null,
  threshold: number | null,
  percentile: number,
  score: EventScore
): string {
  const compLabel = type === 'Surprise' ? 'Forecast' : 'Previous';
  if (actual === null || comparison === null || score === null) {
    return `Incomplete data: Actual or ${compLabel} is missing (Score: N/A)`;
  }

  const delta = actual - comparison;
  const pLabel = `P${percentile}`;
  const tStr = threshold !== null ? threshold.toFixed(3) : 'N/A';
  const dStr = delta >= 0 ? `+${delta.toFixed(3)}` : delta.toFixed(3);
  const mStr = absDelta !== null ? absDelta.toFixed(3) : 'N/A';

  if (score === 1) {
    return `Actual (${actual}) == ${compLabel} (${comparison}) within tolerance -> Delta = 0 -> Inline/Neutral (+1)`;
  }
  if (score === 3) {
    return `Actual (${actual}) > ${compLabel} (${comparison}) [${dStr}] AND |Delta| (${mStr}) > ${pLabel} (${tStr}) -> Large Positive (+3)`;
  }
  if (score === 2) {
    return `Actual (${actual}) > ${compLabel} (${comparison}) [${dStr}] AND |Delta| (${mStr}) <= ${pLabel} (${tStr}) -> Medium Positive (+2)`;
  }
  if (score === -3) {
    return `Actual (${actual}) < ${compLabel} (${comparison}) [${dStr}] AND |Delta| (${mStr}) > ${pLabel} (${tStr}) -> Large Negative (-3)`;
  }
  if (score === -2) {
    return `Actual (${actual}) < ${compLabel} (${comparison}) [${dStr}] AND |Delta| (${mStr}) <= ${pLabel} (${tStr}) -> Medium Negative (-2)`;
  }

  return `Score ${score}`;
}

