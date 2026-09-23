import React, { useMemo } from 'react';
import { HorizonStatistics, HistogramBin } from '../api/apiClient.js';

interface HorizonDistributionChartProps {
  horizons: HorizonStatistics[];
  selectedHorizon: number;
  onSelectHorizon: (h: number) => void;
  samplePaths: Array<{
    returns: Array<number | null>;
  }>;
  horizonBins?: Record<number, HistogramBin[]>;
}

export const HorizonDistributionChart: React.FC<HorizonDistributionChartProps> = ({
  horizons,
  selectedHorizon,
  onSelectHorizon,
  samplePaths,
  horizonBins,
}) => {
  const currentStats = horizons[selectedHorizon - 1];

  // Extract all valid returns at the selected horizon (fallback if precomputed bins not available)
  const horizonReturns = useMemo(() => {
    const list: number[] = [];
    const idx = selectedHorizon - 1;
    for (const p of samplePaths) {
      const r = p.returns[idx];
      if (r !== null && Number.isFinite(r)) {
        list.push(r);
      }
    }
    return list;
  }, [samplePaths, selectedHorizon]);

  // Use precomputed full-sample bins if provided, otherwise compute from local sample
  const bins = useMemo(() => {
    if (horizonBins && horizonBins[selectedHorizon] && horizonBins[selectedHorizon].length > 0) {
      return horizonBins[selectedHorizon];
    }

    if (horizonReturns.length === 0) return [];
    const min = Math.min(...horizonReturns);
    const max = Math.max(...horizonReturns);
    if (min === max) {
      return [{ binStart: min, binEnd: max, count: horizonReturns.length, frequency: 1 }];
    }
    const binCount = 15;
    const step = (max - min) / binCount;
    const b = Array.from({ length: binCount }, (_, i) => ({
      binStart: min + i * step,
      binEnd: min + (i + 1) * step,
      count: 0,
      frequency: 0,
    }));

    for (const val of horizonReturns) {
      let placed = false;
      for (let i = 0; i < b.length; i++) {
        if (val >= b[i].binStart && (i === b.length - 1 ? val <= b[i].binEnd : val < b[i].binEnd)) {
          b[i].count++;
          placed = true;
          break;
        }
      }
      if (!placed && b.length > 0) b[b.length - 1].count++;
    }
    return b;
  }, [horizonBins, selectedHorizon, horizonReturns]);

  const maxCount = Math.max(1, ...bins.map((b) => b.count));
  const minVal = currentStats?.min ?? -0.01;
  const maxVal = currentStats?.max ?? 0.01;

  const width = 600;
  const height = 210;
  const paddingLeft = 45;
  const paddingRight = 30;
  const paddingTop = 25;
  const paddingBottom = 35;

  const chartW = width - paddingLeft - paddingRight;
  const chartH = height - paddingTop - paddingBottom;

  const getX = (val: number) => {
    const range = maxVal - minVal;
    if (range <= 0) return paddingLeft + chartW / 2;
    return paddingLeft + ((val - minVal) / range) * chartW;
  };

  const getY = (count: number) => {
    return paddingTop + chartH - (count / maxCount) * chartH;
  };

  const isFullSample = Boolean(horizonBins && horizonBins[selectedHorizon]);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-4 shadow-md font-mono">
      {/* Header & Horizon Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
              Horizon Return Distribution (H{selectedHorizon})
            </h3>
            {isFullSample && (
              <span className="text-[10px] bg-sky-100 dark:bg-sky-950/80 text-sky-800 dark:text-sky-400 px-1.5 py-0.5 rounded border border-sky-300 dark:border-sky-800 font-medium">
                Full Sample (100% N)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Empirical distribution of normalized percentage returns at trading bar {selectedHorizon}
          </p>
        </div>

        {/* Quick buttons & Horizon slider (1 to 42) */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center space-x-1">
            {[1, 4, 8, 12, 24, 42].map((h) => (
              <button
                key={h}
                onClick={() => onSelectHorizon(h)}
                className={`px-2 py-0.5 rounded font-bold transition-colors ${
                  selectedHorizon === h
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700'
                }`}
              >
                H{h}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-1.5 pl-2 border-l border-slate-200 dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400 text-[11px]">H:</span>
            <input
              type="range"
              min="1"
              max="42"
              value={selectedHorizon}
              onChange={(e) => onSelectHorizon(parseInt(e.target.value, 10))}
              className="w-20 accent-sky-500 cursor-pointer"
            />
            <span className="font-bold text-sky-600 dark:text-sky-400 w-6 text-right">{selectedHorizon}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {/* SVG Histogram */}
        <div className="lg:col-span-2 relative bg-slate-50 dark:bg-slate-950 rounded border border-slate-200 dark:border-slate-800 p-2">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto select-none text-[10px]">
            {/* Grid */}
            {[0, 0.5, 1.0].map((frac) => {
              const c = Math.round(maxCount * frac);
              const y = getY(c);
              return (
                <g key={frac}>
                  <line
                    x1={paddingLeft}
                    y1={y}
                    x2={width - paddingRight}
                    y2={y}
                    className="stroke-slate-200 dark:stroke-slate-800"
                    strokeDasharray="2,2"
                  />
                  <text x={paddingLeft - 6} y={y + 3} textAnchor="end" className="fill-slate-500 dark:fill-slate-400">
                    {c}
                  </text>
                </g>
              );
            })}

            {/* Zero vertical line */}
            {minVal <= 0 && maxVal >= 0 && (
              <line
                x1={getX(0)}
                y1={paddingTop}
                x2={getX(0)}
                y2={paddingTop + chartH}
                className="stroke-slate-400 dark:stroke-slate-600"
                strokeWidth="1.2"
                strokeDasharray="2,2"
              />
            )}

            {/* Bars */}
            {bins.map((bin, idx) => {
              const xStart = getX(bin.binStart);
              const xEnd = getX(bin.binEnd);
              const barW = Math.max(1, xEnd - xStart - 1.5);
              const barY = getY(bin.count);
              const barH = paddingTop + chartH - barY;
              const isPositive = bin.binStart >= 0;

              return (
                <rect
                  key={idx}
                  x={xStart}
                  y={barY}
                  width={barW}
                  height={barH}
                  fill={isPositive ? '#059669' : '#e11d48'}
                  fillOpacity="0.75"
                />
              );
            })}

            {/* P25 marker */}
            {currentStats?.p25 !== null && currentStats?.p25 !== undefined && (
              <g>
                <line
                  x1={getX(currentStats.p25)}
                  y1={paddingTop}
                  x2={getX(currentStats.p25)}
                  y2={paddingTop + chartH}
                  stroke="#a855f7"
                  strokeWidth="1.2"
                  strokeDasharray="2,2"
                />
                <text x={getX(currentStats.p25)} y={paddingTop - 4} textAnchor="middle" fill="#a855f7" className="text-[9px]">
                  P25
                </text>
              </g>
            )}

            {/* P75 marker */}
            {currentStats?.p75 !== null && currentStats?.p75 !== undefined && (
              <g>
                <line
                  x1={getX(currentStats.p75)}
                  y1={paddingTop}
                  x2={getX(currentStats.p75)}
                  y2={paddingTop + chartH}
                  stroke="#a855f7"
                  strokeWidth="1.2"
                  strokeDasharray="2,2"
                />
                <text x={getX(currentStats.p75)} y={paddingTop - 4} textAnchor="middle" fill="#a855f7" className="text-[9px]">
                  P75
                </text>
              </g>
            )}

            {/* Mean marker */}
            {currentStats?.mean !== null && currentStats?.mean !== undefined && (
              <g>
                <line
                  x1={getX(currentStats.mean)}
                  y1={paddingTop}
                  x2={getX(currentStats.mean)}
                  y2={paddingTop + chartH}
                  stroke="#f59e0b"
                  strokeWidth="1.8"
                  strokeDasharray="3,2"
                />
                <text x={getX(currentStats.mean)} y={paddingTop - 4} textAnchor="middle" fill="#f59e0b" className="text-[9px] font-bold">
                  Mean
                </text>
              </g>
            )}

            {/* Median marker */}
            {currentStats?.median !== null && currentStats?.median !== undefined && (
              <g>
                <line
                  x1={getX(currentStats.median)}
                  y1={paddingTop}
                  x2={getX(currentStats.median)}
                  y2={paddingTop + chartH}
                  stroke="#0284c7"
                  strokeWidth="2"
                />
                <text x={getX(currentStats.median)} y={paddingTop - 4} textAnchor="middle" fill="#0284c7" className="text-[9px] font-bold">
                  Med
                </text>
              </g>
            )}

            {/* X axis */}
            <line
              x1={paddingLeft}
              y1={paddingTop + chartH}
              x2={width - paddingRight}
              y2={paddingTop + chartH}
              className="stroke-slate-300 dark:stroke-slate-700"
            />
            <text x={paddingLeft} y={paddingTop + chartH + 16} textAnchor="start" className="fill-slate-500 dark:fill-slate-400">
              {(minVal * 100).toFixed(2)}%
            </text>
            <text x={width - paddingRight} y={paddingTop + chartH + 16} textAnchor="end" className="fill-slate-500 dark:fill-slate-400">
              {(maxVal * 100).toFixed(2)}%
            </text>
          </svg>

          {/* Markers Legend */}
          <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-2 px-1 gap-2">
            <div className="flex flex-wrap items-center gap-3 text-[11px]">
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-1 bg-sky-500 rounded inline-block"></span>
                <span className="text-sky-700 dark:text-sky-300 font-semibold">
                  Median: {currentStats?.median !== null ? (currentStats.median * 100).toFixed(3) + '%' : 'N/A'}
                </span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-1 bg-amber-500 rounded inline-block"></span>
                <span className="text-amber-700 dark:text-amber-300 font-semibold">
                  Mean: {currentStats?.mean !== null ? (currentStats.mean * 100).toFixed(3) + '%' : 'N/A'}
                </span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2 h-1 bg-purple-500 rounded inline-block"></span>
                <span className="text-purple-700 dark:text-purple-300">
                  IQR: {currentStats?.p25 !== null ? (currentStats.p25 * 100).toFixed(2) + '%' : ''} .. {currentStats?.p75 !== null ? (currentStats.p75 * 100).toFixed(2) + '%' : ''}
                </span>
              </span>
            </div>
            <span className="font-semibold text-slate-700 dark:text-slate-300">N = {currentStats?.n ?? 0}</span>
          </div>
        </div>

        {/* Statistics Table */}
        <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded border border-slate-200 dark:border-slate-800 text-xs space-y-2">
          <div className="font-semibold text-slate-900 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800 pb-1.5 flex justify-between">
            <span>H{selectedHorizon} Horizon Stats</span>
            <span className="text-sky-600 dark:text-sky-400">N={currentStats?.n ?? 0}</span>
          </div>

          <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
            <span className="text-slate-500 dark:text-slate-400">Mean:</span>
            <span className="text-right text-slate-800 dark:text-slate-200 font-semibold">
              {currentStats?.mean !== null ? (currentStats.mean * 100).toFixed(3) + '%' : 'N/A'}
            </span>

            <span className="text-slate-500 dark:text-slate-400">Median (P50):</span>
            <span className="text-right text-sky-600 dark:text-sky-400 font-semibold">
              {currentStats?.median !== null ? (currentStats.median * 100).toFixed(3) + '%' : 'N/A'}
            </span>

            <span className="text-emerald-600 dark:text-emerald-400">Positive Rate:</span>
            <span className="text-right text-emerald-700 dark:text-emerald-300 font-bold">
              {currentStats?.positiveDirectionRate !== null
                ? (currentStats.positiveDirectionRate * 100).toFixed(1) + '%'
                : 'N/A'}
            </span>

            <span className="text-rose-600 dark:text-rose-400">Negative Rate:</span>
            <span className="text-right text-rose-700 dark:text-rose-300 font-bold">
              {currentStats?.negativeDirectionRate !== null
                ? (currentStats.negativeDirectionRate * 100).toFixed(1) + '%'
                : 'N/A'}
            </span>

            <span className="text-slate-500 dark:text-slate-400">Zero Count:</span>
            <span className="text-right text-slate-600 dark:text-slate-400">{currentStats?.zeroCount ?? 0}</span>

            <span className="text-slate-500 dark:text-slate-400">Min Return:</span>
            <span className="text-right text-slate-700 dark:text-slate-300">
              {currentStats?.min !== null ? (currentStats.min * 100).toFixed(3) + '%' : 'N/A'}
            </span>

            <span className="text-slate-500 dark:text-slate-400">Max Return:</span>
            <span className="text-right text-slate-700 dark:text-slate-300">
              {currentStats?.max !== null ? (currentStats.max * 100).toFixed(3) + '%' : 'N/A'}
            </span>

            <span className="text-slate-500 dark:text-slate-400">P10:</span>
            <span className="text-right text-slate-600 dark:text-slate-400">
              {currentStats?.p10 !== null ? (currentStats.p10 * 100).toFixed(3) + '%' : 'N/A'}
            </span>

            <span className="text-purple-600 dark:text-purple-400">P25:</span>
            <span className="text-right text-purple-700 dark:text-purple-300">
              {currentStats?.p25 !== null ? (currentStats.p25 * 100).toFixed(3) + '%' : 'N/A'}
            </span>

            <span className="text-purple-600 dark:text-purple-400">P75:</span>
            <span className="text-right text-purple-700 dark:text-purple-300">
              {currentStats?.p75 !== null ? (currentStats.p75 * 100).toFixed(3) + '%' : 'N/A'}
            </span>

            <span className="text-slate-500 dark:text-slate-400">P90:</span>
            <span className="text-right text-slate-600 dark:text-slate-400">
              {currentStats?.p90 !== null ? (currentStats.p90 * 100).toFixed(3) + '%' : 'N/A'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
