import crypto from 'crypto';
import Profile from '../models/Profile.js';
import AuditLog from '../models/AuditLog.js';
import { fetchCodeforcesMetrics } from './providers/codeforcesProvider.js';
import { recalculateAndSaveScore } from './developerScoringService.js';
import { canonicalJSON, sha256 } from './scorePersistence.js';

/**
 * Synchronizes Codeforces metrics for a user.
 * Establishes durable milestoneEventId at the logical job boundary and reuses it across retries.
 */
export const syncCodeforcesProfile = async (userId, options = {}) => {
  const startTime = Date.now();
  const profile = await Profile.findOne({ userId });
  if (!profile) {
    throw new Error('Student profile not found');
  }

  const username = profile.codingStats?.profiles?.codeforces;
  if (!username) {
    throw new Error('Codeforces handle is not linked in profile');
  }

  // 1. Establish durable milestoneEventId at logical job boundary.
  // When a durable queue job ID or delivery ID is unavailable, ensure the generated ID
  // is persisted durably before processing and reused during retries.
  if (!profile.platformSyncStates) profile.platformSyncStates = {};
  if (!profile.platformSyncStates.codeforces) profile.platformSyncStates.codeforces = {};

  let milestoneEventId = options.milestoneEventId || options.eventId || options.jobId || options.deliveryId;

  if (!milestoneEventId) {
    if (profile.platformSyncStates.codeforces.activeMilestoneEventId) {
      milestoneEventId = profile.platformSyncStates.codeforces.activeMilestoneEventId;
    } else {
      milestoneEventId = `sync_cf_${userId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      profile.platformSyncStates.codeforces.activeMilestoneEventId = milestoneEventId;
      profile.platformSyncStates.codeforces.syncStatus = 'SYNCING';
      profile.platformSyncStates.codeforces.lastSyncAttempt = new Date();
      await profile.save();
    }
  } else if (profile.platformSyncStates.codeforces.activeMilestoneEventId !== milestoneEventId) {
    profile.platformSyncStates.codeforces.activeMilestoneEventId = milestoneEventId;
    profile.platformSyncStates.codeforces.syncStatus = 'SYNCING';
    profile.platformSyncStates.codeforces.lastSyncAttempt = new Date();
    await profile.save();
  }

  // Capture baseEvaluationRevision before scoring starts
  const baseEvaluationRevision = options.baseEvaluationRevision ?? profile.developerScoreMeta?.evaluationRevision ?? 0;

  const oldScore = profile.developerScore || 0;
  const oldDataHash = profile.platformSyncStates?.codeforces?.dataHash || null;

  try {
    // 2. Fetch metrics from provider
    const metrics = await fetchCodeforcesMetrics(username);

    // Compute evidence data hash
    const newDataHash = sha256(canonicalJSON(metrics));
    const now = new Date();

    // Preserve last valid contestsParticipated and lastContestAt if new fetch returned null (partial/missing)
    const priorMetrics = profile.codingStats?.rawMetrics?.codeforces || {};
    let syncStatus = 'SYNCED';

    if (metrics.isPartial) {
      syncStatus = 'PARTIAL';
      if (
        metrics.rating === null &&
        priorMetrics.rating !== null &&
        priorMetrics.rating !== undefined
      ) {
        metrics.rating = priorMetrics.rating;
        metrics.maxRating = priorMetrics.maxRating ?? null;
        metrics.rank = priorMetrics.rank ?? null;
        metrics.maxRank = priorMetrics.maxRank ?? null;
      }
      if (
        metrics.contestsParticipated === null &&
        priorMetrics.contestsParticipated !== null &&
        priorMetrics.contestsParticipated !== undefined
      ) {
        metrics.contestsParticipated = priorMetrics.contestsParticipated;
      }
      if (metrics.lastContestAt === null && priorMetrics.lastContestAt) {
        metrics.lastContestAt = priorMetrics.lastContestAt;
      }
    }

    // 3. Update profile metrics and caching metadata
    profile.codingStats.rawMetrics.codeforces = metrics;
    profile.codingStats.codeforcesRating = metrics.rating != null
      ? metrics.rating
      : (priorMetrics.rating ?? null);
    profile.codingStats.codeforcesMaxRating = metrics.maxRating != null
      ? metrics.maxRating
      : (priorMetrics.maxRating ?? null);
    profile.codingStats.codeforcesRank = metrics.rank ?? priorMetrics.rank ?? '';

    if (!profile.platformSyncStates) profile.platformSyncStates = {};
    if (!profile.platformSyncStates.codeforces) profile.platformSyncStates.codeforces = {};

    if (syncStatus === 'SYNCED') {
      profile.codingStats.codeforcesLastSyncedAt = now;
      profile.codingStats.lastSyncedAt = now;
      profile.lastSyncStatus = 'success';
      profile.lastSyncError = null;
      profile.consecutiveSyncFailures = 0;

      profile.platformSyncStates.codeforces.syncStatus = 'SYNCED';
      profile.platformSyncStates.codeforces.activeMilestoneEventId = milestoneEventId;
      profile.platformSyncStates.codeforces.lastSyncAttempt = now;
      profile.platformSyncStates.codeforces.lastSuccessfulSync = now;
      profile.platformSyncStates.codeforces.lastVerifiedAt = now;
      profile.platformSyncStates.codeforces.sourceDataUpdatedAt = metrics.lastContestAt ? new Date(metrics.lastContestAt) : now;
      profile.platformSyncStates.codeforces.dataHash = newDataHash;
      profile.platformSyncStates.codeforces.error = null;
      profile.platformSyncStates.codeforces.consecutiveFailures = 0;
    } else {
      // Partial sync: record PARTIAL state, retain prior lastSuccessfulSync without advancing
      profile.lastSyncStatus = 'success';
      profile.lastSyncError = metrics.partialError || 'Partial Codeforces sync';
      profile.consecutiveSyncFailures = 0;

      profile.platformSyncStates.codeforces.syncStatus = 'PARTIAL';
      profile.platformSyncStates.codeforces.activeMilestoneEventId = milestoneEventId;
      profile.platformSyncStates.codeforces.lastSyncAttempt = now;
      profile.platformSyncStates.codeforces.sourceDataUpdatedAt = metrics.lastContestAt ? new Date(metrics.lastContestAt) : (priorMetrics.lastContestAt ? new Date(priorMetrics.lastContestAt) : now);
      profile.platformSyncStates.codeforces.dataHash = newDataHash;
      profile.platformSyncStates.codeforces.error = metrics.partialError || 'Partial Codeforces sync';
      profile.platformSyncStates.codeforces.consecutiveFailures = 0;
    }

    // Save raw metrics
    await profile.save();

    // 4. Recalculate scoring passing durable milestoneEventId and evidence hashes
    const updatedProfile = await recalculateAndSaveScore(profile._id, 'Codeforces profile sync', {
      ...options,
      milestoneEventId,
      baseEvaluationRevision,
      oldEvidenceHash: oldDataHash,
      newEvidenceHash: newDataHash,
      syncStatus: syncStatus === 'PARTIAL' ? 'PARTIAL' : 'SUCCESS',
      connectionStatus: 'LINKED',
    });

    // Clear activeMilestoneEventId now that the sync and scoring milestone are fully committed
    await Profile.updateOne({ _id: profile._id }, {
      $set: { 'platformSyncStates.codeforces.activeMilestoneEventId': null }
    });
    if (updatedProfile?.platformSyncStates?.codeforces) {
      updatedProfile.platformSyncStates.codeforces.activeMilestoneEventId = null;
    }

    const newScore = updatedProfile.developerScore || 0;
    const scoreDelta = newScore - oldScore;

    // 5. Create AuditLog
    await AuditLog.create({
      action: 'codeforces_sync',
      performedBy: userId,
      role: 'student',
      targetModel: 'User',
      targetId: userId,
      details: {
        success: true,
        username,
        milestoneEventId,
        syncStatus,
        scoreDelta,
        oldScore,
        newScore,
        durationMs: Date.now() - startTime,
      }
    });

    return updatedProfile;
  } catch (err) {
    const now = new Date();
    const errMsg = String(err.message || err);
    const isRateLimit = errMsg.toLowerCase().includes('rate limit');
    const isNotFound = errMsg.toLowerCase().includes('not found');
    const cfSyncStatus = isRateLimit ? 'RATE_LIMITED' : (isNotFound ? 'UNVERIFIED' : 'ERROR');

    profile.lastSyncStatus = 'failed';
    profile.lastSyncError = errMsg;
    profile.consecutiveSyncFailures = (profile.consecutiveSyncFailures || 0) + 1;
    profile.lastFailedSyncAt = now;
    profile.codingStats.lastUpdated = now;

    if (!profile.platformSyncStates) profile.platformSyncStates = {};
    if (!profile.platformSyncStates.codeforces) profile.platformSyncStates.codeforces = {};
    profile.platformSyncStates.codeforces.syncStatus = cfSyncStatus;
    profile.platformSyncStates.codeforces.lastSyncAttempt = now;
    profile.platformSyncStates.codeforces.error = errMsg;
    profile.platformSyncStates.codeforces.consecutiveFailures = profile.consecutiveSyncFailures;
    profile.platformSyncStates.codeforces.activeMilestoneEventId = milestoneEventId;

    await profile.save();

    await AuditLog.create({
      action: 'codeforces_sync',
      performedBy: userId,
      role: 'student',
      targetModel: 'User',
      targetId: userId,
      details: {
        success: false,
        username,
        milestoneEventId,
        error: errMsg,
        durationMs: Date.now() - startTime,
      }
    });

    throw err;
  }
};
