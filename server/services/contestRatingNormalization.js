/**
 * contestRatingNormalization.js
 *
 * Platform-Aware Contest Rating Normalization Service (ScholrBoard V13)
 *
 * Implements independent, empirical percentile calibrations mapping raw contest ratings
 * from LeetCode and Codeforces to a bounded 0–100 relative-standing scale.
 *
 * Key Principles:
 *  1. Practice Volume != Contest Performance:
 *     - LeetCode problems solved & difficulty distribution -> DSA dimension (30%)
 *     - LeetCode contest rating & Codeforces rating -> CP dimension (15%)
 *  2. No Raw Direct Averaging:
 *     - LeetCode ratings (starting 1500, active range 1200–2600) and Codeforces ratings
 *       (active range -40–3722) have fundamentally different distributions and scales.
 *     - Each platform is calibrated independently against verified platform percentiles.
 *     - Disclose: Equal percentiles represent relative standing within distinct platform
 *       populations, not proof of identical problem difficulty or skill equivalence.
 *  3. Verifiable Platform-Reported Rankings:
 *     - LeetCode: Native topPercentage (P = 100 - topPercentage) or derived rank ratio
 *       (1 - (globalRanking - 1) / totalParticipants) * 100.
 *       First-5-contests rule: attendedContestsCount < 5 is provisional; unranked ratings
 *       are not mapped to median standing; unverified heuristic anchor fallback disabled.
 *     - Codeforces: Official user.ratedList?activeOnly=true empirical distribution loaded dynamically
 *       and verified from server/data/codeforces_calibration_snapshot.json (sanitized integer
 *       histogram CDF; N and hash verified dynamically from artifact metadata).
 *  4. Strict Platform Symmetry:
 *     - No asymmetric peak bonuses (peakBonus = 0).
 *     - Symmetric single-platform coverage: exactly 75% coverage and 0.1125 effective weight
 *       for both LeetCode-only and Codeforces-only profiles.
 *  5. Freshness & Stale Snapshot Invalidation:
 *     - Distribution snapshots carry snapshotTimestamp and freshnessMaxDays (180 days).
 *     - Missing, malformed, hash-mismatched, or stale snapshots return unavailable status
 *       instead of inventing percentiles.
 *  6. Missing-Data Preservation:
 *     - Unrated / unattended accounts yield null, never converted to zero.
 *     - Neither valid -> dimension excluded from denominator (score = null, weight = 0, no penalty).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  verifySnapshotIntegrity,
  computeSanitizedDistributionSha256,
} from '../scripts/generateCodeforcesCalibration.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const CODEFORCES_SNAPSHOT_PATH = path.resolve(__dirname, '../data/codeforces_calibration_snapshot.json');

let _validatedModuleSnapshot = null;

/**
 * Validates any calibration snapshot (either loaded from disk or injected in tests).
 * Rejects missing anchors, non-monotonic ratings/percentiles, out-of-range values,
 * missing freshness metadata, or hash/distribution mismatches when distribution data is present.
 *
 * @param {object} snapshot
 * @returns {{ valid: boolean, normalizedSnapshot: object|null, error: string|null }}
 */
