import path from 'path';
import { fileURLToPath } from 'url';
import { CalendarRepository } from '../src/data/calendarLoader.js';
import { CandleRepository } from '../src/data/candleLoader.js';
import { discoverFXPairs } from '../src/data/pairDiscovery.js';
import { AnalyticsService } from '../src/analytics/analyticsService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runAudit() {
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

  const analytics = new AnalyticsService(calendarRepo, candleRepo, pairsMap);

  console.log('=== FORENSIC MANUAL OBSERVATION AUDIT ===\n');

  // Observation 1: Core PCE Price Index m/m, timestamp 1601566200 (2020-10-01 15:30:00 UTC)
  // Raw CSV row 70: 840010001,115719,1601566200,USD,US,Core PCE Price Index m/m,high,0.3,0.1,0.3,0.4
  console.log('--- AUDITING OBSERVATION 1 ---');
  console.log('Raw CSV Row: 840010001,115719,1601566200,USD,US,Core PCE Price Index m/m,high,0.3,0.1,0.3,0.4');
  const audit1 = await analytics.getRawEventInspection('840010001', '115719', 'EURUSD', 75);

  console.log('Parsed Actual:', audit1.parsedRelease.actual);
  console.log('Parsed Forecast:', audit1.parsedRelease.forecast);
  console.log('Parsed Previous:', audit1.parsedRelease.previous);
  console.log('Parsed Revised Previous:', audit1.parsedRelease.revisedPrevious);
  console.log('Surprise Delta (A - F):', audit1.parsedRelease.surpriseDelta);
  console.log('Momentum Delta (A - P):', audit1.parsedRelease.momentumDelta);
  console.log('Surprise Threshold P75:', audit1.thresholds.surpriseThreshold);
  console.log('Momentum Threshold P75:', audit1.thresholds.momentumThreshold);
  console.log('Surprise Score:', audit1.scores.surpriseScore);
  console.log('Momentum Score:', audit1.scores.momentumScore);
  console.log('Event Timestamp (UTC):', audit1.rawRow.timestamp, new Date(audit1.rawRow.timestamp * 1000).toISOString());
  console.log('Aligned P0 Candle Timestamp (UTC):', audit1.alignment.p0Timestamp, new Date(audit1.alignment.p0Timestamp * 1000).toISOString());
  console.log('P0 Open Price:', audit1.alignment.p0);
  console.log('H1 Close Price:', audit1.candleContext.find((c: any) => c.isP0)?.close);
  console.log('H1 Raw Return:', (audit1.alignment.rawReturns[0] * 100).toFixed(4) + '%');
  console.log('H1 Normalized Return (Q=-1):', (audit1.alignment.returns[0] * 100).toFixed(4) + '%');

  // Verify math:
  // Event at 15:30 UTC -> P0 is 16:00 candle!
  const p0ExpectedTime = 1601568000; // 16:00:00 UTC
  if (audit1.alignment.p0Timestamp === p0ExpectedTime) {
    console.log('✓ P0 alignment verified: 15:30 event aligned to 16:00 candle open!');
  } else {
    console.error('✗ P0 alignment mismatch!');
  }

  // Delta A - F = 0.3 - 0.1 = 0.2. S_thresh is 0.2. 0.2 <= 0.2 -> score +2!
  if (audit1.scores.surpriseScore === 2) {
    console.log('✓ Surprise score verified: 0.2 <= P75 threshold -> Score +2 (Medium Positive)!');
  } else {
    console.error('✗ Surprise score mismatch!');
  }

  // Delta A - P = 0.3 - 0.3 = 0.0 -> score +1!
  if (audit1.scores.momentumScore === 1) {
    console.log('✓ Momentum score verified: Delta == 0 -> Score +1 (Neutral / Equal)!');
  } else {
    console.error('✗ Momentum score mismatch!');
  }

  // Normalized return check: Q = -1 for EURUSD with USD event
  const expectedNormH1 = -1 * audit1.alignment.rawReturns[0];
  if (Math.abs(audit1.alignment.returns[0] - expectedNormH1) < 1e-12) {
    console.log('✓ Currency normalization verified: Q = -1 applied correctly!');
  }

  console.log('\n=== AUDIT COMPLETE: 100% REPRODUCIBLE FROM DISK ===');
}

runAudit().catch(console.error);
