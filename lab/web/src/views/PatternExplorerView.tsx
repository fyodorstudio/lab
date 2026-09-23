import React, { useState, useEffect } from 'react';
import {
  fetchCurrencies,
  fetchEvents,
  fetchPairs,
  fetchPattern,
  EventListItem,
  FXPairInfo,
  PatternResponse,
} from '../api/apiClient.js';
import { ResearchHealthPanel } from '../components/ResearchHealthPanel.js';
import { H1H42AggregateChart } from '../components/H1H42AggregateChart.js';
import { PositiveDirectionChart } from '../components/PositiveDirectionChart.js';
import { HorizonDistributionChart } from '../components/HorizonDistributionChart.js';
import { ScoreMatrix } from '../components/ScoreMatrix.js';
import { Compass, Filter, RefreshCw, SlidersHorizontal, ChevronDown, ChevronUp } from 'lucide-react';

interface PatternExplorerViewProps {
  onInspectEvent: (eventId: string, valueId: string, pair: string) => void;
  selectedCurrency?: string;
  onCurrencyChange?: (c: string) => void;
  selectedEvent?: string;
  onEventChange?: (e: string) => void;
  selectedPair?: string;
  onPairChange?: (p: string) => void;
  onPatternLoaded?: (pattern: PatternResponse) => void;
}

