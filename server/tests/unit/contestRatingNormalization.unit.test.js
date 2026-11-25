import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  CALIBRATION_METADATA,
  CODEFORCES_SNAPSHOT,
  CODEFORCES_SNAPSHOT_PATH,
  LEETCODE_SNAPSHOT,
  LEETCODE_RATING_ANCHORS,
  CODEFORCES_RATING_ANCHORS,
  interpolatePercentile,
  isSnapshotFresh,
  validateCalibrationSnapshot,
  loadCodeforcesSnapshot,
  normalizeLeetcodeRating,
  normalizeCodeforcesRating,
  combineContestRatingSignals,
} from '../../services/contestRatingNormalization.js';
import {
  recomputeAnchorsFromDistribution,
  verifySnapshotIntegrity,
  computeSanitizedDistributionSha256,
} from '../../scripts/generateCodeforcesCalibration.mjs';
import {
  computeCpDimension,
  computeDsaDimension,
  calculateDeveloperScore,
  NOMINAL_WEIGHTS,
} from '../../services/developerScoringService.js';

const cfExpected = (rating) => interpolatePercentile(rating, CODEFORCES_RATING_ANCHORS);

test('Contest Calibration 1: Monotonic piecewise interpolation, boundary clamping, and ties', () => {
  const cfMinRating = CODEFORCES_SNAPSHOT.minRating;
  const cfMinPct = CODEFORCES_RATING_ANCHORS[0][1];
  const cfMaxRating = CODEFORCES_SNAPSHOT.maxRating;

  // Lower boundary clamping
  assert.equal(interpolatePercentile(400, LEETCODE_RATING_ANCHORS), 0.5);
  assert.equal(interpolatePercentile(cfMinRating - 50, CODEFORCES_RATING_ANCHORS), cfMinPct);
  assert.equal(interpolatePercentile(cfMinRating, CODEFORCES_RATING_ANCHORS), cfMinPct);

  // Lower bound values interpolate smoothly without artificial 8.21 floor
  const p400 = cfExpected(400);
  const p500 = cfExpected(500);
  const p600 = cfExpected(600);
  assert.ok(p400 > cfMinPct && p400 < p500 && p500 < p600 && p600 < 25);

  // Upper boundary clamping
  assert.equal(interpolatePercentile(3500, LEETCODE_RATING_ANCHORS), 100.0);
  assert.equal(interpolatePercentile(cfMaxRating, CODEFORCES_RATING_ANCHORS), 100.0);
  assert.equal(interpolatePercentile(cfMaxRating + 500, CODEFORCES_RATING_ANCHORS), 100.0);

  // Exact anchor points & percentile bounds [0, 100]
  assert.equal(interpolatePercentile(1500, LEETCODE_RATING_ANCHORS), 50.0);
  assert.equal(interpolatePercentile(1900, LEETCODE_RATING_ANCHORS), 93.0);
  for (const [anchorRating, anchorPct] of CODEFORCES_RATING_ANCHORS) {
    assert.equal(interpolatePercentile(anchorRating, CODEFORCES_RATING_ANCHORS), anchorPct);
    assert.ok(anchorPct > 0 && anchorPct <= 100);
  }

  // Ties / exact values reproduce deterministically
  assert.equal(interpolatePercentile(1400, CODEFORCES_RATING_ANCHORS), interpolatePercentile(1400, CODEFORCES_RATING_ANCHORS));

  // Strict monotonicity across full rating spans
  let prev = -1;
  for (let r = 800; r <= 2600; r += 50) {
    const val = interpolatePercentile(r, LEETCODE_RATING_ANCHORS);
    assert.ok(val >= prev, `LeetCode percentile must be non-decreasing at rating ${r}`);
    prev = val;
  }

  prev = -1;
  for (let r = cfMinRating - 10; r <= cfMaxRating + 10; r += 25) {
    const val = interpolatePercentile(r, CODEFORCES_RATING_ANCHORS);
    assert.ok(val >= prev && val >= 0 && val <= 100, `Codeforces percentile invalid/decreasing at rating ${r}`);
    prev = val;
  }
});