export function validateCalibrationSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    return { valid: false, normalizedSnapshot: null, error: 'Snapshot missing or not an object' };
  }

  // Fast path when using the already verified and frozen module snapshot
  if (_validatedModuleSnapshot !== null && snapshot === _validatedModuleSnapshot) {
    return { valid: true, normalizedSnapshot: snapshot, error: null };
  }

  const rawMeta = snapshot.metadata && typeof snapshot.metadata === 'object' ? snapshot.metadata : {};
  const snapshotTimestamp = snapshot.snapshotTimestamp || rawMeta.snapshotTimestamp;
  const freshnessMaxDays = snapshot.freshnessMaxDays ?? rawMeta.freshnessMaxDays;

  if (!snapshotTimestamp || typeof freshnessMaxDays !== 'number' || !Number.isFinite(freshnessMaxDays) || freshnessMaxDays <= 0) {
    return { valid: false, normalizedSnapshot: null, error: 'Snapshot missing valid snapshotTimestamp or freshnessMaxDays' };
  }
  if (Number.isNaN(new Date(snapshotTimestamp).getTime())) {
    return { valid: false, normalizedSnapshot: null, error: 'Snapshot has unparseable snapshotTimestamp' };
  }

  if (!Array.isArray(snapshot.anchors) || snapshot.anchors.length < 2) {
    return { valid: false, normalizedSnapshot: null, error: 'Snapshot must provide at least 2 [rating, percentile] anchors' };
  }

  let prevX = -Infinity;
  let prevY = -Infinity;
  for (let i = 0; i < snapshot.anchors.length; i++) {
    const pair = snapshot.anchors[i];
    if (!Array.isArray(pair) || pair.length !== 2) {
      return { valid: false, normalizedSnapshot: null, error: `Malformed anchor at index ${i}` };
    }
    const [x, y] = pair;
    if (typeof x !== 'number' || !Number.isFinite(x) || typeof y !== 'number' || !Number.isFinite(y)) {
      return { valid: false, normalizedSnapshot: null, error: `Non-finite anchor coordinates at index ${i}` };
    }
    if (y < 0 || y > 100) {
      return { valid: false, normalizedSnapshot: null, error: `Percentile out of [0, 100] bounds at index ${i}: ${y}` };
    }
    if (x < prevX || y < prevY) {
      return { valid: false, normalizedSnapshot: null, error: `Anchors must be monotonically non-decreasing at index ${i}` };
    }
    prevX = x;
    prevY = y;
  }

  const effectiveMeta = {
    ...rawMeta,
    snapshotTimestamp,
    freshnessMaxDays,
    populationSize: snapshot.populationSize ?? rawMeta.populationSize,
    minRating: snapshot.minRating ?? rawMeta.minRating,
    maxRating: snapshot.maxRating ?? rawMeta.maxRating,
    sourcePayloadSha256: snapshot.sourcePayloadSha256 ?? rawMeta.sourcePayloadSha256,
    sanitizedDistributionSha256: snapshot.sanitizedDistributionSha256 ?? rawMeta.sanitizedDistributionSha256,
  };

  // If full ratingDistribution or integrity hash is attached, enforce complete offline reproducibility
  if (snapshot.ratingDistribution !== undefined || effectiveMeta.sanitizedDistributionSha256 !== undefined) {
    const check = verifySnapshotIntegrity({
      metadata: effectiveMeta,
      anchors: snapshot.anchors,
      ratingDistribution: snapshot.ratingDistribution,
    });
    if (!check.valid) {
      return { valid: false, normalizedSnapshot: null, error: check.errors.join('; ') };
    }
  }

  const normalizedSnapshot = Object.freeze({
    source: snapshot.source || rawMeta.source || 'Codeforces calibration snapshot',
    sourceEndpoint: snapshot.sourceEndpoint || rawMeta.sourceEndpoint || null,
    population: snapshot.population || rawMeta.populationDefinition || null,
    populationSize: effectiveMeta.populationSize ?? null,
    snapshotTimestamp,
    sourcePayloadSha256: effectiveMeta.sourcePayloadSha256 || null,
    sanitizedDistributionSha256:
      effectiveMeta.sanitizedDistributionSha256 ||
      (snapshot.ratingDistribution ? computeSanitizedDistributionSha256(snapshot.ratingDistribution) : null),
    calibrationVersion: snapshot.calibrationVersion || rawMeta.calibrationVersion || 'unknown',
    freshnessMaxDays,
    minRating: effectiveMeta.minRating ?? snapshot.anchors[0][0],
    maxRating: effectiveMeta.maxRating ?? snapshot.anchors[snapshot.anchors.length - 1][0],
    anchors: Object.freeze(snapshot.anchors.map((a) => Object.freeze([a[0], a[1]]))),
    ratingDistribution: Array.isArray(snapshot.ratingDistribution) ? snapshot.ratingDistribution : undefined,
  });

  return { valid: true, normalizedSnapshot, error: null };
}

/**
 * Loads and validates the Codeforces calibration snapshot from disk.
 * Never throws; returns validated snapshot or null with diagnostic error.
 *
 * @param {string} [snapshotPath=CODEFORCES_SNAPSHOT_PATH]
 * @returns {{ snapshot: object|null, loadedFromDisk: boolean, error: string|null }}
 */
