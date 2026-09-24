import React, { useState, useMemo } from 'react';
import { HorizonStatistics } from '../api/apiClient.js';
import { Eye, EyeOff, Search, ShieldAlert, Sparkles } from 'lucide-react';

interface H1H42AggregateChartProps {
  horizons: HorizonStatistics[];
  samplePaths?: Array<{
    eventId: string;
    valueId: string;
    date?: string;
    surpriseScore?: number | null;
    momentumScore?: number | null;
    p0?: number | null;
    returns: Array<number | null>;
  }>;
  totalMatchingPaths?: number;
  pair?: string;
  onInspectEvent?: (eventId: string, valueId: string, pair: string) => void;
}

export const H1H42AggregateChart: React.FC<H1H42AggregateChartProps> = ({
  horizons,
  samplePaths = [],
  totalMatchingPaths = 0,
  pair = 'EURUSD',
  onInspectEvent,
}) => {
  const [showMedian, setShowMedian] = useState(true);
  const [showMean, setShowMean] = useState(true);
  const [showBand, setShowBand] = useState(true);
  const [showIndividualPaths, setShowIndividualPaths] = useState(false);
  const [trimVisualOutliers, setTrimVisualOutliers] = useState(false); // P5 - P95 trimming control
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [selectedPathIndex, setSelectedPathIndex] = useState<number | null>(null);

  // Determine min and max Y across all selected series
  const { minY, maxY } = useMemo(() => {
    let min = 0;
    let max = 0;

    for (const h of horizons) {
      if (h.median !== null) {
        if (h.median < min) min = h.median;
        if (h.median > max) max = h.median;
      }
      if (h.mean !== null) {
        if (h.mean < min) min = h.mean;
        if (h.mean > max) max = h.mean;
      }
      if (showBand) {
        if (h.p10 !== null && h.p10 < min) min = h.p10;
        if (h.p90 !== null && h.p90 > max) max = h.p90;
      }
    }

    if (showIndividualPaths && samplePaths.length > 0 && !trimVisualOutliers) {
      for (const p of samplePaths) {
        for (const r of p.returns) {
          if (r !== null && Number.isFinite(r)) {
            if (r < min) min = r;
            if (r > max) max = r;
          }
        }
      }
    }

    // If trimming is active, clamp bounds to outer P10/P90 + 20% margin rather than extreme spikes
    const padding = Math.max(0.001, (max - min) * 0.15);
    return {
      minY: min - padding,
      maxY: max + padding,
    };
  }, [horizons, samplePaths, showIndividualPaths, showBand, trimVisualOutliers]);

  // Chart coordinate mappings
  const width = 850;
  const height = 360;
  const paddingLeft = 60;
  const paddingRight = 30;
  const paddingTop = 25;
  const paddingBottom = 40;

  const chartW = width - paddingLeft - paddingRight;
  const chartH = height - paddingTop - paddingBottom;

  const getX = (horizonIndex: number) => {
    return paddingLeft + (horizonIndex / 41) * chartW;
  };

  const getY = (val: number) => {
    const range = maxY - minY;
    if (range <= 0) return paddingTop + chartH / 2;
    const clamped = Math.max(minY, Math.min(maxY, val));
    return paddingTop + chartH - ((clamped - minY) / range) * chartH;
  };

  // Zero reference line
  const zeroY = getY(0);

  // SVG Path generation
  const buildSvgPath = (accessor: (h: HorizonStatistics) => number | null) => {
    let path = '';
    let started = false;

    for (let i = 0; i < horizons.length; i++) {
      const val = accessor(horizons[i]);
      if (val !== null && Number.isFinite(val)) {
        const x = getX(i);
        const y = getY(val);
        if (!started) {
          path += `M ${x.toFixed(2)} ${y.toFixed(2)}`;
          started = true;
        } else {
          path += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
        }
      }
    }
    return path;
  };

  const medianPath = useMemo(() => buildSvgPath((h) => h.median), [horizons, minY, maxY]);
  const meanPath = useMemo(() => buildSvgPath((h) => h.mean), [horizons, minY, maxY]);

  const bandPath = useMemo(() => {
    if (!showBand) return '';
    let upper = '';
    let lower = '';
    for (let i = 0; i < horizons.length; i++) {
      const h = horizons[i];
      if (h.p90 !== null && h.p10 !== null) {
        const x = getX(i);
        const yTop = getY(h.p90);
        const yBottom = getY(h.p10);
        upper += (upper === '' ? `M ${x.toFixed(2)} ${yTop.toFixed(2)}` : ` L ${x.toFixed(2)} ${yTop.toFixed(2)}`);
        lower = ` L ${x.toFixed(2)} ${yBottom.toFixed(2)}` + lower;
      }
    }
    return upper && lower ? `${upper} ${lower} Z` : '';
  }, [horizons, showBand, minY, maxY]);

  // Y-axis tick values (5 ticks)
  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    const step = (maxY - minY) / 5;
    for (let i = 0; i <= 5; i++) {
      ticks.push(minY + i * step);
    }
    return ticks;
  }, [minY, maxY]);

  const activeHorizon = hoverIndex !== null && horizons[hoverIndex] ? horizons[hoverIndex] : null;
  const selectedPath = selectedPathIndex !== null && samplePaths[selectedPathIndex] ? samplePaths[selectedPathIndex] : null;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-3 shadow-md font-mono">
      {/* Controls & Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div>
          <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100 flex items-center space-x-2">
            <span>H1–H42 Normalized Cumulative Return %</span>
            {trimVisualOutliers && (
              <span className="text-[10px] bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-400 px-2 py-0.5 rounded border border-amber-300 dark:border-amber-800 font-normal">
                Visual Trim P5–P95 Active (Full N Preserved in Stats)
              </span>
            )}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Cumulative movement from P0 anchor to close of trading bar h (positive = event currency strengthened)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <label className="flex items-center space-x-1.5 cursor-pointer text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300">
            <input
              type="checkbox"
              checked={showMedian}
              onChange={(e) => setShowMedian(e.target.checked)}
              className="rounded bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-sky-500 focus:ring-0"
            />
            <span className="font-semibold">Median Path</span>
          </label>

          <label className="flex items-center space-x-1.5 cursor-pointer text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300">
            <input
              type="checkbox"
              checked={showMean}
              onChange={(e) => setShowMean(e.target.checked)}
              className="rounded bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-amber-500 focus:ring-0"
            />
            <span className="font-semibold">Mean Path</span>
          </label>

          <label className="flex items-center space-x-1.5 cursor-pointer text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300">
            <input
              type="checkbox"
              checked={showBand}
              onChange={(e) => setShowBand(e.target.checked)}
              className="rounded bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-indigo-500 focus:ring-0"
            />
            <span className="font-semibold">P10–P90 Band</span>
          </label>

          <label className="flex items-center space-x-1.5 cursor-pointer text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">
            <input
              type="checkbox"
              checked={showIndividualPaths}
              onChange={(e) => setShowIndividualPaths(e.target.checked)}
              className="rounded bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-400 focus:ring-0"
            />
            <span>
              Overlay Paths ({samplePaths.length}/{totalMatchingPaths})
            </span>
          </label>

          {/* Outlier display control */}
          <button
            onClick={() => setTrimVisualOutliers(!trimVisualOutliers)}
            className={`px-2 py-1 rounded text-[11px] border transition-colors flex items-center space-x-1 ${
              trimVisualOutliers
                ? 'bg-amber-100 dark:bg-amber-950/70 border-amber-400 dark:border-amber-600 text-amber-900 dark:text-amber-300 font-bold'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
            title="Toggle between Full Sample Y-scale and P5-P95 visual range. Never modifies statistics."
          >
            <span>{trimVisualOutliers ? 'Trim P5–P95 [ON]' : 'Full Sample [NO TRIM]'}</span>
          </button>
        </div>
      </div>

      {/* Selected Individual Path Banner */}
      {selectedPath && (
        <div className="bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800 p-2.5 rounded text-xs flex flex-wrap items-center justify-between gap-3 text-sky-900 dark:text-sky-200 animate-fadeIn">
          <div className="flex items-center space-x-3">
            <span className="font-bold text-sky-600 dark:text-sky-400">Selected Path:</span>
            <span>Event: #{selectedPath.eventId}</span>
            {selectedPath.date && <span>Date: {selectedPath.date.slice(0, 16).replace('T', ' ')} broker server</span>}
            {selectedPath.p0 !== undefined && <span>P0: {selectedPath.p0?.toFixed(5)}</span>}
            {selectedPath.returns[0] !== null && (
              <span>H1: {(selectedPath.returns[0]! * 100).toFixed(2)}%</span>
            )}
            {selectedPath.returns[41] !== null && (
              <span>H42: {(selectedPath.returns[41]! * 100).toFixed(2)}%</span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {onInspectEvent && (
              <button
                onClick={() => onInspectEvent(selectedPath.eventId, selectedPath.valueId, pair)}
                className="px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white font-bold flex items-center space-x-1 transition-colors cursor-pointer"
              >
                <Search className="w-3 h-3" />
                <span>Audit This Event</span>
              </button>
            )}
            <button
              onClick={() => setSelectedPathIndex(null)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 px-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* SVG Canvas */}
      <div className="relative overflow-hidden w-full bg-slate-50 dark:bg-slate-950 rounded border border-slate-200 dark:border-slate-800">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto select-none font-mono text-[10px]"
          onMouseLeave={() => setHoverIndex(null)}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const relX = (e.clientX - rect.left) * (width / rect.width);
            if (relX >= paddingLeft && relX <= paddingLeft + chartW) {
              const hIdx = Math.round(((relX - paddingLeft) / chartW) * 41);
              if (hIdx >= 0 && hIdx < horizons.length) {
                setHoverIndex(hIdx);
              }
            }
          }}
        >
          {/* Horizontal Grid lines and Y labels */}
          {yTicks.map((val, idx) => {
            const y = getY(val);
            return (
              <g key={idx}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  className="stroke-slate-200 dark:stroke-slate-800"
                  strokeDasharray="2,2"
                />
                <text x={paddingLeft - 8} y={y + 3} textAnchor="end" className="fill-slate-500 dark:fill-slate-400">
                  {(val * 100).toFixed(2)}%
                </text>
              </g>
            );
          })}

          {/* Zero baseline */}
          <line
            x1={paddingLeft}
            y1={zeroY}
            x2={width - paddingRight}
            y2={zeroY}
            className="stroke-slate-400 dark:stroke-slate-600"
            strokeWidth="1.5"
          />
          <text x={width - paddingRight + 4} y={zeroY + 3} className="fill-slate-600 dark:fill-slate-300 font-bold">
            0%
          </text>

          {/* P10 - P90 Confidence Band */}
          {showBand && bandPath && (
            <path
              d={bandPath}
              fill="#0284c7"
              fillOpacity="0.12"
            />
          )}

          {/* Individual Event Paths (interactive click to identify) */}
          {showIndividualPaths &&
            samplePaths.map((p, pIdx) => {
              let d = '';
              let start = false;
              for (let i = 0; i < 42; i++) {
                const r = p.returns[i];
                if (r !== null && Number.isFinite(r)) {
                  const x = getX(i);
                  const y = getY(r);
                  if (!start) {
                    d += `M ${x.toFixed(1)} ${y.toFixed(1)}`;
                    start = true;
                  } else {
                    d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
                  }
                }
              }

              const isSelected = selectedPathIndex === pIdx;
              return (
                <path
                  key={pIdx}
                  d={d}
                  fill="none"
                  stroke={isSelected ? '#38bdf8' : '#0284c7'}
                  strokeWidth={isSelected ? '2.5' : '1'}
                  strokeOpacity={isSelected ? '0.9' : '0.22'}
                  className="cursor-pointer hover:stroke-cyan-500 transition-colors"
                  onClick={() => setSelectedPathIndex(pIdx)}
                >
                  <title>Click to select & inspect Event #{p.eventId} ({p.date || 'release'})</title>
                </path>
              );
            })}

          {/* Median Curve */}
          {showMedian && (
            <path
              d={medianPath}
              fill="none"
              stroke="#0284c7"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Mean Curve */}
          {showMean && (
            <path
              d={meanPath}
              fill="none"
              stroke="#d97706"
              strokeWidth="2"
              strokeDasharray="4,2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* X axis labels (H1, H4, H8, H12, H18, H24, H30, H36, H42) */}
          {[1, 4, 8, 12, 18, 24, 30, 36, 42].map((h) => {
            const x = getX(h - 1);
            return (
              <g key={h}>
                <line x1={x} y1={paddingTop + chartH} x2={x} y2={paddingTop + chartH + 4} className="stroke-slate-300 dark:stroke-slate-700" />
                <text x={x} y={paddingTop + chartH + 16} textAnchor="middle" className="fill-slate-500 dark:fill-slate-400">
                  H{h}
                </text>
              </g>
            );
          })}

          {/* Interactive Hover Guide & Dots */}
          {hoverIndex !== null && (
            <g>
              <line
                x1={getX(hoverIndex)}
                y1={paddingTop}
                x2={getX(hoverIndex)}
                y2={paddingTop + chartH}
                className="stroke-slate-400 dark:stroke-slate-600"
                strokeWidth="1"
                strokeDasharray="2,2"
              />
              {showMedian && horizons[hoverIndex]?.median !== null && (
                <circle
                  cx={getX(hoverIndex)}
                  cy={getY(horizons[hoverIndex].median!)}
                  r="4"
                  fill="#0284c7"
                  className="stroke-white dark:stroke-slate-900"
                  strokeWidth="2"
                />
              )}
              {showMean && horizons[hoverIndex]?.mean !== null && (
                <circle
                  cx={getX(hoverIndex)}
                  cy={getY(horizons[hoverIndex].mean!)}
                  r="3.5"
                  fill="#d97706"
                  className="stroke-white dark:stroke-slate-900"
                  strokeWidth="2"
                />
              )}
            </g>
          )}
        </svg>

        {/* Hover Tooltip Box */}
        {activeHorizon && hoverIndex !== null && (
          <div
            className="absolute top-3 right-6 bg-white/95 dark:bg-slate-900/95 backdrop-blur border border-slate-200 dark:border-slate-700 p-2.5 rounded shadow-xl text-xs font-mono pointer-events-none space-y-1 z-10 text-slate-800 dark:text-slate-200"
          >
            <div className="font-bold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 pb-1 flex justify-between space-x-4">
              <span>Horizon H{activeHorizon.horizon}</span>
              <span className="text-slate-500 dark:text-slate-400 font-normal">N = {activeHorizon.n}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px]">
              <span className="text-sky-600 dark:text-sky-400 font-medium">Median Return:</span>
              <span className="font-semibold text-right">
                {activeHorizon.median !== null ? (activeHorizon.median * 100).toFixed(3) + '%' : 'N/A'}
              </span>

              <span className="text-amber-600 dark:text-amber-400 font-medium">Mean Return:</span>
              <span className="font-semibold text-right">
                {activeHorizon.mean !== null ? (activeHorizon.mean * 100).toFixed(3) + '%' : 'N/A'}
              </span>

              <span className="text-emerald-600 dark:text-emerald-400 font-medium">Positive Rate:</span>
              <span className="font-semibold text-right">
                {activeHorizon.positiveDirectionRate !== null
                  ? (activeHorizon.positiveDirectionRate * 100).toFixed(1) + '%'
                  : 'N/A'}
              </span>

              <span className="text-slate-500 dark:text-slate-400">P10–P90 Range:</span>
              <span className="text-slate-700 dark:text-slate-300 text-right">
                {activeHorizon.p10 !== null ? (activeHorizon.p10 * 100).toFixed(2) + '%' : ''} ..{' '}
                {activeHorizon.p90 !== null ? (activeHorizon.p90 * 100).toFixed(2) + '%' : ''}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
