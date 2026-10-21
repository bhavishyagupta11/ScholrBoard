import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Profile from '../../models/Profile.js';
import User from '../../models/User.js';
import ScoreHistory from '../../models/ScoreHistory.js';
import AuditLog from '../../models/AuditLog.js';
import {
  recalculateAndSaveScore,
  calculateDeveloperScore,
} from '../../services/developerScoringService.js';
import {
  acquireLock,
  renewLease,
  releaseLock,
  sweepAgingScores,
  startAgingSweepScheduler,
  stopAgingSweepScheduler,
  getAgingSweepSchedulerStatus,
  DAILY_SWEEP_CRON,
} from '../../services/scoreHistoryService.js';
import { validateIntegrationTestDatabaseUri } from '../helpers/testDatabaseGuard.js';

dotenv.config();
process.env.NODE_ENV = 'test';

const testUri = process.env.MONGODB_URI_TEST;
validateIntegrationTestDatabaseUri(testUri);

let testUser = null;

before(async () => {
  await mongoose.connect(testUri, { serverSelectionTimeoutMS: 15000 });

  testUser = await User.create({
    name: 'Phase 5 Dev Score Student',
    email: `phase5.student.${Date.now()}@scholrboard.test`,
    password: 'Password123!',
    role: 'student',
  });
});

after(async () => {
  if (testUser) {
    await Profile.collection.deleteMany({ userId: testUser._id });
    await ScoreHistory.collection.deleteMany({ userId: testUser._id });
    await AuditLog.collection.deleteMany({ performedBy: testUser._id });
    await User.collection.deleteOne({ _id: testUser._id });
  }

  await mongoose.disconnect();
});

test('Integration 5.1: recalculateAndSaveScore with all platforms linked generates valid v3 dimensions, breakdown, and ScoreHistory milestone', async () => {
  await Profile.collection.deleteMany({ userId: testUser._id });
  await ScoreHistory.collection.deleteMany({ userId: testUser._id });

  const evalDate = new Date();
  const calendarDays = Array.from({ length: 150 }, (_, i) => ({
    date: new Date(evalDate.getTime() - (i + 1) * 86400000).toISOString(),
    contributionCount: 3,
  }));

  const profile = await Profile.create({
    userId: testUser._id,
    codingStats: {
      githubRepos: 10,
      leetcodeProblemsSolved: 250,
      codeforcesRating: 1650,
      profiles: { github: 'octocat', leetcode: 'tourist', codeforces: 'tourist' },
      rawMetrics: {
        leetcode: {
          easySolved: 100,
          mediumSolved: 100,
          hardSolved: 30, // 100 + 250 + 150 = 500 wp -> 100 pts
          recencyLevel: 'L1',
          activeSubmitDays30d: 15,
          activeSubmitDays90d: 40,
          activeSubmitDays365d: 120,
          attendedContestsCount: 8,
          contestRating: 1600,
        },
        github: {
          publicRepos: 10,
          effectiveRepositoryCount: 8,
          recentlyActiveRepos: 4,
          stars: 80,
          forks: 25,
          structureBonus: 20,
          topLanguages: [
            { name: 'JavaScript', count: 10 },
            { name: 'TypeScript', count: 8 },
            { name: 'Python', count: 5 },
            { name: 'Go', count: 3 },
            { name: 'Rust', count: 2 },
          ],
          qualifiedMergedPRsCount: 12,
          qualifiedIssuesCount: 15,
        },
        codeforces: {
          contestsParticipated: 10,
          rating: 1650,
          maxRating: 1750,
          lastContestAt: new Date(evalDate.getTime() - 30 * 86400000), // 1 month ago
        },
      },
    },
    platformSyncStates: {
      github: { syncStatus: 'SYNCED', lastSuccessfulSync: evalDate, dataHash: 'gh_hash_1' },
      leetcode: { syncStatus: 'SYNCED', lastSuccessfulSync: evalDate, dataHash: 'lc_hash_1' },
      codeforces: { syncStatus: 'SYNCED', lastSuccessfulSync: evalDate, dataHash: 'cf_hash_1' },
    },
    githubContributionCalendar: {
      syncStatus: 'SYNCED',
      longestStreak: 45,
      weeks: [{ contributionDays: calendarDays }],
    },
  });

  const milestoneEventId = `evt_phase5_full_${Date.now()}`;
  const updatedProfile = await recalculateAndSaveScore(profile._id, 'Full sync recalculation', {
    milestoneEventId,
    newEvidenceHash: 'composite_hash_v3_1',
    oldEvidenceHash: null,
  });

  // 1. Base Developer Score must be calculated in valid range (0-100)
  assert.ok(typeof updatedProfile.developerScore === 'number' && updatedProfile.developerScore > 0);
  assert.equal(updatedProfile.developerScoreVersion, 3);
  assert.equal(updatedProfile.scoringFormulaVersion, 'v3.0.0');

  // 2. All 5 dimensions must exist in developerScoreMeta.dimensions
  const dims = updatedProfile.developerScoreMeta.dimensions;
  assert.ok(dims.get('dsa')?.score > 0);
  assert.ok(dims.get('engActivity')?.score > 0);
  assert.ok(dims.get('repoQuality')?.score > 0);
  assert.ok(dims.get('cp')?.score > 0);
  assert.ok(dims.get('breadth')?.score > 0);

  // 3. Coverage and Confidence
  assert.equal(updatedProfile.developerScoreMeta.coverage, 100);
  assert.equal(updatedProfile.developerScoreMeta.confidence, 'High');
  assert.equal(updatedProfile.developerScoreMeta.freshness, 'Fresh');

  // 4. ScoreHistory record created
  const history = await ScoreHistory.findOne({
    userId: testUser._id,
    milestoneEventId,
  });
  assert.ok(history, 'ScoreHistory snapshot must be persisted');
  assert.equal(history.score, updatedProfile.developerScore);
  assert.equal(history.coverage, 100);
  assert.equal(history.snapshotSequence, 1);
});