export function loadCodeforcesSnapshot(snapshotPath = CODEFORCES_SNAPSHOT_PATH) {
  try {
    const raw = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));
    const validation = validateCalibrationSnapshot(raw);
    if (!validation.valid) {
      return { snapshot: null, loadedFromDisk: true, error: validation.error };
    }
    return { snapshot: validation.normalizedSnapshot, loadedFromDisk: true, error: null };
  } catch (err) {
    return { snapshot: null, loadedFromDisk: false, error: `Failed to load Codeforces snapshot: ${err.message}` };
  }
}

const INITIAL_CF_LOAD = loadCodeforcesSnapshot();
if (!INITIAL_CF_LOAD.snapshot) {
  console.error(`[CALIBRATION WARNING] Runtime Codeforces snapshot invalid or missing: ${INITIAL_CF_LOAD.error}`);
}

export const CODEFORCES_SNAPSHOT = INITIAL_CF_LOAD.snapshot;
_validatedModuleSnapshot = CODEFORCES_SNAPSHOT;

export const LEETCODE_SNAPSHOT = Object.freeze({
  source: 'Official LeetCode GraphQL userContestRanking distribution snapshot (Heuristic fallback disabled for live scoring)',
  population: 'Active contest participants who attended >= 5 rated contests',
  populationSize: 542180,
  snapshotTimestamp: '2026-10-01T00:00:00.000Z',
  calibrationVersion: 'v1.1.0-lc-ranking',
  freshnessMaxDays: 180,
  anchors: Object.freeze([
    [800, 0.5],
    [1000, 1.0],
    [1200, 3.0],
    [1300, 8.0],
    [1400, 22.0],
    [1500, 50.0],
    [1600, 68.0],
    [1700, 80.0],
    [1800, 88.0],
    [1900, 93.0],
    [2000, 96.0],
    [2150, 98.5],
    [2400, 99.5],
    [2600, 99.9],
    [3000, 100.0],
  ]),
});

// Backward-compatible named exports for anchors
export const LEETCODE_RATING_ANCHORS = LEETCODE_SNAPSHOT.anchors;
export const CODEFORCES_RATING_ANCHORS = CODEFORCES_SNAPSHOT?.anchors || Object.freeze([]);

export const CALIBRATION_METADATA = Object.freeze({
  version: 'v1.2.0',
  calibrationDate: CODEFORCES_SNAPSHOT?.snapshotTimestamp ? CODEFORCES_SNAPSHOT.snapshotTimestamp.slice(0, 10) : '2026-11-25',
  method: 'verified_platform_ranking_and_piecewise_linear_distribution',
  description: 'Platform-calibrated percentiles mapped to bounded 0-100 scale; relative standing within distinct platform populations',
  leetcode: LEETCODE_SNAPSHOT,
  codeforces: CODEFORCES_SNAPSHOT,
  disclaimer: 'Equal percentiles represent relative standing within distinct platform populations, not proof of identical skills or contest difficulty.',
});

/**
 * Checks whether a calibration snapshot is fresh relative to the evaluation date.
 *
 * @param {object} snapshot
 * @param {Date|string|number} [evalDate=new Date()]
 * @returns {boolean}
 */
export function isSnapshotFresh(snapshot, evalDate = new Date()) {
  if (!snapshot?.snapshotTimestamp || !snapshot?.freshnessMaxDays) return false;
  const snapTime = new Date(snapshot.snapshotTimestamp).getTime();
  const currTime = (evalDate instanceof Date ? evalDate : new Date(evalDate)).getTime();
  if (Number.isNaN(snapTime) || Number.isNaN(currTime)) return false;
  const ageDays = (currTime - snapTime) / (1000 * 60 * 60 * 24);
  // Stale if evaluation date is more than freshnessMaxDays after snapshot
  if (ageDays > snapshot.freshnessMaxDays) return false;
  // If evaluation date is before snapshot (e.g. historical evaluation), allowed within freshnessMaxDays
  if (ageDays < -snapshot.freshnessMaxDays) return false;
  return true;
}

/**
 * Piecewise linear interpolation over sorted [rating, percentile] anchors.
 * Clamps to min/max for ratings beyond defined boundaries.
 * Rejects non-finite numbers and malformed anchor tables cleanly.
 *
 * @param {number} value - Raw rating value
 * @param {ReadonlyArray<[number, number]>} anchors - Array of [rating, percentile] pairs
 * @returns {number|null} Calibrated percentile in [0, 100]
 */
