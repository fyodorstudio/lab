import fs from 'fs';
import { FXPairInfo } from '../shared/types.js';
import { MAJOR_CURRENCIES } from '../shared/constants.js';

export const RECOGNIZED_FX_CURRENCIES = [
  'USD',
  'EUR',
  'GBP',
  'JPY',
  'AUD',
  'CAD',
  'CHF',
  'NZD',
  'SEK',
  'NOK',
  'DKK',
  'PLN',
  'HUF',
  'CZK',
  'TRY',
  'ZAR',
  'MXN',
  'SGD',
  'HKD',
  'CNH',
] as const;

/**
 * Scans the selected source's candle directory and discovers FX instruments.
 * Filters out crypto and commodities to preserve quantitative FX purity.
 */
export function discoverFXPairs(candlesDir: string): Map<string, FXPairInfo> {
  const pairsMap = new Map<string, FXPairInfo>();
  if (!fs.existsSync(candlesDir)) {
    return pairsMap;
  }

  const files = fs.readdirSync(candlesDir);

  for (const filename of files) {
    // Look for files of format candles_{SYMBOL}_H1.csv
    const match = filename.match(/^candles_([A-Za-z0-9]+)_H1\.csv$/);
    if (!match) continue;

    const symbol = match[1].toUpperCase();

    // Check if symbol consists of 2 standard 3-letter currency codes (e.g. EURUSD)
    if (symbol.length === 6) {
      const base = symbol.slice(0, 3);
      const quote = symbol.slice(3, 6);

      // Both base and quote must be recognized fiat currencies
      const isBaseFiat = RECOGNIZED_FX_CURRENCIES.includes(base as any);
      const isQuoteFiat = RECOGNIZED_FX_CURRENCIES.includes(quote as any);

      // And at least one must be a G8 major currency
      const hasMajor =
        MAJOR_CURRENCIES.includes(base as any) || MAJOR_CURRENCIES.includes(quote as any);

      if (isBaseFiat && isQuoteFiat && hasMajor) {
        pairsMap.set(symbol, {
          pair: symbol,
          base,
          quote,
          filename,
          barCount: 0,
          earliestTimestamp: 0,
          latestTimestamp: 0,
          earliestDate: '',
          latestDate: '',
        });
      }
    }
  }

  return pairsMap;
}

/**
 * Returns all FX pairs that contain the given event currency.
 * Prioritizes major 28 pairs before crosses/exotics.
 */
export function getPairsForCurrency(pairsMap: Map<string, FXPairInfo>, currency: string): FXPairInfo[] {
  const result: FXPairInfo[] = [];
  const currUpper = currency.toUpperCase();

  for (const info of pairsMap.values()) {
    if (info.base === currUpper || info.quote === currUpper) {
      result.push(info);
    }
  }

  // Major pairs first, then alphabetical
  result.sort((a, b) => {
    const aIsMajorCross =
      MAJOR_CURRENCIES.includes(a.base as any) && MAJOR_CURRENCIES.includes(a.quote as any);
    const bIsMajorCross =
      MAJOR_CURRENCIES.includes(b.base as any) && MAJOR_CURRENCIES.includes(b.quote as any);

    if (aIsMajorCross && !bIsMajorCross) return -1;
    if (!aIsMajorCross && bIsMajorCross) return 1;
    return a.pair.localeCompare(b.pair);
  });

  return result;
}

/**
 * Determines whether event currency is base or quote, and return multiplier Q.
 */
export function getCurrencyPosition(
  pair: string,
  eventCurrency: string
): { position: 'base' | 'quote'; multiplier: 1 | -1 } {
  const curr = eventCurrency.toUpperCase();
  const base = pair.slice(0, 3).toUpperCase();
  const quote = pair.slice(3, 6).toUpperCase();

  if (base === curr) {
    return { position: 'base', multiplier: 1 };
  } else if (quote === curr) {
    return { position: 'quote', multiplier: -1 };
  }

  throw new Error(`Event currency ${eventCurrency} is neither base nor quote of pair ${pair}`);
}
