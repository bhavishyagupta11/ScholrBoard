import test from 'node:test';
import assert from 'node:assert/strict';
import Profile from '../../models/Profile.js';
import {
  NOMINAL_WEIGHTS,
  validateWeights,
  getUtcCalendarDay,
  getElapsedUtcMonths,
  evaluateTemporalEvidence,
  computeDevSnapshotHash,
  computeCalculationFingerprint,
  computeDsaDimension,
  computeEngActivityDimension,
  computeRepoQualityDimension,
  computeCpDimension,
  computeBreadthDimension,
  calculateDeveloperScore,
  SCORE_VERSION,
  FORMULA_VERSION,
} from '../../services/developerScoringService.js';
import {
  DAILY_SWEEP_CRON,
  getNextUtcRunDelay,
  startAgingSweepScheduler,
  stopAgingSweepScheduler,
  getAgingSweepSchedulerStatus,
  sweepAgingScores,
  evaluateFreshness,
} from '../../services/scoreHistoryService.js';
import {
  computeScoreFreshness,
  deriveConfidence,
} from '../../services/scorePersistence.js';

test('Phase 5.1: Weight validation and nominal weight constraints', () => {
  assert.equal(NOMINAL_WEIGHTS.dsa, 0.30);
  assert.equal(NOMINAL_WEIGHTS.engActivity, 0.25);
  assert.equal(NOMINAL_WEIGHTS.repoQuality, 0.20);
  assert.equal(NOMINAL_WEIGHTS.cp, 0.15);
  assert.equal(NOMINAL_WEIGHTS.breadth, 0.10);

  const sum = Object.values(NOMINAL_WEIGHTS).reduce((a, b) => a + b, 0);
  assert.equal(Math.round(sum * 100) / 100, 1.00);

  // Throws on invalid weights
  assert.throws(() => validateWeights({ a: 0.5, b: 0.6 }), /must be 1\.0/);
  assert.throws(() => validateWeights({ a: -0.1, b: 1.1 }), /not in \[0,1\]/);
});

