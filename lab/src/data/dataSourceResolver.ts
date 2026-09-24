import fs from 'fs';
import path from 'path';
import { parseCSVLine } from './csvReader.js';

export interface ResearchDataSource {
  kind: 'mt5-v3.1' | 'legacy';
  root: string;
  calendarPath: string;
  candlesDir: string;
  manifestPath: string | null;
  manifest: Record<string, string>;
  label: string;
}

function readManifest(manifestPath: string): Record<string, string> {
  const manifest: Record<string, string> = {};
  const lines = fs.readFileSync(manifestPath, 'utf8').split(/\r?\n/).filter(Boolean);
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    if (fields.length >= 2 && fields[0]) manifest[fields[0]] = fields[1] ?? '';
  }
  return manifest;
}

function readFirstLine(filePath: string): string {
  const descriptor = fs.openSync(filePath, 'r');
  try {
    const buffer = Buffer.alloc(8192);
    const bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, 0);
    return buffer.subarray(0, bytesRead).toString('utf8').split(/\r?\n/, 1)[0];
  } finally {
    fs.closeSync(descriptor);
  }
}

function validateV31Root(root: string): ResearchDataSource | null {
  const manifestPath = path.join(root, 'manifest.csv');
  const calendarPath = path.join(root, 'calendar_releases.csv');
  const candlesDir = path.join(root, 'candles');
  if (!fs.existsSync(manifestPath) || !fs.existsSync(calendarPath) || !fs.existsSync(candlesDir)) {
    return null;
  }
  const manifest = readManifest(manifestPath);
  if (manifest.schema_version !== 'fyodor-mt5-research-export/3.1.0') return null;
  if (manifest.calendar_completed !== 'true' || manifest.candles_completed !== 'true') return null;
  const declaredReleases = Number(manifest.calendar_releases_exported);
  const declaredSymbols = Number(manifest.candle_symbols_exported);
  const declaredBars = Number(manifest.candle_bars_exported);
  if (!(declaredReleases > 0) || !(declaredSymbols > 0) || !(declaredBars > 0)) return null;

  const firstLine = readFirstLine(calendarPath);
  const headers = new Set(parseCSVLine(firstLine));
  const requiredHeaders = [
    'event_id', 'value_id', 'timestamp', 'period', 'revision', 'event_code',
    'unit', 'multiplier', 'digits', 'actual_raw_scaled_1e6', 'timestamp_convention',
  ];
  if (requiredHeaders.some((header) => !headers.has(header))) return null;

  const candleFiles = fs.readdirSync(candlesDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^candles_[A-Za-z0-9]+_H1\.csv$/.test(entry.name));
  if (candleFiles.length !== declaredSymbols) return null;
  if (candleFiles.some((entry) => fs.statSync(path.join(candlesDir, entry.name)).size === 0)) return null;
  return {
    kind: 'mt5-v3.1',
    root,
    calendarPath,
    candlesDir,
    manifestPath,
    manifest,
    label: `MT5 v3.1 export ${manifest.export_id || path.basename(root)}`,
  };
}

/**
 * Source priority:
 * 1. Explicit FYODOR_EXPORT_ROOT
 * 2. Newest manifested, structurally complete v3.1 export under tools/mt5 or raw_data/exports
 * 3. Read-only legacy raw_data files
 */
export function resolveResearchDataSource(repoRoot: string): ResearchDataSource {
  const explicitRoot = process.env.FYODOR_EXPORT_ROOT?.trim();
  if (explicitRoot) {
    const resolved = validateV31Root(path.resolve(explicitRoot));
    if (!resolved) throw new Error(`FYODOR_EXPORT_ROOT is not a complete v3.1 export: ${explicitRoot}`);
    return resolved;
  }

  const searchParents = [path.join(repoRoot, 'tools', 'mt5'), path.join(repoRoot, 'raw_data', 'exports')];
  const candidates: ResearchDataSource[] = [];
  for (const parent of searchParents) {
    if (!fs.existsSync(parent)) continue;
    for (const entry of fs.readdirSync(parent, { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.startsWith('FyodorResearchExport_v3_')) continue;
      const candidate = validateV31Root(path.join(parent, entry.name));
      if (candidate) candidates.push(candidate);
    }
  }
  candidates.sort((a, b) => (b.manifest.export_id || '').localeCompare(a.manifest.export_id || ''));
  if (candidates[0]) return candidates[0];

  const calendarPath = path.join(
    repoRoot,
    'raw_data',
    'economic calendar',
    'fyodor_calendar_master_history_repaired.csv'
  );
  const candlesDir = path.join(repoRoot, 'raw_data', 'fyodor_candles');
  if (!fs.existsSync(calendarPath) || !fs.existsSync(candlesDir)) {
    throw new Error('No complete v3.1 export or legacy research dataset was found.');
  }
  return {
    kind: 'legacy',
    root: path.join(repoRoot, 'raw_data'),
    calendarPath,
    candlesDir,
    manifestPath: null,
    manifest: {},
    label: 'Legacy repaired calendar and candle files',
  };
}
