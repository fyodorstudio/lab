import { CalendarRawRow, ParsedEventRelease, OverviewMetrics } from '../shared/types.js';
import { readCSVLines } from './csvReader.js';
import { parseNumericValue } from './numericParser.js';
import { classifyEventFamily, normalizeEventName } from '../analytics/familyClassifier.js';
import { detectSimultaneousReleases } from '../analytics/simultaneousDetector.js';

export class CalendarRepository {
  private filePath: string;
  private rawRows: CalendarRawRow[] = [];
  private parsedReleases: ParsedEventRelease[] = [];
  private eventsByCurrency = new Map<string, Set<string>>();
  private releasesByEventKey = new Map<string, ParsedEventRelease[]>();
  private metrics: OverviewMetrics | null = null;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  public async load(): Promise<void> {
    const rawRows: CalendarRawRow[] = [];
    let lineCount = 0;
    let rejectedRowCount = 0;
    let malformedTimestampCount = 0;
    let missingA = 0;
    let missingF = 0;
    let missingP = 0;
    let completeAFP = 0;
    let parseFailures = 0;

    let minTs = Infinity;
    let maxTs = -Infinity;
    const currencies = new Set<string>();
    const eventNames = new Set<string>();
    const seenCurrencyTimestamps = new Set<string>();
    let duplicateTimestampCount = 0;

    await readCSVLines(this.filePath, (fields, lineIndex) => {
      if (lineIndex === 1) return; // skip header
      if (fields.length < 10) {
        rejectedRowCount++;
        return;
      }

      lineCount++;
      const [
        eventId,
        valueId,
        tsStr,
        currency,
        countryCode,
        eventName,
        importance,
        actualRaw,
        forecastRaw,
        previousRaw,
        revisedPreviousRaw,
      ] = fields;

      const timestamp = parseInt(tsStr, 10);
      if (Number.isFinite(timestamp) && timestamp > 0 && timestamp < 2.5e9) {
        if (timestamp < minTs) minTs = timestamp;
        if (timestamp > maxTs) maxTs = timestamp;
      } else {
        malformedTimestampCount++;
      }

      const curTsKey = `${currency}_${tsStr}`;
      if (seenCurrencyTimestamps.has(curTsKey)) {
        duplicateTimestampCount++;
      } else {
        seenCurrencyTimestamps.add(curTsKey);
      }

      currencies.add(currency);
      eventNames.add(eventName);

      rawRows.push({
        eventId,
        valueId: valueId || '',
        timestamp,
        currency,
        countryCode: countryCode || '',
        eventName,
        importance: importance?.toLowerCase() || 'medium',
        actualRaw: actualRaw || null,
        forecastRaw: forecastRaw || null,
        previousRaw: previousRaw || null,
        revisedPreviousRaw: revisedPreviousRaw || null,
      });
    });

    this.rawRows = rawRows;

    // Detect simultaneous releases across all rows
    const simultaneousMap = detectSimultaneousReleases(rawRows);

    const parsedReleases: ParsedEventRelease[] = [];
    const eventsByCurrency = new Map<string, Set<string>>();
    const releasesByEventKey = new Map<string, ParsedEventRelease[]>();
    let unknownFamilyCount = 0;

    for (const raw of rawRows) {
      const actParsed = parseNumericValue(raw.actualRaw);
      const fctParsed = parseNumericValue(raw.forecastRaw);
      const prevParsed = parseNumericValue(raw.previousRaw);
      const revPrevParsed = parseNumericValue(raw.revisedPreviousRaw);

      if (raw.actualRaw && !actParsed.isValid) parseFailures++;
      if (raw.forecastRaw && !fctParsed.isValid) parseFailures++;
      if (raw.previousRaw && !prevParsed.isValid) parseFailures++;

      const hasA = actParsed.isValid && actParsed.value !== null;
      const hasF = fctParsed.isValid && fctParsed.value !== null;
      const hasP = prevParsed.isValid && prevParsed.value !== null;

      if (!hasA) missingA++;
      if (!hasF) missingF++;
      if (!hasP) missingP++;

      const hasCompleteAFP = hasA && hasF && hasP;
      if (hasCompleteAFP) completeAFP++;

      const surpriseDelta = hasA && hasF ? actParsed.value! - fctParsed.value! : null;
      const momentumDelta = hasA && hasP ? actParsed.value! - prevParsed.value! : null;

      const simKey = `${raw.currency}_${raw.timestamp}`;
      const simCluster = simultaneousMap.get(simKey);
      const simultaneousCount = simCluster ? simCluster.count : 1;
      const simultaneousEvents = simCluster
        ? simCluster.events.filter((e) => e.eventId !== raw.eventId).map((e) => e.eventName)
        : [];

      const family = classifyEventFamily(raw.eventName);
      if (family === 'Other') {
        unknownFamilyCount++;
      }

      const parsed: ParsedEventRelease = {
        eventId: raw.eventId,
        valueId: raw.valueId,
        timestamp: raw.timestamp,
        date: new Date(raw.timestamp * 1000).toISOString(),
        currency: raw.currency,
        countryCode: raw.countryCode,
        eventName: raw.eventName,
        normalizedEventName: normalizeEventName(raw.eventName),
        eventFamily: family,
        importance: raw.importance,

        actualRaw: raw.actualRaw,
        forecastRaw: raw.forecastRaw,
        previousRaw: raw.previousRaw,
        revisedPreviousRaw: raw.revisedPreviousRaw,

        actual: actParsed.value,
        forecast: fctParsed.value,
        previous: prevParsed.value,
        revisedPrevious: revPrevParsed.value,

        surpriseDelta,
        momentumDelta,
        surpriseAbsDelta: surpriseDelta !== null ? Math.abs(surpriseDelta) : null,
        momentumAbsDelta: momentumDelta !== null ? Math.abs(momentumDelta) : null,

        hasCompleteAFP,
        simultaneousReleaseCount: simultaneousCount,
        simultaneousEvents,
        unit: actParsed.unit || fctParsed.unit || prevParsed.unit || revPrevParsed.unit,
      };

      parsedReleases.push(parsed);

      // Indexing
      if (!eventsByCurrency.has(raw.currency)) {
        eventsByCurrency.set(raw.currency, new Set());
      }
      eventsByCurrency.get(raw.currency)!.add(raw.eventName);

      const eventKey = `${raw.currency}__${raw.eventName}`;
      if (!releasesByEventKey.has(eventKey)) {
        releasesByEventKey.set(eventKey, []);
      }
      releasesByEventKey.get(eventKey)!.push(parsed);
    }

    this.parsedReleases = parsedReleases;
    this.eventsByCurrency = eventsByCurrency;
    this.releasesByEventKey = releasesByEventKey;

    this.metrics = {
      calendarRecordCount: parsedReleases.length,
      fxInstrumentCount: 0, // populated when candles are checked
      h1CandleCount: 0,
      calendarDateRange: {
        minTs,
        maxTs,
        min: new Date(minTs * 1000).toISOString().slice(0, 10),
        max: new Date(maxTs * 1000).toISOString().slice(0, 10),
      },
      marketDateRange: { min: '', max: '', minTs: 0, maxTs: 0 },
      availableCurrencies: Array.from(currencies).sort(),
      totalEventNamesCount: eventNames.size,
      availableFamiliesCount: 10,
      missingActualCount: missingA,
      missingForecastCount: missingF,
      missingPreviousCount: missingP,
      completeAFPCount: completeAFP,
      parsedValueFailuresCount: parseFailures,
      rejectedRowCount,
      malformedTimestampCount,
      duplicateTimestampCount,
      unknownFamilyCount,
      duplicateCandleIssues: [],
    };
  }

  public getRawRows(): CalendarRawRow[] {
    return this.rawRows;
  }

  public getParsedReleases(): ParsedEventRelease[] {
    return this.parsedReleases;
  }

  public getEventsForCurrency(currency: string): string[] {
    const set = this.eventsByCurrency.get(currency.toUpperCase());
    return set ? Array.from(set).sort() : [];
  }

  public getReleasesForEvent(currency: string, eventName: string): ParsedEventRelease[] {
    const key = `${currency.toUpperCase()}__${eventName}`;
    return this.releasesByEventKey.get(key) || [];
  }

  public getMetrics(): OverviewMetrics | null {
    return this.metrics;
  }
}