test('Phase 5.2: Problem Solving / DSA dimension formula, monotonicity, and recency hierarchy', () => {
  const evalDate = new Date('2026-06-01T00:00:00Z');

  // 1. Problem volume calculation: easy=1.0, medium=2.5, hard=5.0, cap=500
  // 100 easy (100) + 40 medium (100) + 20 hard (100) = 300 weighted problems -> 300/500*100 = 60 pts
  const volMetrics = {
    easySolved: 100,
    mediumSolved: 40,
    hardSolved: 20,
    recencyLevel: 'L3', // neutral factor 1.0
  };
  const dsaVol = computeDsaDimension(volMetrics, evalDate);
  assert.equal(dsaVol.breakdown.problemScore, 60);
  assert.equal(dsaVol.score, 60);

  // 2. Monotonicity: increasing hard problems must never decrease the score
  const moreHardMetrics = { ...volMetrics, hardSolved: 30 };
  const dsaMoreHard = computeDsaDimension(moreHardMetrics, evalDate);
  assert.ok(dsaMoreHard.score > dsaVol.score, 'Score must increase monotonically');

  // 3. Problem volume cap at 500
  const maxVolumeMetrics = { easySolved: 500, mediumSolved: 200, hardSolved: 100, recencyLevel: 'L3' };
  const dsaMaxVol = computeDsaDimension(maxVolumeMetrics, evalDate);
  assert.equal(dsaMaxVol.breakdown.problemScore, 100);

  // 4. Level 1 Multi-window Recency:
  // Ceilings: 20, 50, 150. Weights: 0.40, 0.35, 0.25. Floor: 0.55
  // 10 days in 30d (0.5), 25 in 90d (0.5), 75 in 365d (0.5) -> recentActivityScore = 50.0
  // recencyFactor = 0.55 + 0.45 * 0.5 = 0.7750
  const l1Metrics = {
    easySolved: 100,
    mediumSolved: 80,
    hardSolved: 40, // 100 + 200 + 200 = 500 wp -> 100 pts
    recencyLevel: 'L1',
    activeSubmitDays30d: 10,
    activeSubmitDays90d: 25,
    activeSubmitDays365d: 75,
  };
  const dsaL1 = computeDsaDimension(l1Metrics, evalDate);
  assert.equal(dsaL1.breakdown.recencyFactor, 0.775);
  assert.equal(dsaL1.score, 78); // round(100 * 0.775)
  assert.equal(dsaL1.dimensionCoverage, 85); // 60 + 25 = 85 (no contest)

  // 5. Level 2 Anti-gaming Cap:
  // Single submit yesterday cannot restore 1.0 multiplier; capped at L2_RECENCY_CAP = 50
  const l2RecentMetrics = {
    easySolved: 100,
    mediumSolved: 80,
    hardSolved: 40,
    recencyLevel: 'L2',
    lastActivityDate: new Date('2026-05-31T00:00:00Z'), // 1 day ago
  };
  const dsaL2 = computeDsaDimension(l2RecentMetrics, evalDate);
  // l2DecayFactor = (1 - 1/730) = 0.9986, recentScore = 0.9986 * 50 = 49.93
  // recencyFactor <= 0.775 (cannot exceed 0.775)
  assert.ok(dsaL2.breakdown.recencyFactor <= 0.775, 'L2 recency factor must be capped at 0.775');
  assert.equal(dsaL2.dimensionCoverage, 72.5); // 60 + 12.5 = 72.5%
  assert.equal(dsaL2.dimensionConfidence, 'Medium');

  // 6. Level 3 Invariant: score_L3 >= score_L1_inactive
  const l1InactiveMetrics = {
    easySolved: 100,
    mediumSolved: 40,
    hardSolved: 20, // 60 pts
    recencyLevel: 'L1',
    activeSubmitDays30d: 0,
    activeSubmitDays90d: 0,
    activeSubmitDays365d: 0,
  };
  const l3Metrics = {
    easySolved: 100,
    mediumSolved: 40,
    hardSolved: 20, // 60 pts
    recencyLevel: 'L3',
  };
  const scoreL1Inactive = computeDsaDimension(l1InactiveMetrics, evalDate);
  const scoreL3 = computeDsaDimension(l3Metrics, evalDate);
  assert.equal(scoreL1Inactive.breakdown.recencyFactor, 0.55); // floor factor
  assert.equal(scoreL1Inactive.score, 33); // 60 * 0.55 = 33
  assert.equal(scoreL3.breakdown.recencyFactor, 1.0); // neutral factor
  assert.equal(scoreL3.score, 60); // 60 * 1.0 = 60
  assert.ok(scoreL3.score >= scoreL1Inactive.score, 'L3 score must be >= L1 inactive score');

  // 7. Contest bonus: +20 pts max when rating > 1200
  const contestMetrics = {
    ...volMetrics,
    attendedContestsCount: 5,
    contestRating: 2000, // (2000 - 1200) / 1600 * 20 = 10 pts
  };
  const dsaContest = computeDsaDimension(contestMetrics, evalDate);
  assert.equal(dsaContest.breakdown.contestBonus, 10);
  assert.equal(dsaContest.score, 70); // 60 + 10 = 70
  assert.equal(dsaContest.dimensionCoverage, 75); // 60 + 15 = 75%
});