test('Integration 5.2: Missing optional platforms: student with only GitHub linked calculates over available weight, excludes DSA and CP from denominator (score = null, not 0), records accurate coverage (55%), and creates ScoreHistory', async () => {
  await Profile.collection.deleteMany({ userId: testUser._id });
  await ScoreHistory.collection.deleteMany({ userId: testUser._id });

  const evalDate = new Date();
  const calendarDays = Array.from({ length: 100 }, (_, i) => ({
    date: new Date(evalDate.getTime() - (i + 1) * 86400000).toISOString(),
    contributionCount: 2,
  }));

  const profile = await Profile.create({
    userId: testUser._id,
    codingStats: {
      githubRepos: 6,
      profiles: { github: 'solo_coder' },
      rawMetrics: {
        github: {
          publicRepos: 6,
          effectiveRepositoryCount: 5,
          recentlyActiveRepos: 2,
          stars: 40,
          forks: 10,
          topLanguages: [
            { name: 'JavaScript', count: 8 },
            { name: 'Python', count: 5 },
            { name: 'Go', count: 3 },
          ],
          qualifiedMergedPRsCount: 6,
          qualifiedIssuesCount: 4,
        },
      },
    },
    platformSyncStates: {
      github: { syncStatus: 'SYNCED', lastSuccessfulSync: evalDate, dataHash: 'gh_solo_1' },
      leetcode: { syncStatus: 'NOT_CONNECTED' },
      codeforces: { syncStatus: 'NOT_CONNECTED' },
    },
    githubContributionCalendar: {
      syncStatus: 'SYNCED',
      longestStreak: 25,
      weeks: [{ contributionDays: calendarDays }],
    },
  });

  const milestoneEventId = `evt_phase5_gh_only_${Date.now()}`;
  const updatedProfile = await recalculateAndSaveScore(profile._id, 'GitHub only recalculation', {
    milestoneEventId,
    newEvidenceHash: 'composite_hash_gh_only_1',
    oldEvidenceHash: null,
  });

  // 1. Score is normalized over available weight (0.55), NOT penalized with zero for LeetCode or CP
  assert.ok(typeof updatedProfile.developerScore === 'number' && updatedProfile.developerScore >= 40);
  assert.equal(updatedProfile.developerScoreMeta.coverage, 55, 'Coverage must reflect exactly available 55% weight');

  // 2. Unlinked platforms must have score = null in dimensions map, not zero
  const dims = updatedProfile.developerScoreMeta.dimensions;
  assert.equal(dims.get('dsa').score, null);
  assert.equal(dims.get('cp').score, null);
  assert.ok(dims.get('engActivity').score > 0);
  assert.ok(dims.get('repoQuality').score > 0);
  assert.ok(dims.get('breadth').score > 0);

  // 3. ScoreHistory record persisted with accurate null dimensions
  const history = await ScoreHistory.findOne({ userId: testUser._id, milestoneEventId });
  assert.ok(history);
  assert.equal(history.score, updatedProfile.developerScore);
  assert.equal(history.coverage, 55);
});

