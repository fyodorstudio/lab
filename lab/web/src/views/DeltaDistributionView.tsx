import React, { useState, useEffect } from 'react';
import {
  fetchCurrencies,
  fetchEvents,
  fetchDistribution,
  DistributionResponse,
  EventListItem,
} from '../api/apiClient.js';
import { DeltaDistributionChart } from '../components/DeltaDistributionChart.js';
import { BarChart2, Filter } from 'lucide-react';

export const DeltaDistributionView: React.FC = () => {
  const [currencies, setCurrencies] = useState<string[]>([]);
  const [selectedCurrency, setSelectedCurrency] = useState('USD');
  const [eventsList, setEventsList] = useState<EventListItem[]>([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [selectedFamily, setSelectedFamily] = useState('all');
  const [thresholdPercentile, setThresholdPercentile] = useState(75);

  const [distData, setDistData] = useState<{
    surprise: DistributionResponse;
    momentum: DistributionResponse;
  } | null>(null);
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
    fetchEvents(selectedCurrency, selectedFamily).then((events) => {
      setEventsList(events);
      if (events.length > 0) {
        const def = events.find((e) => e.eventName.includes('CPI')) || events[0];
        setSelectedEvent(def.eventName);
      }
    });
  }, [selectedCurrency, selectedFamily]);

  useEffect(() => {
    if (!selectedCurrency || !selectedEvent) return;
    setLoading(true);
    fetchDistribution(selectedCurrency, selectedEvent, thresholdPercentile)
      .then(setDistData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedCurrency, selectedEvent, thresholdPercentile]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center space-x-2">
            <BarChart2 className="w-5 h-5 text-sky-600" />
            <span>Relative Magnitude Delta Distribution</span>
          </h2>
          <p className="text-xs text-slate-500 font-mono mt-1">
            Historical dispersion of |Actual - Forecast| and |Actual - Previous| for relative threshold calibration
          </p>
        </div>
      </div>

      {/* Selectors */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 font-mono text-xs shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="text-slate-500 block mb-1 font-semibold">Currency:</label>
            <select
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium"
            >
              {currencies.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-slate-500 block mb-1 font-semibold">Family Filter:</label>
            <select
              value={selectedFamily}
              onChange={(e) => setSelectedFamily(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium"
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

          <div className="md:col-span-2">
            <label className="text-slate-500 block mb-1 font-semibold">Exact Event Name:</label>
            <select
              value={selectedEvent}
              onChange={(e) => setSelectedEvent(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-slate-800 truncate font-medium"
            >
              {eventsList.map((ev) => (
                <option key={ev.eventName} value={ev.eventName}>
                  [{ev.count}] {ev.eventName} ({ev.family})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Chart Card */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center text-slate-500 font-mono text-sm shadow-sm">
          Calculating empirical magnitude distributions...
        </div>
      ) : distData ? (
        <DeltaDistributionChart
          surprise={distData.surprise}
          momentum={distData.momentum}
          eventName={selectedEvent}
          currency={selectedCurrency}
          selectedThresholdPercentile={thresholdPercentile}
          onSelectThresholdPercentile={setThresholdPercentile}
        />
      ) : null}
    </div>
  );
};
