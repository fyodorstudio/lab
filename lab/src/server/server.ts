import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { CalendarRepository } from '../data/calendarLoader.js';
import { CandleRepository } from '../data/candleLoader.js';
import { discoverFXPairs } from '../data/pairDiscovery.js';
import { AnalyticsService } from '../analytics/analyticsService.js';
import { createApiRouter } from './routes.js';
import { resolveResearchDataSource } from '../data/dataSourceResolver.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  const repoRoot = path.resolve(__dirname, '../../..');
  const source = resolveResearchDataSource(repoRoot);
  const { calendarPath, candlesDir } = source;

  console.log(`Research source: ${source.label}`);
  console.log(`Loading calendar from: ${calendarPath}`);
  const calendarRepo = new CalendarRepository(calendarPath, source.manifest);
  await calendarRepo.load();

  console.log(`Discovering FX pairs in: ${candlesDir}`);
  const pairsMap = discoverFXPairs(candlesDir);
  const candleRepo = new CandleRepository(candlesDir, pairsMap);

  // Pre-load common major pairs for instant responses
  const majorCrosses = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'USDCHF', 'NZDUSD'];
  for (const pair of majorCrosses) {
    if (pairsMap.has(pair)) {
      await candleRepo.loadPair(pair);
    }
  }

  const analyticsService = new AnalyticsService(calendarRepo, candleRepo, pairsMap);

  // Mount API router
  app.use('/api', createApiRouter(analyticsService));

  // Serve static web build if present
  const webDistPath = path.resolve(__dirname, '../../web/dist');
  if (fs.existsSync(webDistPath)) {
    console.log(`Serving frontend from: ${webDistPath}`);
    app.use(express.static(webDistPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(webDistPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`FX Post-Release Research Workstation running at:`);
    console.log(`  Local: http://localhost:${PORT}`);
    console.log(`  API:   http://localhost:${PORT}/api/overview`);
    console.log(`======================================================\n`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
