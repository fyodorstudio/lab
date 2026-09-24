import { CalendarRawRow, ParsedEventRelease, OverviewMetrics } from '../shared/types.js';
import { readCSVLines } from './csvReader.js';
import { parseNumericValue } from './numericParser.js';
import { classifyEventFamily, normalizeEventName } from '../analytics/familyClassifier.js';
import { detectSimultaneousReleases } from '../analytics/simultaneousDetector.js';
import path from 'path';
import { formatBrokerServerDateTime } from '../shared/utils.js';

export class CalendarRepository {
  private filePath: string;
  private rawRows: CalendarRawRow[] = [];
  private parsedReleases: ParsedEventRelease[] = [];
  private eventsByCurrency = new Map<string, Set<string>>();
  private releasesByEventId = new Map<string, ParsedEventRelease[]>();
  private releasesBySeriesKey = new Map<string, ParsedEventRelease[]>();
  private metrics: OverviewMetrics | null = null;
  private sourceMetadata: Record<string, string>;

  constructor(filePath: string, sourceMetadata: Record<string, string> = {}) {
    this.filePath = filePath;
    this.sourceMetadata = sourceMetadata;
  }

  public async load(): Promise<void> {
    const rawRows: CalendarRawRow[] = [];
    const sourceFile = path.basename(this.filePath);
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
    let headers: string[] = [];

    await readCSVLines(this.filePath, (fields, lineIndex) => {
      if (lineIndex === 1) {
        headers = fields;
        return;
      }
      if (fields.length < 10) {
        rejectedRowCount++;
        return;
      }

      lineCount++;
      const field = (name: string): string => {
        const index = headers.indexOf(name);
        return index >= 0 ? fields[index] ?? '' : '';
      };
      const eventId = field('event_id');
      const valueId = field('value_id');
      const tsStr = field('timestamp');
      const currency = field('currency');
      const countryCode = field('country_code');
      const eventName = field('event_name');
      const importance = field('importance');
      const actualRaw = field('actual');
      const forecastRaw = field('forecast');
      const previousRaw = field('previous');
      const revisedPreviousRaw = field('revised_previous');
      const periodRaw = field('period');
      const revisionRaw = field('revision');
      const nullableInteger = (value: string): number | null => {
        if (value === '') return null;
        const parsed = Number.parseInt(value, 10);
        return Number.isFinite(parsed) ? parsed : null;
      };

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
        sourceFile,
        periodTimestamp: nullableInteger(periodRaw),
        revision: nullableInteger(revisionRaw),
        impactType: field('impact_type') || undefined,
        eventCode: field('event_code') || undefined,
        eventType: field('event_type') || undefined,
        sector: field('sector') || undefined,
        frequency: field('frequency') || undefined,
        timeMode: field('time_mode') || undefined,
        sourceUnit: field('unit') || undefined,
        multiplier: field('multiplier') || undefined,
        digits: nullableInteger(field('digits')),
        sourceUrl: field('source_url') || undefined,
        actualScaledIntegerRaw: field('actual_raw_scaled_1e6') || null,
        forecastScaledIntegerRaw: field('forecast_raw_scaled_1e6') || null,
        previousScaledIntegerRaw: field('previous_raw_scaled_1e6') || null,
        revisedPreviousScaledIntegerRaw: field('revised_previous_raw_scaled_1e6') || null,
        timestampConvention: field('timestamp_convention') || undefined,
      });
    });

    this.rawRows = rawRows;

    // Detect simultaneous releases across all rows
    const simultaneousMap = detectSimultaneousReleases(rawRows);

    const parsedReleases: ParsedEventRelease[] = [];
    const eventsByCurrency = new Map<string, Set<string>>();
    const releasesByEventId = new Map<string, ParsedEventRelease[]>();
    const releasesBySeriesKey = new Map<string, ParsedEventRelease[]>();
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
      const simultaneousEventIdentities = simCluster
        ? simCluster.events.filter((e) => e.valueId !== raw.valueId)
        : [];
      const simultaneousEvents = simultaneousEventIdentities.map((e) => e.eventName);

      const family = classifyEventFamily(raw.eventName);
      if (family === 'Other') {
        unknownFamilyCount++;
      }

      const eventSeriesKey = raw.revision === null
        ? `${raw.currency}:${raw.countryCode}:${raw.eventId}`
        : `${raw.currency}:${raw.countryCode}:${raw.eventId}:r${raw.revision}`;
      const sourceUnit = raw.sourceUnit === 'CALENDAR_UNIT_PERCENT' ? '%' : raw.sourceUnit;
      const parsed: ParsedEventRelease = {
        eventId: raw.eventId,
        valueId: raw.valueId,
        timestamp: raw.timestamp,
        date: formatBrokerServerDateTime(raw.timestamp),
        currency: raw.currency,
        countryCode: raw.countryCode,
        eventName: raw.eventName,
        normalizedEventName: normalizeEventName(raw.eventName),
        eventSeriesKey,
        periodTimestamp: raw.periodTimestamp,
        revision: raw.revision,
        impactType: raw.impactType,
        eventCode: raw.eventCode,
        eventType: raw.eventType,
        sector: raw.sector,
        frequency: raw.frequency,
        timeMode: raw.timeMode,
        sourceUnit: raw.sourceUnit,
        multiplier: raw.multiplier,
        digits: raw.digits,
        sourceUrl: raw.sourceUrl,
        actualScaledIntegerRaw: raw.actualScaledIntegerRaw,
        forecastScaledIntegerRaw: raw.forecastScaledIntegerRaw,
        previousScaledIntegerRaw: raw.previousScaledIntegerRaw,
        revisedPreviousScaledIntegerRaw: raw.revisedPreviousScaledIntegerRaw,
        timestampConvention: raw.timestampConvention,
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
        simultaneousEventIdentities,
        sourceFile: raw.sourceFile,
        unit: sourceUnit || actParsed.unit || fctParsed.unit || prevParsed.unit || revPrevParsed.unit,
      };

      parsedReleases.push(parsed);

      // Indexing
      if (!eventsByCurrency.has(raw.currency)) {
        eventsByCurrency.set(raw.currency, new Set());
      }
      eventsByCurrency.get(raw.currency)!.add(raw.eventName);

      if (!releasesByEventId.has(raw.eventId)) {
        releasesByEventId.set(raw.eventId, []);
      }
      releasesByEventId.get(raw.eventId)!.push(parsed);
      if (!releasesBySeriesKey.has(eventSeriesKey)) releasesBySeriesKey.set(eventSeriesKey, []);
      releasesBySeriesKey.get(eventSeriesKey)!.push(parsed);
    }

    const declaredReleaseCount = Number(this.sourceMetadata.calendar_releases_exported);
    if (Number.isFinite(declaredReleaseCount) && declaredReleaseCount > 0 && parsedReleases.length !== declaredReleaseCount) {
      throw new Error(
        `Calendar manifest declares ${declaredReleaseCount} releases, but ${parsedReleases.length} valid rows were loaded from ${sourceFile}.`
      );
    }

    this.parsedReleases = parsedReleases;
    this.eventsByCurrency = eventsByCurrency;
    this.releasesByEventId = releasesByEventId;
    this.releasesBySeriesKey = releasesBySeriesKey;

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

  public getReleasesForEvent(
    currency: string,
    eventName: string,
    eventId?: string,
    eventSeriesKey?: string
  ): ParsedEventRelease[] {
    const currencyUpper = currency.toUpperCase();
    if (eventSeriesKey) {
      return (this.releasesBySeriesKey.get(eventSeriesKey) || []).filter(
        (release) => release.currency.toUpperCase() === currencyUpper
      );
    }
    if (eventId) {
      const matches = (this.releasesByEventId.get(eventId) || []).filter(
        (release) => release.currency.toUpperCase() === currencyUpper
      );
      const seriesKeys = new Set(matches.map((release) => release.eventSeriesKey));
      if (seriesKeys.size > 1) {
        throw new Error(
          `Ambiguous event_id "${eventId}" for ${currencyUpper}: ${seriesKeys.size} revision/stage series match. Supply eventSeriesKey.`
        );
      }
      return matches;
    }

    const matchingSeries = new Set(
      this.parsedReleases
        .filter((release) =>
          release.currency.toUpperCase() === currencyUpper && release.eventName === eventName
        )
        .map((release) => release.eventSeriesKey)
    );

    if (matchingSeries.size > 1) {
      throw new Error(
        `Ambiguous event name "${eventName}" for ${currencyUpper}: ${matchingSeries.size} source series match. Supply eventSeriesKey.`
      );
    }

    const onlySeries = matchingSeries.values().next().value as string | undefined;
    return onlySeries ? this.releasesBySeriesKey.get(onlySeries) || [] : [];
  }

  public getMetrics(): OverviewMetrics | null {
    return this.metrics;
  }

  public getSourceMetadata(): Record<string, string> {
    return { ...this.sourceMetadata };
  }
}
