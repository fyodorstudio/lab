import { describe, it, expect } from 'vitest';
import { calculateHorizonStatistics, calculateScoreMatrix } from '../src/analytics/statisticsEngine.js';
import { EventObservation } from '../src/shared/types.js';

describe('Statistics Engine', () => {
  // Mock observations with known deterministic returns
  const createMockObservation = (returns: number[], sScore: any = 2, mScore: any = 2): EventObservation => ({
    eventId: '1',
    valueId: '1',
    timestamp: 1600000000,
    date: '2020-09-13T12:00:00Z',
    currency: 'USD',
    countryCode: 'US',
    eventName: 'CPI',
    normalizedEventName: 'CPI',
    eventFamily: 'Inflation',
    importance: 'high',
    actualRaw: '2.0',
    forecastRaw: '1.8',
    previousRaw: '1.7',
    revisedPreviousRaw: null,
    actual: 2.0,
    forecast: 1.8,
    previous: 1.7,
    revisedPrevious: null,
    surpriseDelta: 0.2,
    momentumDelta: 0.3,
    surpriseAbsDelta: 0.2,
    momentumAbsDelta: 0.3,
    hasCompleteAFP: true,
    simultaneousReleaseCount: 1,
    simultaneousEvents: [],
    surpriseScore: sScore,
    momentumScore: mScore,
    pair: 'EURUSD',
    eventCurrencyPosition: 'quote',
    directionMultiplier: -1,
    p0Timestamp: 1600002000,
    p0: 1.1800,
    returns,
    rawReturns: returns,
    crossesWeekend: false,
    isFridayRelease: false,
  });

  it('calculates mean, median, and quantiles accurately', () => {
    // 5 observations with H1 returns: -0.02, -0.01, 0.00, +0.01, +0.02
    const obs = [
      createMockObservation([-0.02]),
      createMockObservation([-0.01]),
      createMockObservation([0.00]),
      createMockObservation([0.01]),
      createMockObservation([0.02]),
    ];

    const stats = calculateHorizonStatistics(obs);
    const h1 = stats[0];

    expect(h1.n).toBe(5);
    expect(h1.mean).toBeCloseTo(0.00, 6);
    expect(h1.median).toBeCloseTo(0.00, 6);
    expect(h1.min).toBe(-0.02);
    expect(h1.max).toBe(0.02);
    expect(h1.p25).toBeCloseTo(-0.01, 6);
    expect(h1.p75).toBeCloseTo(0.01, 6);
  });

  it('calculates Positive Direction Rate as count(>0) / count(valid), not win rate', () => {
    // 4 observations: 3 positive, 1 negative
    const obs = [
      createMockObservation([0.01]),
      createMockObservation([0.02]),
      createMockObservation([0.005]),
      createMockObservation([-0.01]),
    ];

    const stats = calculateHorizonStatistics(obs);
    const h1 = stats[0];

    expect(h1.n).toBe(4);
    expect(h1.positiveDirectionCount).toBe(3);
    expect(h1.negativeDirectionCount).toBe(1);
    expect(h1.zeroCount).toBe(0);
    expect(h1.positiveDirectionRate).toBe(0.75); // 3 / 4 = 75%
    expect(h1.negativeDirectionRate).toBe(0.25); // 1 / 4 = 25%
  });

  it('preserves outliers without silently dropping extreme values', () => {
    // Dataset with an extreme market move (+10%)
    const obs = [
      createMockObservation([0.001]),
      createMockObservation([0.002]),
      createMockObservation([0.100]), // 10% extreme move
    ];

    const stats = calculateHorizonStatistics(obs);
    const h1 = stats[0];

    expect(h1.max).toBe(0.100);
    expect(h1.mean).toBeCloseTo((0.001 + 0.002 + 0.100) / 3, 6);
  });

  it('populates 5x5 score matrix accurately with N=0 for unpopulated cells', () => {
    const obs = [
      createMockObservation([0.01], 3, 2), // S: +3, M: +2
      createMockObservation([0.02], 3, 2), // S: +3, M: +2
      createMockObservation([-0.01], -2, -3), // S: -2, M: -3
    ];

    const matrixData = calculateScoreMatrix(obs, 1);
    expect(matrixData.matrix.length).toBe(5); // 5 rows
    expect(matrixData.matrix[0].length).toBe(5); // 5 columns

    // Find cell for S: +3, M: +2
    // EVENT_SCORES = [-3, -2, 1, 2, 3] -> M: 2 is index 3, S: 3 is index 4
    const cellS3M2 = matrixData.matrix[3][4];
    expect(cellS3M2.surpriseScore).toBe(3);
    expect(cellS3M2.momentumScore).toBe(2);
    expect(cellS3M2.n).toBe(2);
    expect(cellS3M2.medianReturn).toBeCloseTo(0.015, 6);
    expect(cellS3M2.positiveDirectionRate).toBe(1.0);

    // Empty cell (e.g. S: 1, M: 1)
    const cellS1M1 = matrixData.matrix[2][2];
    expect(cellS1M1.n).toBe(0);
    expect(cellS1M1.medianReturn).toBeNull();
  });
});
