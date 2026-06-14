import Profile from '../models/Profile.js';
import AuditLog from '../models/AuditLog.js';
import { fetchGithubMetrics } from './providers/githubProvider.js';
import { recalculateAndSaveScore } from './developerScoringService.js';

/**
 * Synchronizes GitHub metrics for a user.
 */
export const syncGithubProfile = async (userId) => {
  const startTime = Date.now();
  const profile = await Profile.findOne({ userId });
  if (!profile) {
    throw new Error('Student profile not found');
  }

  const username = profile.codingStats?.profiles?.github;
  if (!username) {
    throw new Error('GitHub handle is not linked in profile');
  }

  const oldScore = profile.developerScore || 0;

  try {
    // 1. Fetch metrics from provider
    const metrics = await fetchGithubMetrics(username);

    // 2. Update profile metrics and caching metadata
    const now = new Date();
    profile.codingStats.rawMetrics.github = metrics;
    profile.codingStats.githubRepos = metrics.publicRepos ?? 0;
    profile.codingStats.githubFollowers = metrics.followers ?? 0;
    profile.codingStats.githubLastSyncedAt = now;
    profile.codingStats.lastSyncedAt = now;
    
    // Reset consecutive failures on success
    profile.lastSyncStatus = 'success';
    profile.lastSyncError = null;
    profile.consecutiveSyncFailures = 0;
    
    // Save raw metrics first
    await profile.save();

    // 3. Recalculate scoring
    const updatedProfile = await recalculateAndSaveScore(profile._id, 'GitHub profile sync');
    const newScore = updatedProfile.developerScore || 0;
    const scoreDelta = newScore - oldScore;

    // 4. Create AuditLog
    await AuditLog.create({
      action: 'github_sync',
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
    // Increment consecutive failures on failure
    const now = new Date();
    profile.lastSyncStatus = 'failed';
    profile.lastSyncError = String(err.message || err);
    profile.consecutiveSyncFailures = (profile.consecutiveSyncFailures || 0) + 1;
    profile.lastFailedSyncAt = now;
    profile.codingStats.lastUpdated = now;
    await profile.save();

    // Create failure AuditLog
    await AuditLog.create({
      action: 'github_sync',
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
