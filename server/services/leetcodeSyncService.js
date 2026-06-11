import Profile from '../models/Profile.js';
import AuditLog from '../models/AuditLog.js';
import { fetchLeetcodeMetrics } from './providers/leetcodeProvider.js';
import { recalculateAndSaveScore } from './developerScoringService.js';

/**
 * Synchronizes LeetCode metrics for a user.
 */
export const syncLeetcodeProfile = async (userId) => {
  const startTime = Date.now();
  const profile = await Profile.findOne({ userId });
  if (!profile) {
    throw new Error('Student profile not found');
  }

  const username = profile.codingStats?.profiles?.leetcode;
  if (!username) {
    throw new Error('LeetCode handle is not linked in profile');
  }

  const oldScore = profile.developerScore || 0;

  try {
    const metrics = await fetchLeetcodeMetrics(username);

    const now = new Date();
    profile.codingStats.rawMetrics.leetcode = metrics;
    profile.codingStats.leetcodeLastSyncedAt = now;
    profile.codingStats.lastSyncedAt = now;
    
    profile.lastSyncStatus = 'success';
    profile.lastSyncError = null;
    profile.consecutiveSyncFailures = 0;
    
    await profile.save();

    const updatedProfile = await recalculateAndSaveScore(profile._id, 'LeetCode profile sync');
    const newScore = updatedProfile.developerScore || 0;
    const scoreDelta = newScore - oldScore;

    await AuditLog.create({
      action: 'leetcode_sync',
      performedBy: userId,
      role: 'student',
      targetModel: 'User',
      targetId: userId,
      details: {
        success: true,
        username,
        scoreDelta,
        oldScore,
        newScore,
        durationMs: Date.now() - startTime
      }
    });

    return updatedProfile;
  } catch (err) {
    const now = new Date();
    profile.lastSyncStatus = 'failed';
    profile.lastSyncError = String(err.message || err);
    profile.consecutiveSyncFailures = (profile.consecutiveSyncFailures || 0) + 1;
    profile.lastFailedSyncAt = now;
    profile.codingStats.lastUpdated = now;
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
        error: String(err.message || err),
        durationMs: Date.now() - startTime
      }
    });

    throw err;
  }
};
