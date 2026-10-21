/**
 * ScoreHistoryService — Historical Ledger, Scoring Concurrency & Aging Sweep Scheduler.
 *
 * Implements ScholrBoard V13 specifications:
 * - Lease + heartbeat lock with compare-and-set ownership (Part 17.3)
 * - Centralized snapshot creation interface (Part 18, Part 26)
 * - Read-time derivation & daily background aging sweep scheduled at 03:00 UTC (Part 17.5)
 */
import Profile from '../models/Profile.js';
import ScoreHistory from '../models/ScoreHistory.js';
import {
  persistScoreCalculationWithRetry,
  deriveConfidence,
  computeScoreFreshness,
} from './scorePersistence.js';

export class LockLostError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LockLostError';
    this.statusCode = 409;
  }
}

/**
 * Scheduled daily aging sweep cron specification (V13 Part 17.5: 03:00 UTC daily).
 */
export const DAILY_SWEEP_CRON = '0 3 * * *';

let sweepTimeoutHandle = null;
let isSweepScheduled = false;
let isSweepRunning = false;
let lastSweepRunAt = null;
let lastSweepResult = null;

function getLockKey(scoreType) {
  if (scoreType === 'developer') return 'developer';
  if (scoreType === 'placement_readiness' || scoreType === 'placementReadiness') return 'placementReadiness';
  return null;
}

/**
 * Atomically acquires scoring lease lock for a profile and scoreType.
 * Reclaims expired locks safely via compare-and-set.
 */
export async function acquireLock(profileId, scoreType, jobId) {
  const lockKey = getLockKey(scoreType);
  if (!lockKey) {
    throw new Error(`Invalid scoreType for scoring lock: ${scoreType}`);
  }
  const now = new Date();
  const leaseExpires = new Date(now.getTime() + 30_000); // 30-second initial lease

  const result = await Profile.findOneAndUpdate(
    {
      _id: profileId,
      $or: [
        { [`scoringLock.${lockKey}.leaseExpiresAt`]: null },
        { [`scoringLock.${lockKey}.leaseExpiresAt`]: { $lte: now } },
        { [`scoringLock.${lockKey}.lockedBy`]: jobId }, // Re-entrant / retry with same jobId
      ],
    },
    {
      $set: {
        [`scoringLock.${lockKey}.lockedAt`]: now,
        [`scoringLock.${lockKey}.lockedBy`]: jobId,
        [`scoringLock.${lockKey}.leaseExpiresAt`]: leaseExpires,
        [`scoringLock.${lockKey}.lastHeartbeatAt`]: now,
      },
    },
    { new: true }
  );

  return result !== null;
}

/**
 * Renews scoring lease lock with compare-and-set on lockedBy.
 * Throws LockLostError if lock was reclaimed or expired.
 */
export async function renewLease(profileId, scoreType, jobId) {
  const lockKey = getLockKey(scoreType);
  if (!lockKey) {
    throw new Error(`Invalid scoreType for lease renewal: ${scoreType}`);
  }
  const now = new Date();
  const leaseExpires = new Date(now.getTime() + 30_000);

  const result = await Profile.findOneAndUpdate(
    {
      _id: profileId,
      [`scoringLock.${lockKey}.lockedBy`]: jobId, // MUST match this job's ID
    },
    {
      $set: {
        [`scoringLock.${lockKey}.leaseExpiresAt`]: leaseExpires,
        [`scoringLock.${lockKey}.lastHeartbeatAt`]: now,
      },
    },
    { new: true }
  );

  if (!result) {
    throw new LockLostError(`Lease renewal failed for job ${jobId} on profile ${profileId}; lock was reclaimed or expired`);
  }
  return true;
}

/**
 * Releases scoring lease lock with compare-and-set on lockedBy.
 */
