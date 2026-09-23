import { describe, it, expect, beforeAll } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { CalendarRepository } from '../src/data/calendarLoader.js';
import { CandleRepository } from '../src/data/candleLoader.js';
import { discoverFXPairs } from '../src/data/pairDiscovery.js';
import { AnalyticsService } from '../src/analytics/analyticsService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('End-to-End Analytics Service with Real Raw Data', () => {
  let analyticsService: AnalyticsService;

  beforeAll(async () => {
    const repoRoot = path.resolve(__dirname, '../..');
    const calendarPath = path.join(
      repoRoot,
      'raw_data',
      'economic calendar',
      'fyodor_calendar_master_history_repaired.csv'
    );
    const candlesDir = path.join(repoRoot, 'raw_data', 'fyodor_candles');

    const calendarRepo = new CalendarRepository(calendarPath);
    await calendarRepo.load();

    const pairsMap = discoverFXPairs(candlesDir);
    const candleRepo = new CandleRepository(candlesDir, pairsMap);

    analyticsService = new AnalyticsService(calendarRepo, candleRepo, pairsMap);
  }, 30000);

  it('retrieves overview metrics matching raw dataset', async () => {
    const overview = await analyticsService.getOverview();
    expect(overview.calendarRecordCount).toBe(126469);
    expect(overview.availableCurrencies).toContain('USD');
    expect(overview.availableCurrencies).toContain('EUR');
    expect(overview.completeAFPCount).toBe(57244);
    expect(overview.fxInstrumentCount).toBeGreaterThanOrEqual(28);
  });

  it('calculates real delta distribution for USD Core PCE Price Index m/m', async () => {
    const dist = await analyticsService.getDistribution('USD', 'Core PCE Price Index m/m', 75);
    expect(dist.surprise.allDeltasCount).toBeGreaterThan(0);
    expect(dist.surprise.stats.n).toBeGreaterThan(0);
    expect(dist.surprise.selectedThresholdValue).toBeGreaterThan(0);
    expect(dist.surprise.bins.length).toBeGreaterThan(0);
  });

  it('computes H1-H42 pattern statistics for USD CPI y/y on EURUSD', async () => {
    const pattern = await analyticsService.getPattern({
      currency: 'USD',
      eventName: 'CPI y/y',
      pair: 'EURUSD',
      thresholdPercentile: 75,
      requireCompleteAFP: true,
      simultaneousFilter: 'all',
      weekendFilter: 'all',
    });

    expect(pattern.health.sampleSize).toBeGreaterThan(0);
    expect(pattern.horizons.length).toBe(42);
    expect(pattern.horizons[0].horizon).toBe(1);
    expect(pattern.horizons[0].n).toBeGreaterThan(0);
    expect(pattern.scoreMatrix.matrix.length).toBe(5);
  });

  it('audits a specific raw event observation step-by-step', async () => {
    const audit = await analyticsService.getRawEventInspection('840010001', '115719', 'EURUSD', 75);
    expect(audit).not.toBeNull();
    expect(audit.rawRow.eventName).toBe('Core PCE Price Index m/m');
    expect(audit.alignment.p0Timestamp).toBeGreaterThan(0);
    expect(audit.alignment.p0).toBeGreaterThan(0);
    expect(audit.candleContext.length).toBeGreaterThan(0);
  });
});