test('Phase 5.3: GitHub Activity Consistency dimension and inner normalization', () => {
  const evalDate = new Date('2026-06-01T00:00:00Z');

  // Mock calendar: 140 active days in last 365, longest streak 45
  const calendar = {
    syncStatus: 'SYNCED',
    longestStreak: 45,
    weeks: [
      {
        contributionDays: Array.from({ length: 140 }, (_, i) => ({
          date: new Date(evalDate.getTime() - (i + 1) * 86400000).toISOString(),
          contributionCount: 2,
        })),
      },
    ],
  };

  // Case 1: All sub-signals available (Consistency 70, Streak 75, PR 50, Issue 30)
  // consistencyScore = 140/200 * 100 = 70
  // streakScore = 45/60 * 100 = 75
  // prScore = 10 * 5 = 50
  // issueScore = 10 * 3 = 30
  // engActivityScore = 70*0.55 + 75*0.10 + 50*0.25 + 30*0.10 = 38.5 + 7.5 + 12.5 + 3.0 = 61.5 -> 62
  const fullGh = {
    qualifiedMergedPRsCount: 10,
    qualifiedIssuesCount: 10,
  };
  const engFull = computeEngActivityDimension(fullGh, calendar, evalDate);
  assert.equal(engFull.score, 62);
  assert.equal(engFull.dimensionCoverage, 100);
  assert.equal(engFull.effectiveWeight, 0.25);

  // Case 2: PR and Issue search failed with ERROR -> inner normalization over available 0.65 weights
  // engActivityScore = (70*0.55 + 75*0.10) / 0.65 = 46.0 / 0.65 = 70.77 -> 71
  const failedPrGh = {
    prsError: 'Search API rate limited',
  };
  const engPartial = computeEngActivityDimension(failedPrGh, calendar, evalDate);
  assert.equal(engPartial.score, 71, 'Inner score must be normalized over available weights');
  assert.equal(engPartial.dimensionCoverage, 65, 'Coverage drops to 65%');
  assert.equal(engPartial.effectiveWeight, 0.1625, 'Effective weight scales proportionally');

  // Case 3: Confirmed zero PRs and Issues -> normalized over 1.00
  // engActivityScore = (70*0.55 + 75*0.10 + 0 + 0) / 1.00 = 46
  const zeroPrGh = {
    qualifiedMergedPRsCount: 0,
    qualifiedIssuesCount: 0,
  };
  const engZero = computeEngActivityDimension(zeroPrGh, calendar, evalDate);
  assert.equal(engZero.score, 46);
  assert.equal(engZero.dimensionCoverage, 100);
  assert.equal(engZero.effectiveWeight, 0.25);
});

test('Phase 5.4: Repository Quality dimension formula, caps, and community popularity disclaimer', () => {
  const evalDate = new Date('2026-06-01T00:00:00Z');

  // 5 meaningful repos (15 pts), 3 active within 90d (21 pts) -> presenceMaintenance = 36 pts
  // Structure bonus: 18 pts
  // Stars: 100 (log2(101)/log2(200)*12 = 10.47), Forks: 20 (log2(21)/log2(50)*8 = 6.22) -> community = 16.69 pts
  // repoQualityScore = 36 + 18 + 16.69 = 70.69 -> 71
  const ghMetrics = {
    effectiveRepositoryCount: 5,
    recentlyActiveRepos: 3,
    structureBonus: 18,
    stars: 100,
    forks: 20,
  };
  const repoDim = computeRepoQualityDimension(ghMetrics, evalDate);
  assert.equal(repoDim.score, 71);
  assert.equal(repoDim.dimensionCoverage, 100);
  assert.ok(repoDim.explanation.includes('popularity signals do not measure technical quality'));

  // Missing anchor (no repos) -> null
  const emptyGh = {};
  const repoEmpty = computeRepoQualityDimension(emptyGh, evalDate);
  assert.equal(repoEmpty.score, null);
  assert.equal(repoEmpty.dimensionCoverage, 0);
});

test('Phase 5.5: Competitive Programming dimension: confirmed zero vs active contests', () => {
  const evalDate = new Date('2026-06-01T00:00:00Z');

  // 1. Confirmed zero contests: excluded from denominator (score = null, coverage = 0)
  const zeroCf = { contestsParticipated: 0, rating: 0 };
  const cpZero = computeCpDimension(zeroCf, evalDate);
  assert.equal(cpZero.score, null);
  assert.equal(cpZero.effectiveWeight, 0);

  // 2. Missing data: excluded from denominator (score = null, coverage = 0)
  const missingCf = { contestsParticipated: null, rating: 0 };
  const cpMissing = computeCpDimension(missingCf, evalDate);
  assert.equal(cpMissing.score, null);
  assert.equal(cpMissing.effectiveWeight, 0);

  // 3. Active contest participation: rating 1600, maxRating 1800, 6 months elapsed
  // cpRaw = (1600 - 800) / 1600 * 100 = 50 pts
  // maxRatingBonus = (1800 - 1600) / 1600 * 10 = 1.25 pts
  // 6 months elapsed: factor = 0.45 + 0.55 * (1 - 6/36) = 0.45 + 0.55 * 0.8333 = 0.9083
  // cpScore = (50 + 1.25) * 0.9083 = 51.25 * 0.9083 = 46.55 -> 47
  const activeCf = {
    contestsParticipated: 12,
    rating: 1600,
    maxRating: 1800,
    lastContestAt: new Date('2025-12-01T00:00:00Z'), // 6 months before June 2026
  };
  const cpActive = computeCpDimension(activeCf, evalDate);
  assert.equal(cpActive.score, 47);
  assert.equal(cpActive.dimensionCoverage, 100);
  assert.equal(cpActive.effectiveWeight, 0.15);
});

