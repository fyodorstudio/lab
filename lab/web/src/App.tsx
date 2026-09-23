import React, { useState } from 'react';
import { Layout, ActiveTab } from './components/Layout.js';
import { PatternExplorerView } from './views/PatternExplorerView.js';
import { EventExplorerView } from './views/EventExplorerView.js';
import { DeltaDistributionView } from './views/DeltaDistributionView.js';
import { FamilyComparisonView } from './views/FamilyComparisonView.js';
import { RawEventInspectorView } from './views/RawEventInspectorView.js';
import { OverviewView } from './views/OverviewView.js';
import { DataQualityView } from './views/DataQualityView.js';
import { ExportModal } from './components/ExportModal.js';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('pattern');
  const [selectedCurrency, setSelectedCurrency] = useState('USD');
  const [selectedEvent, setSelectedEvent] = useState('CPI m/m');
  const [selectedPair, setSelectedPair] = useState('EURUSD');
  const [selectedFamily, setSelectedFamily] = useState('all');

  const [inspectTarget, setInspectTarget] = useState<{
    eventId: string;
    valueId: string;
    pair: string;
  }>({
    eventId: '840010001',
    valueId: '115719',
    pair: 'EURUSD',
  });
  const [isExportOpen, setIsExportOpen] = useState(false);

  const handleInspectEvent = (eventId: string, valueId: string, pair: string) => {
    setInspectTarget({ eventId, valueId, pair });
    setActiveTab('inspect');
  };

  return (
    <Layout
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      onOpenExport={() => setIsExportOpen(true)}
    >
      {activeTab === 'pattern' && (
        <PatternExplorerView
          onInspectEvent={handleInspectEvent}
          selectedCurrency={selectedCurrency}
          onCurrencyChange={setSelectedCurrency}
          selectedEvent={selectedEvent}
          onEventChange={setSelectedEvent}
          selectedPair={selectedPair}
          onPairChange={setSelectedPair}
        />
      )}

      {activeTab === 'events' && (
        <EventExplorerView
          onInspectEvent={handleInspectEvent}
          selectedCurrency={selectedCurrency}
          onCurrencyChange={setSelectedCurrency}
          selectedEvent={selectedEvent}
          onEventChange={setSelectedEvent}
          selectedPair={selectedPair}
          onPairChange={setSelectedPair}
          selectedFamily={selectedFamily}
          onFamilyChange={setSelectedFamily}
        />
      )}

      {activeTab === 'distribution' && <DeltaDistributionView />}

      {activeTab === 'families' && (
        <FamilyComparisonView
          onSelectFamilyFilter={(family) => {
            setSelectedFamily(family);
            setActiveTab('events');
          }}
        />
      )}

      {activeTab === 'inspect' && (
        <RawEventInspectorView
          initialEventId={inspectTarget.eventId}
          initialValueId={inspectTarget.valueId}
          initialPair={inspectTarget.pair}
        />
      )}

      {activeTab === 'overview' && <OverviewView />}

      {activeTab === 'data-quality' && <DataQualityView />}

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        query={{
          currency: selectedCurrency,
          eventName: selectedEvent || 'CPI m/m',
          pair: selectedPair,
        }}
      />
    </Layout>
  );
};
