import React, { useState } from 'react';
import { Download, X } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  query: any;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, query }) => {
  const [exportType, setExportType] = useState<'observations' | 'horizons' | 'scoreMatrix' | 'horizonDistribution'>('observations');
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: exportType, format, query }),
      });

      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${exportType}_${query.currency}_${(query.eventName || 'event').replace(/\s+/g, '_')}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      onClose();
    } catch (err: any) {
      alert(`Export error: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl text-slate-900 dark:text-slate-100">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <Download className="w-5 h-5 text-sky-500" />
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">Export Empirical Research Dataset</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 text-xs font-mono">
          <div>
            <label className="text-slate-500 dark:text-slate-400 block mb-1 font-semibold">Export Target:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setExportType('observations')}
                className={`p-2.5 rounded border text-left transition-all cursor-pointer ${
                  exportType === 'observations'
                    ? 'bg-sky-50 dark:bg-sky-500/15 border-sky-400 dark:border-sky-500/50 text-sky-800 dark:text-sky-300 ring-1 ring-sky-400 dark:ring-sky-500/40'
                    : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="font-bold">Observations Table</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">Every release row + H1-H42</div>
              </button>

              <button
                onClick={() => setExportType('horizons')}
                className={`p-2.5 rounded border text-left transition-all cursor-pointer ${
                  exportType === 'horizons'
                    ? 'bg-sky-50 dark:bg-sky-500/15 border-sky-400 dark:border-sky-500/50 text-sky-800 dark:text-sky-300 ring-1 ring-sky-400 dark:ring-sky-500/40'
                    : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="font-bold">Horizon Statistics</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">H1–H42 mean, median, IQR</div>
              </button>

              <button
                onClick={() => setExportType('scoreMatrix')}
                className={`p-2.5 rounded border text-left transition-all cursor-pointer ${
                  exportType === 'scoreMatrix'
                    ? 'bg-sky-50 dark:bg-sky-500/15 border-sky-400 dark:border-sky-500/50 text-sky-800 dark:text-sky-300 ring-1 ring-sky-400 dark:ring-sky-500/40'
                    : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="font-bold">Reaction Matrix</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">5×5 S vs M Score Cells</div>
              </button>

              <button
                onClick={() => setExportType('horizonDistribution')}
                className={`p-2.5 rounded border text-left transition-all cursor-pointer ${
                  exportType === 'horizonDistribution'
                    ? 'bg-sky-50 dark:bg-sky-500/15 border-sky-400 dark:border-sky-500/50 text-sky-800 dark:text-sky-300 ring-1 ring-sky-400 dark:ring-sky-500/40'
                    : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="font-bold">Distribution Bins</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">All 42 horizons histogram</div>
              </button>
            </div>
          </div>

          <div>
            <label className="text-slate-500 dark:text-slate-400 block mb-1 font-semibold">File Format:</label>
            <div className="flex space-x-4">
              <label className="flex items-center space-x-2 cursor-pointer text-slate-700 dark:text-slate-300">
                <input
                  type="radio"
                  name="format"
                  value="csv"
                  checked={format === 'csv'}
                  onChange={() => setFormat('csv')}
                  className="text-sky-500 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 focus:ring-sky-500"
                />
                <span>CSV (Comma-Separated)</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer text-slate-700 dark:text-slate-300">
                <input
                  type="radio"
                  name="format"
                  value="json"
                  checked={format === 'json'}
                  onChange={() => setFormat('json')}
                  className="text-sky-500 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 focus:ring-sky-500"
                />
                <span>JSON (Structured Array)</span>
              </label>
            </div>
          </div>

          <div className="p-2.5 bg-slate-50 dark:bg-slate-950/80 rounded border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
            <span className="text-slate-800 dark:text-slate-200 font-semibold block">Dataset Context:</span>
            <div>Currency: <span className="font-semibold text-slate-900 dark:text-slate-200">{query.currency}</span></div>
            <div>Event: <span className="font-semibold text-slate-900 dark:text-slate-200">{query.eventName}</span></div>
            <div>Instrument: <span className="font-semibold text-slate-900 dark:text-slate-200">{query.pair || 'EURUSD'}</span></div>
          </div>
        </div>

        <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded text-xs font-mono text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            Cancel
          </button>
          <button
            disabled={isExporting}
            onClick={handleExport}
            className="px-4 py-1.5 rounded text-xs font-mono bg-sky-600 hover:bg-sky-500 text-white font-bold transition-colors disabled:opacity-50 shadow-sm cursor-pointer"
          >
            {isExporting ? 'Generating...' : 'Download File'}
          </button>
        </div>
      </div>
    </div>
  );
};
