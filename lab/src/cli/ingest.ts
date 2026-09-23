import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { CalendarRepository } from '../data/calendarLoader.js';
import { CandleRepository } from '../data/candleLoader.js';
import { discoverFXPairs } from '../data/pairDiscovery.js';
import { CacheManager } from '../data/cacheManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runIngest() {
  console.log('=== Macroeconomic News & FX H1 Indexer ===');
  const startTime = Date.now();

  const repoRoot = path.resolve(__dirname, '../../..');
  const calendarPath = path.join(
    repoRoot,
    'raw_data',
    'economic calendar',
    'fyodor_calendar_master_history_repaired.csv'
  );
  const candlesDir = path.join(repoRoot, 'raw_data', 'fyodor_candles');
  const cacheDir = path.resolve(__dirname, '../../generated-cache');

  if (!fs.existsSync(calendarPath)) {
    console.error(`ERROR: Calendar file not found at ${calendarPath}`);
    process.exit(1);
  }

  if (!fs.existsSync(candlesDir)) {
    console.error(`ERROR: Candles directory not found at ${candlesDir}`);
    process.exit(1);
  }

  const cache = new CacheManager(cacheDir);

  console.log(`1. Parsing economic calendar: ${calendarPath}...`);
  const calStart = Date.now();
  const calendarRepo = new CalendarRepository(calendarPath);
  await calendarRepo.load();
  const calMetrics = calendarRepo.getMetrics();
  console.log(`   Parsed ${calMetrics?.calendarRecordCount} calendar records in ${Date.now() - calStart}ms.`);
  console.log(`   Date range: ${calMetrics?.calendarDateRange.min} to ${calMetrics?.calendarDateRange.max}`);
  console.log(`   Complete A/F/P records: ${calMetrics?.completeAFPCount}`);
  console.log(`   Currencies: ${calMetrics?.availableCurrencies.join(', ')}`);

  console.log('\n2. Discovering FX instruments from raw candles...');
  const pairsMap = discoverFXPairs(candlesDir);
  console.log(`   Discovered ${pairsMap.size} major FX instruments.`);

  console.log('\n3. Indexing FX candle files...');
  const candleRepo = new CandleRepository(candlesDir, pairsMap);
  let totalCandles = 0;
  for (const [pair, info] of pairsMap.entries()) {
    const series = await candleRepo.loadPair(pair);
    if (series) {
      totalCandles += series.times.length;
      process.stdout.write(`   [${pair}] ${series.times.length} bars (${info.earliestDate} to ${info.latestDate})\n`);
    }
  }

  console.log(`\n4. Saving pre-indexed metadata into ${cacheDir}...`);
  cache.set('pairs', Array.from(pairsMap.values()));
  cache.set('cal_metrics', calMetrics);
  cache.set('currencies', calMetrics?.availableCurrencies);

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n=== Ingestion Completed Successfully in ${totalTime}s ===`);
  console.log(`Total H1 market bars indexed: ${totalCandles.toLocaleString()}`);
  console.log(`Total calendar events indexed: ${calMetrics?.calendarRecordCount.toLocaleString()}`);
}

runIngest().catch((err) => {
  console.error('Ingestion failed:', err);
  process.exit(1);
});
