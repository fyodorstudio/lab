import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { ResearchHealth } from '../api/apiClient.js';

interface ResearchHealthPanelProps {
  health: ResearchHealth | null | undefined;
}

export const ResearchHealthPanel: React.FC<ResearchHealthPanelProps> = ({ health }) => {
  if (!health) return null;

  const hasWarnings = health.warnings && health.warnings.length > 0;
  const isExtremelySmall = health.sampleSize < 10;
  const isSmall = health.sampleSize < 30;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-3 shadow-sm font-mono">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
        <div className="flex items-center space-x-2">
          <Info className="w-4 h-4 text-sky-500" />
          <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100 tracking-wide uppercase">
            Forensic Research Health &amp; Audit
          </h3>
        </div>
        <div className="flex items-center space-x-2 text-xs">
          <span className="text-slate-500 dark:text-slate-400 font-medium">Sample N:</span>
          <span
            className={`font-bold px-2 py-0.5 rounded ${
              isExtremelySmall
                ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                : isSmall
                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
            }`}
          >
            {health.sampleSize}
          </span>
        </div>
      </div>

      {/* Grid of Forensic Attributes */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
        <div className="bg-slate-50 dark:bg-slate-950/60 p-2 rounded border border-slate-200 dark:border-slate-800">
          <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-semibold">Complete A/F/P</span>
          <span className="text-slate-800 dark:text-slate-200 font-bold">{health.completeAFPCount}</span>
        </div>
        <div className="bg-slate-50 dark:bg-slate-950/60 p-2 rounded border border-slate-200 dark:border-slate-800">
          <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-semibold">Missing Exclusions</span>
          <span className="text-slate-800 dark:text-slate-200 font-bold">{health.missingValueExclusions}</span>
        </div>
        <div className="bg-slate-50 dark:bg-slate-950/60 p-2 rounded border border-slate-200 dark:border-slate-800">
          <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-semibold">Simultaneous Releases</span>
          <span className={health.simultaneousReleaseCount > 0 ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-800 dark:text-slate-200 font-semibold'}>
            {health.simultaneousReleaseCount}
          </span>
        </div>
        <div className="bg-slate-50 dark:bg-slate-950/60 p-2 rounded border border-slate-200 dark:border-slate-800">
          <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-semibold">Weekend Crossings</span>
          <span className={health.weekendCrossingCount > 0 ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-800 dark:text-slate-200 font-semibold'}>
            {health.weekendCrossingCount}
          </span>
        </div>
        <div className="bg-slate-50 dark:bg-slate-950/60 p-2 rounded border border-slate-200 dark:border-slate-800">
          <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-semibold">Currency Position</span>
          <span className="text-sky-600 dark:text-sky-400 font-bold capitalize">
            {health.eventCurrencyPosition} (Q={health.eventCurrencyPosition === 'base' ? '+1' : '-1'})
          </span>
        </div>
        <div className="bg-slate-50 dark:bg-slate-950/60 p-2 rounded border border-slate-200 dark:border-slate-800">
          <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-semibold">Scoring Threshold</span>
          <span className="text-slate-800 dark:text-slate-200 font-bold">P{health.thresholdPercentile}</span>
        </div>
      </div>

      {/* Warnings & Notes */}
      {hasWarnings && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded p-2.5 space-y-1.5">
          <div className="flex items-center space-x-1.5 text-amber-800 dark:text-amber-300 font-bold text-xs">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Active Sample Caveats ({health.warnings.length}):</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-900 dark:text-amber-200/90 pl-1">
            {health.warnings.map((w, idx) => (
              <li key={idx} className="leading-snug">{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Retrospective classification notice */}
      <div className="text-[11px] text-slate-500 dark:text-slate-400 italic bg-slate-50 dark:bg-slate-950/60 px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-800">
        <span className="font-semibold text-slate-700 dark:text-slate-300 not-italic">Notice: </span>
        {health.retrospectiveClassificationWarning}
      </div>
    </div>
  );
};