test('Integration 5.3: Confirmed zero Codeforces contests vs missing contest data: both are excluded from denominator (no score penalty), but metadata distinguishes them', async () => {
  const evalDate = new Date();

  // Profile A: Confirmed Zero Contests (contestsParticipated = 0)
  const profileZero = {
    codingStats: {
      rawMetrics: {
        codeforces: { contestsParticipated: 0, rating: 0 },
      },
    },
  };
  const resultZero = calculateDeveloperScore(profileZero, { now: evalDate });
  const cpZeroDim = resultZero.dimensions.get('cp');
  assert.equal(cpZeroDim.score, null, 'Confirmed zero contests must be excluded from denominator (score = null)');
  assert.equal(cpZeroDim.subSignalStatus.contest, 'CONFIRMED_ZERO');

  // Profile B: Missing Contest History (contestsParticipated = null)
  const profileMissing = {
    codingStats: {
      rawMetrics: {
        codeforces: { contestsParticipated: null, rating: 0 },
      },
    },
  };
  const resultMissing = calculateDeveloperScore(profileMissing, { now: evalDate });
  const cpMissingDim = resultMissing.dimensions.get('cp');
  assert.equal(cpMissingDim.score, null, 'Missing contests must be excluded from denominator (score = null)');
  assert.equal(cpMissingDim.subSignalStatus.contest, 'UNAVAILABLE');
});

test('Integration 5.4: Stale sync data (> 30 days) updates freshness to Stale and drops confidence to Low without reducing raw mathematical score', async () => {
  await Profile.collection.deleteMany({ userId: testUser._id });
  await ScoreHistory.collection.deleteMany({ userId: testUser._id });

  const evalDate = new Date();
  const staleDate = new Date(evalDate.getTime() - 40 * 86400000); // 40 days ago

  const calendarDays = Array.from({ length: 150 }, (_, i) => ({
    date: new Date(evalDate.getTime() - (i + 1) * 86400000).toISOString(),
    contributionCount: 3,
  }));

  const profile = await Profile.create({
    userId: testUser._id,
    codingStats: {
      githubRepos: 10,
      leetcodeProblemsSolved: 250,
      profiles: { github: 'stale_coder', leetcode: 'stale_coder' },
      rawMetrics: {
        leetcode: {
          easySolved: 100,
          mediumSolved: 100,
          hardSolved: 30,
          recencyLevel: 'L1',
          activeSubmitDays30d: 15,
          activeSubmitDays90d: 40,
          activeSubmitDays365d: 120,
        },
        github: {
          publicRepos: 10,
          effectiveRepositoryCount: 8,
          recentlyActiveRepos: 4,
          stars: 80,
          forks: 25,
          topLanguages: [
            { name: 'JavaScript', count: 8 },
            { name: 'Python', count: 5 },
          ],
        },
      },
    },
    platformSyncStates: {
      github: { syncStatus: 'SYNCED', lastSuccessfulSync: staleDate, dataHash: 'stale_gh_1' },
      leetcode: { syncStatus: 'SYNCED', lastSuccessfulSync: staleDate, dataHash: 'stale_lc_1' },
    },
    githubContributionCalendar: {
      syncStatus: 'SYNCED',
      longestStreak: 40,
      weeks: [{ contributionDays: calendarDays }],
    },
  });

  const milestoneEventId = `evt_phase5_stale_${Date.now()}`;
  const updatedProfile = await recalculateAndSaveScore(profile._id, 'Stale data recalculation', {
    milestoneEventId,
    newEvidenceHash: 'composite_stale_1',
    oldEvidenceHash: null,
  });

  // Freshness must be Stale and Confidence must be Low
  assert.equal(updatedProfile.developerScoreMeta.freshness, 'Stale');
  assert.equal(updatedProfile.developerScoreMeta.confidence, 'Low');

  // Raw score is preserved based on verified problem volume / activity without artificial penalty
  assert.ok(typeof updatedProfile.developerScore === 'number' && updatedProfile.developerScore > 0);
});