test('Contest Calibration 2: LeetCode native topPercentage and derived rank ratio parsing', () => {
  // Case A: Native verified topPercentage (e.g., top 7.25% of contestants -> 92.75th percentile)
  const nativePct = normalizeLeetcodeRating({
    rating: 1850,
    attendedContestsCount: 12,
    topPercentage: 7.25,
  });

  assert.notEqual(nativePct, null);
  assert.equal(nativePct.rawRating, 1850);
  assert.equal(nativePct.percentile, 92.75);
  assert.equal(nativePct.normalizedScore, 92.75);
  assert.equal(nativePct.derivation, 'native_top_percentage');
  assert.equal(nativePct.isProvisional, false);

  // Case B: Derived rank ratio from globalRanking and totalParticipants
  // globalRanking 5001 out of 100000 -> 1 - (5000 / 100000) = 95.0%
  const derivedRank = normalizeLeetcodeRating({
    rating: 1920,
    attendedContestsCount: 18,
    globalRanking: 5001,
    totalParticipants: 100000,
  });

  assert.notEqual(derivedRank, null);
  assert.equal(derivedRank.percentile, 95.0);
  assert.equal(derivedRank.normalizedScore, 95.0);
  assert.equal(derivedRank.derivation, 'derived_rank_ratio');
  assert.equal(derivedRank.globalRanking, 5001);
  assert.equal(derivedRank.totalParticipants, 100000);
});

test('Contest Calibration 3: LeetCode first-5-contests provisional rule (do NOT guess 1500 as median)', () => {
  // A brand new contestant with 2 attended contests and nominal starting rating 1500
  // without verified native ranking must NOT be mapped to median 50th percentile!
  const provisionalUser = normalizeLeetcodeRating({
    rating: 1500,
    attendedContestsCount: 2,
    topPercentage: null,
    globalRanking: null,
  });

  assert.equal(provisionalUser, null, 'Provisional first-5-contests user without native ranking must return null');

  // Once user reaches 5 contests, if native ranking is absent, unverified heuristic fallback is DISABLED (Workstream 1.1)
  const establishedUser = normalizeLeetcodeRating({
    rating: 1500,
    attendedContestsCount: 5,
    topPercentage: null,
    globalRanking: null,
  });

  assert.notEqual(establishedUser, null);
  assert.equal(establishedUser.normalizedScore, null, 'Score must be null when native ranking evidence is absent');
  assert.equal(establishedUser.status, 'UNAVAILABLE');
  assert.equal(establishedUser.derivation, 'unsupported_ranking_unavailable');
  assert.equal(establishedUser.rawRating, 1500, 'Raw rating must be preserved for display');
  assert.equal(establishedUser.isProvisional, false);
});

test('Contest Calibration 4: Codeforces distribution-derived percentiles from user.ratedList with zero peak bonus', () => {
  const expected1200 = cfExpected(1200);
  const expected1500 = cfExpected(1500);

  const pupil = normalizeCodeforcesRating({
    rating: 1200,
    maxRating: 1200,
    contestsParticipated: 6,
  });

  assert.notEqual(pupil, null);
  assert.equal(pupil.rawRating, 1200);
  assert.equal(pupil.percentile, expected1200);
  assert.equal(pupil.peakBonus, 0, 'Peak bonus must be strictly zero');
  assert.equal(pupil.normalizedScore, expected1200);
  assert.equal(pupil.derivation, 'documented_distribution');
  assert.equal(pupil.source, CODEFORCES_SNAPSHOT.source);
  assert.equal(pupil.populationSize, CODEFORCES_SNAPSHOT.populationSize);
  assert.equal(pupil.populationSize, 42145);
  assert.ok(pupil.population.includes('last month'), 'Population must accurately specify last month cohort');
  assert.ok(pupil.population.includes('activeOnly=true'), 'Population must reference activeOnly=true cohort');

  // Even if maxRating is much higher (e.g. historical 2000), peakBonus remains strictly 0 (symmetric with LeetCode)
  const degradedMaster = normalizeCodeforcesRating({
    rating: 1500,
    maxRating: 2000,
    contestsParticipated: 25,
  });

  assert.equal(degradedMaster.rawRating, 1500);
  assert.equal(degradedMaster.percentile, expected1500);
  assert.equal(degradedMaster.peakBonus, 0, 'Peak bonus is zero to preserve platform symmetry');
  assert.equal(degradedMaster.normalizedScore, expected1500);
});

