const fs = require('fs');
const readline = require('readline');
const { parseCSVLine } = require('C:/dev/Fyodor Math Lab/GEMINI/lab/dist/data/csvReader.js');

async function testFamilyDifferences() {
  const file = 'C:/dev/Fyodor Math Lab/GEMINI/tools/mt5/FyodorResearchExport_v3_20260923_234930_server/calendar_releases.csv';
  const rl = readline.createInterface({ input: fs.createReadStream(file) });
  let count = 0;
  let headers = [];

  const { classifyMacroFamily } = require('C:/dev/Fyodor Math Lab/GEMINI/lab/dist/research/fmsInventoryEngine.js');

  const properSeries = new Map();

  for await (const line of rl) {
    if (count++ === 0) { headers = parseCSVLine(line); continue; }
    if (!line.trim()) continue;

    const fields = parseCSVLine(line);
    const ts = parseInt(fields[headers.indexOf('timestamp')], 10);
    if (ts >= 1672531200) continue;

    const currency = fields[headers.indexOf('currency')].replace(/"/g, '');
    const country = fields[headers.indexOf('country_code')].replace(/"/g, '');
    const eventId = fields[headers.indexOf('event_id')].replace(/"/g, '');
    const revision = fields[headers.indexOf('revision')].replace(/"/g, '');
    const eventName = fields[headers.indexOf('event_name')].replace(/"/g, '');

    const seriesKey = `${currency}:${country}:${eventId}:r${revision === '' ? 'none' : revision}`;
    if (!properSeries.has(seriesKey)) {
      const fam = classifyMacroFamily(eventName);
      properSeries.set(seriesKey, { fam, eventName, total: 0 });
    }
    properSeries.get(seriesKey).total++;
  }

  const famCounts = {};
  for (const s of properSeries.values()) {
    if (!famCounts[s.fam]) famCounts[s.fam] = { series: 0, releases: 0 };
    famCounts[s.fam].series++;
    famCounts[s.fam].releases += s.total;
  }
  console.log('Proper Macro Families:', famCounts);
}

testFamilyDifferences().catch(console.error);
