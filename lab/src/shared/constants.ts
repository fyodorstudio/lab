import { EventFamily, ScoringMode } from './types.js';

export const MAJOR_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD'] as const;

export const DEFAULT_THRESHOLD_PERCENTILE = 75;

export const ALLOWED_THRESHOLD_PERCENTILES = [50, 60, 70, 75, 80, 85, 90, 95] as const;

export const DEFAULT_SCORING_MODE: ScoringMode = 'retrospective';

export const DEFAULT_MIN_WALK_FORWARD_HISTORY = 20;

export const FLOAT_EPSILON = 1e-9;

export const CANONICAL_DECIMALS = 8;

export const EVENT_SCORES = [-3, -2, 1, 2, 3] as const;

export const HORIZONS = Array.from({ length: 42 }, (_, i) => i + 1);

export const KEY_HORIZONS = [1, 4, 8, 12, 24, 42] as const;

export const EVENT_FAMILIES: EventFamily[] = [
  'Inflation',
  'Employment',
  'Growth',
  'Activity',
  'Consumption',
  'PMI / Surveys',
  'Housing',
  'Trade',
  'Central Bank',
  'Other',
];

export const RESEARCH_DISCLOSURES = [
  'H1 data cannot measure the immediate intrahour announcement reaction.',
  'P0 begins at the first complete H1 candle at/after the release.',
  'Surprise/Momentum signs describe mathematical A/F/P relationships, not economic bullishness.',
  'Simultaneous releases can confound attribution.',
  'Retrospective percentile classification is descriptive and not automatically look-ahead-safe.',
  'Walk-forward percentile scoring removes future-data leakage but does not by itself guarantee backtest safety.',
  'Historical patterns do not imply future profitability.',
] as const;

export const RETROSPECTIVE_WARNING =
  'Thresholds calculated using the selected historical sample. This is descriptive research and is not lookahead-safe.';

export const WALK_FORWARD_LABEL = 'Walk-Forward / Lookahead-Safe Thresholds';
export const RETROSPECTIVE_LABEL = 'Retrospective / Descriptive';