test('Contest Calibration 5: Snapshot freshness validation, stale & malformed snapshot invalidation, and offline reproducibility', () => {
  const evalDate = new Date(CODEFORCES_SNAPSHOT.snapshotTimestamp);
  assert.equal(isSnapshotFresh(CODEFORCES_SNAPSHOT, evalDate), true);

  // Expired snapshot (> 180 days old) fails freshness check and returns STALE_SNAPSHOT
  const expiredSnapshot = {
    ...CODEFORCES_SNAPSHOT,
    snapshotTimestamp: '2025-01-01T00:00:00.000Z',
    freshnessMaxDays: 180,
  };

  const staleResult = normalizeCodeforcesRating({
    rating: 1600,
    contestsParticipated: 10,
    evalDate: new Date('2026-10-15T00:00:00Z'),
    snapshot: expiredSnapshot,
  });

  assert.notEqual(staleResult, null);
  assert.equal(staleResult.normalizedScore, null);
  assert.equal(staleResult.status, 'STALE_SNAPSHOT');
  assert.ok(staleResult.error.includes('expired'));

  // Malformed / hash-tampered snapshot must be rejected
  const rawFile = JSON.parse(fs.readFileSync(CODEFORCES_SNAPSHOT_PATH, 'utf-8'));
  const tampered = structuredClone(rawFile);
  tampered.anchors[5][1] = 99.99; // corrupt an anchor without updating histogram
  const tamperedCheck = verifySnapshotIntegrity(tampered);
  assert.equal(tamperedCheck.valid, false);
  const tamperedNorm = normalizeCodeforcesRating({
    rating: 1600,
    contestsParticipated: 10,
    snapshot: tampered,
  });
  assert.equal(tamperedNorm.status, 'MALFORMED_SNAPSHOT');

  // Offline recomputation from sanitized integer histogram reproduces every anchor deterministically & contains no PII
  assert.ok(Array.isArray(rawFile.ratingDistribution) && rawFile.ratingDistribution.length > 0);
  const rawStr = JSON.stringify(rawFile);
  assert.ok(!rawStr.includes('"handle"') && !rawStr.includes('"firstName"') && !rawStr.includes('"email"'));
  const recomputed = recomputeAnchorsFromDistribution(rawFile.ratingDistribution);
  assert.equal(recomputed.populationSize, rawFile.metadata.populationSize);
  assert.equal(recomputed.minRating, rawFile.metadata.minRating);
  assert.equal(recomputed.maxRating, rawFile.metadata.maxRating);
  assert.equal(
    computeSanitizedDistributionSha256(rawFile.ratingDistribution),
    rawFile.metadata.sanitizedDistributionSha256
  );
  assert.deepEqual(recomputed.anchors, rawFile.anchors);

  // Runtime loader reads & validates the on-disk snapshot cleanly
  const diskLoad = loadCodeforcesSnapshot(CODEFORCES_SNAPSHOT_PATH);
  assert.equal(diskLoad.loadedFromDisk, true);
  assert.equal(diskLoad.error, null);
  assert.equal(validateCalibrationSnapshot(rawFile).valid, true);
});