export const PatternExplorerView: React.FC<PatternExplorerViewProps> = ({
  onInspectEvent,
  selectedCurrency: externalCurrency,
  onCurrencyChange,
  selectedEvent: externalEvent,
  onEventChange,
  selectedPair: externalPair,
  onPairChange,
  onPatternLoaded,
}) => {
  const [currencies, setCurrencies] = useState<string[]>([]);
  const [internalCurrency, setInternalCurrency] = useState('USD');
  const selectedCurrency = externalCurrency || internalCurrency;

  const [eventsList, setEventsList] = useState<EventListItem[]>([]);
  const [internalEvent, setInternalEvent] = useState('');
  const selectedEvent = externalEvent !== undefined ? externalEvent : internalEvent;

  const [pairsList, setPairsList] = useState<FXPairInfo[]>([]);
  const [internalPair, setInternalPair] = useState('EURUSD');
  const selectedPair = externalPair || internalPair;

  const [selectedSurpriseScore, setSelectedSurpriseScore] = useState<any>('all');
  const [selectedMomentumScore, setSelectedMomentumScore] = useState<any>('all');
  const [thresholdPercentile, setThresholdPercentile] = useState(75);
  const [selectedHorizon, setSelectedHorizon] = useState(1);

  // Advanced timing & filtering controls
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState<string>('all');
  const [simultaneousFilter, setSimultaneousFilter] = useState<'all' | 'isolated' | 'simultaneous'>('all');
  const [weekendFilter, setWeekendFilter] = useState<'all' | 'excludeFriday' | 'excludeCrossingWeekend'>('all');
  const [requireCompleteAFP, setRequireCompleteAFP] = useState(true);

  const [patternData, setPatternData] = useState<PatternResponse | null>(null);
  const [loading, setLoading] = useState(false);

  // Load currencies on mount
  useEffect(() => {
    fetchCurrencies().then((list) => {
      setCurrencies(list);
      if (!externalCurrency) {
        if (list.includes('USD')) setInternalCurrency('USD');
        else if (list.length > 0) setInternalCurrency(list[0]);
      }
    });
  }, []);

  const handleCurrencyChange = (c: string) => {
    if (onCurrencyChange) onCurrencyChange(c);
    else setInternalCurrency(c);
  };

  const handleEventChange = (e: string) => {
    if (onEventChange) onEventChange(e);
    else setInternalEvent(e);
  };

  const handlePairChange = (p: string) => {
    if (onPairChange) onPairChange(p);
    else setInternalPair(p);
  };

  // Load events and pairs when currency changes
  useEffect(() => {
    if (!selectedCurrency) return;
    fetchEvents(selectedCurrency).then((events) => {
      setEventsList(events);
      if (events.length > 0) {
        if (!selectedEvent || !events.some((e) => e.eventName === selectedEvent)) {
          const def = events.find((e) => e.eventName.includes('CPI')) || events[0];
          handleEventChange(def.eventName);
        }
      }
    });

    fetchPairs(selectedCurrency).then((pairs) => {
      setPairsList(pairs);
      if (pairs.length > 0) {
        if (!selectedPair || !pairs.some((p) => p.pair === selectedPair)) {
          handlePairChange(pairs[0].pair);
        }
      }
    });
  }, [selectedCurrency]);

  // Load pattern data when parameters change
  const loadPattern = () => {
    if (!selectedCurrency || !selectedEvent) return;
    setLoading(true);
    const query: any = {
      currency: selectedCurrency,
      eventName: selectedEvent,
      pair: selectedPair,
      horizon: selectedHorizon,
      surpriseScore: selectedSurpriseScore,
      momentumScore: selectedMomentumScore,
      thresholdPercentile,
      requireCompleteAFP,
      simultaneousFilter,
      weekendFilter,
    };

    if (startDate) query.startDate = startDate;
    if (endDate) query.endDate = endDate;
    if (dayOfWeek !== 'all') query.dayOfWeek = parseInt(dayOfWeek, 10);

    fetchPattern(query)
      .then((data) => {
        setPatternData(data);
        if (onPatternLoaded) onPatternLoaded(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPattern();
  }, [
    selectedCurrency,
    selectedEvent,
    selectedPair,
    selectedSurpriseScore,
    selectedMomentumScore,
    thresholdPercentile,
    startDate,
    endDate,
    dayOfWeek,
    simultaneousFilter,
    weekendFilter,
    requireCompleteAFP,
  ]);

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
            <Compass className="w-5 h-5 text-sky-500" />
            <span>Pattern Explorer: Post-Release Currency Behavior (H1–H42)</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-1">
            Investigating market reaction paths following specific Actual-vs-Forecast and Actual-vs-Previous release outcomes
          </p>
        </div>

        <button
          onClick={loadPattern}
          disabled={loading}
          className="px-3 py-1.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 font-mono text-xs flex items-center space-x-1.5 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Recalculate</span>
        </button>
      </div>

      {/* Filter Control Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 font-mono text-xs space-y-4 shadow-md">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
          <div className="flex items-center space-x-2 text-slate-900 dark:text-slate-300 font-bold">
            <Filter className="w-4 h-4 text-sky-500" />
            <span>Setup & Filter Configuration</span>
          </div>

          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="flex items-center space-x-1 text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 font-medium cursor-pointer"
          >
            <span>Advanced Filters</span>
            {showAdvancedFilters ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Currency */}
          <div>
            <label className="text-slate-500 dark:text-slate-400 block mb-1 font-semibold">Currency:</label>
            <select
              value={selectedCurrency}
              onChange={(e) => handleCurrencyChange(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-2 py-1.5 text-slate-800 dark:text-slate-200 font-medium"
            >
              {currencies.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Exact Event */}
          <div className="lg:col-span-2">
            <label className="text-slate-500 dark:text-slate-400 block mb-1 font-semibold">Exact Event Name:</label>
            <select
              value={selectedEvent}
              onChange={(e) => handleEventChange(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-2 py-1.5 text-slate-800 dark:text-slate-200 truncate font-medium"
            >
              {eventsList.map((ev) => (
                <option key={ev.eventName} value={ev.eventName}>
                  [{ev.count}] {ev.eventName}
                </option>
              ))}
            </select>
          </div>

          {/* FX Pair */}
          <div>
            <label className="text-slate-500 dark:text-slate-400 block mb-1 font-semibold">FX Pair:</label>
            <select
              value={selectedPair}
              onChange={(e) => handlePairChange(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-2 py-1.5 text-slate-800 dark:text-slate-200 font-medium"
            >
              {pairsList.map((p) => (
                <option key={p.pair} value={p.pair}>
                  {p.pair} ({p.base === selectedCurrency ? 'Q=+1' : 'Q=-1'})
                </option>
              ))}
            </select>
          </div>

          {/* Surprise Score Filter */}
          <div>
            <label className="text-slate-500 dark:text-slate-400 block mb-1 font-semibold">Surprise Score:</label>
            <select
              value={selectedSurpriseScore}
              onChange={(e) => setSelectedSurpriseScore(e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10))}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-2 py-1.5 text-slate-800 dark:text-slate-200 font-medium"
            >
              <option value="all">All (Any Surprise)</option>
              <option value="3">+3 Large Surprise</option>
              <option value="2">+2 Med Surprise</option>
              <option value="1">+1 Equal / In-Line</option>
              <option value="-2">-2 Med Surprise</option>
              <option value="-3">-3 Large Surprise</option>
            </select>
          </div>

          {/* Momentum Score Filter */}
          <div>
            <label className="text-slate-500 dark:text-slate-400 block mb-1 font-semibold">Momentum Score:</label>
            <select
              value={selectedMomentumScore}
              onChange={(e) => setSelectedMomentumScore(e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10))}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-2 py-1.5 text-slate-800 dark:text-slate-200 font-medium"
            >
              <option value="all">All (Any Momentum)</option>
              <option value="3">+3 Large Momentum</option>
              <option value="2">+2 Med Momentum</option>
              <option value="1">+1 Equal / Unchanged</option>
              <option value="-2">-2 Med Momentum</option>
              <option value="-3">-3 Large Momentum</option>
            </select>
          </div>
        </div>

        {/* Advanced Filters Collapsible Row */}
        {showAdvancedFilters && (
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 bg-slate-50 dark:bg-slate-950/60 p-3 rounded">
            <div>
              <label className="text-slate-500 dark:text-slate-400 block mb-1 font-medium">Start Date:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded px-2 py-1 text-slate-800 dark:text-slate-200"
              />
            </div>

            <div>
              <label className="text-slate-500 dark:text-slate-400 block mb-1 font-medium">End Date:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded px-2 py-1 text-slate-800 dark:text-slate-200"
              />
            </div>

            <div>
              <label className="text-slate-500 dark:text-slate-400 block mb-1 font-medium">Day of Week:</label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded px-2 py-1 text-slate-800 dark:text-slate-200"
              >
                <option value="all">All Days</option>
                <option value="1">Monday</option>
                <option value="2">Tuesday</option>
                <option value="3">Wednesday</option>
                <option value="4">Thursday</option>
                <option value="5">Friday</option>
              </select>
            </div>

            <div>
              <label className="text-slate-500 dark:text-slate-400 block mb-1 font-medium">Simultaneous Events:</label>
              <select
                value={simultaneousFilter}
                onChange={(e) => setSimultaneousFilter(e.target.value as any)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded px-2 py-1 text-slate-800 dark:text-slate-200"
              >
                <option value="all">Include All</option>
                <option value="isolated">Isolated Only (No Simultaneous)</option>
                <option value="simultaneous">Simultaneous Only</option>
              </select>
            </div>

            <div>
              <label className="text-slate-500 dark:text-slate-400 block mb-1 font-medium">Weekend Crossing:</label>
              <select
                value={weekendFilter}
                onChange={(e) => setWeekendFilter(e.target.value as any)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded px-2 py-1 text-slate-800 dark:text-slate-200"
              >
                <option value="all">Include All</option>
                <option value="excludeFriday">Exclude Friday Releases</option>
                <option value="excludeCrossingWeekend">Exclude Weekend Crossing</option>
              </select>
            </div>

            <div className="col-span-full pt-1 flex items-center justify-between">
              <label className="flex items-center space-x-2 cursor-pointer text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={requireCompleteAFP}
                  onChange={(e) => setRequireCompleteAFP(e.target.checked)}
                  className="rounded bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-sky-500 focus:ring-sky-500"
                />
                <span className="font-medium">Strict Complete A/F/P (Require Actual, Forecast, & Previous)</span>
              </label>

              {(startDate || endDate || dayOfWeek !== 'all' || simultaneousFilter !== 'all' || weekendFilter !== 'all' || !requireCompleteAFP) && (
                <button
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                    setDayOfWeek('all');
                    setSimultaneousFilter('all');
                    setWeekendFilter('all');
                    setRequireCompleteAFP(true);
                  }}
                  className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 underline text-xs cursor-pointer"
                >
                  Reset Advanced Filters
                </button>
              )}
            </div>
          </div>
        )}

        {/* Magnitude Threshold presets */}
        <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className="text-slate-500 dark:text-slate-400 font-semibold">Relative Magnitude Threshold:</span>
            <div className="flex space-x-1">
              {[50, 60, 70, 75, 80, 85, 90, 95].map((p) => (
                <button
                  key={p}
                  onClick={() => setThresholdPercentile(p)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                    thresholdPercentile === p
                      ? 'bg-rose-600 text-white font-bold shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700'
                  }`}
                >
                  P{p}
                </button>
              ))}
            </div>
          </div>
          <span className="text-slate-500 dark:text-slate-400 text-[11px]">
            Default: 75th percentile of nonzero historical deltas
          </span>
        </div>
      </div>

      {/* Forensic Research Health Panel */}
      <ResearchHealthPanel health={patternData?.health} />

      {/* Main Aggregate Charts */}
      {loading ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-16 text-center text-slate-500 dark:text-slate-400 font-mono text-sm shadow-md">
          Calculating empirical H1–H42 paths...
        </div>
      ) : patternData ? (
        <>
          {/* H1-H42 Cumulative Returns Line Chart */}
          <H1H42AggregateChart
            horizons={patternData.horizons}
            samplePaths={patternData.samplePaths}
            totalMatchingPaths={patternData.totalMatchingPaths}
            pair={selectedPair}
            onInspectEvent={onInspectEvent}
          />

          {/* Positive Direction Rate Line Chart */}
          <PositiveDirectionChart horizons={patternData.horizons} />

          {/* Bottom Grid: 5x5 Matrix + Horizon Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 5x5 Score Matrix */}
            <ScoreMatrix
              scoreMatrix={patternData.scoreMatrix}
              scoreMatrices={patternData.scoreMatrices}
              selectedHorizon={selectedHorizon}
              onSelectHorizon={setSelectedHorizon}
              selectedSurpriseScore={selectedSurpriseScore}
              selectedMomentumScore={selectedMomentumScore}
              onSelectScores={(s, m) => {
                setSelectedSurpriseScore(s);
                setSelectedMomentumScore(m);
              }}
            />

            {/* Horizon Return Distribution Histogram */}
            <HorizonDistributionChart
              horizons={patternData.horizons}
              selectedHorizon={selectedHorizon}
              onSelectHorizon={setSelectedHorizon}
              samplePaths={patternData.samplePaths}
              horizonBins={patternData.horizonBins}
            />
          </div>
        </>
      ) : null}
    </div>
  );
};
