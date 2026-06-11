import Profile from '../models/Profile.js';
import { acquireSyncLock, releaseSyncLock } from '../services/syncLockService.js';
import { syncGithubProfile } from '../services/githubSyncService.js';
import { syncLeetcodeProfile } from '../services/leetcodeSyncService.js';
import { syncCodeforcesProfile } from '../services/codeforcesSyncService.js';

// Cooldown duration: 15 minutes (900,000 milliseconds)
const COOLDOWN_MS = 15 * 60 * 1000;
// Failure Throttling Window: 15 minutes
const FAILURE_WINDOW_MS = 15 * 60 * 1000;

const verifyThrottlingAndCooldown = (profile, platform) => {
  const now = Date.now();

  // 1. Failure Throttling protection: 5 failures within 15 minutes
  if (profile.consecutiveSyncFailures >= 5 && profile.lastFailedSyncAt) {
    const elapsedFailureMs = now - new Date(profile.lastFailedSyncAt).getTime();
    if (elapsedFailureMs < FAILURE_WINDOW_MS) {
      const err = new Error('Sync temporarily disabled due to repeated failures.');
      err.statusCode = 429;
      throw err;
    }
  }

  // 2. Cooldown check: 15 minutes since last sync
  let lastSynced = null;
  if (platform === 'github') lastSynced = profile.codingStats?.githubLastSyncedAt;
  else if (platform === 'leetcode') lastSynced = profile.codingStats?.leetcodeLastSyncedAt;
  else if (platform === 'codeforces') lastSynced = profile.codingStats?.codeforcesLastSyncedAt;
  else lastSynced = profile.codingStats?.lastSyncedAt;

  if (lastSynced) {
    const elapsedSyncMs = now - new Date(lastSynced).getTime();
    if (elapsedSyncMs < COOLDOWN_MS) {
      return { inCooldown: true, remainingMs: COOLDOWN_MS - elapsedSyncMs };
    }
  }

  return { inCooldown: false, remainingMs: 0 };
};

export const syncGithub = async (req, res) => {
  const userId = req.user._id;

  try {
    const profile = await Profile.findOne({ userId });
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    if (!profile.codingStats?.profiles?.github) {
      return res.status(400).json({ success: false, message: 'GitHub handle not linked in profile' });
    }

    // Check throttling & cooldown
    const { inCooldown, remainingMs } = verifyThrottlingAndCooldown(profile, 'github');
    if (inCooldown) {
      // Return cached data during cooldown
      profile.lastSyncStatus = 'cooldown';
      await profile.save();
      return res.json({
        success: true,
        cooldown: true,
        message: `GitHub metrics are in cooldown. Next sync available in ${Math.ceil(remainingMs / 1000)} seconds.`,
        codingStats: profile.codingStats,
        githubScore: profile.githubScore,
        developerScore: profile.developerScore
      });
    }

    // Acquire lock and execute sync
    await acquireSyncLock(userId);
    try {
      const updated = await syncGithubProfile(userId);
      return res.json({
        success: true,
        message: 'GitHub profile synced successfully',
        codingStats: updated.codingStats,
        githubScore: updated.githubScore,
        developerScore: updated.developerScore
      });
    } finally {
      // Always release lock
      await releaseSyncLock(userId);
    }

  } catch (error) {
    const status = error.statusCode || 500;
    const cleanMessage = status === 500 ? 'GitHub synchronization failed' : error.message;
    return res.status(status).json({ success: false, message: cleanMessage });
  }
};

export const syncLeetcode = async (req, res) => {
  const userId = req.user._id;

  try {
    const profile = await Profile.findOne({ userId });
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    if (!profile.codingStats?.profiles?.leetcode) {
      return res.status(400).json({ success: false, message: 'LeetCode handle not linked in profile' });
    }

    const { inCooldown, remainingMs } = verifyThrottlingAndCooldown(profile, 'leetcode');
    if (inCooldown) {
      profile.lastSyncStatus = 'cooldown';
      await profile.save();
      return res.json({
        success: true,
        cooldown: true,
        message: `LeetCode metrics are in cooldown. Next sync available in ${Math.ceil(remainingMs / 1000)} seconds.`,
        codingStats: profile.codingStats,
        dsaScore: profile.dsaScore,
        developerScore: profile.developerScore
      });
    }

    await acquireSyncLock(userId);
    try {
      const updated = await syncLeetcodeProfile(userId);
      return res.json({
        success: true,
        message: 'LeetCode profile synced successfully',
        codingStats: updated.codingStats,
        dsaScore: updated.dsaScore,
        developerScore: updated.developerScore
      });
    } finally {
      await releaseSyncLock(userId);
    }

  } catch (error) {
    const status = error.statusCode || 500;
    const cleanMessage = status === 500 ? 'LeetCode synchronization failed' : error.message;
    return res.status(status).json({ success: false, message: cleanMessage });
  }
};

