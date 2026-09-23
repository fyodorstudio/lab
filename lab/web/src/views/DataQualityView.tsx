import React, { useState, useEffect } from 'react';
import { fetchDataQuality } from '../api/apiClient.js';
import { Database, ShieldAlert, CheckCircle2, AlertTriangle, Layers, Calendar } from 'lucide-react';

export const DataQualityView: React.FC = () => {
  const [qualityData, setQualityData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDataQuality()
      .then(setQualityData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400 font-mono text-sm">
        Running forensic dataset health audit...
      </div>
    );
  }

  if (!qualityData) {
    return (
      <div className="bg-rose-950/40 border border-rose-800 p-4 rounded text-rose-300 font-mono text-xs">
        Failed to load data quality audit.
      </div>
    );
  }

  const { overview, pairsAudit, duplicateResolution } = qualityData;

  const rejectedRows = overview.rejectedRowCount ?? 0;
  const malformedTs = overview.malformedTimestampCount ?? 0;
  const duplicateTs = overview.duplicateTimestampCount ?? 0;
  const unknownFamilies = overview.unknownFamilyCount ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
          <Database className="w-5 h-5 text-sky-500" />
          <span>Forensic Data Quality & Physical Source Audit</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-1">
          Full forensic transparency on ingested raw CSV files, integrity checks, missing data exclusions, and instrument coverage
        </p>
      </div>

      {/* Discovered files and counts audit */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3.5 space-y-1 shadow-sm">
          <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-semibold">Calendar File</span>
          <div className="text-slate-900 dark:text-slate-100 font-bold truncate">fyodor_calendar_master_history_repaired.csv</div>
          <div className="text-sky-600 dark:text-sky-400 font-semibold">{overview.calendarRecordCount.toLocaleString()} rows ingested</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3.5 space-y-1 shadow-sm">
          <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-semibold">Rejected / Malformed Rows</span>
          <div className={`font-bold text-base ${rejectedRows > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {rejectedRows.toLocaleString()} Rows Rejected
          </div>
          <div className="text-slate-500 dark:text-slate-400 text-[10px]">Strict CSV quotation & field count parser</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3.5 space-y-1 shadow-sm">
          <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-semibold">Parsed Value Failures</span>
          <div className={`font-bold text-base ${overview.parsedValueFailuresCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {overview.parsedValueFailuresCount.toLocaleString()} Failures
          </div>
          <div className="text-slate-500 dark:text-slate-400 text-[10px]">Non-numeric / NaN actual or forecast tokens</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3.5 space-y-1 shadow-sm">
          <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-semibold">Duplicate Instrument Strategy</span>
          <div className="text-slate-900 dark:text-slate-100 font-bold text-xs truncate">Authoritative File Selection</div>
          <div className="text-slate-500 dark:text-slate-400 text-[10px]">{duplicateResolution}</div>
        </div>
      </div>

      {/* Timestamp & Classification Hygiene */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 font-mono text-xs space-y-3 shadow-sm">
        <h3 className="font-bold text-slate-900 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800 pb-2 flex items-center justify-between">
          <span>Timestamp & Classification Forensic Hygiene</span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">Real-time row-level validation metrics</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="bg-slate-50 dark:bg-slate-950/60 p-3 rounded border border-slate-200 dark:border-slate-800">
            <span className="text-slate-600 dark:text-slate-400 block text-[11px] font-medium">Malformed Timestamps:</span>
            <span className={`text-lg font-bold ${malformedTs > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {malformedTs}
            </span>
            <span className="block text-[10px] text-slate-500 mt-1">Unparseable date/time strings</span>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950/60 p-3 rounded border border-slate-200 dark:border-slate-800">
            <span className="text-slate-600 dark:text-slate-400 block text-[11px] font-medium">Duplicate Timestamps:</span>
            <span className={`text-lg font-bold ${duplicateTs > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {duplicateTs.toLocaleString()}
            </span>
            <span className="block text-[10px] text-slate-500 mt-1">Multi-release clusters on same currency</span>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950/60 p-3 rounded border border-slate-200 dark:border-slate-800">
            <span className="text-slate-600 dark:text-slate-400 block text-[11px] font-medium">Unknown / Unclassified Families:</span>
            <span className={`text-lg font-bold ${unknownFamilies > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {unknownFamilies.toLocaleString()}
            </span>
            <span className="block text-[10px] text-slate-500 mt-1">Events classified into &apos;Other&apos;</span>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950/60 p-3 rounded border border-slate-200 dark:border-slate-800">
            <span className="text-slate-600 dark:text-slate-400 block text-[11px] font-medium">Classified Family Coverage:</span>
            <span className="text-lg font-bold text-sky-600 dark:text-sky-400">
              {overview.calendarRecordCount > 0
                ? `${(((overview.calendarRecordCount - unknownFamilies) / overview.calendarRecordCount) * 100).toFixed(1)}%`
                : '100%'}
            </span>
            <span className="block text-[10px] text-slate-500 mt-1">10 Macro Taxonomy Families</span>
          </div>
        </div>
      </div>

      {/* Missing Values Breakdown */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 font-mono text-xs space-y-3 shadow-sm">
        <h3 className="font-bold text-slate-900 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800 pb-2">
          Calendar Field Completeness Audit
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="bg-slate-50 dark:bg-slate-950/60 p-3 rounded border border-slate-200 dark:border-slate-800">
            <span className="text-slate-600 dark:text-slate-400 block text-[11px] font-medium">Missing Forecast (F):</span>
            <span className="text-lg font-bold text-amber-600 dark:text-amber-400">
              {overview.missingForecastCount.toLocaleString()}
            </span>
            <span className="block text-[10px] text-slate-500 mt-1">
              ({((overview.missingForecastCount / overview.calendarRecordCount) * 100).toFixed(1)}% of releases)
            </span>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950/60 p-3 rounded border border-slate-200 dark:border-slate-800">
            <span className="text-slate-600 dark:text-slate-400 block text-[11px] font-medium">Missing Actual (A):</span>
            <span className="text-lg font-bold text-slate-700 dark:text-slate-300">
              {overview.missingActualCount.toLocaleString()}
            </span>
            <span className="block text-[10px] text-slate-500 mt-1">
              ({((overview.missingActualCount / overview.calendarRecordCount) * 100).toFixed(1)}% of releases)
            </span>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950/60 p-3 rounded border border-slate-200 dark:border-slate-800">
            <span className="text-slate-600 dark:text-slate-400 block text-[11px] font-medium">Missing Previous (P):</span>
            <span className="text-lg font-bold text-slate-700 dark:text-slate-300">
              {overview.missingPreviousCount.toLocaleString()}
            </span>
            <span className="block text-[10px] text-slate-500 mt-1">
              ({((overview.missingPreviousCount / overview.calendarRecordCount) * 100).toFixed(1)}% of releases)
            </span>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950/60 p-3 rounded border border-slate-200 dark:border-slate-800">
            <span className="text-slate-600 dark:text-slate-400 block text-[11px] font-medium">Complete A / F / P:</span>
            <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
              {overview.completeAFPCount.toLocaleString()}
            </span>
            <span className="block text-[10px] text-slate-500 mt-1">
              ({((overview.completeAFPCount / overview.calendarRecordCount) * 100).toFixed(1)}% usable for S+M)
            </span>
          </div>
        </div>
      </div>

      {/* Discovered FX Instruments & Physical File Audit */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 font-mono text-xs space-y-3 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
          <h3 className="font-bold text-slate-900 dark:text-slate-200">
            Physical FX Candle File Discovery & Coverage ({pairsAudit.length} Instruments)
          </h3>
          <span className="text-slate-500 dark:text-slate-400 text-xs font-normal">Location: raw_data/fyodor_candles/</span>
        </div>

        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-xs border-collapse whitespace-nowrap">
            <thead className="bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 sticky top-0 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-2.5 text-left">Instrument</th>
                <th className="p-2.5 text-left">Base</th>
                <th className="p-2.5 text-left">Quote</th>
                <th className="p-2.5 text-left">Physical File Name</th>
                <th className="p-2.5 text-right">Bars</th>
                <th className="p-2.5 text-left">Earliest Date</th>
                <th className="p-2.5 text-left">Latest Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
              {pairsAudit.map((p: any) => (
                <tr key={p.pair} className="hover:bg-slate-100/60 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="p-2.5 font-bold text-sky-600 dark:text-sky-400">{p.pair}</td>
                  <td className="p-2.5 text-slate-700 dark:text-slate-300">{p.base}</td>
                  <td className="p-2.5 text-slate-700 dark:text-slate-300">{p.quote}</td>
                  <td className="p-2.5 text-slate-500 dark:text-slate-400 font-mono">{p.sourceFilename}</td>
                  <td className="p-2.5 text-right font-semibold text-slate-900 dark:text-slate-200">{p.barCount.toLocaleString()}</td>
                  <td className="p-2.5 text-slate-500 dark:text-slate-400">{p.earliestDate}</td>
                  <td className="p-2.5 text-slate-500 dark:text-slate-400">{p.latestDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