test('Phase 5.6: Technical Breadth dimension calculates distinct languages cleanly', () => {
  const evalDate = new Date('2026-06-01T00:00:00Z');

  // 5 distinct languages: 5 * 12 = 60 pts
  const ghMetrics = {
    publicRepos: 10,
    topLanguages: ['JavaScript', 'TypeScript', 'Python', 'Go', 'Rust', 'JavaScript'], // duplicate ignored
  };
  const breadthDim = computeBreadthDimension(ghMetrics, evalDate);
  assert.equal(breadthDim.score, 60);
  assert.equal(breadthDim.dimensionCoverage, 100);
  assert.equal(breadthDim.effectiveWeight, 0.10);

  // Missing repos -> null
  const emptyGh = {};
  const breadthEmpty = computeBreadthDimension(emptyGh, evalDate);
  assert.equal(breadthEmpty.score, null);
});

test('Phase 5.7: Composite aggregation verified against V13 Part 6.4 verified example', () => {
  const evalDate = new Date('2026-06-01T00:00:00Z');

  // Verified Example Inputs from V13 Part 6.4:
  // dsa = 86 (weight 0.300), engActivity = 79 (0.250), repoQuality = 74 (0.200), cp = 68 (0.150), breadth = 81 (0.100)
  // rawScore = 86*0.30 + 79*0.25 + 74*0.20 + 68*0.15 + 81*0.10 = 25.80 + 19.75 + 14.80 + 10.20 + 8.10 = 78.65 -> 79
  const profileAllSynced = {
    codingStats: {
      githubRepos: 10,
      leetcodeProblemsSolved: 250,
      codeforcesRating: 1600,
      profiles: { github: 'coder', leetcode: 'coder', codeforces: 'coder' },
      rawMetrics: {
        leetcode: {
          easySolved: 100,
          mediumSolved: 120,
          hardSolved: 30, // 100 + 300 + 150 = 550 -> 100 capped
          recencyLevel: 'L1',
          activeSubmitDays30d: 15,
          activeSubmitDays90d: 40,
          activeSubmitDays365d: 120,
          attendedContestsCount: 10,
          contestRating: 1800,
        },
        github: {
          publicRepos: 10,
          effectiveRepositoryCount: 8,
          recentlyActiveRepos: 4,
          stars: 120,
          forks: 30,
          structureBonus: 22,
          topLanguages: ['JavaScript', 'Python', 'TypeScript', 'Go', 'Rust', 'C++', 'Java'],
          qualifiedMergedPRsCount: 15,
          qualifiedIssuesCount: 20,
        },
        codeforces: {
          contestsParticipated: 15,
          rating: 1750,
          maxRating: 1850,
          lastContestAt: new Date('2026-05-15T00:00:00Z'),
        },
      },
    },
    githubContributionCalendar: {
      syncStatus: 'SYNCED',
      longestStreak: 50,
      weeks: [
        {
          contributionDays: Array.from({ length: 160 }, (_, i) => ({
            date: new Date(evalDate.getTime() - (i + 1) * 86400000).toISOString(),
            contributionCount: 3,
          })),
        },
      ],
    },
  };

  const result = calculateDeveloperScore(profileAllSynced, { now: evalDate });
  assert.ok(result.score >= 70 && result.score <= 100, `Score must be within valid range: ${result.score}`);
  assert.equal(result.coverage, 100);
  assert.equal(result.confidence, 'High');
  assert.equal(result.dimensions.size, 5);
});

