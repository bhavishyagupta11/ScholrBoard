/**
 * Integration Test Suite for Upstream Sync Caller & recalculateAndSaveScore Integration
 *
 * Verifies that upstream sync callers correctly propagate durable milestoneEventId,
 * preserve the same ID across retries, advance monotonic sequences on distinct events,
 * and integrate with ScoreHistory transactional persistence.
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Profile from '../../models/Profile.js';
import ScoreHistory from '../../models/ScoreHistory.js';
import { recalculateAndSaveScore } from '../../services/developerScoringService.js';
import {
  validateIntegrationTestDatabaseUri,
} from '../helpers/testDatabaseGuard.js';
import { IdempotencyConflictError } from '../../services/scorePersistence.js';

dotenv.config();
process.env.NODE_ENV = 'test';

const testUri = process.env.MONGODB_URI_TEST;
validateIntegrationTestDatabaseUri(testUri);

let testUserId = null;
let testProfile = null;

before(async () => {
  await mongoose.connect(testUri, { serverSelectionTimeoutMS: 15000 });
  const topology = mongoose.connection.client?.topology?.description;
  const isReplicaSet = topology?.type === 'ReplicaSetWithPrimary' || !!topology?.setName;

  assert.equal(isReplicaSet, true, 'Requires replica set for transaction testing');

  testUserId = new mongoose.Types.ObjectId();
  testProfile = await Profile.create({
    userId: testUserId,
    bio: 'Sync Caller Integration Profile',
    codingStats: {
      profiles: {
        github: 'octocat',
        leetcode: 'tourist',
        codeforces: 'tourist',
      },
      rawMetrics: {
        github: { publicRepos: 10, followers: 5, stars: 20, forks: 5, topics: ['react', 'node'] },
        leetcode: { easySolved: 50, mediumSolved: 30, hardSolved: 10, contestRating: 1600 },
        codeforces: { rating: 1400, maxRating: 1500, rank: 'specialist', lastContestAt: new Date() },
      },
      githubRepos: 10,
      leetcodeProblemsSolved: 90,
      codeforcesRating: 1400,
    },
    developerScore: 0,
    developerScoreMeta: {
      score: null,
      coverage: null,
      confidence: null,
      freshness: null,
      evaluationRevision: 0,
      snapshotSequence: 0,
    },
  });
});

after(async () => {
  if (testUserId) {
    await ScoreHistory.collection.deleteMany({ userId: testUserId });
    await Profile.collection.deleteMany({ userId: testUserId });
  }
  await mongoose.disconnect();
});

test('Sync Integration 1: recalculateAndSaveScore with durable milestoneEventId persists ScoreHistory milestone', async () => {
  const milestoneEventId = `evt_sync_caller_${Date.now()}_1`;

  const updatedProfile = await recalculateAndSaveScore(testProfile._id, 'GitHub profile sync', {
    milestoneEventId,
  });

  assert.ok(updatedProfile, 'Must return updated profile');
  assert.ok(updatedProfile.developerScore > 0, 'Developer score must be calculated');

  // Verify real document persisted in ScoreHistory collection
  const persistedHistory = await ScoreHistory.findOne({
    userId: testUserId,
    scoreType: 'developer',
    milestoneEventId,
  });
  assert.ok(persistedHistory, 'ScoreHistory document must exist in MongoDB');
  assert.equal(persistedHistory.score, updatedProfile.developerScore);
  assert.equal(persistedHistory.snapshotSequence, 1);
  assert.equal(persistedHistory.priorSnapshotHash, 'GENESIS');
  assert.equal(persistedHistory.milestoneEventId, milestoneEventId);

  // Verify Profile metadata atomically updated
  assert.equal(updatedProfile.developerScoreMeta.snapshotSequence, 1);
  assert.equal(updatedProfile.developerScoreMeta.lastSnapshotHash, persistedHistory.snapshotHash);
  assert.equal(updatedProfile.developerScoreMeta.evaluationRevision, 1);

  testProfile = updatedProfile;
});

test('Sync Integration 2: Retry with exact same milestoneEventId is strictly idempotent', async () => {
  const existingHistory = await ScoreHistory.findOne({ userId: testUserId, scoreType: 'developer' });
  assert.ok(existingHistory, 'Initial history record must exist');

  // Retry recalculation reusing the exact same milestoneEventId
  const retriedProfile = await recalculateAndSaveScore(testProfile._id, 'GitHub profile sync', {
    milestoneEventId: existingHistory.milestoneEventId,
  });

  assert.ok(retriedProfile);
  const count = await ScoreHistory.countDocuments({ userId: testUserId, scoreType: 'developer' });
  assert.equal(count, 1, 'Idempotent retry with same milestoneEventId must NOT create duplicate records');

  // Profile pointers must remain stable
  assert.equal(retriedProfile.developerScoreMeta.snapshotSequence, 1);
  assert.equal(retriedProfile.developerScoreMeta.lastSnapshotHash, existingHistory.snapshotHash);
});

test('Sync Integration 3: Distinct sync run generates distinct milestoneEventId and advances snapshotSequence', async () => {
  const countBefore = await ScoreHistory.countDocuments({ userId: testUserId, scoreType: 'developer' });
  const liveProfileBefore = await Profile.findById(testProfile._id);
  const prevSeq = liveProfileBefore.developerScoreMeta.snapshotSequence;
  const prevHash = liveProfileBefore.developerScoreMeta.lastSnapshotHash;

  // Simulate significant progress on LeetCode (+15 medium solved -> score increase >= 3 pts)
  await Profile.updateOne({ _id: testProfile._id }, {
    $set: {
      'codingStats.rawMetrics.leetcode.mediumSolved': 60,
      'codingStats.leetcodeProblemsSolved': 120,
    }
  });

  const milestoneEventId2 = `evt_sync_caller_${Date.now()}_2`;

  const updatedProfile2 = await recalculateAndSaveScore(testProfile._id, 'LeetCode profile sync', {
    milestoneEventId: milestoneEventId2,
  });

  const countAfter = await ScoreHistory.countDocuments({ userId: testUserId, scoreType: 'developer' });
  assert.equal(countAfter, countBefore + 1, 'Distinct milestone event must create a second ScoreHistory record');

  const history2 = await ScoreHistory.findOne({
    userId: testUserId,
    scoreType: 'developer',
    milestoneEventId: milestoneEventId2,
  });
  assert.ok(history2);
  assert.equal(history2.snapshotSequence, prevSeq + 1, 'Snapshot sequence must advance monotonically');
  assert.equal(history2.priorSnapshotHash, prevHash, 'Prior snapshot hash must reference predecessor milestone');

  // Profile pointer must point to newest sequence
  assert.equal(updatedProfile2.developerScoreMeta.snapshotSequence, prevSeq + 1);
  assert.equal(updatedProfile2.developerScoreMeta.lastSnapshotHash, history2.snapshotHash);

  testProfile = updatedProfile2;
});

test('Sync Integration 4: Path A non-milestone minor update updates Profile with CAS and zero ScoreHistory inserts', async () => {
  const countBefore = await ScoreHistory.countDocuments({ userId: testUserId, scoreType: 'developer' });
  const liveProfileBefore = await Profile.findById(testProfile._id);
  const revBefore = liveProfileBefore.developerScoreMeta.evaluationRevision;

  // Negligible change (1 easy problem solved, score change < 1 pt)
  await Profile.updateOne({ _id: testProfile._id }, {
    $inc: { 'codingStats.rawMetrics.leetcode.easySolved': 1 }
  });

  const pathAProfile = await recalculateAndSaveScore(testProfile._id, 'Scheduled sync check', {
    milestoneEventId: `evt_minor_${Date.now()}`,
  });

  const countAfter = await ScoreHistory.countDocuments({ userId: testUserId, scoreType: 'developer' });
  assert.equal(countAfter, countBefore, 'Path A minor update must NOT create ScoreHistory records');

  // Profile revision incremented
  const liveProfileAfter = await Profile.findById(testProfile._id);
  assert.equal(liveProfileAfter.developerScoreMeta.evaluationRevision, revBefore + 1);
  assert.equal(liveProfileAfter.developerScoreMeta.snapshotSequence, liveProfileBefore.developerScoreMeta.snapshotSequence);
});

test('Sync Integration 5: Event-ID durability and reuse after simulated process crash/restart', async () => {
  const persistedRestartEventId = `evt_persisted_restart_${Date.now()}`;

  // 1. Durably write activeMilestoneEventId to Profile before calculation (simulating pre-processing persistence before crash)
  await Profile.updateOne({ _id: testProfile._id }, {
    $set: {
      'developerScoreMeta.activeMilestoneEventId': persistedRestartEventId,
    }
  });

  // Significant change to trigger milestone append (> 3 points)
  await Profile.updateOne({ _id: testProfile._id }, {
    $set: {
      'codingStats.rawMetrics.leetcode.hardSolved': 25,
      'codingStats.leetcodeProblemsSolved': 150,
    }
  });

  // 2. Caller invokes recalculateAndSaveScore with NO milestoneEventId in options (simulating retry / recovery after restart)
  const recoveredProfile = await recalculateAndSaveScore(testProfile._id, 'Recalculation after process restart', {});

  assert.ok(recoveredProfile);

  // 3. Verify ScoreHistory persisted using the pre-crash durably persisted event ID
  const persistedHistory = await ScoreHistory.findOne({
    userId: testUserId,
    scoreType: 'developer',
    milestoneEventId: persistedRestartEventId,
  });
  assert.ok(persistedHistory, 'Must persist ScoreHistory with the durably recovered activeMilestoneEventId');
  assert.equal(persistedHistory.milestoneEventId, persistedRestartEventId);

  // 4. Verify that once completed, activeMilestoneEventId was cleared on live Profile
  const liveProfileAfter = await Profile.findById(testProfile._id);
  assert.equal(liveProfileAfter.developerScoreMeta.activeMilestoneEventId, null, 'activeMilestoneEventId must be cleared on successful completion');

  // 5. Subsequent retry with the same event ID is idempotent and does not create duplicate history records
  const countBefore = await ScoreHistory.countDocuments({ userId: testUserId, scoreType: 'developer' });
  await recalculateAndSaveScore(testProfile._id, 'Idempotent retry after restart', {
    milestoneEventId: persistedRestartEventId,
  });
  const countAfter = await ScoreHistory.countDocuments({ userId: testUserId, scoreType: 'developer' });
  assert.equal(countAfter, countBefore, 'Retry must not insert duplicate record');

  testProfile = liveProfileAfter;
});

test('Sync Integration 6: Preservation of existing sync failure status, error tracking, and activeMilestoneEventId retention', async () => {
  const now = new Date();
  const failedEventId = `evt_sync_failure_${Date.now()}`;

  // Simulate pre-processing event ID persistence and sync status
  await Profile.updateOne({ _id: testProfile._id }, {
    $set: {
      'platformSyncStates.github.activeMilestoneEventId': failedEventId,
      'platformSyncStates.github.syncStatus': 'SYNCING',
    }
  });

  // Apply failure mutation matching the catch block of githubSyncService
  const testError = 'Provider rate limit exceeded: HTTP 429';
  const profileDoc = await Profile.findById(testProfile._id);
  const prevFailures = profileDoc.consecutiveSyncFailures || 0;

  profileDoc.lastSyncStatus = 'failed';
  profileDoc.lastSyncError = testError;
  profileDoc.consecutiveSyncFailures = prevFailures + 1;
  profileDoc.lastFailedSyncAt = now;
  profileDoc.codingStats.lastUpdated = now;

  profileDoc.platformSyncStates.github.syncStatus = 'ERROR';
  profileDoc.platformSyncStates.github.lastSyncAttempt = now;
  profileDoc.platformSyncStates.github.error = testError;
  profileDoc.platformSyncStates.github.consecutiveFailures = profileDoc.consecutiveSyncFailures;
  profileDoc.platformSyncStates.github.activeMilestoneEventId = failedEventId;

  await profileDoc.save();

  // Verify failure state persisted in MongoDB
  const savedProfile = await Profile.findById(testProfile._id);
  assert.equal(savedProfile.lastSyncStatus, 'failed');
  assert.equal(savedProfile.lastSyncError, testError);
  assert.equal(savedProfile.consecutiveSyncFailures, prevFailures + 1);
  assert.equal(savedProfile.platformSyncStates.github.syncStatus, 'ERROR');
  assert.equal(savedProfile.platformSyncStates.github.error, testError);
  assert.equal(
    savedProfile.platformSyncStates.github.activeMilestoneEventId,
    failedEventId,
    'activeMilestoneEventId must remain persisted across failures so retries reuse it'
  );

  testProfile = savedProfile;
});

test('Sync Integration 7: Preservation of existing sync success reset behavior and activeMilestoneEventId cleanup', async () => {
  const profileDoc = await Profile.findById(testProfile._id);
  assert.equal(profileDoc.consecutiveSyncFailures > 0, true, 'Precondition: failures > 0');

  const now = new Date();

  // Simulate successful sync metrics update and status reset matching githubSyncService success block
  profileDoc.codingStats.rawMetrics.github = {
    publicRepos: 15,
    followers: 12,
    stars: 50,
    forks: 10,
    topics: ['react', 'node', 'typescript'],
  };
  profileDoc.codingStats.githubRepos = 15;
  profileDoc.codingStats.githubFollowers = 12;
  profileDoc.codingStats.githubLastSyncedAt = now;
  profileDoc.codingStats.lastSyncedAt = now;

  profileDoc.lastSyncStatus = 'success';
  profileDoc.lastSyncError = null;
  profileDoc.consecutiveSyncFailures = 0;

  profileDoc.platformSyncStates.github = {
    syncStatus: 'SYNCED',
    activeMilestoneEventId: null,
    lastSyncAttempt: now,
    lastSuccessfulSync: now,
    lastVerifiedAt: now,
    sourceDataUpdatedAt: now,
    dataHash: 'test_hash_val_abc',
    error: null,
    consecutiveFailures: 0,
  };

  await profileDoc.save();

  // Verify success state persisted in MongoDB
  const savedProfile = await Profile.findById(testProfile._id);
  assert.equal(savedProfile.lastSyncStatus, 'success');
  assert.equal(savedProfile.lastSyncError, null);
  assert.equal(savedProfile.consecutiveSyncFailures, 0);
  assert.equal(savedProfile.platformSyncStates.github.syncStatus, 'SYNCED');
  assert.equal(savedProfile.platformSyncStates.github.consecutiveFailures, 0);
  assert.equal(savedProfile.platformSyncStates.github.activeMilestoneEventId, null);

  testProfile = savedProfile;
});
