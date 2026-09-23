import { CandleSeries, findFirstCandleIndex } from '../data/candleLoader.js';
import { getCurrencyPosition } from '../data/pairDiscovery.js';

export interface AlignedPathResult {
  p0Timestamp: number | null;
  p0: number | null;
  returns: Array<number | null>; // exact event-currency simple returns (length 42)
  logReturns: Array<number | null>; // mathematically symmetric normalized log returns: Q * ln(Pt/P0) (length 42)
  rawReturns: Array<number | null>; // raw pair returns (length 42)
  crossesWeekend: boolean;
  isFridayRelease: boolean;
  eventCurrencyPosition: 'base' | 'quote';
  directionMultiplier: 1 | -1;
  availableHorizonCount: number;
}

/**
 * Aligns an economic release to H1 market candles and computes H1 to H42 returns.
 */
export function alignEventToCandles(
  eventTimestamp: number,
  currency: string,
  pair: string,
  candleSeries: CandleSeries | null | undefined
): AlignedPathResult {
  const { position, multiplier } = getCurrencyPosition(pair, currency);

  const eventDate = new Date(eventTimestamp * 1000);
  const isFridayRelease = eventDate.getUTCDay() === 5;

  if (!candleSeries || candleSeries.times.length === 0) {
    return {
      p0Timestamp: null,
      p0: null,
      returns: Array(42).fill(null),
      logReturns: Array(42).fill(null),
      rawReturns: Array(42).fill(null),
      crossesWeekend: false,
      isFridayRelease,
      eventCurrencyPosition: position,
      directionMultiplier: multiplier,
      availableHorizonCount: 0,
    };
  }

  // Find index of first candle with time >= eventTimestamp
  const p0Index = findFirstCandleIndex(candleSeries.times, eventTimestamp);

  if (p0Index === -1) {
    // Event occurred after all available candle bars
    return {
      p0Timestamp: null,
      p0: null,
      returns: Array(42).fill(null),
      logReturns: Array(42).fill(null),
      rawReturns: Array(42).fill(null),
      crossesWeekend: false,
      isFridayRelease,
      eventCurrencyPosition: position,
      directionMultiplier: multiplier,
      availableHorizonCount: 0,
    };
  }

  const p0Timestamp = candleSeries.times[p0Index];
  const p0 = candleSeries.opens[p0Index];

  if (p0 <= 0 || !Number.isFinite(p0)) {
    return {
      p0Timestamp,
      p0: null,
      returns: Array(42).fill(null),
      logReturns: Array(42).fill(null),
      rawReturns: Array(42).fill(null),
      crossesWeekend: false,
      isFridayRelease,
      eventCurrencyPosition: position,
      directionMultiplier: multiplier,
      availableHorizonCount: 0,
    };
  }

  const returns: Array<number | null> = [];
  const logReturns: Array<number | null> = [];
  const rawReturns: Array<number | null> = [];
  let crossesWeekend = false;
  let availableCount = 0;

  for (let h = 1; h <= 42; h++) {
    const candleIdx = p0Index + (h - 1);

    if (candleIdx < candleSeries.times.length) {
      const closePrice = candleSeries.closes[candleIdx];
      const rawReturn = closePrice / p0 - 1;

      // Exact event-currency simple return:
      // Base currency: Pt / P0 - 1
      // Quote currency: P0 / Pt - 1
      const normalizedSimpleReturn = position === 'base'
        ? rawReturn
        : (closePrice > 0 ? (p0 / closePrice - 1) : null);

      // Mathematically symmetric normalized log return: Q * ln(Pt / P0)
      const normalizedLogReturn = closePrice > 0 && p0 > 0
        ? multiplier * Math.log(closePrice / p0)
        : null;

      rawReturns.push(rawReturn);
      returns.push(normalizedSimpleReturn);
      logReturns.push(normalizedLogReturn);
      availableCount++;

      // Check for weekend gap: if consecutive candles gap by > 3600 seconds
      if (h > 1) {
        const prevCandleTime = candleSeries.times[candleIdx - 1];
        const currentCandleTime = candleSeries.times[candleIdx];
        if (currentCandleTime - prevCandleTime > 3600) {
          crossesWeekend = true;
        }
      }
    } else {
      // Horizon beyond available data
      rawReturns.push(null);
      returns.push(null);
      logReturns.push(null);
    }
  }

  return {
    p0Timestamp,
    p0,
    returns,
    logReturns,
    rawReturns,
    crossesWeekend,
    isFridayRelease,
    eventCurrencyPosition: position,
    directionMultiplier: multiplier,
    availableHorizonCount: availableCount,
  };
}
