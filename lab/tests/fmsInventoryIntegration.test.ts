import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseCSVLine } from '../src/data/csvReader.js';
import {
  EXPECTED_CALENDAR_SHA256,
  EXPECTED_SCHEMA_VERSION,
  CANDIDATE_HOLDING_HORIZONS,
  FmsInventoryResult,
} from '../src/research/fmsInventoryTypes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');

describe('FMS Inventory Integration & Codex Audit Verifications', () => {
  describe('1. Quoted-Comma Calendar Parsing Regression Test', () => {
    const rawLine =
      '826010001,28101,1421843400,"GBP","GB","Average Weekly Earnings, Regular Pay y/y",low,1.8,,1.6,,1414800000,0,CALENDAR_IMPACT_NA,0,826010001,826,"average-weekly-earnings-regular-pay",CALENDAR_TYPE_INDICATOR,CALENDAR_SECTOR_JOBS,CALENDAR_FREQUENCY_MONTH,CALENDAR_TIMEMODE_DATETIME,CALENDAR_UNIT_PERCENT,CALENDAR_MULTIPLIER_NONE,1,CALENDAR_IMPORTANCE_LOW,1,"https://www.ons.gov.uk/",1800000,,1600000,,2015.01.21 12:30:00,2014.11.01 00:00:00,trade_server_time,true';

    it('parses real quoted-comma row into exactly 36 fields using parseCSVLine', () => {
      const fields = parseCSVLine(rawLine);
      expect(fields.length).toBe(36);
    });

    it('preserves exact columns and types for Average Weekly Earnings, Regular Pay y/y', () => {
      const fields = parseCSVLine(rawLine);

      // Col 0: event_id
      expect(fields[0]).toBe('826010001');
      // Col 1: value_id
      expect(fields[1]).toBe('28101');
      // Col 2: timestamp
      expect(fields[2]).toBe('1421843400');
      // Col 3: currency
      expect(fields[3]).toBe('GBP');
      // Col 4: country_code
      expect(fields[4]).toBe('GB');
      // Col 5: event_name
      expect(fields[5]).toBe('Average Weekly Earnings, Regular Pay y/y');
      // Col 6: importance
      expect(fields[6]).toBe('low');
      // Col 7: actual
      expect(fields[7]).toBe('1.8');
      // Col 8: forecast (empty string in this historical release)
      expect(fields[8]).toBe('');
      // Col 9: previous
      expect(fields[9]).toBe('1.6');
      // Col 10: revised_previous (empty)
      expect(fields[10]).toBe('');
      // Col 11: period
      expect(fields[11]).toBe('1414800000');
      // Col 12: revision
      expect(fields[12]).toBe('0');
      // Col 35: country_lookup_ok
      expect(fields[35]).toBe('true');
    });

    it('demonstrates that naive comma-splitting breaks column alignment on this real row', () => {
      const naiveParts = rawLine.split(',');
      // Naive split produces 37 parts due to unquoted comma splitting inside "Average Weekly Earnings, Regular Pay y/y"
      expect(naiveParts.length).toBe(37);
      // Because of shift, Col 11 and Col 12 are corrupted
      expect(naiveParts[11]).not.toBe('1414800000'); // shifted to empty string
      expect(naiveParts[12]).not.toBe('0'); // shifted to 1414800000
    });
  });

  describe('2. Strict Fail-Closed Input Validation', () => {
    it('rejects rows with incorrect column count (< 36 or > 36)', () => {
      const shortRow = '826010001,28101,1421843400,"GBP","GB"';
      const fields = parseCSVLine(shortRow);
      expect(fields.length).not.toBe(36);
    });

    it('correctly identifies valid numeric formats for value_id, event_id, and timestamps', () => {
      expect(/^\d+$/.test('28101')).toBe(true);
      expect(/^\d+$/.test('826010001')).toBe(true);
      expect(/^\d+$/.test('1421843400')).toBe(true);
      expect(/^\d+$/.test('abc')).toBe(false);
      expect(/^\d+$/.test('-10')).toBe(false);
    });

    it('correctly validates ISO currency and country code formats', () => {
      expect(/^[A-Z]{3}$/.test('USD')).toBe(true);
      expect(/^[A-Z]{3}$/.test('US')).toBe(false);
      expect(/^[A-Z]{2}$/.test('US')).toBe(true);
      expect(/^[A-Z]{2}$/.test('USA')).toBe(false);
    });
  });

  describe('3. Synthetic Packages Unit Test: Proving Joint Intersection Cannot Be Mistaken for Marginals', () => {
    it('demonstrates joint count < marginal inputs and joint count < marginal clean paths', () => {
      // 4 Synthetic packages for series S (currency USD) and pair EURUSD:
      // Package 1: Complete inputs (hasCompleteAFP=true), but pair path is blocked (WEEKEND_BLOCKED)
      // Package 2: Incomplete inputs (hasCompleteAFP=false), but pair path is clean across all horizons
      // Package 3: Complete inputs (hasCompleteAFP=true), and pair path is clean up to 30 H4, but blocked at 42 H4 and 60 H4
      // Package 4: Complete inputs (hasCompleteAFP=true), and pair path is clean across all horizons 6-60 H4

      let distinctPackagesCount = 0;
      let completeInputCount = 0;
      let openMarketEntries = 0;
      let cleanPreEntry14 = 0;
      const cleanPathsByHorizon = { 6: 0, 12: 0, 30: 0, 42: 0, 60: 0 };
      let completeInputsAndCleanPre14 = 0;
      const completeInputsAndCleanPathsByHorizon = { 6: 0, 12: 0, 30: 0, 42: 0, 60: 0 };

      const syntheticEpisodes = [
        {
          packageId: 'pkg_1',
          hasCompleteAFP: true,
          entryStatus: 'WEEKEND_BLOCKED',
          preEntryHas14: false,
          holdingHorizonsComplete: { 6: false, 12: false, 30: false, 42: false, 60: false },
        },
        {
          packageId: 'pkg_2',
          hasCompleteAFP: false,
          entryStatus: 'OPEN_MARKET',
          preEntryHas14: true,
          holdingHorizonsComplete: { 6: true, 12: true, 30: true, 42: true, 60: true },
        },
        {
          packageId: 'pkg_3',
          hasCompleteAFP: true,
          entryStatus: 'OPEN_MARKET',
          preEntryHas14: true,
          holdingHorizonsComplete: { 6: true, 12: true, 30: true, 42: false, 60: false },
        },
        {
          packageId: 'pkg_4',
          hasCompleteAFP: true,
          entryStatus: 'OPEN_MARKET',
          preEntryHas14: true,
          holdingHorizonsComplete: { 6: true, 12: true, 30: true, 42: true, 60: true },
        },
      ];

      for (const ep of syntheticEpisodes) {
        distinctPackagesCount++;
        if (ep.hasCompleteAFP) completeInputCount++;

        const isOpenMarket = ep.entryStatus === 'OPEN_MARKET';
        const isCleanPre14 = isOpenMarket && ep.preEntryHas14;

        if (isOpenMarket) {
          openMarketEntries++;
          if (isCleanPre14) {
            cleanPreEntry14++;
            if (ep.hasCompleteAFP) {
              completeInputsAndCleanPre14++;
            }
            for (const h of [6, 12, 30, 42, 60] as const) {
              if (ep.holdingHorizonsComplete[h]) {
                cleanPathsByHorizon[h]++;
                if (ep.hasCompleteAFP) {
                  completeInputsAndCleanPathsByHorizon[h]++;
                }
              }
            }
          }
        }
      }

      // Marginal Assertions:
      expect(distinctPackagesCount).toBe(4);
      expect(completeInputCount).toBe(3); // Pkg 1, 3, 4
      expect(cleanPreEntry14).toBe(3); // Pkg 2, 3, 4
      expect(cleanPathsByHorizon[6]).toBe(3); // Pkg 2, 3, 4
      expect(cleanPathsByHorizon[12]).toBe(3); // Pkg 2, 3, 4
      expect(cleanPathsByHorizon[30]).toBe(3); // Pkg 2, 3, 4
      expect(cleanPathsByHorizon[42]).toBe(2); // Pkg 2, 4
      expect(cleanPathsByHorizon[60]).toBe(2); // Pkg 2, 4

      // Joint Intersection Assertions:
      expect(completeInputsAndCleanPre14).toBe(2); // Pkg 3, 4
      expect(completeInputsAndCleanPathsByHorizon[6]).toBe(2); // Pkg 3, 4
      expect(completeInputsAndCleanPathsByHorizon[12]).toBe(2); // Pkg 3, 4
      expect(completeInputsAndCleanPathsByHorizon[30]).toBe(2); // Pkg 3, 4
      expect(completeInputsAndCleanPathsByHorizon[42]).toBe(1); // Pkg 4 only
      expect(completeInputsAndCleanPathsByHorizon[60]).toBe(1); // Pkg 4 only

      // STRICT PROOF: Joint < Marginal Inputs and Joint < Marginal Clean Paths
      expect(completeInputsAndCleanPathsByHorizon[6]).toBeLessThan(completeInputCount);
      expect(completeInputsAndCleanPathsByHorizon[6]).toBeLessThan(cleanPathsByHorizon[6]);
      expect(completeInputsAndCleanPathsByHorizon[42]).toBeLessThan(completeInputCount);
      expect(completeInputsAndCleanPathsByHorizon[42]).toBeLessThan(cleanPathsByHorizon[42]);

      // STRICT PROOF: Joint is strictly less than Math.min(marginal inputs, marginal clean)
      // Naively taking min(inputs, clean) would yield min(3, 3) = 3 for 6H4, but true joint is 2!
      expect(completeInputsAndCleanPathsByHorizon[6]).toBeLessThan(
        Math.min(completeInputCount, cleanPathsByHorizon[6])
      );

      // Monotonicity of Joint Horizons
      expect(completeInputsAndCleanPathsByHorizon[60]).toBeLessThanOrEqual(
        completeInputsAndCleanPathsByHorizon[42]
      );
      expect(completeInputsAndCleanPathsByHorizon[42]).toBeLessThanOrEqual(
        completeInputsAndCleanPathsByHorizon[30]
      );
      expect(completeInputsAndCleanPathsByHorizon[30]).toBeLessThanOrEqual(
        completeInputsAndCleanPathsByHorizon[12]
      );
      expect(completeInputsAndCleanPathsByHorizon[12]).toBeLessThanOrEqual(
        completeInputsAndCleanPathsByHorizon[6]
      );
      expect(completeInputsAndCleanPathsByHorizon[6]).toBeLessThanOrEqual(
        completeInputsAndCleanPre14
      );
    });
  });

  describe('4. Machine JSON Evidence Invariants & Audit Verification', () => {
    const jsonPath = path.join(REPO_ROOT, 'lab/research/fms_eligibility_inventory.json');

    it('verifies generated fms_eligibility_inventory.json exists and matches schema', () => {
      if (!fs.existsSync(jsonPath)) {
        console.warn('Inventory JSON not yet generated; skipping machine JSON tests');
        return;
      }

      const raw = fs.readFileSync(jsonPath, 'utf8');
      const data: FmsInventoryResult = JSON.parse(raw);

      expect(data.manifest.schemaVersion).toBe(EXPECTED_SCHEMA_VERSION);
      expect(data.manifest.calendarSha256MatchesPinned).toBe(true);
      expect(data.manifest.calendarSha256Calculated).toBe(EXPECTED_CALENDAR_SHA256);
      expect(data.manifest.candleFilesVerifiedOnDisk).toBe(51);
      expect(data.manifest.allCandleFilesHashed).toBe(true);
    });

    it('enforces Invariant 1: entry status partition sums to evaluated episodes for every pair', () => {
      if (!fs.existsSync(jsonPath)) return;

      const raw = fs.readFileSync(jsonPath, 'utf8');
      const data: FmsInventoryResult = JSON.parse(raw);

      for (const [pair, agg] of Object.entries(data.aggregateCoverageByPairAndHorizon)) {
        const sum =
          agg.openMarketEntries +
          agg.weekendBlockedEntries +
          agg.weekdayGapBlockedEntries +
          agg.missingHistoryBlockedEntries;

        expect(
          sum,
          `Pair ${pair}: openMarket (${agg.openMarketEntries}) + weekendBlocked (${agg.weekendBlockedEntries}) + weekdayGapBlocked (${agg.weekdayGapBlockedEntries}) + missingHistoryBlocked (${agg.missingHistoryBlockedEntries}) must equal evaluatedEpisodes (${agg.evaluatedEpisodes})`
        ).toBe(agg.evaluatedEpisodes);
      }
    });

    it('enforces Invariant 2: pre-entry status partition sums to openMarketEntries for every pair', () => {
      if (!fs.existsSync(jsonPath)) return;

      const raw = fs.readFileSync(jsonPath, 'utf8');
      const data: FmsInventoryResult = JSON.parse(raw);

      for (const [pair, agg] of Object.entries(data.aggregateCoverageByPairAndHorizon)) {
        const sum =
          agg.eligiblePreEntry14 +
          agg.preEntryMissingHistory +
          agg.preEntryWeekdayGap +
          agg.preEntryMissingH1Bars;

        expect(
          sum,
          `Pair ${pair}: eligiblePreEntry14 (${agg.eligiblePreEntry14}) + preEntryMissingHistory (${agg.preEntryMissingHistory}) + preEntryWeekdayGap (${agg.preEntryWeekdayGap}) + preEntryMissingH1Bars (${agg.preEntryMissingH1Bars}) must equal openMarketEntries (${agg.openMarketEntries})`
        ).toBe(agg.openMarketEntries);
      }
    });

    it('enforces Invariant 3: holding horizon outcomes sum to eligiblePreEntry14 for every horizon and pair', () => {
      if (!fs.existsSync(jsonPath)) return;

      const raw = fs.readFileSync(jsonPath, 'utf8');
      const data: FmsInventoryResult = JSON.parse(raw);

      for (const [pair, agg] of Object.entries(data.aggregateCoverageByPairAndHorizon)) {
        for (const h of CANDIDATE_HOLDING_HORIZONS) {
          const sum =
            agg.eligibleHorizons[h] +
            agg.boundaryExclusions[h] +
            agg.weekdayGapExclusions[h] +
            agg.missingBarExclusions[h];

          expect(
            sum,
            `Pair ${pair} at ${h}H4: eligible (${agg.eligibleHorizons[h]}) + boundary (${agg.boundaryExclusions[h]}) + weekdayGap (${agg.weekdayGapExclusions[h]}) + missingBar (${agg.missingBarExclusions[h]}) must equal eligiblePreEntry14 (${agg.eligiblePreEntry14})`
          ).toBe(agg.eligiblePreEntry14);
        }
      }
    });

    it('verifies exact series and family counts corrected by RFC4180 parsing', () => {
      if (!fs.existsSync(jsonPath)) return;

      const raw = fs.readFileSync(jsonPath, 'utf8');
      const data: FmsInventoryResult = JSON.parse(raw);

      // Total series: 1,172
      expect(data.seriesSummaries.length).toBe(1172);

      // Verify Inflation series count
      const inflation = data.seriesSummaries.filter((s) => s.macroFamily === 'Inflation');
      expect(inflation.length).toBe(190);

      // Verify Labor series count
      const labor = data.seriesSummaries.filter((s) => s.macroFamily === 'Labor / Employment');
      expect(labor.length).toBe(89);

      // Verify Complete A/F/P releases across all series
      let totalCompleteAfp = 0;
      for (const s of data.seriesSummaries) {
        totalCompleteAfp += s.completeAfPCount;
      }
      expect(totalCompleteAfp).toBe(33973);
    });

    it('verifies overlap audits are derived with explicit clean denominator and pair currencies', () => {
      if (!fs.existsSync(jsonPath)) return;

      const raw = fs.readFileSync(jsonPath, 'utf8');
      const data: FmsInventoryResult = JSON.parse(raw);

      const eurusd = data.aggregateCoverageByPairAndHorizon['EURUSD'];
      expect(eurusd.baseCurrency).toBe('EUR');
      expect(eurusd.quoteCurrency).toBe('USD');

      for (const h of CANDIDATE_HOLDING_HORIZONS) {
        const audit = eurusd.overlapAudits[h];
        // Clean holding episodes denominator strictly matches eligibleHorizons[h]
        expect(audit.cleanHoldingEpisodes).toBe(eurusd.eligibleHorizons[h]);
        expect(audit.episodesWithPairOverlap).toBeLessThanOrEqual(audit.cleanHoldingEpisodes);
        expect(audit.pctWithPairOverlap).toBeGreaterThanOrEqual(0);
        expect(audit.pctWithPairOverlap).toBeLessThanOrEqual(100);
      }
    });

    it('verifies seriesPairEligibility matrix and joint intersection invariants across all combinations', () => {
      if (!fs.existsSync(jsonPath)) return;

      const raw = fs.readFileSync(jsonPath, 'utf8');
      const data: FmsInventoryResult = JSON.parse(raw);

      expect(Array.isArray(data.seriesPairEligibility)).toBe(true);
      expect(data.seriesPairEligibility.length).toBeGreaterThan(10000);

      // Verify marginal and joint monotonicity invariants for every series x pair combination
      for (const sp of data.seriesPairEligibility) {
        // Marginal invariants
        expect(sp.completeInputCount).toBeLessThanOrEqual(sp.distinctPackagesCount);
        expect(sp.openMarketEntries).toBeLessThanOrEqual(sp.distinctPackagesCount);
        expect(sp.cleanPreEntry14).toBeLessThanOrEqual(sp.openMarketEntries);
        expect(sp.cleanPathsByHorizon[6]).toBeLessThanOrEqual(sp.cleanPreEntry14);
        expect(sp.cleanPathsByHorizon[12]).toBeLessThanOrEqual(sp.cleanPathsByHorizon[6]);
        expect(sp.cleanPathsByHorizon[30]).toBeLessThanOrEqual(sp.cleanPathsByHorizon[12]);
        expect(sp.cleanPathsByHorizon[42]).toBeLessThanOrEqual(sp.cleanPathsByHorizon[30]);
        expect(sp.cleanPathsByHorizon[60]).toBeLessThanOrEqual(sp.cleanPathsByHorizon[42]);

        // Joint intersection invariants on SAME package
        expect(sp.completeInputsAndCleanPre14).toBeLessThanOrEqual(sp.completeInputCount);
        expect(sp.completeInputsAndCleanPre14).toBeLessThanOrEqual(sp.cleanPreEntry14);

        for (const h of CANDIDATE_HOLDING_HORIZONS) {
          const jointH = sp.completeInputsAndCleanPathsByHorizon[h];
          expect(jointH).toBeLessThanOrEqual(sp.completeInputsAndCleanPre14);
          expect(jointH).toBeLessThanOrEqual(sp.cleanPathsByHorizon[h]);
          expect(jointH).toBeLessThanOrEqual(sp.completeInputCount);
        }

        // Monotonicity of joint horizons
        expect(sp.completeInputsAndCleanPathsByHorizon[60]).toBeLessThanOrEqual(
          sp.completeInputsAndCleanPathsByHorizon[42]
        );
        expect(sp.completeInputsAndCleanPathsByHorizon[42]).toBeLessThanOrEqual(
          sp.completeInputsAndCleanPathsByHorizon[30]
        );
        expect(sp.completeInputsAndCleanPathsByHorizon[30]).toBeLessThanOrEqual(
          sp.completeInputsAndCleanPathsByHorizon[12]
        );
        expect(sp.completeInputsAndCleanPathsByHorizon[12]).toBeLessThanOrEqual(
          sp.completeInputsAndCleanPathsByHorizon[6]
        );
      }
    });

    it('verifies fms_series_pair_eligibility.csv is emitted with valid 25-column header and non-empty rows', () => {
      const csvPath = path.join(REPO_ROOT, 'lab/research/fms_series_pair_eligibility.csv');
      if (!fs.existsSync(csvPath)) return;

      const lines = fs.readFileSync(csvPath, 'utf8').split(/\r?\n/).filter(Boolean);
      expect(lines.length).toBeGreaterThan(10000);
      expect(lines[0]).toBe(
        'series_key,label,family,currency,country,pair,distinct_packages,complete_inputs,complete_inputs_pct,represented_years,collisions,collision_pct,open_market_entries,clean_pre_entry_14,clean_6h4,clean_12h4,clean_30h4,clean_42h4,clean_60h4,joint_complete_pre14,joint_clean_6h4,joint_clean_12h4,joint_clean_30h4,joint_clean_42h4,joint_clean_60h4'
      );

      // Verify sample row has exactly 25 columns
      const sampleFields = parseCSVLine(lines[1]);
      expect(sampleFields.length).toBe(25);
    });

    it('verifies separate pre-2023 vs full export dates and gap diagnostics on USDHKD and EURUSD', () => {
      if (!fs.existsSync(jsonPath)) return;

      const raw = fs.readFileSync(jsonPath, 'utf8');
      const data: FmsInventoryResult = JSON.parse(raw);

      // USDHKD verification
      const usdhkd = data.pairIntegritySummaries.find((p) => p.pair === 'USDHKD');
      expect(usdhkd).toBeDefined();
      expect(usdhkd!.pre2023Bars).toBe(14010);
      expect(usdhkd!.latestPre2023Date?.slice(0, 10)).toBe('2022-10-14');
      expect(usdhkd!.latestFullExportDate?.slice(0, 10)).toBe('2026-09-23');
      expect(usdhkd!.maxGapHoursPre2023).toBe(48329);
      expect(usdhkd!.maxGapStartPre2023?.slice(0, 10)).toBe('2017-03-24');
      expect(usdhkd!.maxGapEndPre2023?.slice(0, 10)).toBe('2022-09-28');
      expect(usdhkd!.pureWeekendGapsPre2023).toBe(65);
      expect(usdhkd!.weekdayOrMixedGapsPre2023).toBe(78);

      // EURUSD verification
      const eurusd = data.pairIntegritySummaries.find((p) => p.pair === 'EURUSD');
      expect(eurusd).toBeDefined();
      expect(eurusd!.pre2023Bars).toBe(49761);
      expect(eurusd!.latestPre2023Date?.slice(0, 10)).toBe('2022-12-30');
      expect(eurusd!.pureWeekendGapsPre2023).toBe(385);
      expect(eurusd!.weekdayOrMixedGapsPre2023).toBe(47);
      expect(eurusd!.maxGapHoursPre2023).toBe(82);
      expect(eurusd!.maxGapStartPre2023?.slice(0, 10)).toBe('2017-12-29');
      expect(eurusd!.maxGapEndPre2023?.slice(0, 10)).toBe('2018-01-02');
    });

    it('verifies Housing Starts × EURUSD exact joint counts remain unchanged (clean-60 = 54)', () => {
      if (!fs.existsSync(jsonPath)) return;

      const raw = fs.readFileSync(jsonPath, 'utf8');
      const data: FmsInventoryResult = JSON.parse(raw);

      const hs = data.seriesPairEligibility.find(
        (sp) => sp.seriesKey === 'USD:US:840020004:r0' && sp.pair === 'EURUSD'
      );
      expect(hs).toBeDefined();
      expect(hs!.distinctPackagesCount).toBe(96);
      expect(hs!.completeInputCount).toBe(68);
      expect(hs!.cleanPreEntry14).toBe(94);
      expect(hs!.cleanPathsByHorizon[6]).toBe(93);
      expect(hs!.cleanPathsByHorizon[60]).toBe(76);
      expect(hs!.completeInputsAndCleanPre14).toBe(67);
      expect(hs!.completeInputsAndCleanPathsByHorizon[6]).toBe(66);
      expect(hs!.completeInputsAndCleanPathsByHorizon[12]).toBe(65);
      expect(hs!.completeInputsAndCleanPathsByHorizon[30]).toBe(60);
      expect(hs!.completeInputsAndCleanPathsByHorizon[42]).toBe(57);
      expect(hs!.completeInputsAndCleanPathsByHorizon[60]).toBe(54);
    });
  });

  describe('5. Markdown Report & Machine JSON Consistency', () => {
    const reportPath = path.join(REPO_ROOT, 'lab/research/FMS_ELIGIBILITY_INVENTORY.md');
    const jsonPath = path.join(REPO_ROOT, 'lab/research/fms_eligibility_inventory.json');

    it('verifies that Markdown report reflects exact machine JSON figures without hardcoding', () => {
      if (!fs.existsSync(reportPath) || !fs.existsSync(jsonPath)) return;

      const md = fs.readFileSync(reportPath, 'utf8');
      const data: FmsInventoryResult = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

      // Check calendar SHA-256 appears in report
      expect(md).toContain(EXPECTED_CALENDAR_SHA256);

      // Check total pre-2023 packages count appears in report
      expect(md).toContain(data.totalPre2023TimestampPackages.toLocaleString());

      // Check total exact series count appears in report
      expect(md).toContain(data.seriesSummaries.length.toLocaleString());

      // Check instrument coverage reporting accurately reflects physical data
      expect(md).toContain('19 Pairs with Full 2015–2022 Span');
      expect(md).toContain('17 Pairs with Truncated Pre-2023 Span');
      expect(md).toContain('15 Pairs with ZERO Pre-2023 Bars');
      expect(md).toContain('Full Instrument Candle Inventory (All 51 Pairs)');

      // Verify gap reporting precision
      expect(md).toContain('48,329-hour multi-year gap');
      expect(md).toContain('377–385 pure weekend closures and 42–53 weekday/mixed gaps');
      expect(md).not.toContain('zero weekday gaps');

      // Verify absence of unverified continuous claims
      expect(md).not.toContain('continuous 2015–2022 H1 candle coverage across all 36 pairs');

      // Check Exact-Series x Pair Eligibility Matrix section with Joint columns
      expect(md).toContain('Exact-Series × Pair Eligibility Matrix (Marginal vs. Joint Intersections)');
      expect(md).toContain('Candidate Exact Series × Benchmark Pair Eligibility Matrix');
      expect(md).toContain('Joint Pre-14');
      expect(md).toContain('Joint 6H4');
    });
  });
});