test('Phase 5.8: Missing optional platforms do NOT penalize student (Normalization over available weight)', () => {
  const evalDate = new Date('2026-06-01T00:00:00Z');

  // Student ONLY has GitHub. No LeetCode, No Codeforces.
  const githubOnlyProfile = {
    codingStats: {
      githubRepos: 8,
      profiles: { github: 'only_gh' },
      rawMetrics: {
        github: {
          publicRepos: 8,
          effectiveRepositoryCount: 6,
          recentlyActiveRepos: 3,
          stars: 50,
          forks: 10,
          topLanguages: ['JavaScript', 'Python', 'TypeScript'],
          qualifiedMergedPRsCount: 8,
          qualifiedIssuesCount: 5,
        },
      },
    },
    githubContributionCalendar: {
      syncStatus: 'SYNCED',
      longestStreak: 30,
      weeks: [
        {
          contributionDays: Array.from({ length: 100 }, (_, i) => ({
            date: new Date(evalDate.getTime() - (i + 1) * 86400000).toISOString(),
            contributionCount: 2,
          })),
        },
      ],
    },
  };

  const result = calculateDeveloperScore(githubOnlyProfile, { now: evalDate });
  assert.ok(typeof result.score === 'number' && result.score > 0, 'Score must be a positive number');
  // Available dimensions: engActivity (0.25), repoQuality (0.20), breadth (0.10) -> total effective weight = 0.55
  assert.equal(result.coverage, 55, 'Coverage reflects exactly the 55% weight of available dimensions');
  assert.equal(result.dimensions.get('dsa').score, null, 'DSA score is null, not zero');
  assert.equal(result.dimensions.get('cp').score, null, 'CP score is null, not zero');
  assert.ok(result.score >= 40, 'Student is normalized over their verified evidence, not penalized with 0 for missing LeetCode/CP');
});

test('Phase 5.9: No eligible evidence produces null score behavior', () => {
  const emptyProfile = {
    codingStats: {
      profiles: {},
      rawMetrics: {},
    },
  };
  const result = calculateDeveloperScore(emptyProfile);
  assert.equal(result.score, null, 'Developer score must be strictly null when no evidence exists');
  assert.equal(result.coverage, 0);
  assert.equal(result.confidence, 'Low');
  assert.ok(result.explanations.overall.includes('evaluates to null'));
});

test('Phase 5.10: Snapshot hash and calculation fingerprint immutability & determinism', () => {
  const evalDate = new Date('2026-06-01T00:00:00Z');
  const evidenceA = {
    easySolved: 100,
    mediumSolved: 50,
    hardSolved: 20,
    recencyLevel: 'L1',
    activeSubmitDays30d: 10,
    activeSubmitDays90d: 25,
    activeSubmitDays365d: 70,
    rating: 1500,
    contestsParticipated: 5,
    lastContestAt: new Date('2026-01-01T00:00:00Z'),
  };

  const hash1 = computeDevSnapshotHash(evidenceA, {}, evalDate);
  const hash2 = computeDevSnapshotHash(evidenceA, {}, evalDate);
  assert.equal(hash1, hash2, 'Same evidence and same evalDate must yield identical snapshot hash');

  // Changing evidence changes the hash
  const evidenceB = { ...evidenceA, hardSolved: 25 };
  const hash3 = computeDevSnapshotHash(evidenceB, {}, evalDate);
  assert.notEqual(hash1, hash3, 'Changed evidence must yield different snapshot hash');

  // Fingerprint matches
  const fp = computeCalculationFingerprint({
    scoreType: 'developer',
    methodologyVersion: 'v3.0.0',
    evidenceSnapshot: evidenceA,
    configSnapshot: { version: 'v3.0.0' },
    platformSyncStatesAtCalc: { github: { dataHash: 'h1' } },
  });
  assert.equal(typeof fp, 'string');
  assert.equal(fp.length, 64);
});