export async function releaseLock(profileId, scoreType, jobId) {
  const lockKey = getLockKey(scoreType);
  if (!lockKey) {
    return false;
  }
  await Profile.findOneAndUpdate(
    {
      _id: profileId,
      [`scoringLock.${lockKey}.lockedBy`]: jobId, // MUST match this job's ID
    },
    {
      $set: {
        [`scoringLock.${lockKey}.lockedAt`]: null,
        [`scoringLock.${lockKey}.lockedBy`]: null,
        [`scoringLock.${lockKey}.leaseExpiresAt`]: null,
        [`scoringLock.${lockKey}.lastHeartbeatAt`]: null,
      },
    }
  );
  return true;
}

/**
 * Evaluates operational freshness based on the oldest sync date across contributing sources.
 * - <= 14 days: "Fresh"
 * - <= 30 days: "Aging"
 * - > 30 days: "Stale"
 */
export function evaluateFreshness(lastSuccessfulSyncDates, now = new Date()) {
  if (!lastSuccessfulSyncDates || !lastSuccessfulSyncDates.length) return 'Stale';
  const nowMs = (now instanceof Date ? now : new Date(now)).getTime();
  const validTimestamps = lastSuccessfulSyncDates
    .map(d => (d ? new Date(d).getTime() : null))
    .filter(t => t !== null && !isNaN(t));

  if (!validTimestamps.length) return 'Stale';
  const oldestSync = Math.min(...validTimestamps);
  const ageInDays = (nowMs - oldestSync) / (1000 * 60 * 60 * 24);

  if (ageInDays <= 14) return 'Fresh';
  if (ageInDays <= 30) return 'Aging';
  return 'Stale';
}

/**
 * Computes millisecond delay until the next target UTC hour and minute.
 * Authoritative default: 03:00 UTC (V13 Part 17.5).
 */
