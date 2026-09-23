import { describe, it, expect } from 'vitest';
import { detectSimultaneousReleases } from '../src/analytics/simultaneousDetector.js';
import { CalendarRawRow } from '../src/shared/types.js';

describe('Simultaneous Release Detector', () => {
  it('groups multiple events occurring at the exact same timestamp for the same currency', () => {
    const rows: CalendarRawRow[] = [
      {
        eventId: '1',
        valueId: '10',
        timestamp: 1600000000,
        currency: 'USD',
        countryCode: 'US',
        eventName: 'Core PCE Price Index m/m',
        importance: 'high',
        actualRaw: '0.2',
        forecastRaw: '0.1',
        previousRaw: '0.1',
        revisedPreviousRaw: null,
      },
      {
        eventId: '2',
        valueId: '11',
        timestamp: 1600000000,
        currency: 'USD',
        countryCode: 'US',
        eventName: 'Personal Income m/m',
        importance: 'medium',
        actualRaw: '0.4',
        forecastRaw: '0.3',
        previousRaw: '0.2',
        revisedPreviousRaw: null,
      },
      {
        eventId: '3',
        valueId: '12',
        timestamp: 1600000000,
        currency: 'USD',
        countryCode: 'US',
        eventName: 'Personal Spending m/m',
        importance: 'medium',
        actualRaw: '0.3',
        forecastRaw: '0.2',
        previousRaw: '0.1',
        revisedPreviousRaw: null,
      },
      // Different timestamp
      {
        eventId: '4',
        valueId: '13',
        timestamp: 1600003600,
        currency: 'USD',
        countryCode: 'US',
        eventName: 'ISM Manufacturing',
        importance: 'high',
        actualRaw: '55.0',
        forecastRaw: '54.0',
        previousRaw: '53.0',
        revisedPreviousRaw: null,
      },
      // Same timestamp but different currency (EUR)
      {
        eventId: '5',
        valueId: '14',
        timestamp: 1600000000,
        currency: 'EUR',
        countryCode: 'DE',
        eventName: 'German CPI m/m',
        importance: 'high',
        actualRaw: '0.1',
        forecastRaw: '0.1',
        previousRaw: '0.0',
        revisedPreviousRaw: null,
      },
    ];

    const clusters = detectSimultaneousReleases(rows);

    const usdCluster1 = clusters.get('USD_1600000000');
    expect(usdCluster1).toBeDefined();
    expect(usdCluster1?.count).toBe(3);
    expect(usdCluster1?.events.map((e) => e.eventName)).toEqual([
      'Core PCE Price Index m/m',
      'Personal Income m/m',
      'Personal Spending m/m',
    ]);

    const usdCluster2 = clusters.get('USD_1600003600');
    expect(usdCluster2).toBeDefined();
    expect(usdCluster2?.count).toBe(1);

    const eurCluster = clusters.get('EUR_1600000000');
    expect(eurCluster).toBeDefined();
    expect(eurCluster?.count).toBe(1);
  });
});
