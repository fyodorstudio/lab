import React, { useState } from 'react';
import { HorizonStatistics } from '../api/apiClient.js';

interface PositiveDirectionChartProps {
  horizons: HorizonStatistics[];
}

export const PositiveDirectionChart: React.FC<PositiveDirectionChartProps> = ({ horizons }) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const width = 850;
  const height = 240;
  const paddingLeft = 60;
  const paddingRight = 40;
  const paddingTop = 20;
  const paddingBottom = 35;

  const chartW = width - paddingLeft - paddingRight;
  const chartH = height - paddingTop - paddingBottom;

  const getX = (horizonIndex: number) => {
    return paddingLeft + (horizonIndex / 41) * chartW;
  };

  const getY = (rate: number) => {
    // Range is 0.0 to 1.0 (0% to 100%)
    return paddingTop + chartH - rate * chartH;
  };

  const line50Y = getY(0.5);

  let pathD = '';
  let started = false;

  for (let i = 0; i < horizons.length; i++) {
    const rate = horizons[i].positiveDirectionRate;
    if (rate !== null && Number.isFinite(rate)) {
      const x = getX(i);
      const y = getY(rate);
      if (!started) {
        pathD += `M ${x.toFixed(2)} ${y.toFixed(2)}`;
        started = true;
      } else {
        pathD += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
      }
    }
  }

  const activeHorizon = hoverIndex !== null && horizons[hoverIndex] ? horizons[hoverIndex] : null;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-2 shadow-sm font-mono">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
        <div>
          <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
            Positive Direction Rate % (H1–H42)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            Proportion of observations where normalizedReturn &gt; 0 (Descriptive reaction rate, not a trading win rate)
          </p>
        </div>
      </div>

      <div className="relative overflow-hidden w-full bg-slate-50 dark:bg-slate-950/70 rounded border border-slate-200 dark:border-slate-800">
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
          {/* Y-axis gridlines: 0%, 25%, 50%, 75%, 100% */}
          {[0, 0.25, 0.5, 0.75, 1.0].map((rate) => {
            const y = getY(rate);
            const is50 = rate === 0.5;
            return (
              <g key={rate}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke={is50 ? '#0284c7' : undefined}
                  className={is50 ? undefined : 'stroke-slate-200 dark:stroke-slate-800'}
                  strokeDasharray={is50 ? '3,3' : '2,2'}
                  strokeWidth={is50 ? 1.5 : 1}
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 3}
                  textAnchor="end"
                  className={is50 ? 'fill-sky-600 dark:fill-sky-400 font-bold' : 'fill-slate-500 dark:fill-slate-400'}
                >
                  {(rate * 100).toFixed(0)}%
                </text>
              </g>
            );
          })}

          {/* 50% baseline label */}
          <text x={width - paddingRight + 4} y={line50Y + 3} className="fill-sky-600 dark:fill-sky-400 font-bold">
            50%
          </text>

          {/* Rate Curve */}
          <path
            d={pathD}
            fill="none"
            stroke="#059669"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* X-axis ticks */}
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

          {/* Hover indicator */}
          {hoverIndex !== null && activeHorizon && activeHorizon.positiveDirectionRate !== null && (
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
              <circle
                cx={getX(hoverIndex)}
                cy={getY(activeHorizon.positiveDirectionRate)}
                r="4.5"
                fill="#059669"
                className="stroke-white dark:stroke-slate-900"
                strokeWidth="2"
              />
            </g>
          )}
        </svg>

        {/* Hover Tooltip Box */}
        {activeHorizon && hoverIndex !== null && activeHorizon.positiveDirectionRate !== null && (
          <div className="absolute top-2 right-6 bg-white/95 dark:bg-slate-900/95 backdrop-blur border border-slate-200 dark:border-slate-700 p-2.5 rounded shadow-xl text-xs font-mono pointer-events-none z-10 space-y-1 text-slate-800 dark:text-slate-200">
            <div className="font-bold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 pb-1">
              Horizon H{activeHorizon.horizon} (N = {activeHorizon.n})
            </div>
            <div className="text-emerald-600 dark:text-emerald-400 font-semibold">
              Positive Direction Rate: {(activeHorizon.positiveDirectionRate * 100).toFixed(2)}%
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Positive: {activeHorizon.positiveDirectionCount} | Negative: {activeHorizon.negativeDirectionCount} | Zero: {activeHorizon.zeroCount}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