test('Contest Calibration 6: Raw ratings are NOT directly averaged; platform calibration prevents distortion', () => {
  const expectedCf1600 = cfExpected(1600);
  const lc1600 = normalizeLeetcodeRating({ rating: 1600, attendedContestsCount: 10, topPercentage: 32.0 });
  const cf1600 = normalizeCodeforcesRating({ rating: 1600, contestsParticipated: 10 });

  assert.equal(lc1600.percentile, 68.0);
  assert.equal(cf1600.percentile, expectedCf1600);

  // Normalized combination weighs each platform equally on the bounded [0, 100] percentile scale
  const combined = combineContestRatingSignals({
    leetcodeNorm: lc1600,
    codeforcesNorm: cf1600,
    cpRecencyFactor: 1.0,
    nominalWeight: 0.15,
  });

  assert.equal(combined.crossPlatformComparison, true);
  assert.equal(combined.score, Math.round(0.5 * 68.0 + 0.5 * expectedCf1600));
  assert.equal(combined.dimensionCoverage, 100);
  assert.equal(combined.dimensionConfidence, 'High');
  assert.equal(combined.effectiveWeight, 0.15);
  assert.ok(combined.explanation.includes('Cross-platform contest rating comparison'));
});

test('Contest Calibration 7: Strictly symmetric single-platform coverage (75%) and effective weight (0.1125)', () => {
  const expectedCf1600 = cfExpected(1600);

  // Case A: LeetCode only (Codeforces unrated / missing)
  const lcOnly = computeCpDimension(
    { contestsParticipated: null, rating: null },
    new Date(),
    {},
    null,
    null,
    { contestRating: 1800, attendedContestsCount: 8, topPercentage: 12.0 } // 88th percentile
  );

  assert.equal(lcOnly.crossPlatformComparison, false);
  assert.equal(lcOnly.score, 88);
  assert.equal(lcOnly.dimensionCoverage, 75, 'LeetCode-only must have exactly 75% coverage');
  assert.equal(lcOnly.effectiveWeight, 0.1125, 'Effective weight = 0.15 * 0.75 = 0.1125');
  assert.equal(lcOnly.dimensionConfidence, 'Medium');

  // Case B: Codeforces only (LeetCode unrated / missing)
  const cfOnly = computeCpDimension(
    { contestsParticipated: 8, rating: 1600, maxRating: 1600, lastContestAt: new Date() },
    new Date(),
    {},
    null,
    null,
    { contestRating: null, attendedContestsCount: 0 }
  );

  assert.equal(cfOnly.crossPlatformComparison, false);
  assert.equal(cfOnly.score, Math.round(expectedCf1600));
  assert.equal(cfOnly.dimensionCoverage, 75, 'Codeforces-only must have exactly 75% coverage (symmetric with LeetCode)');
  assert.equal(cfOnly.effectiveWeight, 0.1125, 'Effective weight = 0.15 * 0.75 = 0.1125 (symmetric with LeetCode)');
  assert.equal(cfOnly.dimensionConfidence, 'Medium');
});

test('Contest Calibration 8: Missing-data exclusion and unrated profile preservation', () => {
  // Case: Neither platform has contest participation
  const neither = computeCpDimension(
    { contestsParticipated: 0, rating: null },
    new Date(),
    {},
    'NOT_CONNECTED',
    null,
    { contestRating: null, attendedContestsCount: 0 }
  );

  assert.equal(neither.score, null, 'Unrated contestant must produce null score, never zero');
  assert.equal(neither.dimensionCoverage, 0);
  assert.equal(neither.effectiveWeight, 0, 'Effective weight is zero, excluded from scoring denominator');
  assert.equal(neither.crossPlatformComparison, false);
  assert.ok(neither.explanation.includes('excluded from scoring denominator'));
});

