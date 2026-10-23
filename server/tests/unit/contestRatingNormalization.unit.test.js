import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CALIBRATION_METADATA,
  CODEFORCES_SNAPSHOT,
  LEETCODE_SNAPSHOT,
  LEETCODE_RATING_ANCHORS,
  CODEFORCES_RATING_ANCHORS,
  interpolatePercentile,
  isSnapshotFresh,
  normalizeLeetcodeRating,
  normalizeCodeforcesRating,
  combineContestRatingSignals,
} from '../../services/contestRatingNormalization.js';
import {
  computeCpDimension,
  computeDsaDimension,
  calculateDeveloperScore,
  NOMINAL_WEIGHTS,
} from '../../services/developerScoringService.js';

test('Contest Calibration 1: Monotonic piecewise interpolation, boundary clamping, and ties', () => {
  // Lower boundary clamping
  assert.equal(interpolatePercentile(400, LEETCODE_RATING_ANCHORS), 0.5);
  assert.equal(interpolatePercentile(300, CODEFORCES_RATING_ANCHORS), 0.5);

  // Upper boundary clamping
  assert.equal(interpolatePercentile(3500, LEETCODE_RATING_ANCHORS), 100.0);
  assert.equal(interpolatePercentile(3500, CODEFORCES_RATING_ANCHORS), 100.0);

  // Exact anchor points
  assert.equal(interpolatePercentile(1500, LEETCODE_RATING_ANCHORS), 50.0);
  assert.equal(interpolatePercentile(1900, LEETCODE_RATING_ANCHORS), 93.0);
  assert.equal(interpolatePercentile(1200, CODEFORCES_RATING_ANCHORS), 50.0);
  assert.equal(interpolatePercentile(1600, CODEFORCES_RATING_ANCHORS), 88.0);

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
  for (let r = 600; r <= 2600; r += 50) {
    const val = interpolatePercentile(r, CODEFORCES_RATING_ANCHORS);
    assert.ok(val >= prev, `Codeforces percentile must be non-decreasing at rating ${r}`);
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

  // Once user reaches 5 contests, empirical fallback is permitted if native ranking is absent
  const establishedUser = normalizeLeetcodeRating({
    rating: 1500,
    attendedContestsCount: 5,
    topPercentage: null,
    globalRanking: null,
  });

  assert.notEqual(establishedUser, null);
  assert.equal(establishedUser.percentile, 50.0);
  assert.equal(establishedUser.derivation, 'empirical_distribution_fallback');
  assert.equal(establishedUser.isProvisional, false);
});

test('Contest Calibration 4: Codeforces distribution-derived percentiles from user.ratedList with zero peak bonus', () => {
  // Rating 1200 is Pupil transition (50th percentile of active rated contestants)
  const pupil = normalizeCodeforcesRating({
    rating: 1200,
    maxRating: 1200,
    contestsParticipated: 6,
  });

  assert.notEqual(pupil, null);
  assert.equal(pupil.rawRating, 1200);
  assert.equal(pupil.percentile, 50.0);
  assert.equal(pupil.peakBonus, 0, 'Peak bonus must be strictly zero');
  assert.equal(pupil.normalizedScore, 50.0);
  assert.equal(pupil.derivation, 'documented_distribution');
  assert.equal(pupil.source, CODEFORCES_SNAPSHOT.source);
  assert.equal(pupil.populationSize, 154820);
  assert.ok(pupil.population.includes('last month'), 'Population must accurately specify last month cohort');
  assert.ok(pupil.population.includes('activeOnly=true'), 'Population must reference activeOnly=true cohort');

  // Even if maxRating is much higher (e.g. historical 2000), peakBonus remains strictly 0 (symmetric with LeetCode)
  const degradedMaster = normalizeCodeforcesRating({
    rating: 1500,
    maxRating: 2000,
    contestsParticipated: 25,
  });

  assert.equal(degradedMaster.rawRating, 1500);
  assert.equal(degradedMaster.percentile, 82.0);
  assert.equal(degradedMaster.peakBonus, 0, 'Peak bonus is zero to preserve platform symmetry');
  assert.equal(degradedMaster.normalizedScore, 82.0);
});

test('Contest Calibration 5: Snapshot freshness validation and stale snapshot invalidation', () => {
  // Current snapshot with evaluation date close to snapshot date is fresh
  const evalDate = new Date('2026-10-15T00:00:00Z');
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
});

test('Contest Calibration 6: Raw ratings are NOT directly averaged; platform calibration prevents distortion', () => {
  // Demonstrating the mathematical necessity of independent platform calibration:
  // Rating 1600 on Codeforces = Expert (Top 12% of active contestants, 88th percentile)
  // Rating 1600 on LeetCode = ~68th percentile (Top 32%)
  // Naive average (1600 + 1600) / 2 = 1600 would completely ignore that CF 1600 requires significantly higher contest proficiency.
  const lc1600 = normalizeLeetcodeRating({ rating: 1600, attendedContestsCount: 10 });
  const cf1600 = normalizeCodeforcesRating({ rating: 1600, contestsParticipated: 10 });

  assert.equal(lc1600.percentile, 68.0);
  assert.equal(cf1600.percentile, 88.0);

  // Normalized combination weighs each platform equally on the bounded [0, 100] percentile scale
  const combined = combineContestRatingSignals({
    leetcodeNorm: lc1600,
    codeforcesNorm: cf1600,
    cpRecencyFactor: 1.0,
    nominalWeight: 0.15,
  });

  assert.equal(combined.crossPlatformComparison, true);
  // (68.0 + 88.0) / 2 = 78.0
  assert.equal(combined.score, 78);
  assert.equal(combined.dimensionCoverage, 100);
  assert.equal(combined.dimensionConfidence, 'High');
  assert.equal(combined.effectiveWeight, 0.15);
  assert.ok(combined.explanation.includes('Cross-platform contest rating comparison'));
});

test('Contest Calibration 7: Strictly symmetric single-platform coverage (75%) and effective weight (0.1125)', () => {
  // Case A: LeetCode only (Codeforces unrated / missing)
  const lcOnly = computeCpDimension(
    { contestsParticipated: null, rating: null },
    new Date(),
    {},
    null,
    null,
    { contestRating: 1800, attendedContestsCount: 8 } // 88th percentile
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
  assert.equal(cfOnly.score, 88);
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
  assert.equal(cpDim.breakdown.crossPlatformComparison, true);
  assert.equal(cpDim.breakdown.leetcodePercentile, 88.0);
  assert.equal(cpDim.breakdown.codeforcesPercentile, 88.0);
  assert.equal(cpDim.score, 88);
});

test('Contest Calibration 10: Provider failure with previously cached rating preserves prior valid data without zeroing', () => {
  // Profile where a recent provider sync resulted in an ERROR / partial failure,
  // but prior valid contest ratings were preserved in codingStats:
  const profileWithCachedData = {
    developerScore: 75,
    codingStats: {
      leetcodeProblemsSolved: 300,
      leetcodeContestRating: 1750, // Prior valid cached rating (93.5th percentile)
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
  // LeetCode 1750 interpolated in anchors: between [1700, 80.0] and [1800, 88.0] = 84.0
  assert.equal(cp.score, 84);
  assert.equal(cp.dimensionCoverage, 75, 'Single-platform cached LeetCode has symmetric 75% coverage');
  assert.equal(cp.breakdown.crossPlatformComparison, false);
});

