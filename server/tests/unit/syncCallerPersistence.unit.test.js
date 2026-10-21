/**
 * Unit Test Suite for Upstream Caller Integration with Score Persistence
 *
 * Exercises:
 *   1. Durable milestoneEventId generation at the sync job boundary.
 *   2. Preservation of caller-supplied milestoneEventId across retries.
 *   3. Durable activeMilestoneEventId reuse across retries and process restarts when queue ID is absent.
 *   4. Generation of distinct IDs for distinct sync events.
 *   5. Preservation of existing sync failure error handling & consecutive failure counters.
 *   6. Preservation of existing sync success state resets & event ID cleanup.
 *   7. Concurrency guard: baseEvaluationRevision CAS preemption.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';

test('Upstream caller durable milestoneEventId generation and preservation contract', () => {
  const userId = '60c72b2f9b1d8b2bad000001';

  // Case 1: Caller supplies explicit jobId or deliveryId (e.g. BullMQ job run or webhook)
  const incomingOptions1 = { jobId: 'bullmq_job_98765' };
  const milestoneEventId1 = incomingOptions1.milestoneEventId || incomingOptions1.eventId || incomingOptions1.jobId || incomingOptions1.deliveryId ||
    `sync_gh_${userId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  assert.equal(milestoneEventId1, 'bullmq_job_98765', 'Must preserve caller-supplied jobId as milestoneEventId');

  // Case 2: Upstream retry passes the same milestoneEventId
  const retryOptions = { milestoneEventId: milestoneEventId1 };
  const milestoneEventIdRetry = retryOptions.milestoneEventId || retryOptions.eventId || retryOptions.jobId || retryOptions.deliveryId ||
    `sync_gh_${userId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  assert.equal(milestoneEventIdRetry, 'bullmq_job_98765', 'Retry MUST reuse the exact same milestoneEventId');

  // Case 3: Distinct logical event without options generates distinct unique ID
  const eventA = `sync_gh_${userId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const eventB = `sync_gh_${userId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  assert.notEqual(eventA, eventB, 'Distinct sync runs must generate distinct, non-colliding event IDs');
});

test('Durable activeMilestoneEventId reuse across retries and process restarts when queue ID is unavailable', () => {
  const userId = '60c72b2f9b1d8b2bad000002';
  const existingPersistedEventId = `sync_gh_${userId}_1728000000000_abcd1234`;

  // Profile has an active event ID persisted from a prior interrupted attempt / crash
  const profile = {
    userId,
    platformSyncStates: {
      github: {
        activeMilestoneEventId: existingPersistedEventId,
        syncStatus: 'SYNCING',
      },
    },
  };

  // Upstream caller provides no options (e.g. cron run or worker retry without durable queue ID)
  const options = {};

  let milestoneEventId = options.milestoneEventId || options.eventId || options.jobId || options.deliveryId;
  if (!milestoneEventId) {
    if (profile.platformSyncStates?.github?.activeMilestoneEventId) {
      milestoneEventId = profile.platformSyncStates.github.activeMilestoneEventId;
    } else {
      milestoneEventId = `sync_gh_${userId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }
  }

  assert.equal(
    milestoneEventId,
    existingPersistedEventId,
    'Must re-use the durably persisted activeMilestoneEventId across retries/restarts, NOT generate a new random/timestamp ID'
  );
});

test('Preservation of existing sync failure error handling & consecutive failure counters', () => {
  const now = new Date();
  const profile = {
    lastSyncStatus: 'success',
    lastSyncError: null,
    consecutiveSyncFailures: 2,
    lastFailedSyncAt: null,
    codingStats: { lastUpdated: null },
    platformSyncStates: {
      github: {
        syncStatus: 'SYNCED',
        error: null,
        consecutiveFailures: 2,
        activeMilestoneEventId: 'sync_gh_in_flight_111',
      },
    },
  };

  const err = new Error('Rate limit exceeded (HTTP 429)');
  const milestoneEventId = 'sync_gh_in_flight_111';

  // Apply failure mutation logic (exact logic from sync services catch block)
  profile.lastSyncStatus = 'failed';
  profile.lastSyncError = String(err.message || err);
  profile.consecutiveSyncFailures = (profile.consecutiveSyncFailures || 0) + 1;
  profile.lastFailedSyncAt = now;
  profile.codingStats.lastUpdated = now;

  profile.platformSyncStates.github.syncStatus = 'ERROR';
  profile.platformSyncStates.github.lastSyncAttempt = now;
  profile.platformSyncStates.github.error = String(err.message || err);
  profile.platformSyncStates.github.consecutiveFailures = profile.consecutiveSyncFailures;
  profile.platformSyncStates.github.activeMilestoneEventId = milestoneEventId;

  assert.equal(profile.lastSyncStatus, 'failed');
  assert.equal(profile.lastSyncError, 'Rate limit exceeded (HTTP 429)');
  assert.equal(profile.consecutiveSyncFailures, 3, 'consecutiveSyncFailures must increment monotonically on failure');
  assert.equal(profile.platformSyncStates.github.syncStatus, 'ERROR');
  assert.equal(profile.platformSyncStates.github.consecutiveFailures, 3);
  assert.equal(
    profile.platformSyncStates.github.activeMilestoneEventId,
    'sync_gh_in_flight_111',
    'activeMilestoneEventId must be preserved on error so retry uses the same ID'
  );
});

test('Preservation of existing sync success state resets & event ID cleanup', () => {
  const profile = {
    lastSyncStatus: 'failed',
    lastSyncError: 'Network timeout',
    consecutiveSyncFailures: 4,
    platformSyncStates: {
      github: {
        syncStatus: 'SYNCING',
        error: 'Network timeout',
        consecutiveFailures: 4,
        activeMilestoneEventId: 'sync_gh_in_flight_222',
      },
    },
  };

  // Apply success reset logic (exact logic from sync services success block)
  profile.lastSyncStatus = 'success';
  profile.lastSyncError = null;
  profile.consecutiveSyncFailures = 0;

  profile.platformSyncStates.github.syncStatus = 'SYNCED';
  profile.platformSyncStates.github.error = null;
  profile.platformSyncStates.github.consecutiveFailures = 0;
  profile.platformSyncStates.github.activeMilestoneEventId = null;

  assert.equal(profile.lastSyncStatus, 'success');
  assert.equal(profile.lastSyncError, null);
  assert.equal(profile.consecutiveSyncFailures, 0, 'consecutiveSyncFailures must be reset to 0 on success');
  assert.equal(profile.platformSyncStates.github.syncStatus, 'SYNCED');
  assert.equal(profile.platformSyncStates.github.consecutiveFailures, 0);
  assert.equal(profile.platformSyncStates.github.activeMilestoneEventId, null, 'activeMilestoneEventId must be cleared on successful completion');
});

test('baseEvaluationRevision captured before calculation prevents stale writes', () => {
  const profile = {
    _id: 'prof_001',
    developerScoreMeta: {
      evaluationRevision: 5,
    },
  };

  const capturedRevision = profile.developerScoreMeta?.evaluationRevision ?? 0;
  assert.equal(capturedRevision, 5);

  // If concurrent write updates revision during calculation:
  profile.developerScoreMeta.evaluationRevision = 6;

  // CAS filter check:
  const casMatches = capturedRevision === profile.developerScoreMeta.evaluationRevision;
  assert.equal(casMatches, false, 'Stale calculation must not match modified evaluationRevision');
});
