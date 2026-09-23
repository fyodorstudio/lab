import { describe, it, expect } from 'vitest';
import { parseNumericValue } from '../src/data/numericParser.js';

describe('Numeric Parser', () => {
  it('parses standard integers and decimals', () => {
    expect(parseNumericValue('10').value).toBe(10);
    expect(parseNumericValue('1.25').value).toBe(1.25);
    expect(parseNumericValue('0.005').value).toBe(0.005);
  });

  it('correctly preserves 0 and 0.0 as numeric zero, not null', () => {
    const resZero = parseNumericValue('0');
    expect(resZero.value).toBe(0);
    expect(resZero.isValid).toBe(true);

    const resDecimalZero = parseNumericValue('0.0');
    expect(resDecimalZero.value).toBe(0);
    expect(resDecimalZero.isValid).toBe(true);

    const resNegativeZero = parseNumericValue('-0.0');
    expect(resNegativeZero.value).toBe(0);
  });

  it('parses negative numbers and accounting parentheses', () => {
    expect(parseNumericValue('-0.2').value).toBe(-0.2);
    expect(parseNumericValue('-15.4').value).toBe(-15.4);
    expect(parseNumericValue('(5.2)').value).toBe(-5.2);
    expect(parseNumericValue('(100)').value).toBe(-100);
  });

  it('parses percentages preserving numerical scale', () => {
    const res = parseNumericValue('1.2%');
    expect(res.value).toBe(1.2);
    expect(res.unit).toBe('%');

    const resNeg = parseNumericValue('-0.5%');
    expect(resNeg.value).toBe(-0.5);
    expect(resNeg.unit).toBe('%');
  });

  it('parses comma-separated numbers', () => {
    expect(parseNumericValue('1,234').value).toBe(1234);
    expect(parseNumericValue('1,234,567.89').value).toBe(1234567.89);
    expect(parseNumericValue('-2,500.5').value).toBe(-2500.5);
  });

  it('parses scale multipliers (K, M, B, T)', () => {
    expect(parseNumericValue('250K').value).toBe(250000);
    expect(parseNumericValue('3.4M').value).toBe(3400000);
    expect(parseNumericValue('1.1B').value).toBe(1100000000);
    expect(parseNumericValue('-50k').value).toBe(-50000);
    expect(parseNumericValue('2.5T').value).toBe(2500000000000);
  });

  it('returns null and isValid=false for missing or malformed values', () => {
    expect(parseNumericValue(null).isValid).toBe(false);
    expect(parseNumericValue(null).value).toBeNull();

    expect(parseNumericValue('').isValid).toBe(false);
    expect(parseNumericValue('').value).toBeNull();

    expect(parseNumericValue('-').isValid).toBe(false);
    expect(parseNumericValue('N/A').isValid).toBe(false);
    expect(parseNumericValue('tentative').isValid).toBe(false);
    expect(parseNumericValue('abc').isValid).toBe(false);
  });
});
