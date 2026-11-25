/**
 * generateCodeforcesCalibration.mjs
 *
 * Reproducible data-generation script for Codeforces contest rating normalization.
 *
 * Usage:
 *   node server/scripts/generateCodeforcesCalibration.mjs                # Fetch live user.ratedList?activeOnly=true and write snapshot
 *   node server/scripts/generateCodeforcesCalibration.mjs --from-snapshot # Deterministically recompute & verify anchors from stored ratingDistribution
 *
 * Security & Privacy:
 *   Stores ONLY a sanitized integer-rating frequency histogram (`ratingDistribution: [[rating, count], ...]`).
 *   Zero usernames, handles, profile URLs, or personal identifiers are persisted.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_SNAPSHOT_PATH = path.resolve(__dirname, '../data/codeforces_calibration_snapshot.json');

export const STANDARD_RATING_THRESHOLDS = Object.freeze([
  0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400,
  1500, 1600, 1750, 1900, 2100, 2400, 2600, 3000,
]);

/**
 * Computes canonical SHA-256 of the sanitized integer-rating frequency histogram.
 * @param {Array<[number, number]>} ratingDistribution
 * @returns {string}
 */
export function computeSanitizedDistributionSha256(ratingDistribution) {
  return crypto.createHash('sha256').update(JSON.stringify(ratingDistribution), 'utf-8').digest('hex');
}

/**
 * Deterministically builds sorted [rating, count] histogram from raw integer ratings.
 * @param {number[]} rawRatings
 * @returns {Array<[number, number]>}
 */
