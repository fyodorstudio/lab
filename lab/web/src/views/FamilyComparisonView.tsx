import React, { useState, useEffect } from 'react';
import { fetchCurrencies, fetchPairs, fetchFamilyComparison, FXPairInfo } from '../api/apiClient.js';
import { Layers } from 'lucide-react';

interface FamilyComparisonViewProps {
  onSelectFamilyFilter?: (family: string) => void;
}

export const FamilyComparisonView: React.FC<FamilyComparisonViewProps> = ({
  onSelectFamilyFilter,
}) => {
  const [currencies, setCurrencies] = useState<string[]>([]);
  const [selectedCurrency, setSelectedCurrency] = useState('USD');
  const [pairsList, setPairsList] = useState<FXPairInfo[]>([]);
  const [selectedPair, setSelectedPair] = useState('EURUSD');

  const [familyData, setFamilyData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchCurrencies().then((list) => {
      setCurrencies(list);
      if (list.includes('USD')) setSelectedCurrency('USD');
      else if (list.length > 0) setSelectedCurrency(list[0]);
    });
  }, []);

  useEffect(() => {
    if (!selectedCurrency) return;
    fetchPairs(selectedCurrency).then((pairs) => {
      setPairsList(pairs);
      if (pairs.length > 0) setSelectedPair(pairs[0].pair);
    });
  }, [selectedCurrency]);

  useEffect(() => {
    if (!selectedCurrency) return;
    setLoading(true);
    fetchFamilyComparison(selectedCurrency, selectedPair)
      .then(setFamilyData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedCurrency, selectedPair]);

  const formatPct = (val: number | null) => {
    if (val === null) return <span className="text-slate-400 dark:text-slate-500">—</span>;
    const pct = (val * 100).toFixed(2);
    const color = val > 0 ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : val < 0 ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-slate-600 dark:text-slate-400';
    return <span className={color}>{val > 0 ? `+${pct}%` : `${pct}%`}</span>;
  };

  const formatPosRate = (val: number | null) => {
    if (val === null) return <span className="text-slate-400 dark:text-slate-500">—</span>;
    const pct = (val * 100).toFixed(1);
    const color = val >= 0.5 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-rose-600 dark:text-rose-400 font-bold';
    return <span className={color}>{pct}%</span>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
          <Layers className="w-5 h-5 text-sky-500" />
          <span>Macroeconomic Event Family Cross-Sectional Comparison</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-1">
          Descriptive comparison of post-release horizon returns across 10 economic families (Not a strategy ranking)
        </p>
      </div>

      {/* Selectors */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 font-mono text-xs flex flex-wrap gap-4 shadow-sm">
        <div>
          <label className="text-slate-500 dark:text-slate-400 block mb-1 font-semibold">Currency:</label>
          <select
            value={selectedCurrency}
            onChange={(e) => setSelectedCurrency(e.target.value)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-3 py-1.5 text-slate-800 dark:text-slate-200 font-medium"
          >
            {currencies.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-slate-500 dark:text-slate-400 block mb-1 font-semibold">Instrument Pair:</label>
          <select
            value={selectedPair}
            onChange={(e) => setSelectedPair(e.target.value)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-3 py-1.5 text-slate-800 dark:text-slate-200 font-medium"
          >
            {pairsList.map((p) => (
              <option key={p.pair} value={p.pair}>
                {p.pair} ({p.base === selectedCurrency ? 'Q=+1' : 'Q=-1'})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Family Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto shadow-sm font-mono text-xs">
        <table className="w-full border-collapse whitespace-nowrap">
          <thead className="bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="p-3 text-left">Event Family</th>
              <th className="p-3 text-right">Sample N</th>
              <th className="p-3 text-right">Median H1</th>
              <th className="p-3 text-right">Median H4</th>
              <th className="p-3 text-right">Median H8</th>
              <th className="p-3 text-right">Median H12</th>
              <th className="p-3 text-right">Median H24</th>
              <th className="p-3 text-right">Median H42</th>
              <th className="p-3 text-right">Pos Rate H12</th>
              <th className="p-3 text-right">Pos Rate H24</th>
              <th className="p-3 text-right">Pos Rate H42</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
            {loading ? (
              <tr>
                <td colSpan={11} className="p-8 text-center text-slate-400">
                  Aggregating family returns across {selectedPair}...
                </td>
              </tr>
            ) : familyData.length === 0 ? (
              <tr>
                <td colSpan={11} className="p-8 text-center text-slate-400">
                  No data available.
                </td>
              </tr>
            ) : (
              familyData.map((row) => (
                <tr
                  key={row.family}
                  onClick={() => onSelectFamilyFilter && onSelectFamilyFilter(row.family)}
                  className="hover:bg-slate-100/60 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                >
                  <td className="p-3 font-bold text-slate-900 dark:text-slate-200">{row.family}</td>
                  <td className="p-3 text-right text-slate-800 dark:text-slate-300 font-semibold">{row.n}</td>
                  <td className="p-3 text-right">{formatPct(row.medianH1)}</td>
                  <td className="p-3 text-right">{formatPct(row.medianH4)}</td>
                  <td className="p-3 text-right">{formatPct(row.medianH8)}</td>
                  <td className="p-3 text-right">{formatPct(row.medianH12)}</td>
                  <td className="p-3 text-right">{formatPct(row.medianH24)}</td>
                  <td className="p-3 text-right">{formatPct(row.medianH42)}</td>
                  <td className="p-3 text-right">{formatPosRate(row.positiveH12)}</td>
                  <td className="p-3 text-right">{formatPosRate(row.positiveH24)}</td>
                  <td className="p-3 text-right">{formatPosRate(row.positiveH42)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
