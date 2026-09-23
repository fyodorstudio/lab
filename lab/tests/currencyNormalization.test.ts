import { describe, it, expect } from 'vitest';
import { getCurrencyPosition } from '../src/data/pairDiscovery.js';

describe('Currency Normalization and Direction Multiplier', () => {
  it('correctly assigns Q = +1 when event currency is base currency', () => {
    // USD is base in USDJPY, USDCAD, USDCHF
    const resUsdJpy = getCurrencyPosition('USDJPY', 'USD');
    expect(resUsdJpy.position).toBe('base');
    expect(resUsdJpy.multiplier).toBe(1);

    const resEurUsd = getCurrencyPosition('EURUSD', 'EUR');
    expect(resEurUsd.position).toBe('base');
    expect(resEurUsd.multiplier).toBe(1);

    const resGbpJpy = getCurrencyPosition('GBPJPY', 'GBP');
    expect(resGbpJpy.position).toBe('base');
    expect(resGbpJpy.multiplier).toBe(1);
  });

  it('correctly assigns Q = -1 when event currency is quote currency', () => {
    // USD is quote in EURUSD, GBPUSD, AUDUSD, NZDUSD
    const resEurUsd = getCurrencyPosition('EURUSD', 'USD');
    expect(resEurUsd.position).toBe('quote');
    expect(resEurUsd.multiplier).toBe(-1);

    const resUsdJpy = getCurrencyPosition('USDJPY', 'JPY');
    expect(resUsdJpy.position).toBe('quote');
    expect(resUsdJpy.multiplier).toBe(-1);
  });

  it('preserves uniform economic interpretation: positive return always means event currency strengthened', () => {
    // Scenario 1: USD news is positive, USD strengthens.
    // In USDJPY (USD base): Pair rises from 150.00 to 151.50 (+1.0%)
    const rawReturnUsdJpy = (151.50 / 150.00) - 1;
    const { multiplier: qBase } = getCurrencyPosition('USDJPY', 'USD');
    const normReturnUsdJpy = qBase * rawReturnUsdJpy;
    expect(normReturnUsdJpy).toBeCloseTo(0.01, 4); // +1.0%

    // In EURUSD (USD quote): Pair drops from 1.1000 to 1.0890 (-1.0%)
    const rawReturnEurUsd = (1.0890 / 1.1000) - 1;
    const { multiplier: qQuote } = getCurrencyPosition('EURUSD', 'USD');
    const normReturnEurUsd = qQuote * rawReturnEurUsd;
    expect(normReturnEurUsd).toBeCloseTo(0.01, 4); // +1.0%

    // Both normalized returns are positive (+1.0%)!
    expect(normReturnUsdJpy).toBeGreaterThan(0);
    expect(normReturnEurUsd).toBeGreaterThan(0);
  });

  it('throws descriptive error if event currency is neither base nor quote', () => {
    expect(() => getCurrencyPosition('EURUSD', 'JPY')).toThrow();
  });
});
