export interface ParsedNumericResult {
  raw: string | null;
  value: number | null;
  hasUnit: boolean;
  unit?: string;
  isValid: boolean;
}

/**
 * Robust numeric parser for economic calendar values.
 * Handles decimals, negative values, %, K, M, B, commas, parenthesized negatives.
 * Returns finite number or null. Zero is preserved as 0.
 */
export function parseNumericValue(raw: string | null | undefined): ParsedNumericResult {
  if (raw === null || raw === undefined) {
    return { raw: null, value: null, hasUnit: false, isValid: false };
  }

  const trimmed = raw.trim();
  if (trimmed === '' || trimmed === '-' || trimmed.toLowerCase() === 'n/a' || trimmed.toLowerCase() === 'null') {
    return { raw: trimmed, value: null, hasUnit: false, isValid: false };
  }

  let text = trimmed;
  let isNegative = false;

  // Handle accounting brackets: (123.4) -> -123.4
  if (text.startsWith('(') && text.endsWith(')')) {
    isNegative = true;
    text = text.slice(1, -1).trim();
  }

  if (text.startsWith('-')) {
    isNegative = true;
    text = text.slice(1).trim();
  } else if (text.startsWith('+')) {
    text = text.slice(1).trim();
  }

  let unit: string | undefined;
  let multiplier = 1;

  if (text.endsWith('%')) {
    unit = '%';
    text = text.slice(0, -1).trim();
    // In economic calendars, percent is the scale unit (e.g. 1.2% is treated as 1.2)
  } else if (text.endsWith('K') || text.endsWith('k')) {
    unit = 'K';
    multiplier = 1e3;
    text = text.slice(0, -1).trim();
  } else if (text.endsWith('M') || text.endsWith('m')) {
    unit = 'M';
    multiplier = 1e6;
    text = text.slice(0, -1).trim();
  } else if (text.endsWith('B') || text.endsWith('b')) {
    unit = 'B';
    multiplier = 1e9;
    text = text.slice(0, -1).trim();
  } else if (text.endsWith('T') || text.endsWith('t')) {
    unit = 'T';
    multiplier = 1e12;
    text = text.slice(0, -1).trim();
  }

  // Remove thousand separators
  const cleanNumStr = text.replace(/,/g, '');

  // Validate that remaining string is a valid positive number
  if (!/^\d+(\.\d+)?$/.test(cleanNumStr)) {
    return { raw: trimmed, value: null, hasUnit: false, isValid: false };
  }

  const parsed = parseFloat(cleanNumStr);
  if (!Number.isFinite(parsed)) {
    return { raw: trimmed, value: null, hasUnit: false, isValid: false };
  }

  const finalValue = (isNegative ? -parsed : parsed) * multiplier;

  return {
    raw: trimmed,
    value: Object.is(finalValue, -0) ? 0 : finalValue,
    hasUnit: !!unit,
    unit,
    isValid: true,
  };
}
