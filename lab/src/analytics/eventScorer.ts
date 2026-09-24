import { EventScore, ScoringMode } from '../shared/types.js';
import { calculateQuantile, canonicalizeNumber, TieMetrics } from '../shared/utils.js';
import { FLOAT_EPSILON } from '../shared/constants.js';

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
  const sortedSurprise = [...nonzeroSurpriseAbsDeltas].map(v => canonicalizeNumber(v)!).sort((a, b) => a - b);
  const sortedMomentum = [...nonzeroMomentumAbsDeltas].map(v => canonicalizeNumber(v)!).sort((a, b) => a - b);

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
  threshold: number | null,
  epsilon: number = FLOAT_EPSILON
): EventScore {
  if (actual === null || comparison === null || !Number.isFinite(actual) || !Number.isFinite(comparison)) {
    return null;
  }

  const delta = canonicalizeNumber(actual - comparison);
  if (delta === null) return null;

  const absDelta = Math.abs(delta);

  // Equal within floating point epsilon
  if (absDelta <= epsilon) {
    return 1;
  }

  // A nonzero observation cannot be magnitude-classified without a valid
  // reference threshold. Callers must not silently default it to "medium".
  if (threshold === null || !Number.isFinite(threshold)) return null;
  const effectiveThreshold = canonicalizeNumber(threshold)!;

  // Strict inequality: absDelta > effectiveThreshold + epsilon
  // abs(delta) == threshold must remain magnitude 2
  const isLarge = absDelta > effectiveThreshold + epsilon;

  if (delta > 0) {
    return isLarge ? 3 : 2;
  } else {
    return isLarge ? -3 : -2;
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
  score: EventScore,
  options?: {
    scoringMode?: ScoringMode;
    priorN?: number;
    minHistory?: number;
    tieMetrics?: TieMetrics | null;
  }
): string {
  const compLabel = type === 'Surprise' ? 'Forecast' : 'Previous';
  if (actual === null || comparison === null) {
    return `Incomplete data: Actual or ${compLabel} is missing (Score: N/A)`;
  }

  if (options?.scoringMode === 'walkForward' && score === null) {
    const priorN = options.priorN ?? 0;
    const minH = options.minHistory ?? 20;
    return `Insufficient historical sample for walk-forward classification (Prior N = ${priorN} < ${minH})`;
  }

  if (score === null) {
    return `Unable to classify score: insufficient data (Score: N/A)`;
  }

  const delta = canonicalizeNumber(actual - comparison);
  const pLabel = `P${percentile}`;
  const tStr = threshold !== null ? threshold.toFixed(3) : 'N/A';
  const dStr = delta !== null ? (delta >= 0 ? `+${delta.toFixed(3)}` : delta.toFixed(3)) : 'N/A';
  const mStr = absDelta !== null ? absDelta.toFixed(3) : 'N/A';

  if (score === 1) {
    return `Actual (${actual}) == ${compLabel} (${comparison}) -> Delta = 0 -> Inline/Neutral (+1) [Percentile Rank: N/A — exact match]`;
  }

  const isTied = threshold !== null && absDelta !== null && Math.abs(absDelta - threshold) <= FLOAT_EPSILON;
  const tieNote = isTied && options?.tieMetrics
    ? ` [|Delta| equals ${pLabel} threshold; Large requires strictly greater. Equal historical observations: ${options.tieMetrics.tieRate.toFixed(1)}%]`
    : '';

  if (score === 3) {
    return `Actual (${actual}) > ${compLabel} (${comparison}) [${dStr}] AND |Delta| (${mStr}) > ${pLabel} (${tStr}) -> Large Positive (+3)`;
  }
  if (score === 2) {
    if (isTied) {
      return `Actual (${actual}) > ${compLabel} (${comparison}) [${dStr}], but |Delta| (${mStr}) equals ${pLabel} (${tStr}) without strictly exceeding it -> Medium Positive (+2)${tieNote}`;
    }
    return `Actual (${actual}) > ${compLabel} (${comparison}) [${dStr}] AND |Delta| (${mStr}) <= ${pLabel} (${tStr}) -> Medium Positive (+2)`;
  }
  if (score === -3) {
    return `Actual (${actual}) < ${compLabel} (${comparison}) [${dStr}] AND |Delta| (${mStr}) > ${pLabel} (${tStr}) -> Large Negative (-3)`;
  }
  if (score === -2) {
    if (isTied) {
      return `Actual (${actual}) < ${compLabel} (${comparison}) [${dStr}], but |Delta| (${mStr}) equals ${pLabel} (${tStr}) without strictly exceeding it -> Medium Negative (-2)${tieNote}`;
    }
    return `Actual (${actual}) < ${compLabel} (${comparison}) [${dStr}] AND |Delta| (${mStr}) <= ${pLabel} (${tStr}) -> Medium Negative (-2)`;
  }

  return `Score ${score}`;
}