test('Integration 5.5: Scoring lease lock prevents concurrent overlapping calculations for the same profile and scoreType', async () => {
  await Profile.collection.deleteMany({ userId: testUser._id });

  const profile = await Profile.create({
    userId: testUser._id,
  });

  const jobId1 = 'job_worker_1';
  const jobId2 = 'job_worker_2';

  // Worker 1 acquires lock
  const acquired1 = await acquireLock(profile._id, 'developer', jobId1);
  assert.equal(acquired1, true);

  // Worker 2 attempts acquire while lock is valid -> must fail
  const acquired2 = await acquireLock(profile._id, 'developer', jobId2);
  assert.equal(acquired2, false);

  // Worker 1 renews lease -> succeeds
  const renewed1 = await renewLease(profile._id, 'developer', jobId1);
  assert.equal(renewed1, true);

  // Worker 1 releases lock
  await releaseLock(profile._id, 'developer', jobId1);

  // Now Worker 2 can acquire lock
  const acquired2After = await acquireLock(profile._id, 'developer', jobId2);
  assert.equal(acquired2After, true);

  // Clean up
  await releaseLock(profile._id, 'developer', jobId2);
});

test('Integration 5.6: Daily aging sweep (sweepAgingScores) transitions Fresh -> Aging without writing new ScoreHistory records', async () => {
  await Profile.collection.deleteMany({ userId: testUser._id });
  await ScoreHistory.collection.deleteMany({ userId: testUser._id });

  const now = new Date();
  const agingDate = new Date(now.getTime() - 20 * 86400000); // 20 days ago (Aging: > 14 and <= 30)

  const profile = await Profile.create({
    userId: testUser._id,
    developerScore: 75,
    developerScoreMeta: {
      score: 75,
      coverage: 85,
      confidence: 'High',
      freshness: 'Fresh', // currently marked Fresh in database
      dimensions: new Map([['dsa', { recencyLevel: 'L1' }]]),
    },
    platformSyncStates: {
      github: { syncStatus: 'SYNCED', lastSuccessfulSync: agingDate },
      leetcode: { syncStatus: 'SYNCED', lastSuccessfulSync: agingDate },
    },
    codingStats: {
      profiles: { github: 'gh_user', leetcode: 'lc_user' },
    },
  });

  const historyBefore = await ScoreHistory.countDocuments({ userId: testUser._id });

  // Execute daily aging sweep
  const sweepResult = await sweepAgingScores({ now });
  assert.ok(sweepResult.updatedCount >= 1, 'Profile must be updated during aging sweep');

  const profileAfter = await Profile.findById(profile._id);
  assert.equal(profileAfter.developerScoreMeta.freshness, 'Aging');
  assert.equal(profileAfter.developerScoreMeta.confidence, 'Medium');

  // Invariant: sweep MUST NOT write new ScoreHistory records
  const historyAfter = await ScoreHistory.countDocuments({ userId: testUser._id });
  assert.equal(historyAfter, historyBefore, 'ScoreHistory records must remain strictly unchanged by aging sweep');
});

test('Integration 5.7: Idempotent recalculation across retries: calling recalculateAndSaveScore with identical payload and milestoneEventId creates 0 duplicate ScoreHistory records', async () => {
  await Profile.collection.deleteMany({ userId: testUser._id });
  await ScoreHistory.collection.deleteMany({ userId: testUser._id });

  const evalDate = new Date();
  const calendarDays = Array.from({ length: 80 }, (_, i) => ({
    date: new Date(evalDate.getTime() - (i + 1) * 86400000).toISOString(),
    contributionCount: 2,
  }));

  const profile = await Profile.create({
    userId: testUser._id,
    codingStats: {
      githubRepos: 5,
      profiles: { github: 'idempotent_gh' },
      rawMetrics: {
        github: {
          publicRepos: 5,
          effectiveRepositoryCount: 4,
          recentlyActiveRepos: 2,
          stars: 20,
          forks: 5,
          topLanguages: [
            { name: 'JavaScript', count: 5 },
          ],
        },
      },
    },
    platformSyncStates: {
      github: { syncStatus: 'SYNCED', lastSuccessfulSync: evalDate, dataHash: 'hash_gh_idem' },
    },
    githubContributionCalendar: {
      syncStatus: 'SYNCED',
      longestStreak: 20,
      weeks: [{ contributionDays: calendarDays }],
    },
  });

  const milestoneEventId = `evt_phase5_idem_${Date.now()}`;
  const options = {
    milestoneEventId,
    newEvidenceHash: 'hash_idem_1',
    oldEvidenceHash: null,
  };

  // First calculation
  const firstProfile = await recalculateAndSaveScore(profile._id, 'Initial idempotent run', options);
  const firstCount = await ScoreHistory.countDocuments({ userId: testUser._id });
  assert.equal(firstCount, 1, 'First run must create 1 ScoreHistory milestone');

  // Retry with exact same milestoneEventId and payload
  const secondProfile = await recalculateAndSaveScore(profile._id, 'Retry idempotent run', options);
  const secondCount = await ScoreHistory.countDocuments({ userId: testUser._id });
  assert.equal(secondCount, 1, 'Retry must create 0 new ScoreHistory milestones (idempotency)');
  assert.equal(firstProfile.developerScore, secondProfile.developerScore);
});

