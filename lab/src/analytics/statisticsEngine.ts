import { EventObservation, EventScore, HorizonStatistics, ScoreMatrixCell, ScoreMatrixData } from '../shared/types.js';
import { calculateMean, calculateQuantile } from '../shared/utils.js';
import { EVENT_SCORES } from '../shared/constants.js';

/**
 * Calculates H1 to H42 aggregate metrics across an array of event observations.
 */
export function calculateHorizonStatistics(observations: EventObservation[]): HorizonStatistics[] {
  const stats: HorizonStatistics[] = [];

  for (let h = 1; h <= 42; h++) {
    const horizonIdx = h - 1;
    const validReturns: number[] = [];
    let positiveCount = 0;
    let negativeCount = 0;
    let zeroCount = 0;

    for (const obs of observations) {
      const r = obs.returns[horizonIdx];
      if (r !== null && Number.isFinite(r)) {
        validReturns.push(r);
        if (r > 1e-12) {
          positiveCount++;
        } else if (r < -1e-12) {
          negativeCount++;
        } else {
          zeroCount++;
        }
      }
    }

    const n = validReturns.length;
    if (n === 0) {
      stats.push({
        horizon: h,
        n: 0,
        mean: null,
        median: null,
        min: null,
        max: null,
        p10: null,
        p25: null,
        p50: null,
        p75: null,
        p90: null,
        positiveDirectionCount: 0,
        negativeDirectionCount: 0,
        zeroCount: 0,
        positiveDirectionRate: null,
        negativeDirectionRate: null,
      });
      continue;
    }

    const sorted = [...validReturns].sort((a, b) => a - b);
    const mean = calculateMean(sorted);
    const median = calculateQuantile(sorted, 50);

    stats.push({
      horizon: h,
      n,
      mean,
      median,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p10: calculateQuantile(sorted, 10),
      p25: calculateQuantile(sorted, 25),
      p50: median,
      p75: calculateQuantile(sorted, 75),
      p90: calculateQuantile(sorted, 90),
      positiveDirectionCount: positiveCount,
      negativeDirectionCount: negativeCount,
      zeroCount,
      positiveDirectionRate: positiveCount / n,
      negativeDirectionRate: negativeCount / n,
    });
  }

  return stats;
}

/**
 * Computes a 5x5 Score Matrix for surprise scores (-3..+3) x momentum scores (-3..+3)
 * at a specific selected horizon (e.g. H1, H4, H8, H12, H24, H42).
 */
export function calculateScoreMatrix(
  observations: EventObservation[],
  horizon: number = 1
): ScoreMatrixData {
  const horizonIdx = Math.max(0, Math.min(41, horizon - 1));
  const matrix: ScoreMatrixCell[][] = [];

  // Rows: Momentum (-3, -2, 1, 2, 3)
  // Columns: Surprise (-3, -2, 1, 2, 3)
  for (let mIdx = 0; mIdx < EVENT_SCORES.length; mIdx++) {
    const mScore = EVENT_SCORES[mIdx];
    const row: ScoreMatrixCell[] = [];

    for (let sIdx = 0; sIdx < EVENT_SCORES.length; sIdx++) {
      const sScore = EVENT_SCORES[sIdx];

      const matchingObs = observations.filter(
        (o) => o.surpriseScore === sScore && o.momentumScore === mScore
      );

      const validReturns: number[] = [];
      let posCount = 0;

      for (const obs of matchingObs) {
        const r = obs.returns[horizonIdx];
        if (r !== null && Number.isFinite(r)) {
          validReturns.push(r);
          if (r > 1e-12) posCount++;
        }
      }

      const n = validReturns.length;
      if (n === 0) {
        row.push({
          surpriseScore: sScore,
          momentumScore: mScore,
          n: 0,
          medianReturn: null,
          meanReturn: null,
          positiveDirectionRate: null,
        });
      } else {
        const sorted = [...validReturns].sort((a, b) => a - b);
        row.push({
          surpriseScore: sScore,
          momentumScore: mScore,
          n,
          medianReturn: calculateQuantile(sorted, 50),
          meanReturn: calculateMean(sorted),
          positiveDirectionRate: posCount / n,
        });
      }
    }
    matrix.push(row);
  }

  return {
    horizon,
    matrix,
  };
}
