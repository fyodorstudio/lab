import React, { useState, useEffect } from 'react';
import { fetchInspect } from '../api/apiClient.js';
import { ScoreBadge } from '../components/ScoreBadge.js';
import { Search, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';

interface RawEventInspectorViewProps {
  initialEventId?: string;
  initialValueId?: string;
  initialPair?: string;
}

export const RawEventInspectorView: React.FC<RawEventInspectorViewProps> = ({
  initialEventId = '840010001',
  initialValueId = '115719',
  initialPair = 'EURUSD',
}) => {
  const [eventId, setEventId] = useState(initialEventId);
  const [valueId, setValueId] = useState(initialValueId);
  const [pair, setPair] = useState(initialPair);
  const [percentile, setPercentile] = useState(75);

  const [auditData, setAuditData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAudit = () => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    fetchInspect(eventId, valueId, pair, percentile)
      .then(setAuditData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    runAudit();
  }, [initialEventId, initialValueId, initialPair]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
          <ShieldCheck className="w-5 h-5 text-sky-600 dark:text-sky-400" />
          <span>Forensic Raw Event &amp; Math Audit Inspector</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-1">
          Inspect and verify mathematical derivations and percentile classifications directly against underlying raw CSV records
        </p>
      </div>

      {/* Query form */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 font-mono text-xs shadow-sm dark:shadow-md transition-colors duration-150">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runAudit();
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <div>
            <label className="text-slate-600 dark:text-slate-400 block mb-1 font-semibold">Event ID:</label>
            <input
              type="text"
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-3 py-1.5 text-slate-900 dark:text-slate-200 w-36 font-medium focus:border-sky-500 focus:outline-none"
              placeholder="e.g. 840010001"
            />
          </div>

          <div>
            <label className="text-slate-600 dark:text-slate-400 block mb-1 font-semibold">Value ID:</label>
            <input
              type="text"
              value={valueId}
              onChange={(e) => setValueId(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-3 py-1.5 text-slate-900 dark:text-slate-200 w-32 font-medium focus:border-sky-500 focus:outline-none"
              placeholder="e.g. 115719"
            />
          </div>

          <div>
            <label className="text-slate-600 dark:text-slate-400 block mb-1 font-semibold">FX Pair:</label>
            <input
              type="text"
              value={pair}
              onChange={(e) => setPair(e.target.value.toUpperCase())}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-3 py-1.5 text-slate-900 dark:text-slate-200 w-28 font-medium focus:border-sky-500 focus:outline-none"
              placeholder="EURUSD"
            />
          </div>

          <div>
            <label className="text-slate-600 dark:text-slate-400 block mb-1 font-semibold">Classification Threshold:</label>
            <select
              value={percentile}
              onChange={(e) => setPercentile(parseInt(e.target.value, 10))}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-3 py-1.5 text-slate-900 dark:text-slate-200 font-medium focus:border-sky-500 focus:outline-none"
            >
              {[50, 60, 70, 75, 80, 85, 90, 95].map((p) => (
                <option key={p} value={p}>P{p}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="px-4 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white font-bold transition-colors flex items-center space-x-1 shadow-sm cursor-pointer"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Audit Observation</span>
          </button>
        </form>
      </div>

      {loading ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-12 text-center text-slate-500 dark:text-slate-400 font-mono text-sm shadow-sm">
          Auditing observation and underlying market bars...
        </div>
      ) : error ? (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 p-4 rounded text-rose-800 dark:text-rose-300 text-xs font-mono">
          Audit Error: {error}
        </div>
      ) : auditData ? (
        <div className="space-y-6">
          {/* Step 1: Raw Calendar Record */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-3 font-mono text-xs shadow-sm dark:shadow-md transition-colors duration-150">
            <h3 className="font-bold border-b border-slate-200 dark:border-slate-800 pb-2 text-sky-700 dark:text-sky-400">
              1. Raw Economic Calendar Row (from fyodor_calendar_master_history_repaired.csv)
            </h3>
            <div className="bg-slate-50 dark:bg-slate-950/80 p-3 rounded border border-slate-200 dark:border-slate-800 text-[11px] overflow-x-auto text-slate-800 dark:text-slate-300 font-mono">
              {auditData.rawRow.eventId},{auditData.rawRow.valueId},{auditData.rawRow.timestamp},
              {auditData.rawRow.currency},{auditData.rawRow.countryCode},&quot;{auditData.rawRow.eventName}&quot;,
              {auditData.rawRow.importance},{auditData.rawRow.actualRaw || ''},{auditData.rawRow.forecastRaw || ''},
              {auditData.rawRow.previousRaw || ''},{auditData.rawRow.revisedPreviousRaw || ''}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
              <div>
                <span className="text-slate-500 dark:text-slate-400 block">Timestamp:</span>
                <span className="text-slate-900 dark:text-slate-100 font-bold">{auditData.rawRow.timestamp}</span> (
                {new Date(auditData.rawRow.timestamp * 1000).toISOString()})
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block">Currency &amp; Importance:</span>
                <span className="text-slate-800 dark:text-slate-200 font-semibold">{auditData.rawRow.currency} ({auditData.rawRow.importance})</span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block">Event Name:</span>
                <span className="text-slate-800 dark:text-slate-200 font-semibold">{auditData.rawRow.eventName}</span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block">Family:</span>
                <span className="text-slate-800 dark:text-slate-200 font-semibold">{auditData.parsedRelease.eventFamily}</span>
              </div>
            </div>
          </div>

          {/* Step 2: Comprehensive Mathematical Classification Audit */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-4 font-mono text-xs shadow-sm dark:shadow-md transition-colors duration-150">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-2 flex items-center justify-between">
              <h3 className="font-bold text-sky-700 dark:text-sky-400">
                2. Step-by-Step Mathematical &amp; Percentile Classification Audit
              </h3>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
                Audited against {auditData.thresholds.historicalSampleSize} total releases for this event
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* SURPRISE AUDIT CARD */}
              <div className="bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                    Surprise Classification (|A - F|)
                  </span>
                  <ScoreBadge score={auditData.scores.surpriseScore} />
                </div>

                <div className="space-y-1.5 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Actual (A):</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{auditData.parsedRelease.actual ?? 'null'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Forecast (F):</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{auditData.parsedRelease.forecast ?? 'null'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Raw Delta (A - F):</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {auditData.parsedRelease.surpriseDelta !== null ? (auditData.parsedRelease.surpriseDelta >= 0 ? `+${auditData.parsedRelease.surpriseDelta.toFixed(3)}` : auditData.parsedRelease.surpriseDelta.toFixed(3)) : 'null'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Absolute Delta |A - F|:</span>
                    <span className="font-bold text-sky-700 dark:text-sky-400">
                      {auditData.parsedRelease.surpriseAbsDelta !== null ? auditData.parsedRelease.surpriseAbsDelta.toFixed(3) : 'null'}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-1.5">
                    <span className="text-slate-500 dark:text-slate-400">Historical Nonzero N:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {auditData.surpriseAudit?.historicalDistributionN ?? 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Observation Percentile Rank:</span>
                    <span className="font-bold text-purple-700 dark:text-purple-400">
                      {auditData.parsedRelease.surprisePercentileRank !== null && auditData.parsedRelease.surprisePercentileRank !== undefined
                        ? `P${auditData.parsedRelease.surprisePercentileRank.toFixed(1)}`
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Active Boundary (P{auditData.thresholds.percentile}):</span>
                    <span className="font-bold text-rose-700 dark:text-rose-400">
                      P{auditData.thresholds.percentile} = {auditData.thresholds.surpriseThreshold !== null ? auditData.thresholds.surpriseThreshold.toFixed(3) : 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Surprise Percentile Table */}
                {auditData.surpriseAudit?.percentileTable && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold block">
                      Historical Nonzero Surprise Percentiles:
                    </span>
                    <div className="grid grid-cols-4 gap-1 text-[10px]">
                      {auditData.surpriseAudit.percentileTable.map((p: any) => (
                        <div key={p.percentile} className={`p-1 rounded text-center border ${
                          p.percentile === auditData.thresholds.percentile
                            ? 'bg-rose-100 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 font-bold text-rose-800 dark:text-rose-200'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                        }`}>
                          <div>{p.label}</div>
                          <div className="font-semibold">{p.formattedThreshold}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mathematical Justification */}
                <div className="bg-sky-50 dark:bg-sky-950/30 p-2.5 rounded border border-sky-200 dark:border-sky-900/50 text-[11px] text-sky-950 dark:text-sky-200">
                  <span className="font-bold block mb-0.5">Classification Reason:</span>
                  <span>{auditData.surpriseAudit?.reason || 'Calculated from historical distribution'}</span>
                </div>
              </div>

              {/* MOMENTUM AUDIT CARD */}
              <div className="bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                    Momentum Classification (|A - P|)
                  </span>
                  <ScoreBadge score={auditData.scores.momentumScore} />
                </div>

                <div className="space-y-1.5 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Actual (A):</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{auditData.parsedRelease.actual ?? 'null'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Previous (P):</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{auditData.parsedRelease.previous ?? 'null'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Raw Delta (A - P):</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {auditData.parsedRelease.momentumDelta !== null ? (auditData.parsedRelease.momentumDelta >= 0 ? `+${auditData.parsedRelease.momentumDelta.toFixed(3)}` : auditData.parsedRelease.momentumDelta.toFixed(3)) : 'null'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Absolute Delta |A - P|:</span>
                    <span className="font-bold text-sky-700 dark:text-sky-400">
                      {auditData.parsedRelease.momentumAbsDelta !== null ? auditData.parsedRelease.momentumAbsDelta.toFixed(3) : 'null'}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-1.5">
                    <span className="text-slate-500 dark:text-slate-400">Historical Nonzero N:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {auditData.momentumAudit?.historicalDistributionN ?? 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Observation Percentile Rank:</span>
                    <span className="font-bold text-purple-700 dark:text-purple-400">
                      {auditData.parsedRelease.momentumPercentileRank !== null && auditData.parsedRelease.momentumPercentileRank !== undefined
                        ? `P${auditData.parsedRelease.momentumPercentileRank.toFixed(1)}`
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Active Boundary (P{auditData.thresholds.percentile}):</span>
                    <span className="font-bold text-rose-700 dark:text-rose-400">
                      P{auditData.thresholds.percentile} = {auditData.thresholds.momentumThreshold !== null ? auditData.thresholds.momentumThreshold.toFixed(3) : 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Momentum Percentile Table */}
                {auditData.momentumAudit?.percentileTable && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold block">
                      Historical Nonzero Momentum Percentiles:
                    </span>
                    <div className="grid grid-cols-4 gap-1 text-[10px]">
                      {auditData.momentumAudit.percentileTable.map((p: any) => (
                        <div key={p.percentile} className={`p-1 rounded text-center border ${
                          p.percentile === auditData.thresholds.percentile
                            ? 'bg-rose-100 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 font-bold text-rose-800 dark:text-rose-200'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                        }`}>
                          <div>{p.label}</div>
                          <div className="font-semibold">{p.formattedThreshold}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mathematical Justification */}
                <div className="bg-sky-50 dark:bg-sky-950/30 p-2.5 rounded border border-sky-200 dark:border-sky-900/50 text-[11px] text-sky-950 dark:text-sky-200">
                  <span className="font-bold block mb-0.5">Classification Reason:</span>
                  <span>{auditData.momentumAudit?.reason || 'Calculated from historical distribution'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3: Candle Alignment */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-3 font-mono text-xs shadow-sm dark:shadow-md transition-colors duration-150">
            <h3 className="font-bold border-b border-slate-200 dark:border-slate-800 pb-2 text-sky-700 dark:text-sky-400">
              3. H1 Market Alignment &amp; Anchor P0 ({auditData.alignment.eventCurrencyPosition} currency, Q={auditData.alignment.directionMultiplier})
            </h3>

            <div className="bg-slate-50 dark:bg-slate-950/60 p-3 rounded border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Aligned P0 Timestamp:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {auditData.alignment.p0Timestamp} ({new Date(auditData.alignment.p0Timestamp * 1000).toISOString()})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">P0 Open Price:</span>
                <span className="font-bold text-sky-700 dark:text-sky-400">{auditData.alignment.p0?.toFixed(5)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Rule:</span>
                <span className="text-slate-600 dark:text-slate-400">First complete H1 candle beginning at or after announcement timestamp</span>
              </div>
            </div>

            {/* Context candle table */}
            <div>
              <span className="text-slate-800 dark:text-slate-300 font-bold block mb-2">H1 Candle Window Context:</span>
              <table className="w-full text-xs font-mono border-collapse bg-white dark:bg-slate-950/60 rounded border border-slate-200 dark:border-slate-800">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-400 text-left">
                    <th className="p-2">Relative Bar</th>
                    <th className="p-2">Candle Open Time (UTC)</th>
                    <th className="p-2 text-right">Open</th>
                    <th className="p-2 text-right">High</th>
                    <th className="p-2 text-right">Low</th>
                    <th className="p-2 text-right">Close</th>
                    <th className="p-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                  {auditData.candleContext.map((c: any) => (
                    <tr
                      key={c.time}
                      className={c.isP0 ? 'bg-sky-50 dark:bg-sky-500/15 text-sky-900 dark:text-sky-200 font-bold' : 'text-slate-800 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/40'}
                    >
                      <td className="p-2">{c.relativeBar === 0 ? 'P0' : c.relativeBar > 0 ? `+${c.relativeBar}` : c.relativeBar}</td>
                      <td className="p-2">{c.date.replace('T', ' ').slice(0, 19)}</td>
                      <td className="p-2 text-right">{c.open.toFixed(5)}</td>
                      <td className="p-2 text-right">{c.high.toFixed(5)}</td>
                      <td className="p-2 text-right">{c.low.toFixed(5)}</td>
                      <td className="p-2 text-right">{c.close.toFixed(5)}</td>
                      <td className="p-2 text-center">
                        {c.isP0 ? (
                          <span className="px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-500/20 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-500/30 text-[10px] font-bold">
                            Anchor Bar (P0)
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">Post-News</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Step 4: All 42 Trading Bar Cumulative Normalized Returns Table */}
          {auditData.alignment?.returns && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-3 font-mono text-xs shadow-sm dark:shadow-md transition-colors duration-150">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                <h3 className="font-bold text-sky-700 dark:text-sky-400">
                  4. All 42 Cumulative Normalized Returns (H1 to H42)
                </h3>
                <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                  Formula: R_norm(h) = Q × ((Close(h) - P0_Open) / P0_Open)
                </span>
              </div>

              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-xs font-mono border-collapse border border-slate-200 dark:border-slate-800">
                  <thead className="sticky top-0 bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 text-left">
                    <tr>
                      <th className="p-2">Horizon</th>
                      <th className="p-2 text-right">Raw Pair Return %</th>
                      <th className="p-2 text-right">Direction Multiplier (Q)</th>
                      <th className="p-2 text-right">Normalized Return %</th>
                      <th className="p-2 text-center">Direction</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                    {auditData.alignment.returns.map((r: number | null, idx: number) => {
                      const h = idx + 1;
                      const rawR = auditData.alignment.rawReturns?.[idx] ?? null;
                      const isKey = [1, 4, 8, 12, 18, 24, 30, 36, 42].includes(h);

                      return (
                        <tr key={h} className={isKey ? 'bg-sky-50/70 dark:bg-sky-500/10 font-semibold' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-800 dark:text-slate-300'}>
                          <td className="p-2">
                            <span className={isKey ? 'text-sky-800 dark:text-sky-300 font-bold' : 'text-slate-700 dark:text-slate-300'}>Horizon H{h}</span>
                            {isKey && <span className="ml-1.5 text-[10px] bg-sky-100 dark:bg-sky-500/20 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-500/30 px-1 py-0.2 rounded font-sans">KEY</span>}
                          </td>
                          <td className="p-2 text-right text-slate-600 dark:text-slate-400">
                            {rawR !== null ? `${(rawR * 100).toFixed(3)}%` : '—'}
                          </td>
                          <td className="p-2 text-right text-slate-800 dark:text-slate-300 font-bold">
                            {auditData.alignment.directionMultiplier > 0 ? '+1 (Base)' : '-1 (Quote)'}
                          </td>
                          <td className="p-2 text-right font-mono">
                            {r !== null ? (
                              <span className={r > 0 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : r < 0 ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-500 dark:text-slate-400'}>
                                {r > 0 ? '+' : ''}{(r * 100).toFixed(3)}%
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="p-2 text-center">
                            {r !== null ? (
                              r > 0 ? (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold">
                                  Strengthened
                                </span>
                              ) : r < 0 ? (
                                <span className="px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-[10px] font-bold">
                                  Weakened
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[10px]">Unchanged</span>
                              )
                            ) : (
                              <span className="text-slate-400 text-[10px]">Unavailable</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};
