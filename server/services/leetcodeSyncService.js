import crypto from 'crypto';
import Profile from '../models/Profile.js';
import AuditLog from '../models/AuditLog.js';
import { fetchLeetcodeMetrics } from './providers/leetcodeProvider.js';
import { recalculateAndSaveScore } from './developerScoringService.js';
import { canonicalJSON, sha256 } from './scorePersistence.js';

/**
 * Synchronizes LeetCode metrics for a user.
 * Establishes durable milestoneEventId at the logical job boundary and reuses it across retries.
 */
export const syncLeetcodeProfile = async (userId, options = {}) => {
  const startTime = Date.now();
  const profile = await Profile.findOne({ userId });
  if (!profile) {
    throw new Error('Student profile not found');
  }

  const username = profile.codingStats?.profiles?.leetcode;
  if (!username) {
    throw new Error('LeetCode handle is not linked in profile');
  }

  // 1. Establish durable milestoneEventId at logical job boundary.
  // When a durable queue job ID or delivery ID is unavailable, ensure the generated ID
  // is persisted durably before processing and reused during retries.
  if (!profile.platformSyncStates) profile.platformSyncStates = {};
  if (!profile.platformSyncStates.leetcode) profile.platformSyncStates.leetcode = {};

  let milestoneEventId = options.milestoneEventId || options.eventId || options.jobId || options.deliveryId;

  if (!milestoneEventId) {
    if (profile.platformSyncStates.leetcode.activeMilestoneEventId) {
      milestoneEventId = profile.platformSyncStates.leetcode.activeMilestoneEventId;
    } else {
      milestoneEventId = `sync_lc_${userId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      profile.platformSyncStates.leetcode.activeMilestoneEventId = milestoneEventId;
      profile.platformSyncStates.leetcode.syncStatus = 'SYNCING';
      profile.platformSyncStates.leetcode.lastSyncAttempt = new Date();
      await profile.save();
    }
  } else if (profile.platformSyncStates.leetcode.activeMilestoneEventId !== milestoneEventId) {
    profile.platformSyncStates.leetcode.activeMilestoneEventId = milestoneEventId;
    profile.platformSyncStates.leetcode.syncStatus = 'SYNCING';
    profile.platformSyncStates.leetcode.lastSyncAttempt = new Date();
    await profile.save();
  }

  // Capture baseEvaluationRevision before scoring starts
  const baseEvaluationRevision = options.baseEvaluationRevision ?? profile.developerScoreMeta?.evaluationRevision ?? 0;

  const oldScore = profile.developerScore || 0;
  const oldDataHash = profile.platformSyncStates?.leetcode?.dataHash || null;

  try {
    // 2. Fetch metrics from provider
    const metrics = await fetchLeetcodeMetrics(username);

    // Compute evidence data hash
    const newDataHash = sha256(canonicalJSON(metrics));
    const now = new Date();

    // 3. Update profile metrics and caching metadata
    let syncStatus = 'SYNCED';
    const priorMetrics = profile.codingStats?.rawMetrics?.leetcode || {};

    if (metrics.isPartial) {
      syncStatus = 'PARTIAL';
      // Preserve prior valid contest metrics if current contest sub-call failed
      if (metrics.contestRating === null && priorMetrics.contestRating !== null && priorMetrics.contestRating !== undefined) {
        metrics.contestRating = priorMetrics.contestRating;
        metrics.contestGlobalRanking = priorMetrics.contestGlobalRanking ?? null;
        metrics.attendedContestsCount = priorMetrics.attendedContestsCount ?? 0;
      }
      // Preserve prior valid calendar metrics if current calendar sub-call failed or returned unavailable data
      if (metrics.activeSubmitDays30d === null) {
        if (priorMetrics.activeSubmitDays30d !== null && priorMetrics.activeSubmitDays30d !== undefined) {
          metrics.activeSubmitDays30d = priorMetrics.activeSubmitDays30d;
          metrics.activeSubmitDays90d = priorMetrics.activeSubmitDays90d ?? null;
          metrics.activeSubmitDays365d = priorMetrics.activeSubmitDays365d ?? null;
          metrics.lastActivityDate = priorMetrics.lastActivityDate ?? null;
          metrics.submissionCalendarRaw = priorMetrics.submissionCalendarRaw ?? null;
          metrics.recencyLevel = priorMetrics.recencyLevel ?? null;
          metrics.streak = priorMetrics.streak ?? profile.codingStats?.leetcodeStreak ?? null;
          metrics.longestStreak = priorMetrics.longestStreak ?? profile.codingStats?.leetcodeLongestStreak ?? null;
        } else {
          metrics.recencyLevel = priorMetrics.recencyLevel ?? null;
          metrics.streak = metrics.streak ?? priorMetrics.streak ?? profile.codingStats?.leetcodeStreak ?? null;
          metrics.longestStreak = metrics.longestStreak ?? priorMetrics.longestStreak ?? profile.codingStats?.leetcodeLongestStreak ?? null;
        }
      }
    }

    profile.codingStats.rawMetrics.leetcode = metrics;
    profile.codingStats.leetcodeProblemsSolved = metrics.totalSolved ?? 0;
    profile.codingStats.leetcodeContestRating = metrics.contestRating ?? 0;
    profile.codingStats.leetcodeStreak = metrics.streak != null
      ? metrics.streak
      : (priorMetrics.streak != null ? priorMetrics.streak : (profile.codingStats?.leetcodeStreak != null ? profile.codingStats.leetcodeStreak : null));
    profile.codingStats.leetcodeLongestStreak = metrics.longestStreak != null
      ? metrics.longestStreak
      : (priorMetrics.longestStreak != null ? priorMetrics.longestStreak : (profile.codingStats?.leetcodeLongestStreak != null ? profile.codingStats.leetcodeLongestStreak : null));

    if (!profile.platformSyncStates) profile.platformSyncStates = {};
    if (!profile.platformSyncStates.leetcode) profile.platformSyncStates.leetcode = {};

    if (syncStatus === 'SYNCED') {
      profile.codingStats.leetcodeLastSyncedAt = now;
      profile.codingStats.lastSyncedAt = now;
      profile.lastSyncStatus = 'success';
      profile.lastSyncError = null;
      profile.consecutiveSyncFailures = 0;

      profile.platformSyncStates.leetcode.syncStatus = 'SYNCED';
      profile.platformSyncStates.leetcode.activeMilestoneEventId = milestoneEventId;
      profile.platformSyncStates.leetcode.lastSyncAttempt = now;
      profile.platformSyncStates.leetcode.lastSuccessfulSync = now;
      profile.platformSyncStates.leetcode.lastVerifiedAt = now;
      profile.platformSyncStates.leetcode.sourceDataUpdatedAt = metrics.sourceDataUpdatedAt ? new Date(metrics.sourceDataUpdatedAt) : now;
      profile.platformSyncStates.leetcode.dataHash = newDataHash;
      profile.platformSyncStates.leetcode.error = null;
      profile.platformSyncStates.leetcode.consecutiveFailures = 0;
    } else {
      // Partial sync: record PARTIAL state, retain prior lastSuccessfulSync without advancing
      profile.lastSyncStatus = 'success';
      profile.lastSyncError = metrics.partialError || 'Partial LeetCode sync';
      profile.consecutiveSyncFailures = 0;

      profile.platformSyncStates.leetcode.syncStatus = 'PARTIAL';
      profile.platformSyncStates.leetcode.activeMilestoneEventId = milestoneEventId;
      profile.platformSyncStates.leetcode.lastSyncAttempt = now;
      profile.platformSyncStates.leetcode.sourceDataUpdatedAt = metrics.sourceDataUpdatedAt ? new Date(metrics.sourceDataUpdatedAt) : now;
      profile.platformSyncStates.leetcode.dataHash = newDataHash;
      profile.platformSyncStates.leetcode.error = metrics.partialError || 'Partial LeetCode sync';
      profile.platformSyncStates.leetcode.consecutiveFailures = 0;
    }

    // Save raw metrics
    await profile.save();

    // 4. Recalculate scoring passing durable milestoneEventId and evidence hashes
    const updatedProfile = await recalculateAndSaveScore(profile._id, 'LeetCode profile sync', {
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
      $set: { 'platformSyncStates.leetcode.activeMilestoneEventId': null }
    });
    if (updatedProfile?.platformSyncStates?.leetcode) {
      updatedProfile.platformSyncStates.leetcode.activeMilestoneEventId = null;
    }

    const newScore = updatedProfile.developerScore || 0;
    const scoreDelta = newScore - oldScore;

    // 5. Create AuditLog
    await AuditLog.create({
      action: 'leetcode_sync',
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
    const lcSyncStatus = isRateLimit ? 'RATE_LIMITED' : (isNotFound ? 'UNVERIFIED' : 'ERROR');

    profile.lastSyncStatus = 'failed';
    profile.lastSyncError = errMsg;
    profile.consecutiveSyncFailures = (profile.consecutiveSyncFailures || 0) + 1;
    profile.lastFailedSyncAt = now;
    profile.codingStats.lastUpdated = now;

    if (!profile.platformSyncStates) profile.platformSyncStates = {};
    if (!profile.platformSyncStates.leetcode) profile.platformSyncStates.leetcode = {};
    profile.platformSyncStates.leetcode.syncStatus = lcSyncStatus;
    profile.platformSyncStates.leetcode.lastSyncAttempt = now;
    profile.platformSyncStates.leetcode.error = errMsg;
    profile.platformSyncStates.leetcode.consecutiveFailures = profile.consecutiveSyncFailures;
    profile.platformSyncStates.leetcode.activeMilestoneEventId = milestoneEventId;

    await profile.save();

    await AuditLog.create({
      action: 'leetcode_sync',
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
