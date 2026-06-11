import Profile from '../models/Profile.js';

// Lock expiry duration: 10 minutes (600,000 milliseconds)
const SYNC_LOCK_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * Atomically acquires the sync lock for a user's profile.
 * Reclaims expired locks if syncStartedAt is older than 10 minutes.
 * Throws an error if lock cannot be acquired.
 */
export const acquireSyncLock = async (userId) => {
  if (!userId) {
    throw new Error('User ID is required to acquire sync lock');
  }

  const now = new Date();
  const expiryTime = new Date(now.getTime() - SYNC_LOCK_TIMEOUT_MS);

  // Atomic update: only lock if isSyncing is false OR has expired
  const profile = await Profile.findOneAndUpdate(
    {
      userId,
      $or: [
        { 'codingStats.isSyncing': false },
        { 'codingStats.isSyncing': true, 'codingStats.syncStartedAt': { $lt: expiryTime } },
      ],
    },
    {
      $set: {
        'codingStats.isSyncing': true,
        'codingStats.syncStartedAt': now,
        'codingStats.lastUpdated': now,
      },
    },
    { new: true }
  );

  if (!profile) {
    const err = new Error('Sync operation is already in progress. Please wait a few minutes.');
    err.statusCode = 409;
    throw err;
  }

  return profile;
};

/**
 * Releases the sync lock for a user's profile.
 */
export const releaseSyncLock = async (userId) => {
  if (!userId) {
    throw new Error('User ID is required to release sync lock');
  }

  const now = new Date();
  const profile = await Profile.findOneAndUpdate(
    { userId },
    {
      $set: {
        'codingStats.isSyncing': false,
        'codingStats.syncStartedAt': null,
        'codingStats.lastUpdated': now,
      },
    },
    { new: true }
  );

  return profile;
};
