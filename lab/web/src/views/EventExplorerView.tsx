import React, { useState, useEffect } from 'react';
import {
  fetchCurrencies,
  fetchEvents,
  fetchPairs,
  fetchObservations,
  EventListItem,
  FXPairInfo,
  EventObservation,
} from '../api/apiClient.js';
import { ScoreBadge } from '../components/ScoreBadge.js';
import { ChevronDown, ChevronRight, Calendar, CheckCircle2, AlertTriangle, Layers, Percent } from 'lucide-react';

interface EventExplorerViewProps {
  onInspectEvent: (eventId: string, valueId: string, pair: string) => void;
  selectedCurrency?: string;
  onCurrencyChange?: (c: string) => void;
  selectedEvent?: string;
  onEventChange?: (e: string) => void;
  selectedPair?: string;
  onPairChange?: (p: string) => void;
  selectedFamily?: string;
  onFamilyChange?: (f: string) => void;
}

export const EventExplorerView: React.FC<EventExplorerViewProps> = ({
  onInspectEvent,
  selectedCurrency: externalCurrency,
  onCurrencyChange,
  selectedEvent: externalEvent,
  onEventChange,
  selectedPair: externalPair,
  onPairChange,
  selectedFamily: externalFamily,
  onFamilyChange,
}) => {
  // Filter state
  const [currencies, setCurrencies] = useState<string[]>([]);
  const [internalCurrency, setInternalCurrency] = useState('USD');
  const selectedCurrency = externalCurrency || internalCurrency;

  const [eventsList, setEventsList] = useState<EventListItem[]>([]);
  const [internalEvent, setInternalEvent] = useState('');
  const selectedEvent = externalEvent !== undefined ? externalEvent : internalEvent;

  const [internalFamily, setInternalFamily] = useState('all');
  const selectedFamily = externalFamily !== undefined ? externalFamily : internalFamily;

  const [selectedImportance, setSelectedImportance] = useState('all');
  const [pairsList, setPairsList] = useState<FXPairInfo[]>([]);
  const [internalPair, setInternalPair] = useState('EURUSD');
  const selectedPair = externalPair || internalPair;

  const [selectedSurpriseScore, setSelectedSurpriseScore] = useState<any>('all');
  const [selectedMomentumScore, setSelectedMomentumScore] = useState<any>('all');
  const [requireCompleteAFP, setRequireCompleteAFP] = useState(true);
  const [simultaneousFilter, setSimultaneousFilter] = useState<'all' | 'isolated' | 'simultaneous'>('all');
  const [weekendFilter, setWeekendFilter] = useState<'all' | 'excludeFriday' | 'excludeCrossingWeekend'>('all');
  const [thresholdPercentile, setThresholdPercentile] = useState(75);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState<string>('all');

  // Table pagination and sorting
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [sortBy, setSortBy] = useState('timestamp');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [totalCount, setTotalCount] = useState(0);
  const [observations, setObservations] = useState<EventObservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Sync external family changes into internal state
  useEffect(() => {
    if (externalFamily && externalFamily !== internalFamily) {
      setInternalFamily(externalFamily);
    }
  }, [externalFamily]);

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

  const handleFamilyChange = (f: string) => {
    if (onFamilyChange) onFamilyChange(f);
    else setInternalFamily(f);
  };

  // Load events & pairs when currency or family changes
  useEffect(() => {
    if (!selectedCurrency) return;
    fetchEvents(selectedCurrency, selectedFamily).then((events) => {
      setEventsList(events);
      if (events.length > 0) {
        if (!selectedEvent || !events.some((e) => e.eventName === selectedEvent)) {
          const defaultEv = events.find((e) => e.eventName.includes('CPI')) || events[0];
          handleEventChange(defaultEv.eventName);
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
  }, [selectedCurrency, selectedFamily]);

  // Load observations when query/page/sort changes
  useEffect(() => {
    if (!selectedCurrency || !selectedEvent) return;
    setLoading(true);
    const query: any = {
      currency: selectedCurrency,
      eventName: selectedEvent,
      pair: selectedPair,
      surpriseScore: selectedSurpriseScore,
      momentumScore: selectedMomentumScore,
      importance: selectedImportance,
      thresholdPercentile,
      requireCompleteAFP,
      simultaneousFilter,
      weekendFilter,
    };

    if (startDate) query.startDate = startDate;
    if (endDate) query.endDate = endDate;
    if (dayOfWeek !== 'all') query.dayOfWeek = parseInt(dayOfWeek, 10);

    fetchObservations(query, page, pageSize, sortBy, sortDir)
      .then((res) => {
        setObservations(res.items);
        setTotalCount(res.total);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [
    selectedCurrency,
    selectedEvent,
    selectedPair,
    selectedSurpriseScore,
    selectedMomentumScore,
    selectedImportance,
    thresholdPercentile,
    requireCompleteAFP,
    simultaneousFilter,
    weekendFilter,
    startDate,
    endDate,
    dayOfWeek,
    page,
    pageSize,
    sortBy,
    sortDir,
  ]);

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDir('desc');
    }
    setPage(1);
  };

  const completeAFPInBatch = observations.filter((o) => o.hasCompleteAFP).length;
  const simultaneousInBatch = observations.filter((o) => o.simultaneousReleaseCount > 1).length;
  const weekendCrossInBatch = observations.filter((o) => o.crossesWeekend).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            <span>Event Explorer &amp; Comprehensive Observation Table</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-1">
            Sortable, filterable ledger of real macroeconomic announcements, empirical percentile ranks, and full H1–H42 returns
          </p>
        </div>
      </div>

      {/* Primary Filters Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 font-mono text-xs space-y-4 shadow-sm dark:shadow-md transition-colors duration-150">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {/* Currency */}
          <div>
            <label className="text-slate-600 dark:text-slate-400 block mb-1 text-[11px] font-semibold">Currency:</label>
            <select
              value={selectedCurrency}
              onChange={(e) => handleCurrencyChange(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-2 py-1 text-slate-800 dark:text-slate-200 font-medium"
            >
              {currencies.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Family */}
          <div>
            <label className="text-slate-600 dark:text-slate-400 block mb-1 text-[11px] font-semibold">Family:</label>
            <select
              value={selectedFamily}
              onChange={(e) => handleFamilyChange(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-2 py-1 text-slate-800 dark:text-slate-200 font-medium"
            >
              <option value="all">All Families</option>
              <option value="Inflation">Inflation</option>
              <option value="Employment">Employment</option>
              <option value="Growth">Growth</option>
              <option value="Activity">Activity</option>
              <option value="Consumption">Consumption</option>
              <option value="PMI / Surveys">PMI / Surveys</option>
              <option value="Housing">Housing</option>
              <option value="Trade">Trade</option>
              <option value="Central Bank">Central Bank</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Exact Event */}
          <div className="lg:col-span-2">
            <label className="text-slate-600 dark:text-slate-400 block mb-1 text-[11px] font-semibold">Exact Event Name:</label>
            <select
              value={selectedEvent}
              onChange={(e) => handleEventChange(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-2 py-1 text-slate-800 dark:text-slate-200 truncate font-medium"
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
            <label className="text-slate-600 dark:text-slate-400 block mb-1 text-[11px] font-semibold">FX Pair:</label>
            <select
              value={selectedPair}
              onChange={(e) => handlePairChange(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-2 py-1 text-slate-800 dark:text-slate-200 font-medium"
            >
              {pairsList.map((p) => (
                <option key={p.pair} value={p.pair}>
                  {p.pair} ({p.base === selectedCurrency ? 'Q=+1' : 'Q=-1'})
                </option>
              ))}
            </select>
          </div>

          {/* Importance */}
          <div>
            <label className="text-slate-600 dark:text-slate-400 block mb-1 text-[11px] font-semibold">Importance:</label>
            <select
              value={selectedImportance}
              onChange={(e) => setSelectedImportance(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-2 py-1 text-slate-800 dark:text-slate-200 font-medium"
            >
              <option value="all">All Importance</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Relative Threshold P */}
          <div>
            <label className="text-slate-600 dark:text-slate-400 block mb-1 text-[11px] font-semibold">Threshold:</label>
            <select
              value={thresholdPercentile}
              onChange={(e) => setThresholdPercentile(parseInt(e.target.value, 10))}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-2 py-1 text-slate-800 dark:text-slate-200 font-medium"
            >
              {[50, 60, 70, 75, 80, 85, 90, 95].map((p) => (
                <option key={p} value={p}>P{p}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Advanced Filters Grid */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {/* Surprise Score */}
          <div>
            <label className="text-slate-600 dark:text-slate-400 block mb-1 text-[11px] font-semibold">Surprise Score:</label>
            <select
              value={selectedSurpriseScore}
              onChange={(e) => setSelectedSurpriseScore(e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10))}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-2 py-1 text-slate-800 dark:text-slate-200 font-medium"
            >
              <option value="all">All Surprise</option>
              <option value="3">+3 Large</option>
              <option value="2">+2 Med</option>
              <option value="1">+1 Equal</option>
              <option value="-2">-2 Med</option>
              <option value="-3">-3 Large</option>
            </select>
          </div>

          {/* Momentum Score */}
          <div>
            <label className="text-slate-600 dark:text-slate-400 block mb-1 text-[11px] font-semibold">Momentum Score:</label>
            <select
              value={selectedMomentumScore}
              onChange={(e) => setSelectedMomentumScore(e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10))}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-2 py-1 text-slate-800 dark:text-slate-200 font-medium"
            >
              <option value="all">All Momentum</option>
              <option value="3">+3 Large</option>
              <option value="2">+2 Med</option>
              <option value="1">+1 Equal</option>
              <option value="-2">-2 Med</option>
              <option value="-3">-3 Large</option>
            </select>
          </div>

          {/* Simultaneous Filter */}
          <div>
            <label className="text-slate-600 dark:text-slate-400 block mb-1 text-[11px] font-semibold">Simultaneous Filter:</label>
            <select
              value={simultaneousFilter}
              onChange={(e) => setSimultaneousFilter(e.target.value as any)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-2 py-1 text-slate-800 dark:text-slate-200 font-medium"
            >
              <option value="all">All Releases</option>
              <option value="isolated">Isolated Only</option>
              <option value="simultaneous">Simultaneous Only</option>
            </select>
          </div>

          {/* Weekend Filter */}
          <div>
            <label className="text-slate-600 dark:text-slate-400 block mb-1 text-[11px] font-semibold">Weekend Filter:</label>
            <select
              value={weekendFilter}
              onChange={(e) => setWeekendFilter(e.target.value as any)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-2 py-1 text-slate-800 dark:text-slate-200 font-medium"
            >
              <option value="all">Include All</option>
              <option value="excludeFriday">Exclude Friday Releases</option>
              <option value="excludeCrossingWeekend">Exclude Weekend Crossing</option>
            </select>
          </div>

          {/* Date range & Day */}
          <div>
            <label className="text-slate-600 dark:text-slate-400 block mb-1 text-[11px] font-semibold">Start Date:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-2 py-1 text-slate-800 dark:text-slate-200 text-xs"
            />
          </div>

          <div>
            <label className="text-slate-600 dark:text-slate-400 block mb-1 text-[11px] font-semibold">Day of Week:</label>
            <select
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-2 py-1 text-slate-800 dark:text-slate-200 font-medium"
            >
              <option value="all">All Days</option>
              <option value="1">Monday</option>
              <option value="2">Tuesday</option>
              <option value="3">Wednesday</option>
              <option value="4">Thursday</option>
              <option value="5">Friday</option>
            </select>
          </div>

          {/* Complete A/F/P toggle */}
          <div className="flex items-end pb-1.5">
            <label className="flex items-center space-x-2 cursor-pointer text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={requireCompleteAFP}
                onChange={(e) => setRequireCompleteAFP(e.target.checked)}
                className="rounded bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-sky-600 focus:ring-sky-500"
              />
              <span className="text-[11px] font-medium">Require A/F/P</span>
            </label>
          </div>
        </div>
      </div>

      {/* KPI Badges Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-2.5 flex items-center space-x-2.5 shadow-xs dark:shadow-sm">
          <Layers className="w-4 h-4 text-sky-600 dark:text-sky-400 flex-shrink-0" />
          <div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-sans uppercase">Total Filter Matches</div>
            <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">{totalCount}</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-2.5 flex items-center space-x-2.5 shadow-xs dark:shadow-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-sans uppercase">Complete A/F/P in View</div>
            <div className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
              {completeAFPInBatch} / {observations.length}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-2.5 flex items-center space-x-2.5 shadow-xs dark:shadow-sm">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-sans uppercase">Simultaneous Releases</div>
            <div className="font-bold text-amber-600 dark:text-amber-400 text-sm">
              {simultaneousInBatch} in page
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-2.5 flex items-center space-x-2.5 shadow-xs dark:shadow-sm">
          <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
          <div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-sans uppercase">Weekend Crossing</div>
            <div className="font-bold text-indigo-600 dark:text-indigo-400 text-sm">
              {weekendCrossInBatch} in page
            </div>
          </div>
        </div>
      </div>

      {/* Observation Count & Pagination Header */}
      <div className="flex items-center justify-between text-xs font-mono px-1">
        <div className="text-slate-500 dark:text-slate-400">
          Showing <span className="font-bold text-slate-800 dark:text-slate-200">{observations.length}</span> of{' '}
          <span className="font-bold text-sky-600 dark:text-sky-400">{totalCount}</span> matching observations
        </div>
        <div className="flex items-center space-x-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="px-2.5 py-1 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 shadow-xs cursor-pointer"
          >
            Prev
          </button>
          <span className="text-slate-500 dark:text-slate-400">
            Page {page} of {Math.max(1, Math.ceil(totalCount / pageSize))}
          </span>
          <button
            disabled={page >= Math.ceil(totalCount / pageSize)}
            onClick={() => setPage(page + 1)}
            className="px-2.5 py-1 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 shadow-xs cursor-pointer"
          >
            Next
          </button>
        </div>
      </div>

      {/* Observation Table with All Requested Columns including S & M Percentiles */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto shadow-sm dark:shadow-md transition-colors duration-150">
        <table className="w-full text-xs font-mono border-collapse whitespace-nowrap">
          <thead className="bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 select-none">
            <tr>
              <th className="p-2 text-left w-8"></th>
              <th onClick={() => handleSort('timestamp')} className="p-2 text-left cursor-pointer hover:text-slate-900 dark:hover:text-slate-200">
                Date (UTC) {sortBy === 'timestamp' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th className="p-2 text-left">Cur</th>
              <th className="p-2 text-left">Event</th>
              <th className="p-2 text-left">Family</th>
              <th className="p-2 text-center">Importance</th>
              <th className="p-2 text-right">Actual</th>
              <th className="p-2 text-right">Forecast</th>
              <th className="p-2 text-right">Previous</th>
              <th className="p-2 text-right">Rev. Prev</th>
              <th onClick={() => handleSort('surpriseDelta')} className="p-2 text-right cursor-pointer hover:text-slate-900 dark:hover:text-slate-200">
                A - F {sortBy === 'surpriseDelta' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('momentumDelta')} className="p-2 text-right cursor-pointer hover:text-slate-900 dark:hover:text-slate-200">
                A - P {sortBy === 'momentumDelta' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('surpriseAbsDelta')} className="p-2 text-right cursor-pointer hover:text-slate-900 dark:hover:text-slate-200">
                |A - F| {sortBy === 'surpriseAbsDelta' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('momentumAbsDelta')} className="p-2 text-right cursor-pointer hover:text-slate-900 dark:hover:text-slate-200">
                |A - P| {sortBy === 'momentumAbsDelta' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('surprisePercentileRank')} className="p-2 text-center cursor-pointer hover:text-slate-900 dark:hover:text-slate-200">
                S Percentile {sortBy === 'surprisePercentileRank' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('momentumPercentileRank')} className="p-2 text-center cursor-pointer hover:text-slate-900 dark:hover:text-slate-200">
                M Percentile {sortBy === 'momentumPercentileRank' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th className="p-2 text-center">S Score</th>
              <th className="p-2 text-center">M Score</th>
              <th className="p-2 text-left">Pair</th>
              <th className="p-2 text-center">Base/Quote</th>
              <th className="p-2 text-right">P0 (Open)</th>
              <th className="p-2 text-right">H1</th>
              <th className="p-2 text-right">H4</th>
              <th className="p-2 text-right">H8</th>
              <th className="p-2 text-right">H12</th>
              <th className="p-2 text-right">H24</th>
              <th className="p-2 text-right">H42</th>
              <th className="p-2 text-center">Simult</th>
              <th className="p-2 text-center">Weekend</th>
              <th className="p-2 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
            {loading ? (
              <tr>
                <td colSpan={30} className="p-8 text-center text-slate-500">
                  Loading observations from raw dataset...
                </td>
              </tr>
            ) : observations.length === 0 ? (
              <tr>
                <td colSpan={30} className="p-8 text-center text-slate-500">
                  No observations match the current filter criteria.
                </td>
              </tr>
            ) : (
              observations.map((obs) => {
                const isExpanded = expandedRowId === `${obs.eventId}_${obs.valueId}`;
                const h1 = obs.returns[0];
                const h4 = obs.returns[3];
                const h8 = obs.returns[7];
                const h12 = obs.returns[11];
                const h24 = obs.returns[23];
                const h42 = obs.returns[41];

                const formatPct = (val: number | null) => {
                  if (val === null) return '—';
                  const pct = (val * 100).toFixed(2);
                  const color = val > 0 ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : val < 0 ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-slate-500 dark:text-slate-400';
                  return <span className={color}>{val > 0 ? `+${pct}%` : `${pct}%`}</span>;
                };

                return (
                  <React.Fragment key={`${obs.eventId}_${obs.valueId}`}>
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="p-2 text-center">
                        <button
                          onClick={() => setExpandedRowId(isExpanded ? null : `${obs.eventId}_${obs.valueId}`)}
                          className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                        >
                          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </button>
                      </td>
                      <td className="p-2 text-slate-700 dark:text-slate-300">{obs.date.replace('T', ' ').slice(0, 16)}</td>
                      <td className="p-2 font-bold text-sky-700 dark:text-sky-400">{obs.currency}</td>
                      <td className="p-2 text-slate-900 dark:text-slate-200 max-w-xs truncate font-medium" title={obs.eventName}>
                        {obs.eventName}
                      </td>
                      <td className="p-2 text-slate-600 dark:text-slate-400">{obs.eventFamily}</td>
                      <td className="p-2 text-center text-slate-600 dark:text-slate-400 capitalize">{obs.importance}</td>
                      <td className="p-2 text-right font-semibold text-slate-900 dark:text-slate-100">{obs.actualRaw || '—'}</td>
                      <td className="p-2 text-right text-slate-600 dark:text-slate-400">{obs.forecastRaw || '—'}</td>
                      <td className="p-2 text-right text-slate-600 dark:text-slate-400">{obs.previousRaw || '—'}</td>
                      <td className="p-2 text-right text-slate-500">{obs.revisedPreviousRaw || '—'}</td>
                      <td className="p-2 text-right text-slate-800 dark:text-slate-300">{obs.surpriseDelta !== null ? (obs.surpriseDelta >= 0 ? `+${obs.surpriseDelta.toFixed(3)}` : obs.surpriseDelta.toFixed(3)) : '—'}</td>
                      <td className="p-2 text-right text-slate-800 dark:text-slate-300">{obs.momentumDelta !== null ? (obs.momentumDelta >= 0 ? `+${obs.momentumDelta.toFixed(3)}` : obs.momentumDelta.toFixed(3)) : '—'}</td>
                      <td className="p-2 text-right text-slate-600 dark:text-slate-400">{obs.surpriseAbsDelta !== null ? obs.surpriseAbsDelta.toFixed(3) : '—'}</td>
                      <td className="p-2 text-right text-slate-600 dark:text-slate-400">{obs.momentumAbsDelta !== null ? obs.momentumAbsDelta.toFixed(3) : '—'}</td>

                      {/* Surprise Percentile Rank */}
                      <td className="p-2 text-center">
                        {obs.surprisePercentileRank !== null && obs.surprisePercentileRank !== undefined ? (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            obs.surprisePercentileRank >= 75
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700'
                          }`}>
                            P{obs.surprisePercentileRank.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Momentum Percentile Rank */}
                      <td className="p-2 text-center">
                        {obs.momentumPercentileRank !== null && obs.momentumPercentileRank !== undefined ? (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            obs.momentumPercentileRank >= 75
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700'
                          }`}>
                            P{obs.momentumPercentileRank.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="p-2 text-center">
                        <ScoreBadge score={obs.surpriseScore} size="sm" />
                      </td>
                      <td className="p-2 text-center">
                        <ScoreBadge score={obs.momentumScore} size="sm" />
                      </td>
                      <td className="p-2 text-slate-800 dark:text-slate-300 font-semibold">{obs.pair}</td>
                      <td className="p-2 text-center text-slate-600 dark:text-slate-400 uppercase text-[10px]">{obs.eventCurrencyPosition}</td>
                      <td className="p-2 text-right text-slate-700 dark:text-slate-300">{obs.p0 !== null ? obs.p0.toFixed(5) : '—'}</td>
                      <td className="p-2 text-right">{formatPct(h1)}</td>
                      <td className="p-2 text-right">{formatPct(h4)}</td>
                      <td className="p-2 text-right">{formatPct(h8)}</td>
                      <td className="p-2 text-right">{formatPct(h12)}</td>
                      <td className="p-2 text-right">{formatPct(h24)}</td>
                      <td className="p-2 text-right">{formatPct(h42)}</td>
                      <td className="p-2 text-center">
                        {obs.simultaneousReleaseCount > 1 ? (
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-400 border border-amber-300 dark:border-amber-800 text-[10px] font-bold">
                            {obs.simultaneousReleaseCount}
                          </span>
                        ) : (
                          <span className="text-slate-400">1</span>
                        )}
                      </td>
                      <td className="p-2 text-center">
                        {obs.crossesWeekend ? (
                          <span className="px-1 py-0.5 rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-800 text-[10px] font-semibold">
                            YES
                          </span>
                        ) : (
                          <span className="text-slate-400">NO</span>
                        )}
                      </td>
                      <td className="p-2 text-center">
                        <button
                          onClick={() => onInspectEvent(obs.eventId, obs.valueId, obs.pair)}
                          className="text-sky-600 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-300 underline text-[11px] font-semibold cursor-pointer"
                        >
                          Audit
                        </button>
                      </td>
                    </tr>

                    {/* Expandable Details Drawer */}
                    {isExpanded && (
                      <tr className="bg-slate-50 dark:bg-slate-950 border-y border-slate-200 dark:border-slate-800">
                        <td colSpan={30} className="p-4 space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-mono">
                            {/* Surprise Percentile & Score Audit */}
                            <div className="bg-white dark:bg-slate-900 p-3 rounded border border-slate-200 dark:border-slate-800 space-y-1.5 shadow-xs">
                              <span className="text-slate-900 dark:text-slate-200 font-bold block mb-1 border-b border-slate-200 dark:border-slate-800 pb-1 flex items-center justify-between">
                                <span>Surprise Audit (|A - F|)</span>
                                <ScoreBadge score={obs.surpriseScore} size="sm" />
                              </span>
                              <div>Raw Delta: <span className="font-semibold text-slate-800 dark:text-slate-200">{obs.surpriseDelta !== null ? (obs.surpriseDelta >= 0 ? `+${obs.surpriseDelta.toFixed(3)}` : obs.surpriseDelta.toFixed(3)) : 'N/A'}</span></div>
                              <div>Magnitude: <span className="font-semibold text-slate-800 dark:text-slate-200">{obs.surpriseAbsDelta !== null ? obs.surpriseAbsDelta.toFixed(3) : 'N/A'}</span></div>
                              <div>Percentile Rank: <span className="font-bold text-sky-600 dark:text-sky-400">{obs.surprisePercentileRank !== null && obs.surprisePercentileRank !== undefined ? `P${obs.surprisePercentileRank.toFixed(1)}` : 'N/A'}</span></div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 pt-1">
                                {obs.surprisePercentileRank != null && obs.surprisePercentileRank >= thresholdPercentile ? `Exceeds P${thresholdPercentile} threshold` : `Within P${thresholdPercentile} threshold`}
                              </div>
                            </div>

                            {/* Momentum Percentile & Score Audit */}
                            <div className="bg-white dark:bg-slate-900 p-3 rounded border border-slate-200 dark:border-slate-800 space-y-1.5 shadow-xs">
                              <span className="text-slate-900 dark:text-slate-200 font-bold block mb-1 border-b border-slate-200 dark:border-slate-800 pb-1 flex items-center justify-between">
                                <span>Momentum Audit (|A - P|)</span>
                                <ScoreBadge score={obs.momentumScore} size="sm" />
                              </span>
                              <div>Raw Delta: <span className="font-semibold text-slate-800 dark:text-slate-200">{obs.momentumDelta !== null ? (obs.momentumDelta >= 0 ? `+${obs.momentumDelta.toFixed(3)}` : obs.momentumDelta.toFixed(3)) : 'N/A'}</span></div>
                              <div>Magnitude: <span className="font-semibold text-slate-800 dark:text-slate-200">{obs.momentumAbsDelta !== null ? obs.momentumAbsDelta.toFixed(3) : 'N/A'}</span></div>
                              <div>Percentile Rank: <span className="font-bold text-sky-600 dark:text-sky-400">{obs.momentumPercentileRank !== null && obs.momentumPercentileRank !== undefined ? `P${obs.momentumPercentileRank.toFixed(1)}` : 'N/A'}</span></div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 pt-1">
                                {obs.momentumPercentileRank != null && obs.momentumPercentileRank >= thresholdPercentile ? `Exceeds P${thresholdPercentile} threshold` : `Within P${thresholdPercentile} threshold`}
                              </div>
                            </div>

                            {/* Market Candle Anchor */}
                            <div className="bg-white dark:bg-slate-900 p-3 rounded border border-slate-200 dark:border-slate-800 space-y-1 shadow-xs">
                              <span className="text-slate-900 dark:text-slate-200 font-bold block mb-1 border-b border-slate-200 dark:border-slate-800 pb-1">
                                Market Candle Anchor
                              </span>
                              <div>Instrument: {obs.pair} ({obs.eventCurrencyPosition}, Q={obs.directionMultiplier})</div>
                              <div>P0 Open Time: {obs.p0Timestamp ? new Date(obs.p0Timestamp * 1000).toISOString().replace('T', ' ').slice(0, 19) : 'N/A'}</div>
                              <div>P0 Open Price: {obs.p0 !== null ? obs.p0.toFixed(5) : 'N/A'}</div>
                              <div className="text-[10px] text-slate-500">First complete H1 candle at/after release</div>
                            </div>

                            {/* Simultaneous Releases */}
                            <div className="bg-white dark:bg-slate-900 p-3 rounded border border-slate-200 dark:border-slate-800 space-y-1 shadow-xs">
                              <span className="text-slate-900 dark:text-slate-200 font-bold block mb-1 border-b border-slate-200 dark:border-slate-800 pb-1">
                                Simultaneous Releases ({obs.simultaneousReleaseCount})
                              </span>
                              {obs.simultaneousEvents && obs.simultaneousEvents.length > 0 ? (
                                <ul className="list-disc list-inside text-[11px] text-amber-700 dark:text-amber-400 space-y-0.5">
                                  {obs.simultaneousEvents.slice(0, 3).map((name, i) => (
                                    <li key={i} className="truncate">{name}</li>
                                  ))}
                                  {obs.simultaneousEvents.length > 3 && (
                                    <li className="text-slate-500">+{obs.simultaneousEvents.length - 3} more</li>
                                  )}
                                </ul>
                              ) : (
                                <div className="text-slate-500">No other releases at this exact timestamp</div>
                              )}
                            </div>
                          </div>

                          {/* All 42 returns strip */}
                          <div className="bg-white dark:bg-slate-900 p-3 rounded border border-slate-200 dark:border-slate-800 shadow-xs">
                            <span className="text-slate-900 dark:text-slate-200 font-bold block text-xs mb-2">
                              All 42 Trading Bar Cumulative Normalized Returns:
                            </span>
                            <div className="flex flex-wrap gap-1.5 font-mono text-[10px]">
                              {obs.returns.map((r, hIdx) => {
                                const hNum = hIdx + 1;
                                const isKey = [1, 4, 8, 12, 24, 42].includes(hNum);
                                return (
                                  <div
                                    key={hNum}
                                    className={`px-1.5 py-0.5 rounded border ${
                                      isKey
                                        ? 'border-sky-400 dark:border-sky-500 bg-sky-50 dark:bg-sky-950 font-bold text-sky-800 dark:text-sky-200'
                                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300'
                                    }`}
                                  >
                                    <span className="text-slate-400">H{hNum}:</span>{' '}
                                    {r !== null ? (
                                      <span className={r > 0 ? 'text-emerald-600 dark:text-emerald-400' : r < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500'}>
                                        {(r * 100).toFixed(2)}%
                                      </span>
                                    ) : (
                                      '—'
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