export function getNextUtcRunDelay(targetHourUtc = 3, targetMinuteUtc = 0, now = new Date()) {
  const current = now instanceof Date ? now : new Date(now);
  const next = new Date(Date.UTC(
    current.getUTCFullYear(),
    current.getUTCMonth(),
    current.getUTCDate(),
    targetHourUtc,
    targetMinuteUtc,
    0,
    0
  ));
  if (next.getTime() <= current.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next.getTime() - current.getTime();
}

/**
 * Scheduled Daily Aging Sweep (V13 Part 17.5).
 * Inspects profiles and updates operational freshness/confidence without inserting ScoreHistory records.
 * Protects against overlapping executions via process-level mutex.
 * Handles transient database errors gracefully per profile without aborting the loop.
 */
export async function sweepAgingScores(options = {}) {
  if (isSweepRunning && !options._bypassMutex) {
    console.warn('[sweepAgingScores] Aging sweep already in progress; skipping concurrent trigger');
    return {
      sweptCount: 0,
      updatedCount: 0,
      errorCount: 0,
      skipped: true,
      reason: 'CONCURRENT_SWEEP_IN_PROGRESS',
    };
  }

  isSweepRunning = true;
  const now = options.now || new Date();
  lastSweepRunAt = now;

  let sweptCount = 0;
  let updatedCount = 0;
  let errorCount = 0;
  const errors = [];

  try {
    const profiles = await Profile.find({
      $or: [
        { 'developerScoreMeta.freshness': { $in: ['Fresh', 'Aging'] } },
        { 'placementReadinessMeta.freshness': { $in: ['Fresh', 'Aging'] } },
      ],
    });

    for (const profile of profiles) {
      sweptCount++;
      const updates = {};
      let hasChanges = false;

      try {
        // Check Developer Score freshness
        if (profile.developerScoreMeta?.freshness) {
          const currentFreshness = computeScoreFreshness(profile, 'developer', now);
          if (currentFreshness !== profile.developerScoreMeta.freshness) {
            updates['developerScoreMeta.freshness'] = currentFreshness;
            const dsaRecency = profile.developerScoreMeta.dimensions?.get
              ? profile.developerScoreMeta.dimensions.get('dsa')?.recencyLevel
              : profile.developerScoreMeta.dimensions?.dsa?.recencyLevel;
            updates['developerScoreMeta.confidence'] = deriveConfidence({
              coverage: profile.developerScoreMeta.coverage,
              freshness: currentFreshness,
              recencyLevel: dsaRecency ?? null,
            });
            hasChanges = true;
          }
        }

        // Check Placement Readiness freshness
        if (profile.placementReadinessMeta?.freshness) {
          const placeFreshness = computeScoreFreshness(profile, 'placement_readiness', now);
          if (placeFreshness !== profile.placementReadinessMeta.freshness) {
            updates['placementReadinessMeta.freshness'] = placeFreshness;
            const placeDsaRecency = profile.placementReadinessMeta.dimensions?.get
              ? profile.placementReadinessMeta.dimensions.get('placementDsa')?.recencyLevel
              : profile.placementReadinessMeta.dimensions?.placementDsa?.recencyLevel;
            updates['placementReadinessMeta.confidence'] = deriveConfidence({
              coverage: profile.placementReadinessMeta.coverage,
              freshness: placeFreshness,
              recencyLevel: placeDsaRecency ?? null,
            });
            hasChanges = true;
          }
        }

        if (hasChanges) {
          // Strictly updates operational metadata. Never touches developerScore or writes to ScoreHistory.
          await Profile.updateOne({ _id: profile._id }, { $set: updates });
          updatedCount++;
        }
      } catch (profileErr) {
        errorCount++;
        errors.push({ profileId: profile._id, error: profileErr.message });
        console.warn(`[sweepAgingScores] Error updating aged freshness for profile ${profile._id}:`, profileErr.message);
      }
    }

    const result = { sweptCount, updatedCount, errorCount, errors, skipped: false };
    lastSweepResult = result;
    return result;
  } finally {
    isSweepRunning = false;
  }
}

/**
 * Starts the daily aging sweep scheduler at 03:00 UTC (V13 Part 17.5).
 */
export function startAgingSweepScheduler(options = {}) {
  if (isSweepScheduled && sweepTimeoutHandle) {
    return {
      started: false,
      reason: 'ALREADY_SCHEDULED',
      cron: DAILY_SWEEP_CRON,
    };
  }

  const scheduleNext = () => {
    const delay = options.initialDelayMs !== undefined
      ? options.initialDelayMs
      : getNextUtcRunDelay(3, 0);

    sweepTimeoutHandle = setTimeout(async () => {
      try {
        await sweepAgingScores();
      } catch (err) {
        console.error('[sweepAgingScores] Scheduled sweep error:', err.message);
      } finally {
        if (isSweepScheduled) {
          scheduleNext();
        }
      }
    }, delay);

    if (sweepTimeoutHandle.unref) {
      sweepTimeoutHandle.unref();
    }
  };

  isSweepScheduled = true;
  scheduleNext();

  return {
    started: true,
    cron: DAILY_SWEEP_CRON,
    nextRunDelayMs: options.initialDelayMs ?? getNextUtcRunDelay(3, 0),
  };
}

/**
 * Stops the aging sweep scheduler and cleans up active timers.
 */
export function stopAgingSweepScheduler() {
  if (sweepTimeoutHandle) {
    clearTimeout(sweepTimeoutHandle);
    sweepTimeoutHandle = null;
  }
  isSweepScheduled = false;
  return { stopped: true };
}

/**
 * Returns current scheduler status.
 */
export function getAgingSweepSchedulerStatus() {
  return {
    isScheduled: isSweepScheduled,
    isRunning: isSweepRunning,
    scheduleCron: DAILY_SWEEP_CRON,
    scheduleDescription: 'Daily at 03:00 UTC',
    lastSweepRunAt,
    lastSweepResult,
  };
}

/**
 * Centralized createSnapshot interface (V13 Part 18 & Part 26).
 * Delegates to persistScoreCalculationWithRetry for ACID transaction and CAS guarantees.
 */
export async function createSnapshot(params) {
  return persistScoreCalculationWithRetry(params);
}

export default {
  acquireLock,
  renewLease,
  releaseLock,
  evaluateFreshness,
  getNextUtcRunDelay,
  sweepAgingScores,
  startAgingSweepScheduler,
  stopAgingSweepScheduler,
  getAgingSweepSchedulerStatus,
  createSnapshot,
  LockLostError,
  DAILY_SWEEP_CRON,
};
