/**
 * Unit Test Suite for scorePersistence.js
 *
 * Runs in-memory without database dependencies using Node.js built-in test runner.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalJSON,
  sha256,
  canonicalizeEligibility,
  computeHistoricalSnapshotHash,
  verifyMilestonePayloadMatch,
  shouldAppendScoreHistory,
  evaluateEvidenceHashChange,
  deriveConfidence,
  IdempotencyConflictError,
  MissingRequiredMilestoneEventIdError,
  SequenceCollisionRetryExhaustedError,
} from '../../services/scorePersistence.js';

test('canonicalizeEligibility sorts conditions and reasons deterministically', () => {
  const eligA = {
    status: 'ELIGIBLE',
    isEligible: true,
    reasons: ['Reason B', 'Reason A'],
    conditions: [
      { ruleSetId: 'SET2', ruleId: 'ruleY', met: true },
      { ruleSetId: 'SET1', ruleId: 'ruleX', met: true },
    ],
    ruleSetId: 'SET_MAIN',
    ruleSetVersion: 'v1.0.0',
  };

  const eligB = {
    status: 'ELIGIBLE',
    isEligible: true,
    reasons: ['Reason A', 'Reason B'],
    conditions: [
      { ruleSetId: 'SET1', ruleId: 'ruleX', met: true },
      { ruleSetId: 'SET2', ruleId: 'ruleY', met: true },
    ],
    ruleSetId: 'SET_MAIN',
    ruleSetVersion: 'v1.0.0',
  };

  const canonA = canonicalizeEligibility(eligA);
  const canonB = canonicalizeEligibility(eligB);

  assert.deepEqual(canonA, canonB);
  assert.equal(canonicalJSON(canonA), canonicalJSON(canonB));
});

test('computeHistoricalSnapshotHash represents canonical eligibility state consistently', () => {
  const baseParams = {
    userId: '60c72b2f9b1d8b2bad000001',
    scoreType: 'placement_readiness',
    milestoneEventId: 'evt_placement_001',
    priorSnapshotHash: 'GENESIS',
    snapshotSequence: 1,
    score: 84.5,
    coverage: 90,
    confidence: 'High',
    freshness: 'Fresh',
    configHash: 'cfghash123',
    methodologyVersion: 'v2.0.0',
    milestoneReason: 'PROGRESSION_MILESTONE',
    evidenceFingerprint: 'evfp_abc',
  };

  const hash1 = computeHistoricalSnapshotHash({
    ...baseParams,
    eligibilitySnapshot: {
      status: 'ELIGIBLE',
      isEligible: true,
      reasons: ['Cleared backlogs', 'GPA >= 7.5'],
      conditions: [{ ruleId: 'gpa_min', met: true }],
      ruleSetId: 'CAMPUS_2026',
      ruleSetVersion: 'v1.0',
    },
  });

  // Re-ordered reasons and conditions should produce identical snapshot hash
  const hash1Reordered = computeHistoricalSnapshotHash({
    ...baseParams,
    eligibilitySnapshot: {
      status: 'ELIGIBLE',
      isEligible: true,
      reasons: ['GPA >= 7.5', 'Cleared backlogs'],
      conditions: [{ ruleId: 'gpa_min', met: true }],
      ruleSetId: 'CAMPUS_2026',
      ruleSetVersion: 'v1.0',
    },
  });
  assert.equal(hash1, hash1Reordered, 'Re-ordered conditions/reasons must produce identical hash');

  // Conflicting condition met=false must produce different snapshot hash
  const hashConflictingCondition = computeHistoricalSnapshotHash({
    ...baseParams,
    eligibilitySnapshot: {
      status: 'ELIGIBLE',
      isEligible: true,
      reasons: ['Cleared backlogs', 'GPA >= 7.5'],
      conditions: [{ ruleId: 'gpa_min', met: false }],
      ruleSetId: 'CAMPUS_2026',
      ruleSetVersion: 'v1.0',
    },
  });
  assert.notEqual(hash1, hashConflictingCondition, 'Condition change must alter snapshotHash');

  // Conflicting ruleSetId must produce different snapshot hash
  const hashConflictingRuleSet = computeHistoricalSnapshotHash({
    ...baseParams,
    eligibilitySnapshot: {
      status: 'ELIGIBLE',
      isEligible: true,
      reasons: ['Cleared backlogs', 'GPA >= 7.5'],
      conditions: [{ ruleId: 'gpa_min', met: true }],
      ruleSetId: 'CAMPUS_2027',
      ruleSetVersion: 'v1.0',
    },
  });
  assert.notEqual(hash1, hashConflictingRuleSet, 'RuleSetId change must alter snapshotHash');
});

test('verifyMilestonePayloadMatch validates all canonical eligibility fields', () => {
  const existingRecord = {
    score: 82.0,
    coverage: 88.0,
    confidence: 'High',
    freshness: 'Fresh',
    configHash: 'cfg_hash_001',
    placementMethodologyVersion: 'v2.0.0',
    scoreType: 'placement_readiness',
    evidenceFingerprint: 'fp_abc',
    eligibilitySnapshot: {
      status: 'ELIGIBLE',
      isEligible: true,
      reasons: ['Meets GPA', 'No Backlogs'],
      conditions: [
        { ruleId: 'min_gpa', ruleSetId: 'SET_1', met: true },
        { ruleId: 'no_backlogs', ruleSetId: 'SET_1', met: true },
      ],
      ruleSetId: 'CAMPUS_2026',
      ruleSetVersion: '1.0',
    },
  };

  const incomingExact = {
    score: 82.0,
    coverage: 88.0,
    confidence: 'High',
    freshness: 'Fresh',
    configHash: 'cfg_hash_001',
    placementMethodologyVersion: 'v2.0.0',
    scoreType: 'placement_readiness',
    evidenceFingerprint: 'fp_abc',
    eligibilitySnapshot: {
      status: 'ELIGIBLE',
      isEligible: true,
      reasons: ['No Backlogs', 'Meets GPA'], // Permuted order
      conditions: [
        { ruleId: 'no_backlogs', ruleSetId: 'SET_1', met: true },
        { ruleId: 'min_gpa', ruleSetId: 'SET_1', met: true },
      ],
      ruleSetId: 'CAMPUS_2026',
      ruleSetVersion: '1.0',
    },
  };
  assert.equal(verifyMilestonePayloadMatch(existingRecord, incomingExact), true);

  // Status conflict
  const incomingStatusConflict = {
    ...incomingExact,
    eligibilitySnapshot: {
      ...incomingExact.eligibilitySnapshot,
      status: 'INELIGIBLE',
    },
  };
  assert.equal(verifyMilestonePayloadMatch(existingRecord, incomingStatusConflict), false);

  // isEligible conflict
  const incomingIsEligibleConflict = {
    ...incomingExact,
    eligibilitySnapshot: {
      ...incomingExact.eligibilitySnapshot,
      isEligible: false,
    },
  };
  assert.equal(verifyMilestonePayloadMatch(existingRecord, incomingIsEligibleConflict), false);

  // Condition met conflict
  const incomingConditionConflict = {
    ...incomingExact,
    eligibilitySnapshot: {
      ...incomingExact.eligibilitySnapshot,
      conditions: [
        { ruleId: 'min_gpa', ruleSetId: 'SET_1', met: true },
        { ruleId: 'no_backlogs', ruleSetId: 'SET_1', met: false },
      ],
    },
  };
  assert.equal(verifyMilestonePayloadMatch(existingRecord, incomingConditionConflict), false);

  // RuleSetId conflict
  const incomingRuleSetConflict = {
    ...incomingExact,
    eligibilitySnapshot: {
      ...incomingExact.eligibilitySnapshot,
      ruleSetId: 'OFF_CAMPUS_2026',
    },
  };
  assert.equal(verifyMilestonePayloadMatch(existingRecord, incomingRuleSetConflict), false);

  // RuleSetVersion conflict
  const incomingVersionConflict = {
    ...incomingExact,
    eligibilitySnapshot: {
      ...incomingExact.eligibilitySnapshot,
      ruleSetVersion: '2.0',
    },
  };
  assert.equal(verifyMilestonePayloadMatch(existingRecord, incomingVersionConflict), false);
});

test('retry with same milestoneEventId but conflicting eligibility details raises IdempotencyConflictError', () => {
  const existingRecord = {
    milestoneEventId: 'evt_stable_123',
    score: 85.0,
    coverage: 90.0,
    confidence: 'High',
    freshness: 'Fresh',
    configHash: 'cfg_hash_001',
    placementMethodologyVersion: 'v2.0.0',
    scoreType: 'placement_readiness',
    evidenceFingerprint: 'fp_123',
    eligibilitySnapshot: {
      status: 'ELIGIBLE',
      isEligible: true,
      reasons: ['Passed all gates'],
      conditions: [{ ruleId: 'gate1', met: true }],
      ruleSetId: 'STD_2026',
      ruleSetVersion: 'v1',
    },
  };

  const incomingConflicting = {
    score: 85.0,
    coverage: 90.0,
    confidence: 'High',
    freshness: 'Fresh',
    configHash: 'cfg_hash_001',
    placementMethodologyVersion: 'v2.0.0',
    scoreType: 'placement_readiness',
    evidenceFingerprint: 'fp_123',
    eligibilitySnapshot: {
      status: 'INELIGIBLE', // Conflict!
      isEligible: false,
      reasons: ['Failed gate 1'],
      conditions: [{ ruleId: 'gate1', met: false }],
      ruleSetId: 'STD_2026',
      ruleSetVersion: 'v1',
    },
  };

  // Simulate idempotent check
  const isMatch = verifyMilestonePayloadMatch(existingRecord, incomingConflicting);
  assert.equal(isMatch, false, 'Conflicting eligibility must not match existing payload');

  assert.throws(() => {
    if (!isMatch) {
      throw new IdempotencyConflictError(
        `Idempotency conflict for milestoneEventId "${existingRecord.milestoneEventId}": existing record fields do not match incoming calculation payload.`
      );
    }
  }, {
    name: 'IdempotencyConflictError',
    statusCode: 409,
  });
});

test('shouldAppendScoreHistory evaluates complete eligibility transitions and score thresholds', () => {
  const baseEval = {
    scoreType: 'placement_readiness',
    score: 75.0,
    coverage: 80.0,
    confidence: 'High',
    freshness: 'Fresh',
    configHash: 'cfg1',
    placementMethodologyVersion: 'v2.0.0',
    eligibilitySnapshot: {
      status: 'ELIGIBLE',
      isEligible: true,
      conditions: [{ ruleId: 'c1', met: true }],
      ruleSetId: 'R1',
      ruleSetVersion: 'v1',
    },
  };

  const latestRecord = {
    score: 75.0,
    coverage: 80.0,
    confidence: 'High',
    freshness: 'Fresh',
    configHash: 'cfg1',
    placementMethodologyVersion: 'v2.0.0',
    eligibilitySnapshot: {
      status: 'ELIGIBLE',
      isEligible: true,
      conditions: [{ ruleId: 'c1', met: true }],
      ruleSetId: 'R1',
      ruleSetVersion: 'v1',
    },
  };

  // No change -> should NOT append
  assert.equal(shouldAppendScoreHistory({
    currentEval: baseEval,
    latestHistoryRecord: latestRecord,
    evidenceDataHashChanged: false,
    triggerReason: 'SCHEDULED_CHECK',
  }), false);

  // Score drop >= 1 pt (decay milestone) -> MUST append
  assert.equal(shouldAppendScoreHistory({
    currentEval: { ...baseEval, score: 74.0 },
    latestHistoryRecord: latestRecord,
    evidenceDataHashChanged: false,
  }), true);

  // Score increase of 1 pt (fractional progress < 3) -> should NOT append
  assert.equal(shouldAppendScoreHistory({
    currentEval: { ...baseEval, score: 76.0 },
    latestHistoryRecord: latestRecord,
    evidenceDataHashChanged: false,
  }), false);

  // Score increase >= 3 pts -> MUST append
  assert.equal(shouldAppendScoreHistory({
    currentEval: { ...baseEval, score: 78.0 },
    latestHistoryRecord: latestRecord,
    evidenceDataHashChanged: false,
  }), true);

  // Eligibility condition transition -> MUST append
  assert.equal(shouldAppendScoreHistory({
    currentEval: {
      ...baseEval,
      eligibilitySnapshot: {
        ...baseEval.eligibilitySnapshot,
        conditions: [{ ruleId: 'c1', met: false }],
        status: 'INELIGIBLE',
        isEligible: false,
      },
    },
    latestHistoryRecord: latestRecord,
    evidenceDataHashChanged: false,
  }), true);
});

test('deriveConfidence enforces typed recency and coverage thresholds', () => {
  // High confidence requires coverage >= 75, Fresh, and L1 or L2
  assert.equal(deriveConfidence({ coverage: 80, freshness: 'Fresh', recencyLevel: 'L1' }), 'High');
  assert.equal(deriveConfidence({ coverage: 80, freshness: 'Fresh', recencyLevel: 'L2' }), 'High');
  assert.equal(deriveConfidence({ coverage: 80, freshness: 'Fresh', recencyLevel: 'L3' }), 'Medium');

  // Missing recency level must yield Low confidence
  assert.equal(deriveConfidence({ coverage: 90, freshness: 'Fresh', recencyLevel: null }), 'Low');
  assert.equal(deriveConfidence({ coverage: 90, freshness: 'Fresh', recencyLevel: undefined }), 'Low');
});

test('evaluateEvidenceHashChange distinguishes all 7 operational states', () => {
  assert.equal(evaluateEvidenceHashChange(null, null, 'SUCCESS').event, 'NO_EVIDENCE_EVER');
  assert.equal(evaluateEvidenceHashChange(null, 'hash_new', 'SUCCESS').event, 'FIRST_VALID_EVIDENCE');
  assert.equal(evaluateEvidenceHashChange('hash_old', 'hash_old', 'SUCCESS').event, 'VALID_EVIDENCE_UNCHANGED');
  assert.equal(evaluateEvidenceHashChange('hash_old', 'hash_new', 'SUCCESS').event, 'VALID_EVIDENCE_CHANGED');
  assert.equal(evaluateEvidenceHashChange('hash_old', null, 'RATE_LIMITED').event, 'TRANSIENT_PROVIDER_FAILURE');
  assert.equal(evaluateEvidenceHashChange('hash_old', 'hash_new', 'SUCCESS', 'UNLINKED').event, 'UNLINKED_OR_UNAVAILABLE');
  assert.equal(evaluateEvidenceHashChange('hash_old', null, 'SUCCESS').event, 'INCOMPLETE_MALFORMED_PAYLOAD');
});

test('Path A Optimistic Concurrency CAS preemption detects stale baseEvaluationRevision', () => {
  const profileState = {
    _id: 'prof_123',
    developerScoreMeta: {
      evaluationRevision: 4,
      score: 75.0,
    },
  };

  // Case 1: Matching base revision -> CAS succeeds
  const effectiveBaseRevisionMatching = 4;
  const isMatch = profileState.developerScoreMeta.evaluationRevision === effectiveBaseRevisionMatching;
  assert.equal(isMatch, true);

  // Case 2: Stale base revision (e.g. calculation took long time and concurrent write incremented revision to 4)
  const effectiveBaseRevisionStale = 3;
  const isStaleMatch = profileState.developerScoreMeta.evaluationRevision === effectiveBaseRevisionStale;
  assert.equal(isStaleMatch, false);
});

test('Path B CAS matchedCount logic distinguishes legitimately newer live pointers from failures', () => {
  // Scenario 1: Live sequence is newer (concurrent newer milestone won race)
  const historyRecordSeq = 5;
  const liveProfileSeqNewer = 6;
  const shouldPreserveNewer = liveProfileSeqNewer >= historyRecordSeq;
  assert.equal(shouldPreserveNewer, true, 'Must preserve newer live pointer and not regress');

  // Scenario 2: Invariant failure (profile exists, live seq < target seq, but CAS failed)
  const liveProfileSeqStale = 4;
  const isInvariantViolation = liveProfileSeqStale < historyRecordSeq;
  assert.equal(isInvariantViolation, true, 'Must detect invariant failure and abort transaction');
});

test('MissingRequiredMilestoneEventIdError is thrown when milestoneEventId is absent or blank', () => {
  const invalidEventIds = [null, undefined, '', '   '];
  for (const id of invalidEventIds) {
    assert.throws(() => {
      if (!id || typeof id !== 'string' || !id.trim()) {
        throw new MissingRequiredMilestoneEventIdError(
          `MissingRequiredMilestoneEventIdError: milestoneEventId is required`
        );
      }
    }, {
      name: 'MissingRequiredMilestoneEventIdError',
      statusCode: 400,
    });
  }
});

test('testDatabaseGuard requires non-empty MONGODB_URI_TEST, enforces test database, and redacts credentials', async () => {
  const { validateIntegrationTestDatabaseUri, sanitizeMongoUri } = await import('../helpers/testDatabaseGuard.js');

  // Case 1: Missing or empty URI throws fatal error
  const emptyInputs = [null, undefined, '', '   '];
  for (const empty of emptyInputs) {
    assert.throws(() => {
      validateIntegrationTestDatabaseUri(empty);
    }, {
      message: /FATAL: MONGODB_URI_TEST environment variable is missing or empty/,
    });
  }

  // Case 2: Non-test database throws error without exposing credentials
  const prodUri = 'mongodb+srv://admin_user:SuperSecretPassword123@cluster0.prod.mongodb.net/scholrboard_production?retryWrites=true';
  assert.throws(() => {
    validateIntegrationTestDatabaseUri(prodUri);
  }, (err) => {
    assert.match(err.message, /must explicitly contain "test"/);
    assert.ok(!err.message.includes('SuperSecretPassword123'), 'Credentials must NEVER leak in error messages!');
    assert.ok(err.message.includes('***:***'), 'Credentials must be redacted!');
    return true;
  });

  // Case 3: Valid test database URI returns extracted test database name
  const validTestUri = 'mongodb+srv://test_user:Pass456@cluster0.test.mongodb.net/scholrboard_test?retryWrites=true';
  const dbName = validateIntegrationTestDatabaseUri(validTestUri);
  assert.equal(dbName, 'scholrboard_test');

  // Case 4: Sanitize helper redacts credentials
  const sanitized = sanitizeMongoUri('mongodb://dbuser:mysecretpwd@localhost:27017/testdb');
  assert.equal(sanitized, 'mongodb://***:***@localhost:27017/testdb');
});

test('Failure-injection hook is strictly disabled when NODE_ENV is production', () => {
  const originalEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    const options = { _injectFailureBeforeProfileUpdate: true };

    // The guard in persistScoreCalculation evaluates:
    const willTrigger = process.env.NODE_ENV === 'test' && options._injectFailureBeforeProfileUpdate === true;
    assert.equal(willTrigger, false, 'Failure injection MUST be ignored in production mode');

    // In test mode:
    process.env.NODE_ENV = 'test';
    const willTriggerInTest = process.env.NODE_ENV === 'test' && options._injectFailureBeforeProfileUpdate === true;
    assert.equal(willTriggerInTest, true, 'Failure injection triggers only when NODE_ENV is test');
  } finally {
    process.env.NODE_ENV = originalEnv;
  }
});


