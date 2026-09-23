import { describe, it, expect } from 'vitest';
import { alignEventToCandles } from '../src/analytics/eventAligner.js';
import { CandleSeries } from '../src/data/candleLoader.js';

describe('Event Aligner and H1-H42 Sequencer', () => {
  // Construct a deterministic fixture of 50 consecutive hourly candles starting at 10:00 UTC
  // 1600000000 is 2020-09-13T12:26:40Z, let's use exact round hourly timestamps:
  // Base time = 1600000000 - (1600000000 % 3600) = 1599998400 (round hour)
  const baseTime = 1600002000; // Exact round hour
  const candleTimes: number[] = [];
  const opens: number[] = [];
  const highs: number[] = [];
  const lows: number[] = [];
  const closes: number[] = [];

  for (let i = 0; i < 60; i++) {
    candleTimes.push(baseTime + i * 3600);
    opens.push(1.1000 + i * 0.001);
    highs.push(1.1050 + i * 0.001);
    lows.push(1.0950 + i * 0.001);
    closes.push(1.1000 + (i + 1) * 0.001);
  }

  const series: CandleSeries = {
    pair: 'EURUSD',
    times: candleTimes,
    opens,
    highs,
    lows,
    closes,
  };

  it('aligns exact-hour release to the candle beginning at that hour', () => {
    // Release at exact hour of candle 5
    const eventTime = candleTimes[5];
    const res = alignEventToCandles(eventTime, 'USD', 'EURUSD', series);

    expect(res.p0Timestamp).toBe(candleTimes[5]);
    expect(res.p0).toBe(opens[5]);
  });

  it('aligns half-hour release to the first complete candle beginning AFTER release', () => {
    // Release at 13:30 (between candle 5 and candle 6)
    const eventTime = candleTimes[5] + 1800;
    const res = alignEventToCandles(eventTime, 'USD', 'EURUSD', series);

    // First complete candle beginning AT OR AFTER 13:30 is candle 6 (14:00)
    expect(res.p0Timestamp).toBe(candleTimes[6]);
    expect(res.p0).toBe(opens[6]);
  });

  it('aligns 1-second-after-hour release to the next hour candle', () => {
    // Release at 14:00:01 (1 second after candle 5)
    const eventTime = candleTimes[5] + 1;
    const res = alignEventToCandles(eventTime, 'USD', 'EURUSD', series);

    expect(res.p0Timestamp).toBe(candleTimes[6]);
    expect(res.p0).toBe(opens[6]);
  });

  it('computes H1 through H42 cumulative returns correctly', () => {
    const eventTime = candleTimes[0];
    const res = alignEventToCandles(eventTime, 'USD', 'EURUSD', series);

    // In EURUSD, USD is quote currency, so multiplier Q = -1
    expect(res.directionMultiplier).toBe(-1);
    expect(res.eventCurrencyPosition).toBe('quote');

    // H1 close is closes[0]
    const p0 = opens[0];
    const h1Raw = closes[0] / p0 - 1;
    const h1Norm = -1 * h1Raw;

    expect(res.returns[0]).toBeCloseTo(h1Norm, 8);
    expect(res.rawReturns[0]).toBeCloseTo(h1Raw, 8);

    // H42 close is closes[41]
    const h42Raw = closes[41] / p0 - 1;
    const h42Norm = -1 * h42Raw;
    expect(res.returns[41]).toBeCloseTo(h42Norm, 8);
  });

  it('handles weekend gaps by counting available trading bars and setting crossesWeekend flag', () => {
    // Create a series with a 48-hour weekend gap between bar 10 and bar 11
    const timesWithWeekend: number[] = [];
    const opensW: number[] = [];
    const closesW: number[] = [];

    for (let i = 0; i < 50; i++) {
      const t = i <= 10 ? baseTime + i * 3600 : baseTime + (i + 48) * 3600;
      timesWithWeekend.push(t);
      opensW.push(1.2000);
      closesW.push(1.2010);
    }

    const weekendSeries: CandleSeries = {
      pair: 'EURUSD',
      times: timesWithWeekend,
      opens: opensW,
      highs: opensW,
      lows: opensW,
      closes: closesW,
    };

    const res = alignEventToCandles(baseTime, 'USD', 'EURUSD', weekendSeries);
    expect(res.crossesWeekend).toBe(true);
    // Sequence continues with 42 available bars
    expect(res.returns[41]).not.toBeNull();
  });

  it('handles missing candle data near end of dataset without interpolating or forward-filling', () => {
    // Only 10 candles available in series
    const shortSeries: CandleSeries = {
      pair: 'EURUSD',
      times: candleTimes.slice(0, 10),
      opens: opens.slice(0, 10),
      highs: highs.slice(0, 10),
      lows: lows.slice(0, 10),
      closes: closes.slice(0, 10),
    };

    const res = alignEventToCandles(candleTimes[0], 'USD', 'EURUSD', shortSeries);
    expect(res.availableHorizonCount).toBe(10);
    expect(res.returns[0]).not.toBeNull();
    expect(res.returns[9]).not.toBeNull();
    // Horizons 11 to 42 must be null
    expect(res.returns[10]).toBeNull();
    expect(res.returns[41]).toBeNull();
  });

  it('rejects events occurring before candle dataset begins (zero lookahead warp)', () => {
    // Event occurred 1 year before candle series begins
    const wayBefore = baseTime - 365 * 24 * 3600;
    const res = alignEventToCandles(wayBefore, 'USD', 'EURUSD', series);

    expect(res.p0Timestamp).toBeNull();
    expect(res.p0).toBeNull();
    expect(res.availableHorizonCount).toBe(0);
    expect(res.returns.every((r) => r === null)).toBe(true);
  });

  it('rejects events falling inside multi-day/multi-week data discontinuities (> 4 days gap)', () => {
    // Event occurred 10 days before next available candle
    const bigGapTime = baseTime - 10 * 24 * 3600;
    const res = alignEventToCandles(bigGapTime, 'USD', 'EURUSD', series);

    expect(res.p0Timestamp).toBeNull();
    expect(res.p0).toBeNull();
    expect(res.availableHorizonCount).toBe(0);
  });
});

