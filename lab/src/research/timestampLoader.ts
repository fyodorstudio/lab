import fs from 'fs';
import readline from 'readline';

/**
 * Loads ONLY the candle timestamps (column 0) from an MT5 H1 candle CSV.
 * Strictly avoids reading, parsing, or storing OHLC prices or volumes.
 */
export async function loadCandleTimestampsOnly(filePath: string): Promise<number[]> {
  const times: number[] = [];
  const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let isHeader = true;
  for await (const line of rl) {
    if (isHeader) {
      isHeader = false;
      continue;
    }
    if (!line) continue;

    // Extract only the first field before the first comma
    const commaIdx = line.indexOf(',');
    const tsStr = commaIdx === -1 ? line : line.slice(0, commaIdx);
    const ts = parseInt(tsStr, 10);
    if (Number.isFinite(ts) && ts > 0) {
      times.push(ts);
    }
  }

  return times;
}