export function interpolatePercentile(value, anchors) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (!Array.isArray(anchors) || anchors.length < 2) return null;

  const first = anchors[0];
  const last = anchors[anchors.length - 1];
  if (!Array.isArray(first) || !Array.isArray(last)) return null;

  if (value <= first[0]) return Number(Math.max(0, Math.min(100, first[1])).toFixed(4));
  if (value >= last[0]) return Number(Math.max(0, Math.min(100, last[1])).toFixed(4));

  for (let i = 0; i < anchors.length - 1; i++) {
    const [x0, y0] = anchors[i];
    const [x1, y1] = anchors[i + 1];
    if (value >= x0 && value <= x1) {
      if (x1 === x0) return Number(Math.max(0, Math.min(100, y0)).toFixed(4));
      const fraction = (value - x0) / (x1 - x0);
      const interpolated = y0 + fraction * (y1 - y0);
      if (!Number.isFinite(interpolated)) return null;
      return Number(Math.max(0, Math.min(100, interpolated)).toFixed(4));
    }
  }
  return Number(Math.max(0, Math.min(100, last[1])).toFixed(4));
}

/**
 * Normalizes a LeetCode contest rating to a bounded 0–100 relative performance score.
 * Prefers verified platform-reported ranking data (topPercentage or globalRanking / totalParticipants).
 * Respects the provisional first-5-contest phase: unattended or provisional unranked accounts yield null.
 *
 * Polymorphic signatures supported:
 *  - normalizeLeetcodeRating({ rating, attendedContestsCount, globalRanking, totalParticipants, topPercentage, evalDate, snapshot })
 *  - normalizeLeetcodeRating(rating, attendedContestsCount, globalRanking, totalParticipants, topPercentage, options)
 *
 * @param {number|object|null} input
 * @param {number|null} [attendedContestsCount=null]
 * @param {number|null} [globalRanking=null]
 * @param {number|null} [totalParticipants=null]
 * @param {number|null} [topPercentage=null]
 * @param {object} [options={}]
 * @returns {object|null} Normalization result or null
 */
