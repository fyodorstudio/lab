import { Router, Request, Response } from 'express';
import { IAnalyticsService } from '../analytics/analyticsService.js';
import { PatternQueryFilters } from '../shared/types.js';

export function createApiRouter(analyticsService: IAnalyticsService): Router {
  const router = Router();

  // Overview metrics
  router.get('/overview', async (_req: Request, res: Response) => {
    try {
      const data = await analyticsService.getOverview();
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Available currencies
  router.get('/currencies', async (_req: Request, res: Response) => {
    try {
      const data = await analyticsService.getCurrencies();
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Events for currency (optional family filter)
  router.get('/events', async (req: Request, res: Response) => {
    try {
      const currency = (req.query.currency as string) || 'USD';
      const family = req.query.family as string | undefined;
      const data = await analyticsService.getEvents(currency, family);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Pairs for currency
  router.get('/pairs', async (req: Request, res: Response) => {
    try {
      const currency = (req.query.currency as string) || 'USD';
      const data = await analyticsService.getPairs(currency);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Surprise & Momentum distribution
  router.get('/distribution', async (req: Request, res: Response) => {
    try {
      const currency = req.query.currency as string;
      const eventName = req.query.eventName as string;
      const percentile = req.query.percentile ? parseInt(req.query.percentile as string, 10) : 75;

      if (!currency || !eventName) {
        res.status(400).json({ error: 'currency and eventName query parameters are required' });
        return;
      }

      const data = await analyticsService.getDistribution(currency, eventName, percentile);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Core Pattern query
  router.post('/pattern', async (req: Request, res: Response) => {
    try {
      const query: PatternQueryFilters = req.body;
      if (!query.currency || !query.eventName) {
        res.status(400).json({ error: 'currency and eventName are required' });
        return;
      }

      const data = await analyticsService.getPattern(query);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Observation table pagination
  router.post('/observations', async (req: Request, res: Response) => {
    try {
      const { query, page, pageSize, sortBy, sortDir } = req.body;
      if (!query || !query.currency || !query.eventName) {
        res.status(400).json({ error: 'Valid query with currency and eventName is required' });
        return;
      }

      const data = await analyticsService.getObservations(
        query,
        page || 1,
        pageSize || 50,
        sortBy || 'timestamp',
        sortDir || 'desc'
      );
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Raw Event Inspector
  router.get('/inspect', async (req: Request, res: Response) => {
    try {
      const eventId = req.query.eventId as string;
      const valueId = (req.query.valueId as string) || '';
      const pair = (req.query.pair as string) || 'EURUSD';
      const percentile = req.query.percentile ? parseInt(req.query.percentile as string, 10) : 75;
      const scoringMode = (req.query.scoringMode as any) || 'retrospective';
      const minHistory = req.query.minHistory ? parseInt(req.query.minHistory as string, 10) : 20;

      if (!eventId) {
        res.status(400).json({ error: 'eventId is required' });
        return;
      }

      const data = await analyticsService.getRawEventInspection(
        eventId,
        valueId,
        pair,
        percentile,
        scoringMode,
        minHistory
      );
      if (!data) {
        res.status(404).json({ error: 'Event observation not found' });
        return;
      }

      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Event family comparison
  router.get('/family-comparison', async (req: Request, res: Response) => {
    try {
      const currency = (req.query.currency as string) || 'USD';
      const pair = req.query.pair as string | undefined;
      const data = await analyticsService.getFamilyComparison(currency, pair);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Data Quality page
  router.get('/data-quality', async (_req: Request, res: Response) => {
    try {
      const data = await analyticsService.getDataQuality();
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Data Export
  router.post('/export', async (req: Request, res: Response) => {
    try {
      const { type, format, query } = req.body;
      // type: 'observations' | 'horizons' | 'scoreMatrix'
      // format: 'csv' | 'json'

      if (type === 'observations') {
        const obsData = await analyticsService.getObservations(query, 1, 10000);
        if (format === 'json') {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Content-Disposition', 'attachment; filename="observations.json"');
          res.json(obsData.items);
          return;
        }

        // CSV export
        const headers = [
          'timestamp',
          'date',
          'currency',
          'eventName',
          'importance',
          'actualRaw',
          'forecastRaw',
          'previousRaw',
          'actual',
          'forecast',
          'previous',
          'surpriseDelta',
          'momentumDelta',
          'surpriseAbsDelta',
          'momentumAbsDelta',
          'surprisePercentileRank',
          'momentumPercentileRank',
          'surpriseScore',
          'momentumScore',
          'pair',
          'eventCurrencyPosition',
          'directionMultiplier',
          'p0Timestamp',
          'p0',
          'simultaneousCount',
          'crossesWeekend',
          'isFridayRelease',
          ...Array.from({ length: 42 }, (_, i) => `H${i + 1}_return`),
        ];

        const csvLines = [headers.join(',')];
        for (const obs of obsData.items) {
          const row = [
            obs.timestamp,
            `"${obs.date}"`,
            obs.currency,
            `"${obs.eventName.replace(/"/g, '""')}"`,
            obs.importance,
            `"${obs.actualRaw || ''}"`,
            `"${obs.forecastRaw || ''}"`,
            `"${obs.previousRaw || ''}"`,
            obs.actual ?? '',
            obs.forecast ?? '',
            obs.previous ?? '',
            obs.surpriseDelta ?? '',
            obs.momentumDelta ?? '',
            obs.surpriseAbsDelta ?? '',
            obs.momentumAbsDelta ?? '',
            obs.surprisePercentileRank !== null && obs.surprisePercentileRank !== undefined ? `P${obs.surprisePercentileRank}` : '',
            obs.momentumPercentileRank !== null && obs.momentumPercentileRank !== undefined ? `P${obs.momentumPercentileRank}` : '',
            obs.surpriseScore ?? '',
            obs.momentumScore ?? '',
            obs.pair,
            obs.eventCurrencyPosition,
            obs.directionMultiplier,
            obs.p0Timestamp ?? '',
            obs.p0 ?? '',
            obs.simultaneousReleaseCount,
            obs.crossesWeekend,
            obs.isFridayRelease,
            ...obs.returns.map((r) => (r !== null ? r.toFixed(6) : '')),
          ];
          csvLines.push(row.join(','));
        }

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="observations.csv"');
        res.send(csvLines.join('\n'));
        return;
      }

      if (type === 'horizons') {
        const pattern = await analyticsService.getPattern(query);
        if (format === 'json') {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Content-Disposition', 'attachment; filename="horizons.json"');
          res.json(pattern.horizons);
          return;
        }

        const headers = [
          'horizon',
          'n',
          'mean',
          'median',
          'min',
          'max',
          'p10',
          'p25',
          'p50',
          'p75',
          'p90',
          'positiveCount',
          'negativeCount',
          'zeroCount',
          'positiveDirectionRate',
          'negativeDirectionRate',
        ];

        const csvLines = [headers.join(',')];
        for (const h of pattern.horizons) {
          csvLines.push(
            [
              h.horizon,
              h.n,
              h.mean ?? '',
              h.median ?? '',
              h.min ?? '',
              h.max ?? '',
              h.p10 ?? '',
              h.p25 ?? '',
              h.p50 ?? '',
              h.p75 ?? '',
              h.p90 ?? '',
              h.positiveDirectionCount,
              h.negativeDirectionCount,
              h.zeroCount,
              h.positiveDirectionRate !== null ? (h.positiveDirectionRate * 100).toFixed(2) + '%' : '',
              h.negativeDirectionRate !== null ? (h.negativeDirectionRate * 100).toFixed(2) + '%' : '',
            ].join(',')
          );
        }

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="horizons.csv"');
        res.send(csvLines.join('\n'));
        return;
      }

      if (type === 'scoreMatrix') {
        const pattern = await analyticsService.getPattern(query);
        if (format === 'json') {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Content-Disposition', 'attachment; filename="score_matrix.json"');
          res.json(pattern.scoreMatrix);
          return;
        }

        const headers = ['momentumScore', 'surpriseScore', 'n', 'medianReturn', 'meanReturn', 'positiveDirectionRate'];
        const csvLines = [headers.join(',')];
        for (const row of pattern.scoreMatrix.matrix) {
          for (const cell of row) {
            csvLines.push(
              [
                cell.momentumScore,
                cell.surpriseScore,
                cell.n,
                cell.medianReturn !== null ? (cell.medianReturn * 100).toFixed(4) + '%' : '',
                cell.meanReturn !== null ? (cell.meanReturn * 100).toFixed(4) + '%' : '',
                cell.positiveDirectionRate !== null ? (cell.positiveDirectionRate * 100).toFixed(2) + '%' : '',
              ].join(',')
            );
          }
        }

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="score_matrix.csv"');
        res.send(csvLines.join('\n'));
        return;
      }

      if (type === 'horizonDistribution') {
        const horizonNum = query.horizon || 1;
        const pattern = await analyticsService.getPattern(query);
        const stats = pattern.horizons[horizonNum - 1];
        const bins = pattern.horizonBins?.[horizonNum] || [];

        if (format === 'json') {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Content-Disposition', `attachment; filename="horizon_${horizonNum}_distribution.json"`);
          res.json({ horizon: horizonNum, stats, bins });
          return;
        }

        const headers = ['binIndex', 'binStart', 'binEnd', 'count', 'frequencyPct'];
        const csvLines = [
          `# Horizon: H${horizonNum} | N: ${stats?.n ?? 0} | Mean: ${stats?.mean !== null ? (stats.mean * 100).toFixed(4) + '%' : ''} | Median: ${stats?.median !== null ? (stats.median * 100).toFixed(4) + '%' : ''}`,
          headers.join(','),
        ];
        bins.forEach((b: any, idx: number) => {
          csvLines.push(
            [
              idx + 1,
              (b.binStart * 100).toFixed(4) + '%',
              (b.binEnd * 100).toFixed(4) + '%',
              b.count,
              (b.frequency * 100).toFixed(2) + '%',
            ].join(',')
          );
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="horizon_${horizonNum}_distribution.csv"`);
        res.send(csvLines.join('\n'));
        return;
      }

      res.status(400).json({ error: 'Unknown export type' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
