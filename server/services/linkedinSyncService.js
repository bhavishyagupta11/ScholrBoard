/**
 * linkedinSyncService.js — ScholrBoard V13 Phase 7
 *
 * Synchronization and verification service for LinkedIn integration.
 * Adheres to authoritative V13 Part 3.2, Part 13, and Phase 7 specifications:
 *   1. Distinguishes connection status from activity metric synchronization.
 *   2. Treats LinkedIn profile strictly as a verified social link with zero scoring impact.
 *   3. Enforces that missing, restricted, or unverified activity metrics remain strictly null
 *      and never penalize student scores or coverage.
 *   4. Durable milestoneEventId lifecycle with idempotent retry protection.
 *   5. Preserves existing cached data on failed, partial, or expired authorization attempts.
 *   6. Does not advance lastSuccessfulSync on incomplete or unavailable activity refreshes.
 */

import crypto from 'crypto';
import Profile from '../models/Profile.js';
import AuditLog from '../models/AuditLog.js';
import { normalizeLinkedInInput, fetchLinkedInProfile } from './providers/linkedinProvider.js';
import { canonicalJSON, sha256 } from './scorePersistence.js';

/**
 * Synchronizes or verifies LinkedIn profile connection for a given student user.
 *
 * @param {string|mongoose.Types.ObjectId} userId - The user ID
 * @param {object} [options={}] - Execution options (milestoneEventId, accessToken, fetchImpl, etc.)
 * @returns {Promise<object>} The updated Profile document
 */