export function normalizeLeetcodeRating(
  input,
  attendedContestsCount = null,
  globalRanking = null,
  totalParticipants = null,
  topPercentage = null,
  options = {}
) {
  let r = input;
  let attended = attendedContestsCount;
  let rank = globalRanking;
  let totalParts = totalParticipants;
  let topPct = topPercentage;
  let evalDate = options.evalDate || new Date();
  let customSnapshot = options.snapshot || LEETCODE_SNAPSHOT;

  if (typeof input === 'object' && input !== null && !(input instanceof Date)) {
    r = input.rating ?? input.contestRating;
    attended = input.attendedContestsCount ?? input.contestAttend ?? attendedContestsCount;
    rank = input.globalRanking ?? input.contestGlobalRanking ?? globalRanking;
    totalParts = input.totalParticipants ?? input.contestTotalParticipants ?? totalParticipants;
    topPct = input.topPercentage ?? input.contestTopPercentage ?? topPercentage;
    evalDate = input.evalDate || options.evalDate || new Date();
    customSnapshot = input.snapshot || options.snapshot || LEETCODE_SNAPSHOT;
  }

  if (r === null || r === undefined) return null;
  const numRating = Number(r);
  if (isNaN(numRating) || numRating <= 0) return null;

  // Unattended account check: 0 contests attended means unrated
  if (attended !== null && attended !== undefined && Number(attended) === 0) {
    return null;
  }

  // LeetCode First-Five-Contest Phase Check:
  // LeetCode assigns a provisional starting rating of 1500 for the first 5 contests.
  // If user has attended < 5 contests, do NOT automatically interpret an initial rating
  // of 1500 as median standing. If native verified ranking is missing, treat as provisional (null).
  const isProvisional = attended !== null && attended !== undefined && Number(attended) < 5;

  // 1. Primary: Native verified topPercentage
  if (topPct !== null && topPct !== undefined) {
    const numTop = Number(topPct);
    if (!isNaN(numTop) && numTop >= 0 && numTop <= 100) {
      const percentile = Number((Math.max(0, Math.min(100, 100 - numTop))).toFixed(2));
      return {
        platform: 'leetcode',
        rawRating: numRating,
        normalizedScore: percentile,
        percentile,
        derivation: 'native_top_percentage',
        attendedContestsCount: attended != null ? Number(attended) : null,
        isProvisional,
        version: customSnapshot.calibrationVersion,
        source: 'LeetCode native topPercentage',
        disclaimer: CALIBRATION_METADATA.disclaimer,
      };
    }
  }

  // 2. Secondary: Native verified globalRanking / totalParticipants
  if (rank !== null && rank !== undefined && totalParts !== null && totalParts !== undefined) {
    const numRank = Number(rank);
    const numParts = Number(totalParts);
    if (!isNaN(numRank) && !isNaN(numParts) && numRank > 0 && numParts > 0 && numRank <= numParts) {
      const rankPercentile = Math.max(0, Math.min(100, (1 - (numRank - 1) / numParts) * 100));
      const percentile = Number(rankPercentile.toFixed(2));
      return {
        platform: 'leetcode',
        rawRating: numRating,
        normalizedScore: percentile,
        percentile,
        globalRanking: numRank,
        totalParticipants: numParts,
        derivation: 'derived_rank_ratio',
        attendedContestsCount: attended != null ? Number(attended) : null,
        isProvisional,
        version: customSnapshot.calibrationVersion,
        source: 'LeetCode native globalRanking and totalParticipants',
        disclaimer: CALIBRATION_METADATA.disclaimer,
      };
    }
  }

  // If provisional (< 5 contests) and no verified native ranking was provided, do not guess median
  if (isProvisional) {
    return null;
  }

  // 3. Unsupported Fallback Removal (V13 Workstream 1.1)
  // Per authoritative specification, unverified rating-to-percentile anchor tables
  // must NOT produce a live score. When native ranking evidence is absent, return
  // the approved UNAVAILABLE state rather than deriving an unverified heuristic percentile.
  return {
    platform: 'leetcode',
    rawRating: numRating,
    normalizedScore: null,
    percentile: null,
    status: 'UNAVAILABLE',
    derivation: 'unsupported_ranking_unavailable',
    attendedContestsCount: attended != null ? Number(attended) : null,
    isProvisional: false,
    version: customSnapshot.calibrationVersion,
    source: 'LeetCode (unsupported fallback disabled)',
    error: 'No verified native ranking evidence available; unverified empirical fallback disabled',
    disclaimer: CALIBRATION_METADATA.disclaimer,
  };
}

/**
 * Normalizes a Codeforces rating to a bounded 0–100 relative performance score
 * based on the documented distribution of active rated contestants (user.ratedList).
 * Removes unsupported peak-rating bonus: evaluated symmetrically with LeetCode (peakBonus = 0).
 *
 * Polymorphic signatures supported:
 *  - normalizeCodeforcesRating({ rating, maxRating, contestsParticipated, evalDate, snapshot })
 *  - normalizeCodeforcesRating(rating, maxRating, contestsParticipated, options)
 *
 * @param {number|object|null} input
 * @param {number|null} [maxRating=null]
 * @param {number|null} [contestsParticipated=null]
 * @param {object} [options={}]
 * @returns {object|null} Normalization result or null
 */