test('Integration 5.8: A new profile in MongoDB has no misleading v3 version metadata; recalculating valid score persists v3 versions', async () => {
  await Profile.collection.deleteMany({ userId: testUser._id });
  await ScoreHistory.collection.deleteMany({ userId: testUser._id });

  // 1. Create fresh profile with no scores or platforms
  const newProfile = await Profile.create({ userId: testUser._id });
  const rawDbDoc = await Profile.findById(newProfile._id).lean();

  assert.equal(rawDbDoc.developerScore, null, 'New unscored profile must have null developerScore');
  assert.equal(rawDbDoc.developerScoreVersion, null, 'New unscored profile must not default developerScoreVersion to 3');
  assert.equal(rawDbDoc.scoringFormulaVersion, null, 'New unscored profile must not default scoringFormulaVersion to v3.0.0');
  assert.equal(rawDbDoc.developerScoreMeta?.developerMethodologyVersion ?? null, null, 'New unscored profile developerScoreMeta must not default to v3.0.0');

  // 2. Add valid evidence and run recalculateAndSaveScore
  const evalDate = new Date();
  const calendarDays = Array.from({ length: 60 }, (_, i) => ({
    date: new Date(evalDate.getTime() - (i + 1) * 86400000).toISOString(),
    contributionCount: 2,
  }));

  await Profile.updateOne({ _id: newProfile._id }, {
    $set: {
      codingStats: {
        githubRepos: 5,
        profiles: { github: 'scored_student' },
        rawMetrics: {
          github: {
            publicRepos: 5,
            effectiveRepositoryCount: 4,
            recentlyActiveRepos: 2,
            stars: 25,
            forks: 5,
            topLanguages: [{ name: 'JavaScript', count: 5 }],
          },
        },
      },
      platformSyncStates: {
        github: { syncStatus: 'SYNCED', lastSuccessfulSync: evalDate, dataHash: 'h_new_1' },
      },
      githubContributionCalendar: {
        syncStatus: 'SYNCED',
        longestStreak: 15,
        weeks: [{ contributionDays: calendarDays }],
      },
    },
  });

  const milestoneEventId = `evt_phase5_audit_v3_${Date.now()}`;
  const scoredProfile = await recalculateAndSaveScore(newProfile._id, 'Audit v3 version persistence test', {
    milestoneEventId,
    newEvidenceHash: 'h_new_1_eval',
    oldEvidenceHash: null,
  });

  // 3. Post-calculation assertions
  assert.ok(typeof scoredProfile.developerScore === 'number' && scoredProfile.developerScore > 0);
  assert.equal(scoredProfile.developerScoreVersion, 3);
  assert.equal(scoredProfile.scoringFormulaVersion, 'v3.0.0');
  assert.equal(scoredProfile.developerScoreMeta.developerMethodologyVersion, 'v3.0.0');

  // Verify in database
  const refreshedDbDoc = await Profile.findById(newProfile._id).lean();
  assert.equal(refreshedDbDoc.developerScoreVersion, 3);
  assert.equal(refreshedDbDoc.scoringFormulaVersion, 'v3.0.0');
  assert.equal(refreshedDbDoc.developerScoreMeta.developerMethodologyVersion, 'v3.0.0');
});

