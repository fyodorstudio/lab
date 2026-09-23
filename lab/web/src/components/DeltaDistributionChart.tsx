import React, { useState } from 'react';
import { DistributionResponse, PercentileThresholdRow } from '../api/apiClient.js';
import { Info, HelpCircle } from 'lucide-react';

interface DeltaDistributionChartProps {
  surprise: DistributionResponse;
  momentum: DistributionResponse;
  eventName: string;
  currency: string;
  selectedThresholdPercentile: number;
  onSelectThresholdPercentile?: (p: number) => void;
}

export const DeltaDistributionChart: React.FC<DeltaDistributionChartProps> = ({
  surprise,
  momentum,
  eventName,
  currency,
  selectedThresholdPercentile,
  onSelectThresholdPercentile,
}) => {
  const [activeTab, setActiveTab] = useState<'surprise' | 'momentum'>('surprise');
  const [selectedBinIndex, setSelectedBinIndex] = useState<number | null>(null);
  const [hoveredPercentile, setHoveredPercentile] = useState<number | null>(null);

  const activeData = activeTab === 'surprise' ? surprise : momentum;
  const { stats, bins, selectedThresholdValue, unit, percentileTable, thresholdDetails } = activeData;

  const width = 640;
  const height = 230;
  const paddingLeft = 45;
  const paddingRight = 30;
  const paddingTop = 35;
  const paddingBottom = 35;

  const chartW = width - paddingLeft - paddingRight;
  const chartH = height - paddingTop - paddingBottom;

  const maxCount = Math.max(1, ...bins.map((b) => b.count));
  const minVal = stats.min ?? 0;
  const maxVal = stats.max ?? 1;

  const getX = (val: number) => {
    const range = maxVal - minVal;
    if (range <= 0) return paddingLeft + chartW / 2;
    return paddingLeft + ((val - minVal) / range) * chartW;
  };

  const getY = (count: number) => {
    return paddingTop + chartH - (count / maxCount) * chartH;
  };

  const formatDelta = (val: number | null | undefined): string => {
    if (val === null || val === undefined || !Number.isFinite(val)) return 'N/A';
    if (unit === '%') return `${val.toFixed(2)}%`;
    if (unit === 'K' || unit === 'k') {
      return Math.abs(val) >= 1000 ? `${(val / 1000).toFixed(1)}K` : `${val.toFixed(1)}K`;
    }
    if (unit === 'M' || unit === 'm') {
      return Math.abs(val) >= 1e6 ? `${(val / 1e6).toFixed(2)}M` : `${val.toFixed(2)}M`;
    }
    return Number.isInteger(val) ? String(val) : val.toFixed(3);
  };

  // Derive standard percentiles if not already provided by backend
  const standardPercentiles: PercentileThresholdRow[] = percentileTable || [
    { percentile: 50, label: 'P50', threshold: stats.p50, formattedThreshold: formatDelta(stats.p50) },
    { percentile: 60, label: 'P60', threshold: stats.p60, formattedThreshold: formatDelta(stats.p60) },
    { percentile: 70, label: 'P70', threshold: stats.p70, formattedThreshold: formatDelta(stats.p70) },
    { percentile: 75, label: 'P75', threshold: stats.p75, formattedThreshold: formatDelta(stats.p75) },
    { percentile: 80, label: 'P80', threshold: stats.p80, formattedThreshold: formatDelta(stats.p80) },
    { percentile: 85, label: 'P85', threshold: stats.p85, formattedThreshold: formatDelta(stats.p85) },
    { percentile: 90, label: 'P90', threshold: stats.p90, formattedThreshold: formatDelta(stats.p90) },
    { percentile: 95, label: 'P95', threshold: stats.p95, formattedThreshold: formatDelta(stats.p95) },
  ];

  const currentThreshFormatted = formatDelta(selectedThresholdValue);
  const diffLabel = activeTab === 'surprise' ? '|Actual - Forecast|' : '|Actual - Previous|';
  const scoreField = activeTab === 'surprise' ? 'Surprise Score' : 'Momentum Score';

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-4 shadow-sm dark:shadow-md font-mono transition-colors duration-150">
      {/* Header, Event Metadata and Surprise/Momentum Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-sky-600 dark:text-sky-400 font-bold">[{currency}]</span>
            <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">{eventName}</h3>
            {unit && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-500/10 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-500/20 font-bold">
                Unit: {unit}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Historical Nonzero Absolute Delta Distribution • Sample N = {activeData.nonZeroDeltasCount} of {activeData.allDeltasCount} releases
          </p>
        </div>

        <div className="flex items-center space-x-2 bg-slate-100 dark:bg-slate-950 p-1 rounded border border-slate-200 dark:border-slate-800 text-xs">
          <button
            onClick={() => {
              setActiveTab('surprise');
              setSelectedBinIndex(null);
            }}
            className={`px-3 py-1 rounded transition-colors cursor-pointer ${
              activeTab === 'surprise'
                ? 'bg-sky-600 text-white font-semibold shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            |A - F| Surprise
          </button>
          <button
            onClick={() => {
              setActiveTab('momentum');
              setSelectedBinIndex(null);
            }}
            className={`px-3 py-1 rounded transition-colors cursor-pointer ${
              activeTab === 'momentum'
                ? 'bg-sky-600 text-white font-semibold shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            |A - P| Momentum
          </button>
        </div>
      </div>

      {/* Primary Visual & Metric Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {/* Histogram Chart with Interactive Percentile Markers */}
        <div className="lg:col-span-2 relative bg-slate-50 dark:bg-slate-950 rounded border border-slate-200 dark:border-slate-800 p-2.5">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto select-none text-[10px]">
            {/* Horizontal Grid lines */}
            {[0, 0.5, 1.0].map((frac) => {
              const y = paddingTop + frac * chartH;
              return (
                <line
                  key={frac}
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  className="stroke-slate-200 dark:stroke-slate-800"
                  strokeDasharray="2,2"
                />
              );
            })}

            {/* Histogram Bars */}
            {bins.map((bin, idx) => {
              const x1 = getX(bin.binStart);
              const x2 = getX(bin.binEnd);
              const barW = Math.max(1.5, x2 - x1 - 1.5);
              const y = getY(bin.count);
              const barH = paddingTop + chartH - y;
              const isSelected = selectedBinIndex === idx;

              return (
                <g key={idx} className="cursor-pointer" onClick={() => setSelectedBinIndex(isSelected ? null : idx)}>
                  <rect
                    x={x1}
                    y={y}
                    width={barW}
                    height={barH}
                    className={`transition-all ${
                      isSelected
                        ? 'fill-sky-500 stroke-sky-400 dark:fill-sky-400 dark:stroke-sky-300'
                        : 'fill-slate-300 hover:fill-sky-400/70 dark:fill-slate-700/80 dark:hover:fill-sky-500/80 stroke-slate-400 dark:stroke-slate-600'
                    }`}
                    strokeWidth="1"
                  />
                </g>
              );
            })}

            {/* P75 Indicator Line */}
            {stats.p75 !== null && (
              <g
                className="cursor-pointer"
                onMouseEnter={() => setHoveredPercentile(75)}
                onMouseLeave={() => setHoveredPercentile(null)}
              >
                <line
                  x1={getX(stats.p75)}
                  y1={paddingTop}
                  x2={getX(stats.p75)}
                  y2={paddingTop + chartH}
                  stroke="#a855f7"
                  strokeWidth="1.5"
                  strokeDasharray="3,2"
                />
                <text x={getX(stats.p75)} y={paddingTop - 18} textAnchor="middle" fill="#a855f7" className="font-bold text-[9px]">
                  P75
                </text>
              </g>
            )}

            {/* P85 Indicator Line */}
            {stats.p85 !== null && (
              <g
                className="cursor-pointer"
                onMouseEnter={() => setHoveredPercentile(85)}
                onMouseLeave={() => setHoveredPercentile(null)}
              >
                <line
                  x1={getX(stats.p85)}
                  y1={paddingTop}
                  x2={getX(stats.p85)}
                  y2={paddingTop + chartH}
                  stroke="#ec4899"
                  strokeWidth="1.5"
                  strokeDasharray="3,2"
                />
                <text x={getX(stats.p85)} y={paddingTop - 18} textAnchor="middle" fill="#ec4899" className="font-bold text-[9px]">
                  P85
                </text>
              </g>
            )}

            {/* P95 Indicator Line */}
            {stats.p95 !== null && (
              <g
                className="cursor-pointer"
                onMouseEnter={() => setHoveredPercentile(95)}
                onMouseLeave={() => setHoveredPercentile(null)}
              >
                <line
                  x1={getX(stats.p95)}
                  y1={paddingTop}
                  x2={getX(stats.p95)}
                  y2={paddingTop + chartH}
                  stroke="#f97316"
                  strokeWidth="1.5"
                  strokeDasharray="3,2"
                />
                <text x={getX(stats.p95)} y={paddingTop - 18} textAnchor="middle" fill="#f97316" className="font-bold text-[9px]">
                  P95
                </text>
              </g>
            )}

            {/* Median Marker (P50) */}
            {stats.median !== null && (
              <g
                className="cursor-pointer"
                onMouseEnter={() => setHoveredPercentile(50)}
                onMouseLeave={() => setHoveredPercentile(null)}
              >
                <line
                  x1={getX(stats.median)}
                  y1={paddingTop}
                  x2={getX(stats.median)}
                  y2={paddingTop + chartH}
                  stroke="#0284c7"
                  strokeWidth="1.8"
                />
                <text x={getX(stats.median)} y={paddingTop - 6} textAnchor="middle" fill="#0284c7" className="font-bold text-[9px]">
                  Med (P50)
                </text>
              </g>
            )}

            {/* Active Selected Threshold Line */}
            {selectedThresholdValue !== null && (
              <g>
                <line
                  x1={getX(selectedThresholdValue)}
                  y1={paddingTop - 5}
                  x2={getX(selectedThresholdValue)}
                  y2={paddingTop + chartH}
                  stroke="#f43f5e"
                  strokeWidth="2"
                  strokeDasharray="4,2"
                />
                <text
                  x={getX(selectedThresholdValue)}
                  y={paddingTop - 6}
                  textAnchor="middle"
                  fill="#f43f5e"
                  className="font-bold text-[10px]"
                >
                  P{selectedThresholdPercentile} = {currentThreshFormatted}
                </text>
              </g>
            )}

            {/* X Axis line & labels */}
            <line
              x1={paddingLeft}
              y1={paddingTop + chartH}
              x2={width - paddingRight}
              y2={paddingTop + chartH}
              className="stroke-slate-300 dark:stroke-slate-700"
            />
            <text x={paddingLeft} y={paddingTop + chartH + 16} textAnchor="start" className="fill-slate-500 dark:fill-slate-400">
              Min: {formatDelta(minVal)}
            </text>
            <text x={width - paddingRight} y={paddingTop + chartH + 16} textAnchor="end" className="fill-slate-500 dark:fill-slate-400">
              Max: {formatDelta(maxVal)}
            </text>
          </svg>

          {/* Threshold marker legend with real values */}
          <div className="flex flex-wrap items-center justify-between mt-2.5 text-xs text-slate-600 dark:text-slate-400 px-1 gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-3 text-[11px]">
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-1 bg-sky-600 dark:bg-sky-400 rounded inline-block"></span>
                <span>Median ({formatDelta(stats.median)})</span>
              </span>
              <span className="flex items-center space-x-1 text-purple-600 dark:text-purple-400">
                <span className="w-2 h-1 bg-purple-500 rounded inline-block"></span>
                <span>P75 ({formatDelta(stats.p75)})</span>
              </span>
              <span className="flex items-center space-x-1 text-pink-600 dark:text-pink-400">
                <span className="w-2 h-1 bg-pink-500 rounded inline-block"></span>
                <span>P85 ({formatDelta(stats.p85)})</span>
              </span>
              <span className="flex items-center space-x-1 text-orange-600 dark:text-orange-400">
                <span className="w-2 h-1 bg-orange-500 rounded inline-block"></span>
                <span>P95 ({formatDelta(stats.p95)})</span>
              </span>
            </div>
            <span className="font-semibold text-slate-800 dark:text-slate-200">Nonzero N = {activeData.nonZeroDeltasCount}</span>
          </div>

          {selectedBinIndex !== null && (
            <div className="mt-2 bg-sky-50 dark:bg-slate-900 border border-sky-300 dark:border-sky-800 p-2 rounded text-xs text-sky-900 dark:text-sky-200">
              Selected Bin Range: [{formatDelta(bins[selectedBinIndex].binStart)} to {formatDelta(bins[selectedBinIndex].binEnd)}] — {bins[selectedBinIndex].count} releases ({(bins[selectedBinIndex].frequency * 100).toFixed(1)}% of sample)
            </div>
          )}

          {hoveredPercentile !== null && (
            <div className="mt-2 bg-purple-50 dark:bg-purple-950/40 border border-purple-300 dark:border-purple-800 p-2 rounded text-xs text-purple-900 dark:text-purple-200">
              <strong>P{hoveredPercentile} Reference:</strong> {hoveredPercentile}th percentile threshold is{' '}
              <strong>{formatDelta((stats as any)[`p${hoveredPercentile}`])}</strong> ({hoveredPercentile}% of historical nonzero absolute deltas are below or equal to this magnitude).
            </div>
          )}
        </div>

        {/* Quantile Statistics & Threshold Selector Card */}
        <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded border border-slate-200 dark:border-slate-800 text-xs space-y-3">
          <div className="font-semibold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800 pb-1.5 flex justify-between">
            <span>Sample Distribution</span>
            <span className="text-slate-500 dark:text-slate-400 font-normal">All Releases: {activeData.allDeltasCount}</span>
          </div>

          <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[11px]">
            <span className="text-slate-500 dark:text-slate-400">Mean:</span>
            <span className="text-right text-slate-800 dark:text-slate-200 font-semibold">{formatDelta(stats.mean)}</span>

            <span className="text-slate-500 dark:text-slate-400">Median (P50):</span>
            <span className="text-right text-sky-600 dark:text-sky-400 font-bold">{formatDelta(stats.median)}</span>

            <span className="text-slate-500 dark:text-slate-400">Min Nonzero:</span>
            <span className="text-right text-slate-700 dark:text-slate-300">{formatDelta(stats.min)}</span>

            <span className="text-slate-500 dark:text-slate-400">Max Observed:</span>
            <span className="text-right text-slate-700 dark:text-slate-300">{formatDelta(stats.max)}</span>

            <span className="text-slate-500 dark:text-slate-400">P25:</span>
            <span className="text-right text-slate-700 dark:text-slate-300">{formatDelta(stats.p25)}</span>

            <span className="text-purple-600 dark:text-purple-400 font-semibold">P75:</span>
            <span className="text-right text-purple-700 dark:text-purple-300 font-bold">{formatDelta(stats.p75)}</span>

            <span className="text-pink-600 dark:text-pink-400 font-semibold">P85:</span>
            <span className="text-right text-pink-700 dark:text-pink-300 font-bold">{formatDelta(stats.p85)}</span>

            <span className="text-orange-600 dark:text-orange-400 font-semibold">P95:</span>
            <span className="text-right text-orange-700 dark:text-orange-300 font-bold">{formatDelta(stats.p95)}</span>
          </div>

          {onSelectThresholdPercentile && (
            <div className="pt-2.5 border-t border-slate-200 dark:border-slate-800">
              <span className="text-slate-600 dark:text-slate-400 block mb-1.5 text-[10px] uppercase font-bold tracking-wider">
                Select Magnitude Threshold:
              </span>
              <div className="grid grid-cols-4 gap-1">
                {[50, 60, 70, 75, 80, 85, 90, 95].map((p) => (
                  <button
                    key={p}
                    onClick={() => onSelectThresholdPercentile(p)}
                    className={`py-1 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                      selectedThresholdPercentile === p
                        ? 'bg-rose-600 text-white border-rose-500 shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    P{p}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 1: Real Values Behind Every Percentile Table */}
      <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded border border-slate-200 dark:border-slate-800 space-y-2">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-1.5">
          <div className="flex items-center space-x-1.5">
            <Info className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 uppercase tracking-wide">
              Real Historical Delta Thresholds (P50 to P95)
            </h4>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Source: Verified {activeData.nonZeroDeltasCount} nonzero releases for {eventName}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-slate-200/60 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-b border-slate-300 dark:border-slate-800 text-left">
                <th className="p-2 font-semibold">Percentile</th>
                <th className="p-2 font-semibold">Absolute Delta Threshold</th>
                <th className="p-2 font-semibold">Status in Active Model</th>
                <th className="p-2 font-semibold">Empirical Meaning</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
              {standardPercentiles.map((row) => {
                const isActive = row.percentile === selectedThresholdPercentile;
                const formatted = row.formattedThreshold || formatDelta(row.threshold);

                return (
                  <tr
                    key={row.percentile}
                    className={`transition-colors ${
                      isActive
                        ? 'bg-rose-50 dark:bg-rose-950/30 font-bold text-rose-900 dark:text-rose-200'
                        : 'hover:bg-slate-100/60 dark:hover:bg-slate-900/50'
                    }`}
                  >
                    <td className="p-2">
                      <span className={`px-1.5 py-0.5 rounded font-bold ${
                        isActive
                          ? 'bg-rose-600 text-white'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                      }`}>
                        {row.label}
                      </span>
                    </td>
                    <td className="p-2 font-mono text-sm">
                      <span className={isActive ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-900 dark:text-slate-100 font-semibold'}>
                        {formatted}
                      </span>
                    </td>
                    <td className="p-2">
                      {isActive ? (
                        <span className="text-rose-600 dark:text-rose-400 font-bold">
                          ACTIVE THRESHOLD
                        </span>
                      ) : (
                        <span className="text-slate-500 dark:text-slate-400">Reference Benchmark</span>
                      )}
                    </td>
                    <td className="p-2 text-[11px] text-slate-600 dark:text-slate-400">
                      {row.percentile}% of historical nonzero {diffLabel} are ≤ {formatted} ({100 - row.percentile}% exceed it)
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 2: Active Scoring Threshold Explainer Card */}
      <div className="bg-sky-50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-900/40 rounded p-3 text-xs space-y-2">
        <div className="flex items-center space-x-2 text-sky-900 dark:text-sky-300 font-bold">
          <HelpCircle className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
          <span>Active Classification Boundary: P{selectedThresholdPercentile} = {currentThreshFormatted}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 text-[11px]">
          <div className="bg-white dark:bg-slate-900/90 p-2.5 rounded border border-sky-200 dark:border-sky-900/50 space-y-1">
            <span className="font-bold text-slate-900 dark:text-slate-100 block">1. Distribution Partition Meaning:</span>
            <p className="text-slate-600 dark:text-slate-300">
              • <strong>{selectedThresholdPercentile}%</strong> of historical nonzero {diffLabel} deltas are <strong>≤ {currentThreshFormatted}</strong>.
            </p>
            <p className="text-slate-600 dark:text-slate-300">
              • <strong>{100 - selectedThresholdPercentile}%</strong> of historical nonzero {diffLabel} deltas are <strong>&gt; {currentThreshFormatted}</strong> (Tail events).
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900/90 p-2.5 rounded border border-sky-200 dark:border-sky-900/50 space-y-1">
            <span className="font-bold text-slate-900 dark:text-slate-100 block">2. Resulting Score Boundary ({scoreField}):</span>
            <p className="text-slate-600 dark:text-slate-300">
              • <code>{diffLabel} ≤ {currentThreshFormatted}</code> → Magnitude Score <strong>±2 (Medium)</strong>
            </p>
            <p className="text-slate-600 dark:text-slate-300">
              • <code>{diffLabel} &gt; {currentThreshFormatted}</code> → Magnitude Score <strong>±3 (Large Outlier)</strong>
            </p>
            <p className="text-slate-500 dark:text-slate-400 text-[10px]">
              • Equal releases (Delta = 0) always score <strong>+1 (Inline/Neutral)</strong> regardless of threshold.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
