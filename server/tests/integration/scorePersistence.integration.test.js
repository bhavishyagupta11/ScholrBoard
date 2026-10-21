/**
 * Integration Test Suite for scorePersistence.js against Real MongoDB Replica Set
 *
 * Dedicated Test Database Enforcement:
 *   - Strictly requires MONGODB_URI_TEST pointing to an isolated test database.
 *   - Never silently falls back to MONGODB_URI.
 *
 * Exercises:
 *   1. Real multi-document ACID transactions (session.withTransaction).
 *   2. Real idempotency retry recovery.
 *   3. Real idempotency conflict rejection on mismatched eligibility.
 *   4. Real Path A optimistic revision CAS update.
 *   5. Real Path A stale calculation preemption.
 *   6. Real append-only mutation protection across all Mongoose paths.
 *   7. Real concurrent milestone racing with sequence collision retry recovery.
 *   8. Real failure-injection atomicity test (zero partial transaction leakage).
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Profile from '../../models/Profile.js';
import ScoreHistory from '../../models/ScoreHistory.js';
import {
  persistScoreCalculation,
  persistScoreCalculationWithRetry,
  IdempotencyConflictError,
  MissingRequiredMilestoneEventIdError,
  computeHistoricalSnapshotHash,
} from '../../services/scorePersistence.js';

import {
  validateIntegrationTestDatabaseUri,
  sanitizeMongoUri,
} from '../helpers/testDatabaseGuard.js';

dotenv.config();
// Explicitly ensure test environment mode for integration test execution
process.env.NODE_ENV = 'test';

// 1. Strict Fail-Fast Dedicated Test Database Guard
// Validates presence, non-empty status, test database naming, and never falls back to MONGODB_URI
const testUri = process.env.MONGODB_URI_TEST;
const targetDbName = validateIntegrationTestDatabaseUri(testUri);

let isReplicaSet = false;
let testUserId = null;
let testProfile = null;

before(async () => {
  await mongoose.connect(testUri, { serverSelectionTimeoutMS: 15000 });
  const topology = mongoose.connection.client?.topology?.description;
  isReplicaSet = topology?.type === 'ReplicaSetWithPrimary' || !!topology?.setName;

  assert.equal(
    isReplicaSet,
    true,
    'MongoDB integration tests require a real Replica Set to verify multi-document ACID transactions.'
  );

  testUserId = new mongoose.Types.ObjectId();
  testProfile = await Profile.create({
    userId: testUserId,
    bio: 'Isolated Integration Test Profile',
    developerScore: 0,
    placementReadinessScore: 0,
    placementReadinessMeta: {
      score: null,
      coverage: null,
      confidence: null,
      freshness: null,
      evaluationRevision: 0,
      snapshotSequence: 0,
    },
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
    // Raw native collection cleanup (bypasses Mongoose append-only pre hooks)
    await ScoreHistory.collection.deleteMany({ userId: testUserId });
    await Profile.collection.deleteMany({ userId: testUserId });
  }
  await mongoose.disconnect();
});

test('Integration 1: Real multi-document ACID transaction milestone persistence (Path B)', async () => {
  const milestoneEventId = `evt_integ_${Date.now()}_1`;
  const calculationResult = {
    score: 85.0,
    coverage: 88.0,
    confidence: 'High',
    freshness: 'Fresh',
    evidenceCount: 12,
    dimensions: new Map([['dsa', { score: 90 }]]),
    configSnapshotHash: 'cfg_hash_test_1',
    placementMethodologyVersion: 'v2.0.0',
    evidenceFingerprint: 'ev_fp_integ_1',
    eligibilitySnapshot: {
      status: 'ELIGIBLE',
      isEligible: true,
      reasons: ['Met GPA threshold', 'No active backlogs'],
      conditions: [
        { ruleId: 'cgpa_min', ruleSetId: 'CAMPUS_2026', met: true },
        { ruleId: 'no_backlogs', ruleSetId: 'CAMPUS_2026', met: true },
      ],
      ruleSetId: 'CAMPUS_2026',
      ruleSetVersion: 'v1.0.0',
    },
  };

  const record = await persistScoreCalculation({
    profile: testProfile,
    scoreType: 'placement_readiness',
    result: calculationResult,
    evaluationHash: 'eval_hash_day_1',
    triggerReason: 'INITIAL_EVALUATION',
    oldEvidenceHash: null,
    newEvidenceHash: 'prov_hash_1',
    syncStatus: 'SUCCESS',
    connectionStatus: 'LINKED',
    milestoneEventId,
  });

  assert.ok(record, 'Milestone record must be returned');
  assert.equal(record.snapshotSequence, 1);
  assert.equal(record.priorSnapshotHash, 'GENESIS');
  assert.equal(record.milestoneEventId, milestoneEventId);
  assert.equal(record.eligibilitySnapshot.status, 'ELIGIBLE');
  assert.equal(record.eligibilitySnapshot.isEligible, true);

  // Verify real document persisted in ScoreHistory collection
  const persistedInDb = await ScoreHistory.findOne({
    userId: testUserId,
    milestoneEventId,
  });
  assert.ok(persistedInDb, 'Record must exist in MongoDB ScoreHistory collection');
  assert.equal(persistedInDb.score, 85.0);

  // Verify Profile was atomically updated in the same transaction
  const updatedProfile = await Profile.findById(testProfile._id);
  assert.equal(updatedProfile.placementReadinessMeta.score, 85.0);
  assert.equal(updatedProfile.placementReadinessMeta.snapshotSequence, 1);
  assert.equal(updatedProfile.placementReadinessMeta.lastSnapshotHash, record.snapshotHash);
  assert.equal(updatedProfile.placementReadinessMeta.evaluationRevision, 1);
  assert.equal(updatedProfile.placementReadinessMeta.eligibilityStatus.status, 'ELIGIBLE');

  testProfile = updatedProfile;
});

test('Integration 2: Real Idempotency Retry with identical payload returns existing record without duplicate insert', async () => {
  const existingRecord = await ScoreHistory.findOne({ userId: testUserId });
  assert.ok(existingRecord, 'Pre-existing record must exist');

  const identicalResult = {
    score: 85.0,
    coverage: 88.0,
    confidence: 'High',
    freshness: 'Fresh',
    evidenceCount: 12,
    dimensions: new Map([['dsa', { score: 90 }]]),
    configSnapshotHash: 'cfg_hash_test_1',
    placementMethodologyVersion: 'v2.0.0',
    evidenceFingerprint: 'ev_fp_integ_1',
    eligibilitySnapshot: {
      status: 'ELIGIBLE',
      isEligible: true,
      reasons: ['No active backlogs', 'Met GPA threshold'], // Permuted order
      conditions: [
        { ruleId: 'no_backlogs', ruleSetId: 'CAMPUS_2026', met: true },
        { ruleId: 'cgpa_min', ruleSetId: 'CAMPUS_2026', met: true },
      ],
      ruleSetId: 'CAMPUS_2026',
      ruleSetVersion: 'v1.0.0',
    },
  };

  const retryRecord = await persistScoreCalculation({
    profile: testProfile,
    scoreType: 'placement_readiness',
    result: identicalResult,
    evaluationHash: 'eval_hash_day_1',
    triggerReason: 'INITIAL_EVALUATION',
    oldEvidenceHash: 'prov_hash_1',
    newEvidenceHash: 'prov_hash_1',
    syncStatus: 'SUCCESS',
    connectionStatus: 'LINKED',
    milestoneEventId: existingRecord.milestoneEventId,
  });

  assert.equal(retryRecord._id.toString(), existingRecord._id.toString());
  const count = await ScoreHistory.countDocuments({ userId: testUserId });
  assert.equal(count, 1, 'Idempotent retry must NOT insert duplicate ScoreHistory records');
});

test('Integration 3: Real Idempotency Conflict Rejection with conflicting eligibility raises IdempotencyConflictError', async () => {
  const existingRecord = await ScoreHistory.findOne({ userId: testUserId });
  assert.ok(existingRecord, 'Pre-existing record must exist');

  const conflictingResult = {
    score: 85.0,
    coverage: 88.0,
    confidence: 'High',
    freshness: 'Fresh',
    evidenceCount: 12,
    dimensions: new Map([['dsa', { score: 90 }]]),
    configSnapshotHash: 'cfg_hash_test_1',
    placementMethodologyVersion: 'v2.0.0',
    evidenceFingerprint: 'ev_fp_integ_1',
    eligibilitySnapshot: {
      status: 'INELIGIBLE', // Conflict!
      isEligible: false,
      reasons: ['Active backlog reported'],
      conditions: [
        { ruleId: 'cgpa_min', ruleSetId: 'CAMPUS_2026', met: true },
        { ruleId: 'no_backlogs', ruleSetId: 'CAMPUS_2026', met: false },
      ],
      ruleSetId: 'CAMPUS_2026',
      ruleSetVersion: 'v1.0.0',
    },
  };

  await assert.rejects(async () => {
    await persistScoreCalculation({
      profile: testProfile,
      scoreType: 'placement_readiness',
      result: conflictingResult,
      evaluationHash: 'eval_hash_day_1',
      triggerReason: 'INITIAL_EVALUATION',
      oldEvidenceHash: 'prov_hash_1',
      newEvidenceHash: 'prov_hash_1',
      syncStatus: 'SUCCESS',
      connectionStatus: 'LINKED',
      milestoneEventId: existingRecord.milestoneEventId,
    });
  }, {
    name: 'IdempotencyConflictError',
    statusCode: 409,
  });

  const count = await ScoreHistory.countDocuments({ userId: testUserId });
  assert.equal(count, 1, 'Conflicting transaction must abort without adding records');
});

test('Integration 4: Real Path A non-milestone update with evaluationRevision CAS', async () => {
  const countBefore = await ScoreHistory.countDocuments({ userId: testUserId });
  const liveProfileBefore = await Profile.findById(testProfile._id);
  const baseRev = liveProfileBefore.placementReadinessMeta.evaluationRevision;

  const nonMilestoneResult = {
    score: 85.1,
    coverage: 88.0,
    confidence: 'High',
    freshness: 'Fresh',
    evidenceCount: 12,
    dimensions: new Map([['dsa', { score: 90.1 }]]),
    configSnapshotHash: 'cfg_hash_test_1',
    placementMethodologyVersion: 'v2.0.0',
    evidenceFingerprint: 'ev_fp_integ_1',
    eligibilitySnapshot: {
      status: 'ELIGIBLE',
      isEligible: true,
      reasons: ['Met GPA threshold', 'No active backlogs'],
      conditions: [
        { ruleId: 'cgpa_min', ruleSetId: 'CAMPUS_2026', met: true },
        { ruleId: 'no_backlogs', ruleSetId: 'CAMPUS_2026', met: true },
      ],
      ruleSetId: 'CAMPUS_2026',
      ruleSetVersion: 'v1.0.0',
    },
  };

  await persistScoreCalculation({
    profile: liveProfileBefore,
    scoreType: 'placement_readiness',
    result: nonMilestoneResult,
    evaluationHash: 'eval_hash_day_1_part2',
    triggerReason: 'DAILY_RECALCULATION',
    oldEvidenceHash: 'prov_hash_1',
    newEvidenceHash: 'prov_hash_1',
    syncStatus: 'SUCCESS',
    connectionStatus: 'LINKED',
    baseEvaluationRevision: baseRev,
  });

  const countAfter = await ScoreHistory.countDocuments({ userId: testUserId });
  assert.equal(countAfter, countBefore, 'Path A must NOT insert into ScoreHistory');

  const liveProfileAfter = await Profile.findById(testProfile._id);
  assert.equal(liveProfileAfter.placementReadinessMeta.score, 85.1);
  assert.equal(liveProfileAfter.placementReadinessMeta.evaluationRevision, baseRev + 1);

  testProfile = liveProfileAfter;
});

test('Integration 5: Real Path A stale calculation preemption', async () => {
  const liveProfile = await Profile.findById(testProfile._id);
  const currentRev = liveProfile.placementReadinessMeta.evaluationRevision;
  const staleBaseRev = currentRev - 1;

  const staleResult = {
    score: 85.2,
    coverage: 88.0,
    confidence: 'High',
    freshness: 'Fresh',
    dimensions: new Map([['dsa', { score: 90.2 }]]),
    configSnapshotHash: 'cfg_hash_test_1',
    placementMethodologyVersion: 'v2.0.0',
    eligibilitySnapshot: liveProfile.placementReadinessMeta.eligibilityStatus,
  };

  const result = await persistScoreCalculation({
    profile: liveProfile,
    scoreType: 'placement_readiness',
    result: staleResult,
    evaluationHash: 'eval_hash_day_1_stale',
    triggerReason: 'DAILY_RECALCULATION',
    oldEvidenceHash: 'prov_hash_1',
    newEvidenceHash: 'prov_hash_1',
    syncStatus: 'SUCCESS',
    connectionStatus: 'LINKED',
    baseEvaluationRevision: staleBaseRev,
  });

  assert.equal(result.success, false);
  assert.equal(result.preempted, true);
  assert.equal(result.reason, 'CONCURRENCY_PREEMPTED');

  const profileUnchanged = await Profile.findById(testProfile._id);
  assert.equal(profileUnchanged.placementReadinessMeta.score, 85.1);
  assert.equal(profileUnchanged.placementReadinessMeta.evaluationRevision, currentRev);
});

test('Integration 6: Real Append-Only Immutability Hook enforcement across all Mongoose mutation paths', async () => {
  // Query existing document
  const doc = await ScoreHistory.findOne({ userId: testUserId });
  assert.ok(doc, 'Test document must exist');

  // Path 1: Document instance save() when !isNew
  doc.score = 99.9;
  await assert.rejects(async () => {
    await doc.save();
  }, {
    message: 'ScoreHistory is strictly append-only: document mutations via save() are prohibited by architecture.',
  });

  // Path 2: Document instance updateOne()
  await assert.rejects(async () => {
    await doc.updateOne({ $set: { score: 99.9 } });
  }, {
    message: 'ScoreHistory is strictly append-only: update operations are prohibited by architecture.',
  });

  // Path 3: Document instance deleteOne()
  await assert.rejects(async () => {
    await doc.deleteOne();
  }, {
    message: 'ScoreHistory is strictly append-only: delete operations are prohibited by architecture.',
  });

  // Path 4: Model query updateOne()
  await assert.rejects(async () => {
    await ScoreHistory.updateOne({ userId: testUserId }, { $set: { score: 99.9 } });
  }, {
    message: 'ScoreHistory is strictly append-only: update operations are prohibited by architecture.',
  });

  // Path 5: Model query updateMany()
  await assert.rejects(async () => {
    await ScoreHistory.updateMany({ userId: testUserId }, { $set: { score: 99.9 } });
  }, {
    message: 'ScoreHistory is strictly append-only: update operations are prohibited by architecture.',
  });

  // Path 6: Model query deleteOne()
  await assert.rejects(async () => {
    await ScoreHistory.deleteOne({ userId: testUserId });
  }, {
    message: 'ScoreHistory is strictly append-only: delete operations are prohibited by architecture.',
  });

  // Path 7: Model query deleteMany()
  await assert.rejects(async () => {
    await ScoreHistory.deleteMany({ userId: testUserId });
  }, {
    message: 'ScoreHistory is strictly append-only: delete operations are prohibited by architecture.',
  });
});

test('Integration 7: Real concurrent milestone racing for same profile and score type', async () => {
  const currentProfile = await Profile.findById(testProfile._id);
  const baseSequence = currentProfile.placementReadinessMeta.snapshotSequence || 1;

  const eventIdRaceA = `evt_race_${Date.now()}_A`;
  const eventIdRaceB = `evt_race_${Date.now()}_B`;

  const resultA = {
    score: 89.0, // Progression milestone (+3.9 pts)
    coverage: 90.0,
    confidence: 'High',
    freshness: 'Fresh',
    evidenceCount: 15,
    dimensions: new Map([['dsa', { score: 92 }]]),
    configSnapshotHash: 'cfg_hash_test_1',
    placementMethodologyVersion: 'v2.0.0',
    evidenceFingerprint: 'ev_fp_race_A',
    eligibilitySnapshot: currentProfile.placementReadinessMeta.eligibilityStatus,
  };

  const resultB = {
    score: 93.0, // Progression milestone (+7.9 pts)
    coverage: 92.0,
    confidence: 'High',
    freshness: 'Fresh',
    evidenceCount: 18,
    dimensions: new Map([['dsa', { score: 95 }]]),
    configSnapshotHash: 'cfg_hash_test_1',
    placementMethodologyVersion: 'v2.0.0',
    evidenceFingerprint: 'ev_fp_race_B',
    eligibilitySnapshot: currentProfile.placementReadinessMeta.eligibilityStatus,
  };

  // Launch both milestone calculations concurrently
  const [recordA, recordB] = await Promise.all([
    persistScoreCalculationWithRetry({
      profile: currentProfile,
      scoreType: 'placement_readiness',
      result: resultA,
      evaluationHash: 'eval_hash_race_A',
      triggerReason: 'PROGRESSION_MILESTONE',
      oldEvidenceHash: 'prov_hash_1',
      newEvidenceHash: 'prov_hash_2',
      syncStatus: 'SUCCESS',
      connectionStatus: 'LINKED',
      milestoneEventId: eventIdRaceA,
      maxRetries: 3,
    }),
    persistScoreCalculationWithRetry({
      profile: currentProfile,
      scoreType: 'placement_readiness',
      result: resultB,
      evaluationHash: 'eval_hash_race_B',
      triggerReason: 'PROGRESSION_MILESTONE',
      oldEvidenceHash: 'prov_hash_1',
      newEvidenceHash: 'prov_hash_3',
      syncStatus: 'SUCCESS',
      connectionStatus: 'LINKED',
      milestoneEventId: eventIdRaceB,
      maxRetries: 3,
    }),
  ]);

  assert.ok(recordA, 'Record A must be persisted');
  assert.ok(recordB, 'Record B must be persisted');

  // Verify unique snapshot sequences
  assert.notEqual(recordA.snapshotSequence, recordB.snapshotSequence, 'Concurrent racing milestones must receive unique snapshotSequence values');

  // Identify first and second in chronological sequence order
  const [firstRecord, secondRecord] = recordA.snapshotSequence < recordB.snapshotSequence
    ? [recordA, recordB]
    : [recordB, recordA];

  assert.equal(firstRecord.snapshotSequence, baseSequence + 1);
  assert.equal(secondRecord.snapshotSequence, baseSequence + 2);

  // Verify predecessor hash linkage: secondRecord must reference firstRecord's snapshotHash
  assert.equal(
    secondRecord.priorSnapshotHash,
    firstRecord.snapshotHash,
    'Second milestone record must link its priorSnapshotHash directly to the first milestone record snapshotHash'
  );

  // Verify Profile live pointer matches the higher sequence
  const liveProfile = await Profile.findById(testProfile._id);
  assert.equal(
    liveProfile.placementReadinessMeta.snapshotSequence,
    secondRecord.snapshotSequence,
    'Live profile snapshotSequence pointer must point to the newest sequence'
  );
  assert.equal(
    liveProfile.placementReadinessMeta.lastSnapshotHash,
    secondRecord.snapshotHash,
    'Live profile lastSnapshotHash pointer must point to newest milestone hash'
  );
  assert.equal(
    liveProfile.placementReadinessMeta.score,
    secondRecord.score,
    'Live profile score must match newest milestone score'
  );

  testProfile = liveProfile;
});

test('Integration 8: Real failure-injection test proves failure between history insertion and Profile update leaves no partial transaction state', async () => {
  const countBefore = await ScoreHistory.countDocuments({ userId: testUserId });
  const profileBefore = await Profile.findById(testProfile._id);
  const failedEventId = `evt_fail_inject_${Date.now()}`;

  const failedResult = {
    score: 98.0,
    coverage: 95.0,
    confidence: 'High',
    freshness: 'Fresh',
    evidenceCount: 20,
    dimensions: new Map([['dsa', { score: 99 }]]),
    configSnapshotHash: 'cfg_hash_test_1',
    placementMethodologyVersion: 'v2.0.0',
    evidenceFingerprint: 'ev_fp_fail_inject',
    eligibilitySnapshot: profileBefore.placementReadinessMeta.eligibilityStatus,
  };

  // Attempt persistence with injected failure right after ScoreHistory.create
  await assert.rejects(async () => {
    await persistScoreCalculation({
      profile: profileBefore,
      scoreType: 'placement_readiness',
      result: failedResult,
      evaluationHash: 'eval_hash_fail_inject',
      triggerReason: 'PROGRESSION_MILESTONE',
      oldEvidenceHash: 'prov_hash_2',
      newEvidenceHash: 'prov_hash_4',
      syncStatus: 'SUCCESS',
      connectionStatus: 'LINKED',
      milestoneEventId: failedEventId,
      options: { _injectFailureBeforeProfileUpdate: true }, // Injected failure trigger!
    });
  }, {
    message: 'INJECTED_FAILURE_AFTER_HISTORY_CREATE',
  });

  // Verify ZERO partial state leakage in ScoreHistory
  const leakedRecord = await ScoreHistory.findOne({ milestoneEventId: failedEventId });
  assert.equal(leakedRecord, null, 'Inserted ScoreHistory record must be rolled back by MongoDB transaction; no partial state allowed!');

  const countAfter = await ScoreHistory.countDocuments({ userId: testUserId });
  assert.equal(countAfter, countBefore, 'ScoreHistory document count must not increase after aborted transaction');

  // Verify Profile was not mutated
  const profileAfter = await Profile.findById(testProfile._id);
  assert.equal(
    profileAfter.placementReadinessMeta.snapshotSequence,
    profileBefore.placementReadinessMeta.snapshotSequence,
    'Profile snapshotSequence must remain unchanged'
  );
  assert.equal(
    profileAfter.placementReadinessMeta.lastSnapshotHash,
    profileBefore.placementReadinessMeta.lastSnapshotHash,
    'Profile lastSnapshotHash must remain unchanged'
  );
  assert.equal(
    profileAfter.placementReadinessMeta.score,
    profileBefore.placementReadinessMeta.score,
    'Profile score must remain unchanged'
  );
});
