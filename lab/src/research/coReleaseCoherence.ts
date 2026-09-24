import { ParsedEventRelease } from '../shared/types.js';

export type CoReleaseCoherenceStatus =
  | 'COHERENT'
  | 'CONFLICTING'
  | 'ISOLATED'
  | 'NEUTRAL'
  | 'UNCLASSIFIED';

/**
 * Evaluates pairwise directional coherence of explicitly defined simultaneous releases sharing the same currency and timestamp.
 *
 * NOTE: These are strictly pairwise labels between predefined partner indicators, NOT proof that an entire multi-release bundle agrees.
 *
 * Explicitly Defined Pairings:
 * - Headline CPI (840030005) vs Core CPI (840030006): same surprise sign is COHERENT; opposing surprise sign is CONFLICTING.
 * - Nonfarm Payrolls (840030016) vs Unemployment Rate (840030015): opposite surprise sign is COHERENT (e.g. NFP beat + Unemp drop); same surprise sign is CONFLICTING.
 *
 * Status Definitions:
 * - 'ISOLATED': Target release occurred with no other concurrent releases at the same currency and timestamp.
 * - 'NEUTRAL': Target release has zero or null surprise delta.
 * - 'UNCLASSIFIED': Simultaneous releases that do not belong to the explicitly defined pairs above, or where the partner indicator has a zero or null surprise delta.
 */
export function evaluateCoReleaseCoherence(
  targetRelease: ParsedEventRelease,
  allConcurrentReleases: ParsedEventRelease[]
): CoReleaseCoherenceStatus {
  // Exclude the target release itself
  const others = allConcurrentReleases.filter((r) => r.valueId !== targetRelease.valueId);

  if (others.length === 0) {
    return 'ISOLATED';
  }

  if (targetRelease.surpriseDelta === null || Math.abs(targetRelease.surpriseDelta) < 1e-9) {
    return 'NEUTRAL';
  }

  const targetSign = Math.sign(targetRelease.surpriseDelta);

  // 1. Headline CPI (840030005) paired with Core CPI (840030006)
  if (targetRelease.eventId === '840030005') {
    const coreCpi = others.find((r) => r.eventId === '840030006' && r.surpriseDelta !== null);
    if (coreCpi && coreCpi.surpriseDelta !== null && Math.abs(coreCpi.surpriseDelta) >= 1e-9) {
      const coreSign = Math.sign(coreCpi.surpriseDelta);
      return coreSign === targetSign ? 'COHERENT' : 'CONFLICTING';
    }
    return 'UNCLASSIFIED';
  }

  // 2. Core CPI (840030006) paired with Headline CPI (840030005)
  if (targetRelease.eventId === '840030006') {
    const headlineCpi = others.find((r) => r.eventId === '840030005' && r.surpriseDelta !== null);
    if (headlineCpi && headlineCpi.surpriseDelta !== null && Math.abs(headlineCpi.surpriseDelta) >= 1e-9) {
      const headSign = Math.sign(headlineCpi.surpriseDelta);
      return headSign === targetSign ? 'COHERENT' : 'CONFLICTING';
    }
    return 'UNCLASSIFIED';
  }

  // 3. Nonfarm Payrolls (840030016) paired with Unemployment Rate (840030015)
  if (targetRelease.eventId === '840030016') {
    const unemp = others.find((r) => r.eventId === '840030015' && r.surpriseDelta !== null);
    if (unemp && unemp.surpriseDelta !== null && Math.abs(unemp.surpriseDelta) >= 1e-9) {
      const unempSign = Math.sign(unemp.surpriseDelta);
      // For unemployment, higher rate is economically weaker (opposite sign to jobs beat)
      // So NFP beat (+) + Unemp drop (-) is COHERENT (both signal stronger labor)
      // NFP miss (-) + Unemp rise (+) is COHERENT (both signal weaker labor)
      return unempSign === -targetSign ? 'COHERENT' : 'CONFLICTING';
    }
    return 'UNCLASSIFIED';
  }

  // 4. Unemployment Rate (840030015) paired with Nonfarm Payrolls (840030016)
  if (targetRelease.eventId === '840030015') {
    const nfp = others.find((r) => r.eventId === '840030016' && r.surpriseDelta !== null);
    if (nfp && nfp.surpriseDelta !== null && Math.abs(nfp.surpriseDelta) >= 1e-9) {
      const nfpSign = Math.sign(nfp.surpriseDelta);
      return nfpSign === -targetSign ? 'COHERENT' : 'CONFLICTING';
    }
    return 'UNCLASSIFIED';
  }

  // Any other simultaneous combination of indicators is strictly UNCLASSIFIED
  return 'UNCLASSIFIED';
}