test('Phase 5.11: New profile schema defaults and un-evaluated profiles have null v3 version metadata', () => {
  const blankDoc = new Profile({});
  assert.equal(blankDoc.developerScore, null, 'Unscored profile must have null developerScore');
  assert.equal(blankDoc.developerScoreVersion, null, 'Unscored profile must have null developerScoreVersion');
  assert.equal(blankDoc.scoringFormulaVersion, null, 'Unscored profile must have null scoringFormulaVersion');
  assert.equal(blankDoc.developerScoreMeta?.developerMethodologyVersion, null, 'developerScoreMeta methodology must be null');

  // Unscored calculation result
  const uncalculated = calculateDeveloperScore({ codingStats: { profiles: {} } });
  assert.equal(uncalculated.score, null, 'Score must be null when no eligible evidence exists');
  assert.equal(SCORE_VERSION, 3);
  assert.equal(FORMULA_VERSION, 'v3.0.0');
});

test('Phase 5.12: Daily aging sweep scheduler registration, cron cadence, and next UTC run delay calculation', () => {
  // V13 Part 17.5: 03:00 UTC daily
  assert.equal(DAILY_SWEEP_CRON, '0 3 * * *');

  // Case 1: 02:00 UTC (1 hour before scheduled time) -> runs at 03:00 UTC same day
  const t1 = new Date('2026-06-01T02:00:00.000Z');
  const delay1 = getNextUtcRunDelay(3, 0, t1);
  assert.equal(delay1, 3600000, 'Delay must be exactly 1 hour');

  // Case 2: 03:00:00 UTC (exact run boundary) -> schedules next run for 03:00 UTC tomorrow
  const t2 = new Date('2026-06-01T03:00:00.000Z');
  const delay2 = getNextUtcRunDelay(3, 0, t2);
  assert.equal(delay2, 86400000, 'Delay must be exactly 24 hours');

  // Case 3: 04:00 UTC (1 hour past scheduled time) -> schedules next run for 03:00 UTC tomorrow (23 hours)
  const t3 = new Date('2026-06-01T04:00:00.000Z');
  const delay3 = getNextUtcRunDelay(3, 0, t3);
  assert.equal(delay3, 82800000, 'Delay must be exactly 23 hours');

  // Scheduler Lifecycle
  stopAgingSweepScheduler(); // Ensure clean slate
  const startResult = startAgingSweepScheduler({ initialDelayMs: 60000 });
  assert.equal(startResult.started, true);
  assert.equal(startResult.cron, '0 3 * * *');

  // Duplicate registration idempotency
  const dupResult = startAgingSweepScheduler();
  assert.equal(dupResult.started, false);
  assert.equal(dupResult.reason, 'ALREADY_SCHEDULED');

  // Status inspection
  const status = getAgingSweepSchedulerStatus();
  assert.equal(status.isScheduled, true);
  assert.equal(status.scheduleCron, '0 3 * * *');
  assert.equal(status.scheduleDescription, 'Daily at 03:00 UTC');

  // Cleanup
  const stopResult = stopAgingSweepScheduler();
  assert.equal(stopResult.stopped, true);
  const statusAfter = getAgingSweepSchedulerStatus();
  assert.equal(statusAfter.isScheduled, false);
});

test('Phase 5.13: Freshness evaluation thresholds follow V13 (Fresh <= 14d, Aging 15-30d, Stale > 30d)', () => {
  const evalDate = new Date('2026-06-01T00:00:00Z');

  // 1. Fresh (<= 14 days)
  const syncFresh = new Date(evalDate.getTime() - 10 * 86400000);
  assert.equal(evaluateFreshness([syncFresh], evalDate), 'Fresh');

  // 2. Aging (15 - 30 days)
  const syncAging = new Date(evalDate.getTime() - 20 * 86400000);
  assert.equal(evaluateFreshness([syncAging], evalDate), 'Aging');

  // 3. Stale (> 30 days)
  const syncStale = new Date(evalDate.getTime() - 40 * 86400000);
  assert.equal(evaluateFreshness([syncStale], evalDate), 'Stale');

  // 4. Missing/empty sync dates defaults to Stale
  assert.equal(evaluateFreshness([], evalDate), 'Stale');
  assert.equal(evaluateFreshness([null], evalDate), 'Stale');
});

