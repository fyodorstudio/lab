import React from 'react';

interface ScoreBadgeProps {
  score: number | null | undefined;
  type?: 'surprise' | 'momentum';
  label?: string;
  size?: 'sm' | 'md';
}

export const ScoreBadge: React.FC<ScoreBadgeProps> = ({ score, size = 'md' }) => {
  if (score === null || score === undefined) {
    return (
      <span
        className={`inline-flex items-center justify-center font-mono font-semibold rounded bg-slate-800 text-slate-400 border border-slate-700 ${
          size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-0.5 text-xs'
        }`}
      >
        N/A
      </span>
    );
  }

  let colorClass = '';
  let text = '';

  switch (score) {
    case 3:
      colorClass = 'bg-emerald-950/70 text-emerald-300 border border-emerald-700';
      text = '+3 Large';
      break;
    case 2:
      colorClass = 'bg-emerald-950/40 text-emerald-400 border border-emerald-800';
      text = '+2 Med';
      break;
    case 1:
      colorClass = 'bg-slate-800/80 text-slate-300 border border-slate-700';
      text = '+1 Inline';
      break;
    case -2:
      colorClass = 'bg-rose-950/40 text-rose-400 border border-rose-800';
      text = '-2 Med';
      break;
    case -3:
      colorClass = 'bg-rose-950/70 text-rose-300 border border-rose-700';
      text = '-3 Large';
      break;
    default:
      colorClass = 'bg-slate-800 text-slate-300 border border-slate-700';
      text = String(score);
  }

  return (
    <span
      className={`inline-flex items-center justify-center font-mono font-medium rounded ${colorClass} ${
        size === 'sm' ? 'px-1.5 py-0.2 text-[11px]' : 'px-2 py-0.5 text-xs'
      }`}
    >
      {text}
    </span>
  );
};
