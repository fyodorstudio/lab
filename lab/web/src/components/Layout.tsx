import React, { useState, useEffect } from 'react';
import {
  Activity,
  BarChart2,
  Calendar,
  Compass,
  Database,
  Download,
  Layers,
  Moon,
  Search,
  Sun,
} from 'lucide-react';
import { DisclosuresBanner } from './DisclosuresBanner.js';

export type ActiveTab =
  | 'pattern'
  | 'events'
  | 'distribution'
  | 'families'
  | 'inspect'
  | 'overview'
  | 'data-quality';

interface LayoutProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenExport?: () => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({
  activeTab,
  onSelectTab,
  onOpenExport,
  children,
}) => {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved) return saved === 'dark';
      return document.documentElement.classList.contains('dark');
    }
    return false;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const navItems = [
    { id: 'pattern', label: 'Pattern Explorer', icon: Compass },
    { id: 'events', label: 'Event Explorer & Table', icon: Calendar },
    { id: 'distribution', label: 'Delta Distribution', icon: BarChart2 },
    { id: 'families', label: 'Family Comparison', icon: Layers },
    { id: 'inspect', label: 'Raw Event Inspector', icon: Search },
    { id: 'overview', label: 'Dataset Overview', icon: Activity },
    { id: 'data-quality', label: 'Data Quality & Audit', icon: Database },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-sky-500/30 selection:text-sky-900 dark:selection:text-sky-200 transition-colors duration-150">
      {/* Top Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 shadow-xs dark:shadow-md">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded bg-sky-100 dark:bg-sky-500/10 border border-sky-300 dark:border-sky-500/30 flex items-center justify-center text-sky-700 dark:text-sky-400 font-bold font-mono">
              FX
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-wider text-slate-900 dark:text-slate-100 uppercase">
                Macro Post-Release Workstation
              </h1>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                1–42 H1 Post-News Reaction Quantitative Engine
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2.5">
            <div className="hidden sm:flex items-center space-x-2 bg-slate-100 dark:bg-slate-950/80 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-600 dark:text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse"></span>
              <span>Source loaded</span>
            </div>

            {onOpenExport && (
              <button
                onClick={onOpenExport}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-mono bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 shadow-xs transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                <span className="hidden sm:inline font-semibold">Export</span>
              </button>
            )}

            {/* Theme Toggle Button placed immediately next to Export */}
            <button
              onClick={() => setIsDark(!isDark)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-mono bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 shadow-xs transition-colors cursor-pointer"
              title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
            >
              {isDark ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline font-semibold">Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-sky-600" />
                  <span className="hidden sm:inline font-semibold">Dark</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white/95 dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 px-4">
          <div className="max-w-7xl mx-auto flex space-x-1 overflow-x-auto py-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id as ActiveTab)}
                  className={`flex items-center space-x-2 px-3 py-1.5 text-xs font-mono whitespace-nowrap rounded transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-500/30 font-bold shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Disclosures and Methodology Banner */}
      <DisclosuresBanner />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-[11px] font-mono py-4 px-4 text-center">
        Macroeconomic News &amp; FX H1 Post-Release Research Workstation • Forensic Dataset Audit Engine • Zero Lookahead
      </footer>
    </div>
  );
};
