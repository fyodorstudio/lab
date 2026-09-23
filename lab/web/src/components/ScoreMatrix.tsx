import React from 'react';
import { ScoreMatrixData } from '../api/apiClient.js';

interface ScoreMatrixProps {
  scoreMatrix: ScoreMatrixData | null | undefined;
  scoreMatrices?: Record<number, ScoreMatrixData>;
  selectedHorizon: number;
  onSelectHorizon: (h: number) => void;
  selectedSurpriseScore: number | 'all' | undefined;
  selectedMomentumScore: number | 'all' | undefined;
  onSelectScores: (sScore: number, mScore: number) => void;
}

const SCORE_LABELS = [-3, -2, 1, 2, 3];

export const ScoreMatrix: React.FC<ScoreMatrixProps> = ({
  scoreMatrix,
  scoreMatrices,
  selectedHorizon,
  onSelectHorizon,
  selectedSurpriseScore,
  selectedMomentumScore,
  onSelectScores,
}) => {
  const activeMatrix = (scoreMatrices && scoreMatrices[selectedHorizon]) || scoreMatrix;
  if (!activeMatrix || !activeMatrix.matrix) return null;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-3 shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div>
          <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
            5×5 Surprise vs Momentum Reaction Matrix
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            Empirical matrix showing sample N, median return %, and positive direction rate at H{selectedHorizon}
          </p>
        </div>

        <div className="flex items-center space-x-1 font-mono text-xs">
          <span className="text-slate-500 dark:text-slate-400 mr-1">Horizon:</span>
          {[1, 4, 8, 12, 24, 42].map((h) => (
            <button
              key={h}
              onClick={() => onSelectHorizon(h)}
              className={`px-2.5 py-1 rounded font-bold transition-colors ${
                selectedHorizon === h
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700'
              }`}
            >
              H{h}
            </button>
          ))}
        </div>
      </div>

      {/* 5x5 Matrix Grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono border-collapse">
          <thead>
            <tr>
              <th className="p-2.5 border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 text-left w-28">
                Momentum ↓ \ Surprise →
              </th>
              {SCORE_LABELS.map((s) => (
                <th
                  key={s}
                  className={`p-2.5 border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 text-center font-bold ${
                    s > 1 ? 'text-emerald-600 dark:text-emerald-400' : s === 1 ? 'text-slate-700 dark:text-slate-300' : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  Surprise {s > 0 ? `+${s}` : s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeMatrix.matrix.map((row, rIdx) => {
              const mScore = SCORE_LABELS[rIdx];
              return (
                <tr key={mScore}>
                  {/* Row Header (Momentum Score) */}
                  <th
                    className={`p-2.5 border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 text-left font-bold ${
                      mScore > 1 ? 'text-emerald-600 dark:text-emerald-400' : mScore === 1 ? 'text-slate-700 dark:text-slate-300' : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    Momentum {mScore > 0 ? `+${mScore}` : mScore}
                  </th>

                  {/* 5 Matrix Cells */}
                  {row.map((cell, cIdx) => {
                    const sScore = SCORE_LABELS[cIdx];
                    const isSelected =
                      selectedSurpriseScore === sScore && selectedMomentumScore === mScore;
                    const hasObs = cell.n > 0;

                    let bgClass = 'bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800/80';
                    if (isSelected) {
                      bgClass = 'bg-sky-100 dark:bg-sky-950/80 ring-2 ring-sky-500 shadow-sm';
                    } else if (hasObs) {
                      if (cell.medianReturn !== null && cell.medianReturn > 0.0005) {
                        bgClass = 'bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50';
                      } else if (cell.medianReturn !== null && cell.medianReturn < -0.0005) {
                        bgClass = 'bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50';
                      }
                    }

                    return (
                      <td
                        key={sScore}
                        onClick={() => hasObs && onSelectScores(sScore, mScore)}
                        className={`p-2 border border-slate-200 dark:border-slate-800 transition-all text-center ${
                          hasObs ? 'cursor-pointer' : 'cursor-not-allowed opacity-30 bg-slate-100 dark:bg-slate-950'
                        } ${bgClass}`}
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">N={cell.n}</span>
                            {cell.positiveDirectionRate !== null && (
                              <span
                                className={`text-[10px] font-medium ${
                                  cell.positiveDirectionRate >= 0.5 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                                }`}
                              >
                                {(cell.positiveDirectionRate * 100).toFixed(0)}% pos
                              </span>
                            )}
                          </div>

                          <div
                            className={`text-xs font-bold ${
                              cell.medianReturn !== null
                                ? cell.medianReturn > 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : cell.medianReturn < 0
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-slate-700 dark:text-slate-300'
                                : 'text-slate-400 dark:text-slate-500'
                            }`}
                          >
                            {cell.medianReturn !== null
                              ? `${cell.medianReturn > 0 ? '+' : ''}${(cell.medianReturn * 100).toFixed(3)}%`
                              : '—'}
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400 pt-1">
        <span>Click any populated cell to drill down into that specific setup.</span>
        <span>Green = positive median return; Red = negative median return</span>
      </div>
    </div>
  );
};
