import { CandleSeries, findFirstCandleIndex } from '../data/candleLoader.js';
import { getCurrencyPosition } from '../data/pairDiscovery.js';
import { gapCrossesWeekend } from '../analytics/eventAligner.js';

export interface AlignedExplorationPath {
  p0Timestamp: number | null;
  p0: number | null;
  h1CloseTimestamp: number | null;
  h1Close: number | null;
  // Cumulative returns P0 -> Hh (length 42, h = 1..42)
  cumulativeSimpleReturns: Array<number | null>;
  cumulativeLogReturns: Array<number | null>;
  // Delayed returns H1 close -> Hh close (length 42, index 0 / H1 is null, indices 1..41 / H2..H42 are returns)
  delayedSimpleReturns: Array<number | null>;
  delayedLogReturns: Array<number | null>;
  rawPairCumulativeReturns: Array<number | null>;
  rawPairDelayedReturns: Array<number | null>;
  crossesWeekend: boolean;
  crossesNonWeekendGap: boolean;
  isFridayRelease: boolean;
  eventCurrencyPosition: 'base' | 'quote';
  directionMultiplier: 1 | -1;
  availableHorizonCount: number;
}

/**
 * Computes both cumulative (P0 -> Hh) and delayed (H1 close -> Hh close) returns
 * for an event aligned to candle history.
 */
export function computeEventReturns(
  eventTimestamp: number,
  currency: string,
  pair: string,
  candleSeries: CandleSeries | null | undefined
): AlignedExplorationPath {
  const { position, multiplier } = getCurrencyPosition(pair, currency);
  const eventDate = new Date(eventTimestamp * 1000);
  const isFridayRelease = eventDate.getUTCDay() === 5;

  const emptyResult: AlignedExplorationPath = {
    p0Timestamp: null,
    p0: null,
    h1CloseTimestamp: null,
    h1Close: null,
    cumulativeSimpleReturns: Array(42).fill(null),
    cumulativeLogReturns: Array(42).fill(null),
    delayedSimpleReturns: Array(42).fill(null),
    delayedLogReturns: Array(42).fill(null),
    rawPairCumulativeReturns: Array(42).fill(null),
    rawPairDelayedReturns: Array(42).fill(null),
    crossesWeekend: false,
    crossesNonWeekendGap: false,
    isFridayRelease,
    eventCurrencyPosition: position,
    directionMultiplier: multiplier,
    availableHorizonCount: 0,
  };

  if (!candleSeries || candleSeries.times.length === 0) {
    return emptyResult;
  }

  const p0Index = findFirstCandleIndex(candleSeries.times, eventTimestamp);
  if (p0Index === -1) {
    return emptyResult;
  }

  const p0Timestamp = candleSeries.times[p0Index];
  const p0 = candleSeries.opens[p0Index];

  if (p0 <= 0 || !Number.isFinite(p0)) {
    return emptyResult;
  }

  const h1Close = candleSeries.closes[p0Index];
  const h1CloseTimestamp = candleSeries.times[p0Index] + 3600;

  if (h1Close <= 0 || !Number.isFinite(h1Close)) {
    return emptyResult;
  }

  const cumulativeSimpleReturns: Array<number | null> = [];
  const cumulativeLogReturns: Array<number | null> = [];
  const delayedSimpleReturns: Array<number | null> = [];
  const delayedLogReturns: Array<number | null> = [];
  const rawPairCumulativeReturns: Array<number | null> = [];
  const rawPairDelayedReturns: Array<number | null> = [];

  let crossesWeekend = false;
  let crossesNonWeekendGap = false;
  let availableCount = 0;

  for (let h = 1; h <= 42; h++) {
    const candleIdx = p0Index + (h - 1);

    if (candleIdx < candleSeries.times.length) {
      const closePrice = candleSeries.closes[candleIdx];
      availableCount++;

      // Raw pair returns
      const rawCumulative = closePrice / p0 - 1;
      const rawDelayed = h === 1 ? null : closePrice / h1Close - 1;

      // Cumulative event-currency simple return:
      // Base: Ph / P0 - 1
      // Quote: P0 / Ph - 1
      const cumSimple = position === 'base'
        ? rawCumulative
        : (closePrice > 0 ? (p0 / closePrice - 1) : null);

      // Cumulative normalized log return: Q * ln(Ph / P0)
      const cumLog = closePrice > 0
        ? multiplier * Math.log(closePrice / p0)
        : null;

      // Delayed event-currency simple return (from H1 close to Hh close, h >= 2):
      // Base: Ph / P1 - 1
      // Quote: P1 / Ph - 1
      const delayedSimple = h === 1
        ? null
        : (position === 'base'
            ? (closePrice / h1Close - 1)
            : (closePrice > 0 ? (h1Close / closePrice - 1) : null));

      // Delayed normalized log return: Q * ln(Ph / P1)
      const delayedLog = h === 1
        ? null
        : (closePrice > 0 && h1Close > 0
            ? multiplier * Math.log(closePrice / h1Close)
            : null);

      cumulativeSimpleReturns.push(cumSimple);
      cumulativeLogReturns.push(cumLog);
      delayedSimpleReturns.push(delayedSimple);
      delayedLogReturns.push(delayedLog);
      rawPairCumulativeReturns.push(rawCumulative);
      rawPairDelayedReturns.push(rawDelayed);

      // Weekend & non-weekend gap checks
      if (h > 1) {
        const prevCandleTime = candleSeries.times[candleIdx - 1];
        const currentCandleTime = candleSeries.times[candleIdx];
        if (currentCandleTime - prevCandleTime > 3600) {
          if (gapCrossesWeekend(prevCandleTime, currentCandleTime)) {
            crossesWeekend = true;
          } else {
            crossesNonWeekendGap = true;
          }
        }
      }
    } else {
      cumulativeSimpleReturns.push(null);
      cumulativeLogReturns.push(null);
      delayedSimpleReturns.push(null);
      delayedLogReturns.push(null);
      rawPairCumulativeReturns.push(null);
      rawPairDelayedReturns.push(null);
    }
  }

  return {
    p0Timestamp,
    p0,
    h1CloseTimestamp,
    h1Close,
    cumulativeSimpleReturns,
    cumulativeLogReturns,
    delayedSimpleReturns,
    delayedLogReturns,
    rawPairCumulativeReturns,
    rawPairDelayedReturns,
    crossesWeekend,
    crossesNonWeekendGap,
    isFridayRelease,
    eventCurrencyPosition: position,
    directionMultiplier: multiplier,
    availableHorizonCount: availableCount,
  };
}