test('Contest Calibration 9: Full Developer Score v3 nominal weights and practice vs contest separation preserved', () => {
  // Check nominal weights
  assert.equal(NOMINAL_WEIGHTS.dsa, 0.30);
  assert.equal(NOMINAL_WEIGHTS.engActivity, 0.25);
  assert.equal(NOMINAL_WEIGHTS.repoQuality, 0.20);
  assert.equal(NOMINAL_WEIGHTS.cp, 0.15);
  assert.equal(NOMINAL_WEIGHTS.breadth, 0.10);

  const total = Object.values(NOMINAL_WEIGHTS).reduce((sum, w) => sum + w, 0);
  assert.equal(total, 1.0, 'Nominal weights must strictly sum to 1.00');

  // Verify full score calculation preserves practice (DSA) vs contest (CP) separation
  const profileData = {
    developerScore: null,
    codingStats: {
      leetcodeProblemsSolved: 250,
      leetcodeContestRating: 1800,
      codeforcesRating: 1600,
      codeforcesMaxRating: 1600,
      githubContributions: 150,
      githubRepos: 10,
      rawMetrics: {
        leetcode: {
          easySolved: 100,
          mediumSolved: 120,
          hardSolved: 30,
          totalSolved: 250,
          contestRating: 1800,
          attendedContestsCount: 15,
          topPercentage: 12.0, // verified native top percentage -> 88th percentile
          activeSubmitDays30d: 15,
          recencyLevel: 'L1',
        },
        codeforces: {
          rating: 1600,
          maxRating: 1600,
          contestsParticipated: 15,
          lastContestAt: new Date(),
        },
        github: {
          publicRepos: 10,
          stars: 25,
          forks: 5,
          topLanguages: ['JavaScript', 'Python', 'Go'],
        },
      },
    },
    platformSyncStates: {
      leetcode: { syncStatus: 'SYNCED' },
      codeforces: { syncStatus: 'SYNCED' },
      github: { syncStatus: 'SYNCED' },
    },
    githubContributionCalendar: {
      weeks: [{ contributionDays: [{ date: '2026-06-01', contributionCount: 5 }] }],
    },
  };

  const scoreResult = calculateDeveloperScore(profileData);
  assert.notEqual(scoreResult.score, null);
  assert.ok(scoreResult.score > 0);

  const dsaDim = scoreResult.dimensions.get('dsa');
  const cpDim = scoreResult.dimensions.get('cp');

  // DSA evaluates problem solved count
  assert.equal(dsaDim.breakdown.easySolved, 100);
  assert.equal(dsaDim.breakdown.mediumSolved, 120);

  // CP evaluates contest ratings
  const expectedCf1600 = cfExpected(1600);
  assert.equal(cpDim.breakdown.crossPlatformComparison, true);
  assert.equal(cpDim.breakdown.leetcodePercentile, 88.0);
  assert.equal(cpDim.breakdown.codeforcesPercentile, expectedCf1600);
  assert.equal(cpDim.score, Math.round(0.5 * 88.0 + 0.5 * expectedCf1600));
});

test('Contest Calibration 10: Provider failure with previously cached rating preserves prior valid data without zeroing', () => {
  // Profile where a recent provider sync resulted in an ERROR / partial failure,
  // but prior valid contest ratings and verified ranking were preserved in codingStats:
  const profileWithCachedData = {
    developerScore: 75,
    codingStats: {
      leetcodeProblemsSolved: 300,
      leetcodeContestRating: 1750,
      codeforcesRating: null, // Codeforces unrated
      githubContributions: 200,
      githubRepos: 8,
      rawMetrics: {
        leetcode: {
          easySolved: 100,
          mediumSolved: 150,
          hardSolved: 50,
          totalSolved: 300,
          contestRating: 1750,
          attendedContestsCount: 12,
          topPercentage: 16.0, // 84th percentile verified
          recencyLevel: 'L1',
          activeSubmitDays30d: 20,
        },
        codeforces: null,
        github: {
          publicRepos: 8,
          stars: 10,
          topLanguages: ['TypeScript'],
        },
      },
    },
    platformSyncStates: {
      leetcode: {
        syncStatus: 'ERROR',
        error: 'ETIMEDOUT connecting to LeetCode API',
        lastSuccessfulSync: new Date('2026-09-01T00:00:00Z'),
      },
      codeforces: { syncStatus: 'NOT_CONNECTED' },
      github: { syncStatus: 'SYNCED' },
    },
    githubContributionCalendar: {
      weeks: [{ contributionDays: [{ date: '2026-06-01', contributionCount: 5 }] }],
    },
  };

  const result = calculateDeveloperScore(profileWithCachedData);
  assert.notEqual(result.score, null, 'Score must not be null when cached evidence is valid');
  assert.ok(result.score > 0, 'Score must be non-zero');

  const cp = result.dimensions.get('cp');
  assert.notEqual(cp.score, null);
  assert.equal(cp.score, 84);
  assert.equal(cp.dimensionCoverage, 75, 'Single-platform cached LeetCode has symmetric 75% coverage');
  assert.equal(cp.breakdown.crossPlatformComparison, false);
});

