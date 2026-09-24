import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import { CalendarRepository } from '../src/data/calendarLoader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('v3.1 calendar loading', () => {
  it('preserves manifest-era metadata and separates revisions into distinct series', async () => {
    const calendarPath = path.join(__dirname, 'fixtures', 'calendar_v31_revisions.csv');
    const repository = new CalendarRepository(calendarPath, {
      schema_version: 'fyodor-mt5-research-export/3.1.0',
    });
    await repository.load();

    const rows = repository.getParsedReleases();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      eventName: 'Manufacturing PMI, final',
      eventSeriesKey: 'EUR:DE:276500001:r1',
      revision: 1,
      periodTimestamp: 1748736000,
      sourceUrl: 'https://example.test/a,b',
      actualScaledIntegerRaw: '49200000',
      timestampConvention: 'trade_server_time',
    });
    expect(rows[1].eventSeriesKey).toBe('EUR:DE:276500001:r3');

    expect(() => repository.getReleasesForEvent('EUR', rows[0].eventName, '276500001')).toThrow(/Ambiguous event_id/);
    expect(() => repository.getReleasesForEvent('EUR', rows[0].eventName)).toThrow(/Ambiguous event name/);
    expect(repository.getReleasesForEvent('EUR', rows[0].eventName, '276500001', rows[0].eventSeriesKey)).toHaveLength(1);
  });
});
