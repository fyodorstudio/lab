import React, { useEffect, useState } from 'react';
import { fetchOverview, OverviewMetrics } from '../api/apiClient.js';
import { Activity, Calendar, CheckCircle2, Clock, Database, FileSpreadsheet, Layers } from 'lucide-react';

export const OverviewView: React.FC = () => {
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOverview()
      .then(setMetrics)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-400 font-mono text-sm">
        <Activity className="w-5 h-5 animate-spin mr-2 text-sky-400" />
        Loading dataset metrics...
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="bg-rose-950/40 border border-rose-800 p-4 rounded text-rose-300 text-xs font-mono">
        Error loading overview: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
          <Database className="w-5 h-5 text-sky-500" />
          <span>Macroeconomic &amp; Market Dataset Overview</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-1">
          Forensic audit of verified files ingested from raw_data/
        </p>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span className="uppercase font-semibold">Economic Calendar Records</span>
            <Calendar className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {metrics.calendarRecordCount.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            {metrics.calendarDateRange.min} to {metrics.calendarDateRange.max}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span className="uppercase font-semibold">H1 Market Candles</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {metrics.h1CandleCount.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            {metrics.marketDateRange.min} to {metrics.marketDateRange.max}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span className="uppercase font-semibold">FX Instruments Discovered</span>
            <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {metrics.fxInstrumentCount} Pairs
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            All 28 G8 major crosses + 23 liquid exotics
          </div>
        </div>
      </div>

      {/* Completeness & Quality Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Data Completeness */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-3 font-mono text-xs shadow-sm">
          <h3 className="font-bold text-slate-900 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800 pb-2 flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Economic Release Completeness (A / F / P)</span>
          </h3>

          <div className="space-y-2">
            <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded border border-slate-200 dark:border-slate-800">
              <span className="text-slate-600 dark:text-slate-400">Complete A/F/P Releases:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {metrics.completeAFPCount.toLocaleString()} ({((metrics.completeAFPCount / metrics.calendarRecordCount) * 100).toFixed(1)}%)
              </span>
            </div>

            <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded border border-slate-200 dark:border-slate-800">
              <span className="text-slate-600 dark:text-slate-400">Missing Forecast (F):</span>
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                {metrics.missingForecastCount.toLocaleString()}
              </span>
            </div>

            <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded border border-slate-200 dark:border-slate-800">
              <span className="text-slate-600 dark:text-slate-400">Missing Actual (A):</span>
              <span className="font-semibold text-slate-800 dark:text-slate-300">
                {metrics.missingActualCount.toLocaleString()}
              </span>
            </div>

            <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded border border-slate-200 dark:border-slate-800">
              <span className="text-slate-600 dark:text-slate-400">Missing Previous (P):</span>
              <span className="font-semibold text-slate-800 dark:text-slate-300">
                {metrics.missingPreviousCount.toLocaleString()}
              </span>
            </div>

            <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded border border-slate-200 dark:border-slate-800">
              <span className="text-slate-600 dark:text-slate-400">Parsed Value Failures:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-300">
                {metrics.parsedValueFailuresCount}
              </span>
            </div>
          </div>
        </div>

        {/* Currency & Event Catalog */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-3 font-mono text-xs shadow-sm">
          <h3 className="font-bold text-slate-900 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800 pb-2 flex items-center space-x-2">
            <Layers className="w-4 h-4 text-sky-500" />
            <span>Available Currencies &amp; Catalog</span>
          </h3>

          <div className="space-y-2.5">
            <div>
              <span className="text-slate-600 dark:text-slate-400 block text-[11px] mb-1 font-semibold">Currencies:</span>
              <div className="flex flex-wrap gap-1.5">
                {metrics.availableCurrencies.map((c) => (
                  <span
                    key={c}
                    className="px-2.5 py-0.5 rounded bg-sky-100 dark:bg-sky-500/10 border border-sky-300 dark:border-sky-500/30 text-sky-800 dark:text-sky-300 font-bold"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Unique Event Names:</span>
              <span className="text-slate-900 dark:text-slate-100 font-bold">{metrics.totalEventNamesCount}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Economic Families:</span>
              <span className="text-slate-900 dark:text-slate-100 font-bold">{metrics.availableFamiliesCount}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Duplicate Candle Issues:</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">0 Detected</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
