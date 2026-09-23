import { EventFamily } from '../shared/types.js';

interface KeywordMapping {
  family: EventFamily;
  keywords: string[];
}

const FAMILY_KEYWORD_RULES: KeywordMapping[] = [
  {
    family: 'Central Bank',
    keywords: [
      'interest rate decision',
      'fomc',
      'monetary policy',
      'rate statement',
      'rate decision',
      'bank rate',
      'discount rate',
      'repo rate',
      'target rate',
      'cash rate',
      'reserve ratio',
      'central bank',
      'ecb press conference',
      'fed speech',
      'fed interest rate',
    ],
  },
  {
    family: 'Inflation',
    keywords: [
      'cpi',
      'hicp',
      'ppi',
      'pce',
      'price index',
      'inflation',
      'deflator',
      'cost of living',
      'import price',
      'export price',
    ],
  },
  {
    family: 'Employment',
    keywords: [
      'nonfarm',
      'payroll',
      'unemployment',
      'employment',
      'jobless',
      'adp',
      'job openings',
      'jolts',
      'wages',
      'earnings',
      'labor',
      'labour',
      'claimant',
      'participation rate',
      'challenger',
      'layoffs',
    ],
  },
  {
    family: 'Growth',
    keywords: ['gdp', 'gnp', 'gross domestic', 'economic growth', 'gross national'],
  },
  {
    family: 'PMI / Surveys',
    keywords: [
      'pmi',
      'ism',
      'ifo',
      'zew',
      'cbi',
      'sentiment',
      'empire state',
      'philly fed',
      'philadelphia fed',
      'michigan',
      'business climate',
      'kansas fed',
      'richmond fed',
      'dallas fed',
      'leading index',
      'tankan',
      'svme',
    ],
  },
  {
    family: 'Consumption',
    keywords: [
      'retail sales',
      'consumer confidence',
      'consumer spending',
      'personal spending',
      'household spending',
      'auto sales',
      'vehicle sales',
      'redbook',
    ],
  },
  {
    family: 'Activity',
    keywords: [
      'industrial production',
      'factory orders',
      'manufacturing production',
      'capacity utilization',
      'durable goods',
      'capital expenditure',
      'machine tool',
      'mining production',
      'industrial output',
    ],
  },
  {
    family: 'Housing',
    keywords: [
      'housing',
      'building permits',
      'home sales',
      'mortgage',
      'house price',
      'construction',
      'nahb',
      'case-shiller',
      'new home',
      'existing home',
      'pending home',
    ],
  },
  {
    family: 'Trade',
    keywords: [
      'trade balance',
      'current account',
      'exports',
      'imports',
      'merchandise trade',
      'terms of trade',
      'trade deficit',
      'trade surplus',
    ],
  },
];

/**
 * Normalizes event name (trims, removes redundant spaces, normalizes quotes)
 */
export function normalizeEventName(eventName: string): string {
  if (!eventName) return '';
  return eventName.trim().replace(/\s+/g, ' ');
}

/**
 * Classifies an event name into a macroeconomic family using keyword matching.
 */
export function classifyEventFamily(eventName: string): EventFamily {
  if (!eventName) return 'Other';

  const lower = eventName.toLowerCase();

  for (const rule of FAMILY_KEYWORD_RULES) {
    for (const kw of rule.keywords) {
      if (lower.includes(kw)) {
        return rule.family;
      }
    }
  }

  return 'Other';
}