export function buildRatingHistogram(rawRatings) {
  const counts = new Map();
  for (const r of rawRatings) {
    if (typeof r !== 'number' || !Number.isFinite(r)) continue;
    const intRating = Math.round(r);
    counts.set(intRating, (counts.get(intRating) || 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) => a[0] - b[0]);
}

/**
 * Deterministically derives empirical CDF anchors strictly from the sanitized ratingDistribution.
 * Empirical CDF definition: P(r) = round((count(rating <= r) / N) * 100, 2).
 *
 * @param {Array<[number, number]>} ratingDistribution
 * @param {number[]} [baseThresholds=STANDARD_RATING_THRESHOLDS]
 * @returns {{ anchors: Array<[number, number]>, populationSize: number, minRating: number, maxRating: number }}
 */
export function recomputeAnchorsFromDistribution(ratingDistribution, baseThresholds = STANDARD_RATING_THRESHOLDS) {
  if (!Array.isArray(ratingDistribution) || ratingDistribution.length === 0) {
    throw new Error('ratingDistribution must be a non-empty array of [rating, count] pairs');
  }

  let populationSize = 0;
  let prevRating = -Infinity;
  for (const pair of ratingDistribution) {
    if (!Array.isArray(pair) || pair.length !== 2) {
      throw new Error('Malformed ratingDistribution entry: expected [rating, count]');
    }
    const [r, c] = pair;
    if (typeof r !== 'number' || !Number.isFinite(r) || typeof c !== 'number' || !Number.isInteger(c) || c <= 0) {
      throw new Error(`Invalid ratingDistribution pair: [${r}, ${c}]`);
    }
    if (r <= prevRating) {
      throw new Error(`ratingDistribution must be strictly sorted ascending (got ${r} after ${prevRating})`);
    }
    prevRating = r;
    populationSize += c;
  }

  const minRating = ratingDistribution[0][0];
  const maxRating = ratingDistribution[ratingDistribution.length - 1][0];

  const thresholdSet = new Set([minRating, maxRating]);
  for (const t of baseThresholds) {
    if (t >= minRating && t <= maxRating) {
      thresholdSet.add(t);
    }
  }
  const thresholds = Array.from(thresholdSet).sort((a, b) => a - b);

  // Prefix cumulative sum for O(K + M) exact CDF computation
  let idx = 0;
  let cumulative = 0;
  const anchors = [];

  for (const threshold of thresholds) {
    while (idx < ratingDistribution.length && ratingDistribution[idx][0] <= threshold) {
      cumulative += ratingDistribution[idx][1];
      idx++;
    }
    const pct = Number(((cumulative / populationSize) * 100.0).toFixed(4));
    anchors.push([threshold, pct]);
  }

  return { anchors, populationSize, minRating, maxRating };
}

/**
 * Verifies a stored snapshot artifact independently from its sanitized ratingDistribution.
 * @param {object} snapshot
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function verifySnapshotIntegrity(snapshot) {
  const errors = [];
  if (!snapshot || typeof snapshot !== 'object') {
    return { valid: false, errors: ['Snapshot is missing or not an object'] };
  }

  const meta = snapshot.metadata;
  if (!meta || !meta.snapshotTimestamp || !meta.freshnessMaxDays) {
    errors.push('Snapshot metadata missing snapshotTimestamp or freshnessMaxDays');
  }

  if (!Array.isArray(snapshot.ratingDistribution) || snapshot.ratingDistribution.length === 0) {
    errors.push('Snapshot missing sanitized ratingDistribution');
    return { valid: false, errors };
  }

  let derived;
  try {
    derived = recomputeAnchorsFromDistribution(snapshot.ratingDistribution);
  } catch (e) {
    errors.push(`Failed recomputing anchors from ratingDistribution: ${e.message}`);
    return { valid: false, errors };
  }

  if (meta?.populationSize !== derived.populationSize) {
    errors.push(`populationSize mismatch: metadata=${meta?.populationSize}, distributionSum=${derived.populationSize}`);
  }
  if (meta?.minRating !== derived.minRating) {
    errors.push(`minRating mismatch: metadata=${meta?.minRating}, distributionMin=${derived.minRating}`);
  }
  if (meta?.maxRating !== derived.maxRating) {
    errors.push(`maxRating mismatch: metadata=${meta?.maxRating}, distributionMax=${derived.maxRating}`);
  }

  const expectedSanitizedHash = computeSanitizedDistributionSha256(snapshot.ratingDistribution);
  if (meta?.sanitizedDistributionSha256 !== expectedSanitizedHash) {
    errors.push(`sanitizedDistributionSha256 mismatch: expected ${expectedSanitizedHash}, got ${meta?.sanitizedDistributionSha256}`);
  }

  if (!Array.isArray(snapshot.anchors) || snapshot.anchors.length !== derived.anchors.length) {
    errors.push(`anchors count mismatch: stored=${snapshot.anchors?.length}, derived=${derived.anchors.length}`);
  } else {
    for (let i = 0; i < derived.anchors.length; i++) {
      const [er, ep] = derived.anchors[i];
      const storedPair = snapshot.anchors[i];
      if (!Array.isArray(storedPair) || storedPair[0] !== er || storedPair[1] !== ep) {
        errors.push(`anchor[${i}] mismatch: stored=${JSON.stringify(storedPair)}, derived=[${er},${ep}]`);
        break;
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export async function generateCalibration({
  outFile = DEFAULT_SNAPSHOT_PATH,
  fromSnapshot = false,
  timestamp = new Date().toISOString(),
} = {}) {
  if (fromSnapshot) {
    const raw = JSON.parse(fs.readFileSync(outFile, 'utf-8'));
    const check = verifySnapshotIntegrity(raw);
    if (!check.valid) {
      throw new Error(`Offline snapshot verification failed:\n - ${check.errors.join('\n - ')}`);
    }
    console.log(`[calibration] Offline verification PASSED for N=${raw.metadata.populationSize} [${raw.metadata.minRating}, ${raw.metadata.maxRating}], ${raw.anchors.length} anchors, sanitizedDistributionSha256=${raw.metadata.sanitizedDistributionSha256}`);
    return raw;
  }

  const url = 'https://codeforces.com/api/user.ratedList?activeOnly=true';
  console.log(`Fetching Codeforces active rated contestants from: ${url}`);

  const res = await fetch(url, {
    headers: { 'User-Agent': 'ScholrBoard-Calibration/1.0' },
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Codeforces API: ${res.status} ${res.statusText}`);
  }

  const rawBuffer = Buffer.from(await res.arrayBuffer());
  const sourcePayloadSha256 = crypto.createHash('sha256').update(rawBuffer).digest('hex');
  const json = JSON.parse(rawBuffer.toString('utf-8'));

  if (json.status !== 'OK') {
    throw new Error(`Codeforces API returned non-OK status: ${json.comment || json.status}`);
  }

  const users = Array.isArray(json.result) ? json.result : [];
  // Strip ALL PII (handles, names, URLs, countries, avatars) — retain ONLY integer ratings.
  const rawRatings = users
    .map((u) => u.rating)
    .filter((r) => typeof r === 'number' && !Number.isNaN(r));

  const ratingDistribution = buildRatingHistogram(rawRatings);
  const { anchors, populationSize, minRating, maxRating } = recomputeAnchorsFromDistribution(ratingDistribution);
  const sanitizedDistributionSha256 = computeSanitizedDistributionSha256(ratingDistribution);

  console.log(`Successfully parsed ${populationSize} active rated contestants across ${ratingDistribution.length} distinct integer ratings.`);
  console.log(`Rating range: [${minRating}, ${maxRating}]`);
  console.log(`Raw Payload SHA-256: ${sourcePayloadSha256}`);
  console.log(`Sanitized Distribution SHA-256: ${sanitizedDistributionSha256}`);

  const snapshot = {
    metadata: {
      source: url,
      sourceEndpoint: 'Codeforces API user.ratedList?activeOnly=true',
      populationDefinition: 'Active rated contestants who competed in at least 1 rated contest during the last month (~30 days) [Codeforces user.ratedList?activeOnly=true cohort]',
      populationSize,
      distinctRatingsCount: ratingDistribution.length,
      snapshotTimestamp: timestamp,
      sourcePayloadSha256,
      sourcePayloadHashScope: 'SHA-256 over raw Codeforces API HTTP response body (verified at fetch time; raw handles stripped for privacy)',
      sanitizedDistributionSha256,
      sanitizedDistributionHashScope: 'SHA-256 over JSON.stringify(ratingDistribution) integer histogram (offline verifiable)',
      calibrationVersion: 'v1.2.0-cf-empirical-reproducible',
      freshnessMaxDays: 180,
      minRating,
      maxRating,
      method: 'empirical_cdf_piecewise_linear',
      anchorFormula: 'Number(((count(rating <= threshold) / populationSize) * 100).toFixed(4))',
      reproductionCommand: 'node server/scripts/generateCodeforcesCalibration.mjs --from-snapshot',
    },
    anchors,
    ratingDistribution,
  };

  const outDir = path.dirname(outFile);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(outFile, JSON.stringify(snapshot, null, 2), 'utf-8');
  console.log(`Snapshot artifact written to: ${outFile}`);
  return snapshot;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const fromSnapshot = process.argv.includes('--from-snapshot');
  generateCalibration({ fromSnapshot }).catch((err) => {
    console.error('Calibration generation failed:', err);
    process.exit(1);
  });
}