export const syncCodeforces = async (req, res) => {
  const userId = req.user._id;

  try {
    const profile = await Profile.findOne({ userId });
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    if (!profile.codingStats?.profiles?.codeforces) {
      return res.status(400).json({ success: false, message: 'Codeforces handle not linked in profile' });
    }

    const { inCooldown, remainingMs } = verifyThrottlingAndCooldown(profile, 'codeforces');
    if (inCooldown) {
      profile.lastSyncStatus = 'cooldown';
      await profile.save();
      return res.json({
        success: true,
        cooldown: true,
        message: `Codeforces metrics are in cooldown. Next sync available in ${Math.ceil(remainingMs / 1000)} seconds.`,
        codingStats: profile.codingStats,
        cpScore: profile.cpScore,
        developerScore: profile.developerScore
      });
    }

    await acquireSyncLock(userId);
    try {
      const updated = await syncCodeforcesProfile(userId);
      return res.json({
        success: true,
        message: 'Codeforces profile synced successfully',
        codingStats: updated.codingStats,
        cpScore: updated.cpScore,
        developerScore: updated.developerScore
      });
    } finally {
      await releaseSyncLock(userId);
    }

  } catch (error) {
    const status = error.statusCode || 500;
    const cleanMessage = status === 500 ? 'Codeforces synchronization failed' : error.message;
    return res.status(status).json({ success: false, message: cleanMessage });
  }
};

export const syncAllPlatforms = async (req, res) => {
  const userId = req.user._id;

  try {
    const profile = await Profile.findOne({ userId });
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    const { github, leetcode, codeforces } = profile.codingStats?.profiles || {};
    if (!github && !leetcode && !codeforces) {
      return res.status(400).json({ success: false, message: 'No coding profiles are linked' });
    }

    const { inCooldown, remainingMs } = verifyThrottlingAndCooldown(profile, 'all');
    if (inCooldown) {
      profile.lastSyncStatus = 'cooldown';
      await profile.save();
      return res.json({
        success: true,
        cooldown: true,
        message: `Sync-All is in cooldown. Next sync available in ${Math.ceil(remainingMs / 1000)} seconds.`,
        codingStats: profile.codingStats,
        developerScore: profile.developerScore
      });
    }

    await acquireSyncLock(userId);
    try {
      // Sync each connected platform sequentially to avoid API concurrency lock problems
      if (github) {
        await syncGithubProfile(userId).catch(err => console.warn('Sync All (GitHub) failed:', err.message));
      }
      if (leetcode) {
        await syncLeetcodeProfile(userId).catch(err => console.warn('Sync All (LeetCode) failed:', err.message));
      }
      if (codeforces) {
        await syncCodeforcesProfile(userId).catch(err => console.warn('Sync All (Codeforces) failed:', err.message));
      }

      // Reload fresh profile
      const updated = await Profile.findOne({ userId });
      
      // Update overall sync status metadata
      const now = new Date();
      updated.codingStats.lastSyncedAt = now;
      updated.lastSyncStatus = 'success';
      updated.lastSyncError = null;
      await updated.save();

      return res.json({
        success: true,
        message: 'All platforms synced successfully',
        codingStats: updated.codingStats,
        developerScore: updated.developerScore
      });
    } finally {
      await releaseSyncLock(userId);
    }

  } catch (error) {
    const status = error.statusCode || 500;
    const cleanMessage = status === 500 ? 'Platform synchronization failed' : error.message;
    return res.status(status).json({ success: false, message: cleanMessage });
  }
};