test('Contest Calibration 11 (Workstream 1.1): Missing native LeetCode ranking evidence cannot silently reactivate unverified heuristic', () => {
  // Established contestant with 15 attended contests and 1800 rating, but NO topPercentage and NO globalRanking
  const result = normalizeLeetcodeRating({
    rating: 1800,
    attendedContestsCount: 15,
    topPercentage: null,
    globalRanking: null,
    totalParticipants: null,
  });

  assert.notEqual(result, null);
  assert.equal(result.rawRating, 1800, 'Raw contest rating is preserved for display and diagnosis');
  assert.equal(result.normalizedScore, null, 'Normalized score must be null (heuristic fallback disabled)');
  assert.equal(result.percentile, null, 'Percentile must not be derived from heuristic anchor table');
  assert.equal(result.status, 'UNAVAILABLE');
  assert.equal(result.derivation, 'unsupported_ranking_unavailable');
  assert.ok(result.error.includes('unverified empirical fallback disabled'));

  // When combined into CP dimension, LeetCode without verified ranking is treated as unavailable:
  const combined = combineContestRatingSignals({
    leetcodeNorm: result,
    codeforcesNorm: null,
    nominalWeight: 0.15,
  });

  assert.equal(combined.score, null, 'Unverified LeetCode data cannot produce a production CP score');
  assert.equal(combined.effectiveWeight, 0, 'Excluded from scoring denominator');
  assert.equal(combined.dimensionCoverage, 0);
});

test('Contest Calibration 12 (Workstream 1.1): Range and denominator validation for native LeetCode ranking data', () => {
  // Invalid topPercentage (out of [0, 100] bounds)
  const invalidTopPctNegative = normalizeLeetcodeRating({
    rating: 1700,
    attendedContestsCount: 10,
    topPercentage: -5,
  });
  assert.equal(invalidTopPctNegative.normalizedScore, null);
  assert.equal(invalidTopPctNegative.status, 'UNAVAILABLE');

  const invalidTopPctExcess = normalizeLeetcodeRating({
    rating: 1700,
    attendedContestsCount: 10,
    topPercentage: 105,
  });
  assert.equal(invalidTopPctExcess.normalizedScore, null);

  // Inconsistent ranking: globalRanking > totalParticipants
  const inconsistentRank = normalizeLeetcodeRating({
    rating: 1700,
    attendedContestsCount: 10,
    globalRanking: 5000,
    totalParticipants: 1000, // impossible
  });
  assert.equal(inconsistentRank.normalizedScore, null);
  assert.equal(inconsistentRank.status, 'UNAVAILABLE');

  // Non-positive denominators or rankings
  const zeroRank = normalizeLeetcodeRating({
    rating: 1700,
    attendedContestsCount: 10,
    globalRanking: 0,
    totalParticipants: 1000,
  });
  assert.equal(zeroRank.normalizedScore, null);

  const zeroParts = normalizeLeetcodeRating({
    rating: 1700,
    attendedContestsCount: 10,
    globalRanking: 5,
    totalParticipants: 0,
  });
  assert.equal(zeroParts.normalizedScore, null);
});

