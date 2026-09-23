import path from 'path';
import { FXPairInfo } from '../shared/types.js';
import { readCSVLines } from './csvReader.js';

export interface CandleSeries {
  pair: string;
  times: number[];
  opens: number[];
  highs: number[];
  lows: number[];
  closes: number[];
}

export class CandleRepository {
  private candleCache = new Map<string, CandleSeries>();
  private pairInfoMap = new Map<string, FXPairInfo>();
  private candlesDir: string;

  constructor(candlesDir: string, pairInfoMap: Map<string, FXPairInfo>) {
    this.candlesDir = candlesDir;
    this.pairInfoMap = pairInfoMap;
  }

  /**
   * Loads candles for a specific pair if not already cached.
   */
  public async loadPair(pair: string): Promise<CandleSeries | null> {
    const pairUpper = pair.toUpperCase();
    if (this.candleCache.has(pairUpper)) {
      return this.candleCache.get(pairUpper)!;
    }

    const pairInfo = this.pairInfoMap.get(pairUpper);
    if (!pairInfo) {
      return null;
    }

    const filePath = path.join(this.candlesDir, pairInfo.filename);
    const times: number[] = [];
    const opens: number[] = [];
    const highs: number[] = [];
    const lows: number[] = [];
    const closes: number[] = [];

    await readCSVLines(filePath, (fields, lineIndex) => {
      if (lineIndex === 1) return; // skip header
      if (fields.length < 5) return;

      const time = parseInt(fields[0], 10);
      const open = parseFloat(fields[1]);
      const high = parseFloat(fields[2]);
      const low = parseFloat(fields[3]);
      const close = parseFloat(fields[4]);

      if (Number.isFinite(time) && Number.isFinite(open) && Number.isFinite(close)) {
        times.push(time);
        opens.push(open);
        highs.push(high);
        lows.push(low);
        closes.push(close);
      }
    });

    const series: CandleSeries = {
      pair: pairUpper,
      times,
      opens,
      highs,
      lows,
      closes,
    };

    if (times.length > 0) {
      pairInfo.barCount = times.length;
      pairInfo.earliestTimestamp = times[0];
      pairInfo.latestTimestamp = times[times.length - 1];
      pairInfo.earliestDate = new Date(times[0] * 1000).toISOString().slice(0, 10);
      pairInfo.latestDate = new Date(times[times.length - 1] * 1000).toISOString().slice(0, 10);
    }

    this.candleCache.set(pairUpper, series);
    return series;
  }

  /**
   * Pre-loads all pairs into cache.
   */
  public async loadAllPairs(onProgress?: (loaded: number, total: number, pair: string) => void): Promise<void> {
    const pairs = Array.from(this.pairInfoMap.keys());
    for (let i = 0; i < pairs.length; i++) {
      const p = pairs[i];
      await this.loadPair(p);
      if (onProgress) {
        onProgress(i + 1, pairs.length, p);
      }
    }
  }

  public getCachedSeries(pair: string): CandleSeries | undefined {
    return this.candleCache.get(pair.toUpperCase());
  }

  public getAllCachedPairs(): string[] {
    return Array.from(this.candleCache.keys());
  }
}

/**
 * Binary search to find the index of the first candle with time >= eventTime.
 * Returns -1 if no candle is at or after eventTime, or if eventTime precedes
 * the start of candle data, or if the gap exceeds maximum plausible gap (4 days).
 */
export function findFirstCandleIndex(times: number[], eventTime: number): number {
  if (!times || times.length === 0) return -1;
  // If event happened before the earliest candle (allowing 1 hour before first candle open)
  if (eventTime < times[0] - 3600) return -1;
  if (eventTime > times[times.length - 1]) return -1;

  let low = 0;
  let high = times.length - 1;
  let ans = -1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (times[mid] >= eventTime) {
      ans = mid;
      high = mid - 1; // Look for earlier matching index
    } else {
      low = mid + 1;
    }
  }

  // Safety guard: if gap from announcement to next candle exceeds 4 days (345,600s),
  // this is a data discontinuity / missing market gap, not a normal market gap.
  if (ans !== -1 && times[ans] - eventTime > 345600) {
    return -1;
  }

  return ans;
}