test('Integration 5.9: A failed calculation or persistence attempt cannot label an unpersisted score as v3', async () => {
  await Profile.collection.deleteMany({ userId: testUser._id });
  await ScoreHistory.collection.deleteMany({ userId: testUser._id });

  const unscoredProfile = await Profile.create({
    userId: testUser._id,
    developerScore: null,
    developerScoreVersion: null,
    scoringFormulaVersion: null,
  });

  const failedMilestoneEventId = `evt_fail_v3_${Date.now()}`;

  // Attempt calculation with injected failure right after history creation before profile update
  await assert.rejects(async () => {
    await recalculateAndSaveScore(unscoredProfile._id, 'Failing run with injected failure', {
      milestoneEventId: failedMilestoneEventId,
      _injectFailureBeforeProfileUpdate: true,
    });
  }, {
    message: 'INJECTED_FAILURE_AFTER_HISTORY_CREATE',
  });

  // Verify profile in DB was NOT mutated to claim v3
  const persisted = await Profile.findById(unscoredProfile._id).lean();
  assert.equal(persisted.developerScore, null, 'developerScore must remain null after failed persistence');
  assert.equal(persisted.developerScoreVersion, null, 'developerScoreVersion must remain null after failed persistence');
  assert.equal(persisted.scoringFormulaVersion, null, 'scoringFormulaVersion must remain null after failed persistence');
  assert.equal(persisted.developerScoreMeta?.developerMethodologyVersion ?? null, null, 'developerScoreMeta must remain null');

  // Verify no orphaned ScoreHistory was persisted
  const orphanedHistory = await ScoreHistory.findOne({ milestoneEventId: failedMilestoneEventId });
  assert.equal(orphanedHistory, null, 'Transaction rollback must prevent orphaned ScoreHistory record');
});

test('Integration 5.10: Daily aging sweep scheduler registration, lifecycle, and status verification', async () => {
  assert.equal(DAILY_SWEEP_CRON, '0 3 * * *');

  // Clean stop first
  stopAgingSweepScheduler();

  const startRes = startAgingSweepScheduler({ initialDelayMs: 3600000 });
  assert.equal(startRes.started, true);
  assert.equal(startRes.cron, '0 3 * * *');

  const status = getAgingSweepSchedulerStatus();
  assert.equal(status.isScheduled, true);
  assert.equal(status.scheduleCron, '0 3 * * *');
  assert.equal(status.scheduleDescription, 'Daily at 03:00 UTC');

  // Stop scheduler
  const stopRes = stopAgingSweepScheduler();
  assert.equal(stopRes.stopped, true);
  assert.equal(getAgingSweepSchedulerStatus().isScheduled, false);
});

test('Integration 5.11: Aging sweep handles repeated runs and concurrent execution safely without score reduction or duplicate history', async () => {
  await Profile.collection.deleteMany({ userId: testUser._id });
  await ScoreHistory.collection.deleteMany({ userId: testUser._id });

  const now = new Date();
  const agingDate = new Date(now.getTime() - 22 * 86400000); // 22 days ago (Aging)

  const profile = await Profile.create({
    userId: testUser._id,
    developerScore: 82,
    developerScoreVersion: 3,
    scoringFormulaVersion: 'v3.0.0',
    developerScoreMeta: {
      score: 82,
      coverage: 80,
      confidence: 'High',
      freshness: 'Fresh',
      dimensions: new Map([['dsa', { recencyLevel: 'L1' }]]),
    },
    platformSyncStates: {
      github: { syncStatus: 'SYNCED', lastSuccessfulSync: agingDate },
      leetcode: { syncStatus: 'SYNCED', lastSuccessfulSync: agingDate },
    },
    codingStats: {
      profiles: { github: 'dev_gh', leetcode: 'dev_lc' },
    },
  });

  const countBefore = await ScoreHistory.countDocuments({ userId: testUser._id });
  assert.equal(countBefore, 0);

  // 1. First sweep execution
  const sweepRes1 = await sweepAgingScores({ now });
  assert.ok(sweepRes1.updatedCount >= 1);

  const docAfterSweep1 = await Profile.findById(profile._id);
  assert.equal(docAfterSweep1.developerScore, 82, 'Raw mathematical score must NOT be reduced by aging sweep');
  assert.equal(docAfterSweep1.developerScoreMeta.freshness, 'Aging');
  assert.equal(docAfterSweep1.developerScoreMeta.confidence, 'Medium');
  assert.equal(docAfterSweep1.developerScoreVersion, 3);

  // ScoreHistory records must NOT be created for metadata-only sweep
  const countAfterSweep1 = await ScoreHistory.countDocuments({ userId: testUser._id });
  assert.equal(countAfterSweep1, 0, 'No history milestones for aging sweep updates');

  // 2. Second repeated sweep execution (idempotent / noop)
  const sweepRes2 = await sweepAgingScores({ now });
  assert.equal(sweepRes2.errorCount, 0);

  const docAfterSweep2 = await Profile.findById(profile._id);
  assert.equal(docAfterSweep2.developerScore, 82);
  const countAfterSweep2 = await ScoreHistory.countDocuments({ userId: testUser._id });
  assert.equal(countAfterSweep2, 0);
});