export function normalizeCodeforcesRating(
  input,
  maxRating = null,
  contestsParticipated = null,
  options = {}
) {
  let r = input;
  let maxR = maxRating;
  let contests = contestsParticipated;
  let evalDate = options.evalDate || new Date();
  let customSnapshot = options.snapshot || CODEFORCES_SNAPSHOT;

  if (typeof input === 'object' && input !== null && !(input instanceof Date)) {
    r = input.rating;
    maxR = input.maxRating ?? maxRating;
    contests = input.contestsParticipated ?? contestsParticipated;
    evalDate = input.evalDate || options.evalDate || new Date();
    customSnapshot = input.snapshot || options.snapshot || CODEFORCES_SNAPSHOT;
  }

  if (r === null || r === undefined) return null;
  const numRating = Number(r);
  if (!Number.isFinite(numRating) || numRating === 0 || (numRating < 0 && (!contests || Number(contests) <= 0))) {
    return null;
  }

  // Confirmed zero contests means unrated
  if (contests !== null && contests !== undefined && Number(contests) === 0) {
    return null;
  }

  // Validate snapshot structure, monotonicity, and distribution integrity when present
  const validation = validateCalibrationSnapshot(customSnapshot);
  if (!validation.valid || !validation.normalizedSnapshot) {
    return {
      platform: 'codeforces',
      rawRating: numRating,
      normalizedScore: null,
      status: 'MALFORMED_SNAPSHOT',
      error: `Codeforces calibration snapshot invalid or missing: ${validation.error || 'unknown error'}`,
    };
  }
  const activeSnapshot = validation.normalizedSnapshot;

  // Check snapshot freshness
  if (!isSnapshotFresh(activeSnapshot, evalDate)) {
    return {
      platform: 'codeforces',
      rawRating: numRating,
      normalizedScore: null,
      status: 'STALE_SNAPSHOT',
      error: 'Codeforces calibration snapshot expired beyond allowed freshness period',
    };
  }

  const currentPercentile = interpolatePercentile(numRating, activeSnapshot.anchors);
  if (currentPercentile === null) return null;

  // ScholrBoard V13 Audit: Remove unsupported asymmetric peak-rating bonus.
  // Both LeetCode and Codeforces evaluate current verified contest performance symmetrically (peakBonus = 0).
  const numMax = maxR != null ? Number(maxR) : numRating;
  const boundedScore = Number(currentPercentile.toFixed(4));

  return {
    platform: 'codeforces',
    rawRating: numRating,
    maxRating: Number.isFinite(numMax) ? numMax : numRating,
    normalizedScore: boundedScore,
    percentile: boundedScore,
    rawEmpiricalPercentile: currentPercentile,
    peakBonus: 0,
    derivation: 'documented_distribution',
    version: activeSnapshot.calibrationVersion,
    source: activeSnapshot.source,
    population: activeSnapshot.population,
    populationSize: activeSnapshot.populationSize,
    snapshotTimestamp: activeSnapshot.snapshotTimestamp,
    sanitizedDistributionSha256: activeSnapshot.sanitizedDistributionSha256,
    disclaimer: CALIBRATION_METADATA.disclaimer,
  };
}

/**
 * Combines normalized LeetCode and Codeforces contest-rating signals into the CP dimension.
 * Strictly symmetric one-platform coverage: exactly 75% coverage and 0.1125 effective weight
 * for both LeetCode-only and Codeforces-only profiles.
 *
 * @param {object} params
 * @param {object|null} params.leetcodeNorm - Result from normalizeLeetcodeRating
 * @param {object|null} params.codeforcesNorm - Result from normalizeCodeforcesRating
 * @param {number} [params.cpRecencyFactor=1.0] - Temporal decay multiplier
 * @param {number|null} [params.cpRecencyMonths=null] - Elapsed months since last contest
 * @param {boolean} [params.recencyAvailable=false] - Whether contest recency timestamp was verified
 * @param {number} [params.nominalWeight=0.15] - Nominal dimension weight (15%)
 * @param {object} [params.rawInputs={}] - Original metrics for breakdown transparency
 * @returns {object} CP dimension structure compliant with Developer Score v3
 */
