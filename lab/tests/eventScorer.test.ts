import { describe, it, expect } from 'vitest';
import { scoreDelta, calculateEventThresholds } from '../src/analytics/eventScorer.js';

describe('Event Scorer', () => {
  it('assigns +1 (neutral) when actual equals comparison', () => {
    expect(scoreDelta(2.5, 2.5, 0.5)).toBe(1);
    expect(scoreDelta(0.0, 0.0, 0.5)).toBe(1);
    expect(scoreDelta(-1.2, -1.2, 0.5)).toBe(1);
  });

  it('assigns +2 when actual > comparison and abs(delta) <= threshold', () => {
    // Delta = 2.8 - 2.5 = 0.3. Threshold = 0.5.
    expect(scoreDelta(2.8, 2.5, 0.5)).toBe(2);
    // Boundary condition: delta == threshold -> +2
    expect(scoreDelta(3.0, 2.5, 0.5)).toBe(2);
  });

  it('assigns +3 when actual > comparison and abs(delta) > threshold', () => {
    // Delta = 3.2 - 2.5 = 0.7. Threshold = 0.5.
    expect(scoreDelta(3.2, 2.5, 0.5)).toBe(3);
  });

  it('assigns -2 when actual < comparison and abs(delta) <= threshold', () => {
    // Delta = 2.2 - 2.5 = -0.3. abs(delta) = 0.3 <= 0.5.
    expect(scoreDelta(2.2, 2.5, 0.5)).toBe(-2);
    // Boundary condition: abs(delta) == threshold -> -2
    expect(scoreDelta(2.0, 2.5, 0.5)).toBe(-2);
  });

  it('assigns -3 when actual < comparison and abs(delta) > threshold', () => {
    // Delta = 1.5 - 2.5 = -1.0. abs(delta) = 1.0 > 0.5.
    expect(scoreDelta(1.5, 2.5, 0.5)).toBe(-3);
  });

  it('returns null when actual or comparison is null', () => {
    expect(scoreDelta(null, 2.5, 0.5)).toBeNull();
    expect(scoreDelta(2.5, null, 0.5)).toBeNull();
    expect(scoreDelta(null, null, 0.5)).toBeNull();
  });

  it('calculates P75 and other configurable percentiles from nonzero deltas', () => {
    // Nonzero deltas: 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8
    const nonzeroDeltas = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8];
    const thresholds75 = calculateEventThresholds(nonzeroDeltas, nonzeroDeltas, 75);

    expect(thresholds75.surpriseThreshold).toBeCloseTo(0.625, 3);

    // Delta 0.6 is <= 0.625 -> score +2
    expect(scoreDelta(2.6, 2.0, thresholds75.surpriseThreshold)).toBe(2);
    // Delta 0.7 is > 0.625 -> score +3
    expect(scoreDelta(2.7, 2.0, thresholds75.surpriseThreshold)).toBe(3);

    // Configurable threshold: 90th percentile
    const thresholds90 = calculateEventThresholds(nonzeroDeltas, nonzeroDeltas, 90);
    expect(thresholds90.surpriseThreshold).toBeGreaterThan(thresholds75.surpriseThreshold!);
  });
});