export async function syncLinkedinProfile(userId, options = {}) {
  const profile = await Profile.findOne({ userId });
  if (!profile) {
    const err = new Error('Student profile not found');
    err.statusCode = 404;
    throw err;
  }

  // Verify connection candidate exists
  const existingHandle = profile.codingStats?.profiles?.linkedin;
  const existingUrl = profile.socialLinks?.linkedin;
  const inputCandidate = options.username || options.profileUrl || existingHandle || existingUrl;

  if (!inputCandidate) {
    const err = new Error('LinkedIn profile is not linked in profile');
    err.statusCode = 400;
    throw err;
  }

  // Ensure subdocuments exist
  if (!profile.platformSyncStates) profile.platformSyncStates = {};
  if (!profile.platformSyncStates.linkedin) profile.platformSyncStates.linkedin = {};
  if (!profile.codingStats) profile.codingStats = {};
  if (!profile.codingStats.rawMetrics) profile.codingStats.rawMetrics = {};
  if (!profile.socialLinks) profile.socialLinks = {};
  if (!profile.codingStats.profiles) profile.codingStats.profiles = {};

  // 1. Establish durable milestoneEventId at logical job boundary
  let milestoneEventId = options.milestoneEventId || options.eventId || options.jobId || options.deliveryId;

  if (!milestoneEventId) {
    if (profile.platformSyncStates.linkedin.activeMilestoneEventId) {
      milestoneEventId = profile.platformSyncStates.linkedin.activeMilestoneEventId;
    } else {
      milestoneEventId = `sync_li_${userId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      profile.platformSyncStates.linkedin.activeMilestoneEventId = milestoneEventId;
      profile.platformSyncStates.linkedin.syncStatus = 'SYNCING';
      profile.platformSyncStates.linkedin.lastSyncAttempt = new Date();
      await profile.save();
    }
  } else if (profile.platformSyncStates.linkedin.activeMilestoneEventId !== milestoneEventId) {
    profile.platformSyncStates.linkedin.activeMilestoneEventId = milestoneEventId;
    profile.platformSyncStates.linkedin.syncStatus = 'SYNCING';
    profile.platformSyncStates.linkedin.lastSyncAttempt = new Date();
    await profile.save();
  }

  const now = new Date();
  const priorMetrics = profile.codingStats.rawMetrics.linkedin || {};
  const priorUrl = profile.socialLinks.linkedin;
  const priorHandle = profile.codingStats.profiles.linkedin;

  try {
    // 2. Normalize profile URL and handle
    const normalized = normalizeLinkedInInput(inputCandidate);

    let fetchResult = null;
    let syncStatus = 'UNAVAILABLE';
    let activityMetricsAvailable = false;
    let followers = null;
    let connections = null;
    let scopeGranted = ['openid', 'profile', 'email'];
    let reason = 'Activity and engagement metrics unavailable under current approved permissions';

    // 3. If an access token is provided or configured, attempt provider fetch
    const accessToken = options.accessToken || process.env.LINKEDIN_ACCESS_TOKEN;
    if (accessToken) {
      try {
        fetchResult = await fetchLinkedInProfile(accessToken, options);
        scopeGranted = fetchResult.scopeGranted;
        activityMetricsAvailable = fetchResult.activityMetricsAvailable;
        followers = fetchResult.followers;
        connections = fetchResult.connections;

        if (activityMetricsAvailable) {
          syncStatus = 'SUCCESS';
          reason = null;
        } else {
          syncStatus = 'PARTIAL';
          reason = fetchResult.reason;
        }
      } catch (providerErr) {
        // Map provider error code to syncStatus
        if (providerErr.code === 'AUTH_EXPIRED') {
          syncStatus = 'AUTH_EXPIRED';
        } else if (providerErr.code === 'RATE_LIMITED') {
          syncStatus = 'RATE_LIMITED';
        } else if (providerErr.code === 'INSUFFICIENT_SCOPE') {
          syncStatus = 'UNAVAILABLE';
        } else {
          syncStatus = 'ERROR';
        }

        profile.platformSyncStates.linkedin.syncStatus = syncStatus;
        profile.platformSyncStates.linkedin.error = providerErr.message;
        profile.platformSyncStates.linkedin.lastSyncAttempt = now;
        profile.platformSyncStates.linkedin.consecutiveFailures =
          (profile.platformSyncStates.linkedin.consecutiveFailures || 0) + 1;

        // Preserve previously valid data on error
        if (priorUrl) profile.socialLinks.linkedin = priorUrl;
        if (priorHandle) profile.codingStats.profiles.linkedin = priorHandle;

        await profile.save();
        throw providerErr;
      }
    }

    // 4. Update data and caching structures
    const identityVerified = Boolean(fetchResult && fetchResult.memberId);
    if (!fetchResult) {
      reason = 'User-provided profile reference. OAuth identity verification and activity metrics are unavailable.';
    }

    const evidencePayload = {
      profileUrl: normalized.profileUrl,
      vanityName: normalized.vanityName,
      identityVerified,
      followers,
      connections,
      activityMetricsAvailable,
    };
    const dataHash = sha256(canonicalJSON(evidencePayload));

    // Update connection status and valid links
    profile.platformSyncStates.linkedin.connectionStatus = 'LINKED';
    profile.platformSyncStates.linkedin.syncStatus = syncStatus;
    profile.platformSyncStates.linkedin.lastSyncAttempt = now;
    if (identityVerified) {
      profile.platformSyncStates.linkedin.lastVerifiedAt = now;
    }
    profile.platformSyncStates.linkedin.dataHash = dataHash;
    profile.platformSyncStates.linkedin.error = reason;
    profile.platformSyncStates.linkedin.consecutiveFailures = 0;

    // Advance lastSuccessfulSync ONLY on legitimate complete success with verified metrics
    if (syncStatus === 'SUCCESS') {
      profile.platformSyncStates.linkedin.lastSuccessfulSync = now;
    }

    // Update profile identity and raw metrics
    profile.socialLinks.linkedin = normalized.profileUrl;
    profile.codingStats.profiles.linkedin = normalized.vanityName;
    profile.codingStats.linkedInConnected = true;

    profile.codingStats.rawMetrics.linkedin = {
      profileUrl: normalized.profileUrl,
      vanityName: normalized.vanityName,
      memberId: fetchResult?.memberId || priorMetrics.memberId || null,
      identityVerified,
      followers,
      connections,
      activityMetricsAvailable,
      scopeGranted,
      reason,
    };

    // Platform details Map / object
    const platformDetail = {
      username: normalized.vanityName,
      profileUrl: normalized.profileUrl,
      syncMode: 'linked',
      note: identityVerified
        ? 'LinkedIn profile verified via OAuth. Activity metrics unavailable under current approved permissions.'
        : 'User-provided LinkedIn profile reference. Identity and activity metrics are unverified by OAuth provider.',
      syncedAt: now,
      connectionStatus: 'LINKED',
      syncStatus,
      identityVerified,
    };

    if (profile.codingStats.platformDetails instanceof Map) {
      profile.codingStats.platformDetails.set('linkedin', platformDetail);
    } else {
      if (!profile.codingStats.platformDetails) profile.codingStats.platformDetails = {};
      profile.codingStats.platformDetails.linkedin = platformDetail;
    }

    // 5. Clean up durable milestone event ID upon successful completion
    profile.platformSyncStates.linkedin.activeMilestoneEventId = null;

    // 6. Zero scoring effect guarantee:
    // Neither Developer Score v3 nor Placement Readiness v2 formulas are called or modified.
    // Existing scores and historical metadata are completely preserved.

    await profile.save();

    // Record audit event
    await AuditLog.create({
      action: 'LINKEDIN_SYNC_COMPLETED',
      performedBy: userId,
      role: 'student',
      targetModel: 'User',
      targetId: userId,
      details: {
        connectionStatus: 'LINKED',
        syncStatus,
        activityMetricsAvailable,
        vanityName: normalized.vanityName,
        milestoneEventId,
      },
    }).catch((err) => console.warn('[linkedinSync] AuditLog create failed:', err.message));

    return profile;
  } catch (err) {
    // If error was thrown by provider, let it bubble after state preservation
    throw err;
  }
}