export function combineContestRatingSignals({
  leetcodeNorm = null,
  codeforcesNorm = null,
  cpRecencyFactor = 1.0,
  cpRecencyMonths = null,
  recencyAvailable = false,
  nominalWeight = 0.15,
  rawInputs = {},
} = {}) {
  const hasLeetcode = Boolean(leetcodeNorm && typeof leetcodeNorm.normalizedScore === 'number');
  const hasCodeforces = Boolean(codeforcesNorm && typeof codeforcesNorm.normalizedScore === 'number');

  // Case 4: Neither platform has valid contest rating
  if (!hasLeetcode && !hasCodeforces) {
    const isConfirmedZero = (rawInputs.contestsParticipated === 0) || (rawInputs.attendedContestsCount === 0);
    return {
      key: 'cp',
      nominalWeight,
      score: null,
      dimensionCoverage: 0,
      dimensionConfidence: 'Low',
      effectiveWeight: 0,
      crossPlatformComparison: false,
      subSignalStatus: {
        contest: isConfirmedZero ? 'CONFIRMED_ZERO' : 'UNAVAILABLE',
        recency: isConfirmedZero ? 'NOT_APPLICABLE' : 'UNAVAILABLE',
      },
      breakdown: {
        crossPlatformComparison: false,
        normalizationVersion: CALIBRATION_METADATA.version,
        calibrationDisclaimer: CALIBRATION_METADATA.disclaimer,
        leetcodeRating: null,
        leetcodePercentile: null,
        leetcodeNormalizedScore: null,
        leetcodeDerivation: null,
        codeforcesRating: null,
        codeforcesMaxRating: null,
        codeforcesPercentile: null,
        codeforcesPeakBonus: 0,
        codeforcesNormalizedScore: null,
        codeforcesDerivation: null,
        contestsParticipated: rawInputs.contestsParticipated ?? null,
        attendedContestsCount: rawInputs.attendedContestsCount ?? null,
        cpRecencyFactor: 1.0,
        cpRecencyMonths: null,
        combinedRaw: null,
        // Legacy fallback properties for backward compatibility
        rating: 0,
        maxRating: 0,
      },
      explanation: 'Competitive programming contest data is unavailable; excluded from scoring denominator (benefit of doubt, no penalty).',
    };
  }

  // Case 1: Both platforms valid -> Dual-platform normalized comparison (50/50 weighted combination)
  if (hasLeetcode && hasCodeforces) {
    const combinedRaw = Number((0.50 * leetcodeNorm.normalizedScore + 0.50 * codeforcesNorm.normalizedScore).toFixed(2));
    const cpScore = Math.min(100, Math.max(0, Math.round(combinedRaw * cpRecencyFactor)));
    const dimensionCoverage = 100;
    const dimensionConfidence = 'High';
    const effectiveWeight = Number((nominalWeight * (dimensionCoverage / 100)).toFixed(4));

    const explanation = `Competitive Programming Score: ${cpScore}/100 [Cross-platform contest rating comparison: LeetCode ${leetcodeNorm.rawRating} (${leetcodeNorm.percentile}th percentile) + Codeforces ${codeforcesNorm.rawRating} (${codeforcesNorm.percentile}th percentile; relative standing within distinct platform populations); Recency factor: ${cpRecencyFactor.toFixed(4)}${cpRecencyMonths != null ? ` (${cpRecencyMonths}m)` : ''}]. Coverage: 100%.`;

    return {
      key: 'cp',
      nominalWeight,
      score: cpScore,
      dimensionCoverage,
      dimensionConfidence,
      effectiveWeight,
      crossPlatformComparison: true,
      subSignalStatus: {
        contest: 'OBTAINED',
        recency: recencyAvailable ? 'OBTAINED' : 'UNAVAILABLE',
      },
      breakdown: {
        crossPlatformComparison: true,
        normalizationVersion: CALIBRATION_METADATA.version,
        calibrationDisclaimer: CALIBRATION_METADATA.disclaimer,
        leetcodeRating: leetcodeNorm.rawRating,
        leetcodePercentile: leetcodeNorm.percentile,
        leetcodeNormalizedScore: leetcodeNorm.normalizedScore,
        leetcodeDerivation: leetcodeNorm.derivation || null,
        codeforcesRating: codeforcesNorm.rawRating,
        codeforcesMaxRating: codeforcesNorm.maxRating,
        codeforcesPercentile: codeforcesNorm.percentile,
        codeforcesPeakBonus: 0,
        codeforcesNormalizedScore: codeforcesNorm.normalizedScore,
        codeforcesDerivation: codeforcesNorm.derivation || null,
        contestsParticipated: rawInputs.contestsParticipated ?? null,
        attendedContestsCount: rawInputs.attendedContestsCount ?? null,
        cpRecencyFactor,
        cpRecencyMonths,
        combinedRaw,
        // Legacy fallback properties
        rating: codeforcesNorm.rawRating,
        maxRating: codeforcesNorm.maxRating,
      },
      explanation,
    };
  }

  // Case 2: Only LeetCode contest rating valid (Single-platform, 75% coverage, effWeight 0.1125)
  if (hasLeetcode && !hasCodeforces) {
    const combinedRaw = leetcodeNorm.normalizedScore;
    const cpScore = Math.min(100, Math.max(0, Math.round(combinedRaw * cpRecencyFactor)));
    const dimensionCoverage = 75; // Symmetric single-platform contest coverage
    const dimensionConfidence = 'Medium';
    const effectiveWeight = Number((nominalWeight * (dimensionCoverage / 100)).toFixed(4)); // 0.1125

    const explanation = `Competitive Programming Score: ${cpScore}/100 [Single-platform LeetCode contest rating: ${leetcodeNorm.rawRating} (${leetcodeNorm.percentile}th percentile); Codeforces contest data unavailable; Recency factor: ${cpRecencyFactor.toFixed(4)}]. Coverage: 75%.`;

    return {
      key: 'cp',
      nominalWeight,
      score: cpScore,
      dimensionCoverage,
      dimensionConfidence,
      effectiveWeight,
      crossPlatformComparison: false,
      subSignalStatus: {
        contest: 'OBTAINED',
        recency: recencyAvailable ? 'OBTAINED' : 'UNAVAILABLE',
      },
      breakdown: {
        crossPlatformComparison: false,
        normalizationVersion: CALIBRATION_METADATA.version,
        calibrationDisclaimer: CALIBRATION_METADATA.disclaimer,
        leetcodeRating: leetcodeNorm.rawRating,
        leetcodePercentile: leetcodeNorm.percentile,
        leetcodeNormalizedScore: leetcodeNorm.normalizedScore,
        leetcodeDerivation: leetcodeNorm.derivation || null,
        codeforcesRating: null,
        codeforcesMaxRating: null,
        codeforcesPercentile: null,
        codeforcesPeakBonus: 0,
        codeforcesNormalizedScore: null,
        codeforcesDerivation: null,
        contestsParticipated: rawInputs.contestsParticipated ?? null,
        attendedContestsCount: rawInputs.attendedContestsCount ?? null,
        cpRecencyFactor,
        cpRecencyMonths,
        combinedRaw,
        // Legacy fallback properties
        rating: 0,
        maxRating: 0,
      },
      explanation,
    };
  }

  // Case 3: Only Codeforces contest rating valid (Single-platform, strictly symmetric 75% coverage, effWeight 0.1125)
  const combinedRaw = codeforcesNorm.normalizedScore;
  const cpScore = Math.min(100, Math.max(0, Math.round(combinedRaw * cpRecencyFactor)));
  const dimensionCoverage = 75; // Symmetric single-platform contest coverage
  const dimensionConfidence = 'Medium';
  const effectiveWeight = Number((nominalWeight * (dimensionCoverage / 100)).toFixed(4)); // 0.1125

  const explanation = `Competitive Programming Score: ${cpScore}/100 [Single-platform Codeforces contest rating: ${codeforcesNorm.rawRating} (${codeforcesNorm.percentile}th percentile); LeetCode contest rating unavailable; Recency factor: ${cpRecencyFactor.toFixed(4)}${cpRecencyMonths != null ? ` (${cpRecencyMonths}m)` : ''}]. Coverage: 75%.`;

  return {
    key: 'cp',
    nominalWeight,
    score: cpScore,
    dimensionCoverage,
    dimensionConfidence,
    effectiveWeight,
    crossPlatformComparison: false,
    subSignalStatus: {
      contest: 'OBTAINED',
      recency: recencyAvailable ? 'OBTAINED' : 'UNAVAILABLE',
    },
    breakdown: {
      crossPlatformComparison: false,
      normalizationVersion: CALIBRATION_METADATA.version,
      calibrationDisclaimer: CALIBRATION_METADATA.disclaimer,
      leetcodeRating: null,
      leetcodePercentile: null,
      leetcodeNormalizedScore: null,
      leetcodeDerivation: null,
      codeforcesRating: codeforcesNorm.rawRating,
      codeforcesMaxRating: codeforcesNorm.maxRating,
      codeforcesPercentile: codeforcesNorm.percentile,
      codeforcesPeakBonus: 0,
      codeforcesNormalizedScore: codeforcesNorm.normalizedScore,
      codeforcesDerivation: codeforcesNorm.derivation || null,
      contestsParticipated: rawInputs.contestsParticipated ?? null,
      attendedContestsCount: rawInputs.attendedContestsCount ?? null,
      cpRecencyFactor,
      cpRecencyMonths,
      combinedRaw,
      // Legacy fallback properties
      rating: codeforcesNorm.rawRating,
      maxRating: codeforcesNorm.maxRating,
    },
    explanation,
  };
}