test('Contest Calibration 13 (Workstream 1.2): Codeforces empirical lower and upper bound handling (-40 to 3722)', () => {
  const cfMinRating = CODEFORCES_SNAPSHOT.minRating;
  const cfMinPct = CODEFORCES_RATING_ANCHORS[0][1];
  const cfMaxRating = CODEFORCES_SNAPSHOT.maxRating;

  // Exactly at observed minimum rating
  const minResult = normalizeCodeforcesRating({ rating: cfMinRating, contestsParticipated: 2 });
  assert.notEqual(minResult, null);
  assert.equal(minResult.rawRating, cfMinRating);
  assert.equal(minResult.percentile, cfMinPct);
  assert.equal(minResult.normalizedScore, cfMinPct);

  // Below observed minimum rating clamps to min empirical percentile
  const subMinResult = normalizeCodeforcesRating({ rating: cfMinRating - 50, contestsParticipated: 2 });
  assert.notEqual(subMinResult, null);
  assert.equal(subMinResult.percentile, cfMinPct);

  // Sub-600 ratings interpolate monotonically without artificial 8.21 floor
  const r400 = normalizeCodeforcesRating({ rating: 400, contestsParticipated: 3 });
  const r500 = normalizeCodeforcesRating({ rating: 500, contestsParticipated: 5 });
  const r600 = normalizeCodeforcesRating({ rating: 600, contestsParticipated: 5 });
  assert.equal(r400.percentile, cfExpected(400));
  assert.equal(r500.percentile, cfExpected(500));
  assert.equal(r600.percentile, cfExpected(600));
  assert.ok(r400.percentile < r500.percentile && r500.percentile < r600.percentile);

  // Exactly at observed maximum rating
  const maxResult = normalizeCodeforcesRating({ rating: cfMaxRating, contestsParticipated: 50 });
  assert.equal(maxResult.percentile, 100.0);
  assert.equal(maxResult.normalizedScore, 100.0);

  // Above observed maximum rating clamps to 100.0%
  const superMaxResult = normalizeCodeforcesRating({ rating: cfMaxRating + 500, contestsParticipated: 50 });
  assert.equal(superMaxResult.percentile, 100.0);
});

test('Workstream 2: LeetCode problem count (695 solved) is NOT a contest rating and cannot enter CP scoring', () => {
  // Candidate has 695 solved problems on LeetCode, but has NEVER attended a rated contest
  const leetcodePracticeOnly = {
    easySolved: 200,
    mediumSolved: 400,
    hardSolved: 95,
    totalSolved: 695,
    contestRating: null,
    attendedContestsCount: 0,
    topPercentage: null,
  };

  // 1. CP dimension computation strictly ignores totalSolved: 695
  const cpResult = computeCpDimension(
    { contestsParticipated: 0, rating: null },
    new Date(),
    {},
    'NOT_CONNECTED',
    null,
    leetcodePracticeOnly
  );

  assert.equal(cpResult.score, null, 'Solved problem count 695 must NOT produce a CP score');
  assert.equal(cpResult.effectiveWeight, 0, 'CP dimension must be excluded when no contest rating exists');
  assert.equal(cpResult.breakdown.leetcodeRating, null);
  assert.equal(cpResult.breakdown.leetcodePercentile, null);

  // 2. DSA dimension evaluates the 695 solved problems
  const dsaResult = computeDsaDimension(leetcodePracticeOnly);
  assert.notEqual(dsaResult.score, null);
  assert.ok(dsaResult.score > 0, 'DSA dimension correctly scores practice volume');
  assert.equal(dsaResult.breakdown.problemScore, 100, '695 weighted problems exceeds the 500 cap -> 100 pts');

  // 3. Raw ratings from LeetCode and Codeforces cannot be directly averaged
  const lcNorm = normalizeLeetcodeRating({ rating: 1600, attendedContestsCount: 10, topPercentage: 32.0 });
  const cfNorm = normalizeCodeforcesRating({ rating: 1600, contestsParticipated: 10 });
  assert.notEqual(lcNorm.percentile, cfNorm.percentile, 'Different distributions prevent raw rating equivalence');

  // 4. Max rating is kept distinct from current rating
  const cfWithPeak = normalizeCodeforcesRating({ rating: 1400, maxRating: 1900, contestsParticipated: 15 });
  assert.equal(cfWithPeak.rawRating, 1400);
  assert.equal(cfWithPeak.maxRating, 1900);
  assert.equal(cfWithPeak.percentile, cfExpected(1400), 'Current rating 1400 governs current standing');
});

