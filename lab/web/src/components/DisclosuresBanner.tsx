import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ShieldAlert } from 'lucide-react';

export const DisclosuresBanner: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  const disclosures = [
    'H1 data cannot measure the immediate intrahour announcement reaction.',
    'P0 begins at the first complete H1 candle at/after the release.',
    'Surprise/Momentum signs describe mathematical A/F/P relationships, not economic bullishness.',
    'Simultaneous releases can confound attribution.',
    'Retrospective percentile classification is descriptive and not automatically look-ahead-safe.',
    'Historical patterns do not imply future profitability.',
  ];

  return (
    <div className="bg-amber-50/90 dark:bg-amber-950/25 border-b border-amber-200 dark:border-amber-900/40 text-amber-900 dark:text-amber-200 text-xs px-4 py-2 transition-colors duration-150">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="font-semibold text-amber-900 dark:text-amber-300">Methodological Disclosures &amp; Scientific Constraints:</span>
          <span className="hidden md:inline text-amber-800 dark:text-amber-400/80 text-[11px]">
            Descriptive research workstation. Zero lookahead-safe trading signals. Retrospective sample classification.
          </span>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center space-x-1 text-amber-800 dark:text-amber-400 hover:text-amber-950 dark:hover:text-amber-200 font-mono font-medium transition-colors cursor-pointer"
        >
          <span>{isExpanded ? 'Hide Caveats' : 'View 6 Caveats'}</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {isExpanded && (
        <div className="max-w-7xl mx-auto mt-2 pt-2 border-t border-amber-200 dark:border-amber-900/40 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {disclosures.map((d, idx) => (
            <div key={idx} className="flex items-start space-x-1.5 bg-white dark:bg-slate-900/90 p-2 rounded border border-amber-200 dark:border-amber-900/40 shadow-xs">
              <span className="font-mono text-amber-700 dark:text-amber-400 font-bold shrink-0">{idx + 1}.</span>
              <span className="text-[11px] leading-tight text-slate-700 dark:text-slate-300">{d}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
