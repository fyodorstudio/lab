import fs from 'fs';
import readline from 'readline';

/**
 * Splits a single CSV line into an array of string fields, respecting quotes.
 */
export function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        // Escaped double quote
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(currentField.trim());
      currentField = '';
    } else {
      currentField += char;
    }
  }

  fields.push(currentField.trim());
  return fields;
}

/**
 * Reads a CSV file line-by-line via readline interface for memory efficiency.
 */
export async function readCSVLines(
  filePath: string,
  onLine: (fields: string[], lineIndex: number) => void
): Promise<number> {
  const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let lineCount = 0;
  for await (const line of rl) {
    lineCount++;
    const trimmed = line.trim();
    if (!trimmed) continue;
    const fields = parseCSVLine(line);
    onLine(fields, lineCount);
  }

  return lineCount;
}
