import crypto from 'crypto';
import Profile from '../models/Profile.js';
import Activity from '../models/Activity.js';
import AuditLog from '../models/AuditLog.js';
import { fetchGithubMetrics } from './providers/githubProvider.js';
import { recalculateAndSaveScore } from './developerScoringService.js';
import { canonicalJSON, sha256 } from './scorePersistence.js';

/**
 * Synchronizes GitHub metrics for a user.
 * Establishes durable milestoneEventId at the logical job boundary and reuses it across retries.
 * Persists contribution calendar, verified PR and issue metrics, handles partial-sync states,
 * and upserts qualified PRs into Activity collection.
 */
export const syncGithubProfile = async (userId, options = {}) => {
  const startTime = Date.now();
  const profile = await Profile.findOne({ userId });
  if (!profile) {
    throw new Error('Student profile not found');
  }

  const username = profile.codingStats?.profiles?.github;
  if (!username) {
    throw new Error('GitHub handle is not linked in profile');
  }

  // 1. Establish durable milestoneEventId at logical job boundary.
  if (!profile.platformSyncStates) profile.platformSyncStates = {};
  if (!profile.platformSyncStates.github) profile.platformSyncStates.github = {};

  let milestoneEventId = options.milestoneEventId || options.eventId || options.jobId || options.deliveryId;

  if (!milestoneEventId) {
    if (profile.platformSyncStates.github.activeMilestoneEventId) {
      milestoneEventId = profile.platformSyncStates.github.activeMilestoneEventId;
    } else {
      milestoneEventId = `sync_gh_${userId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      profile.platformSyncStates.github.activeMilestoneEventId = milestoneEventId;
      profile.platformSyncStates.github.syncStatus = 'SYNCING';
      profile.platformSyncStates.github.lastSyncAttempt = new Date();
      await profile.save();
    }
  } else if (profile.platformSyncStates.github.activeMilestoneEventId !== milestoneEventId) {
    profile.platformSyncStates.github.activeMilestoneEventId = milestoneEventId;
    profile.platformSyncStates.github.syncStatus = 'SYNCING';
    profile.platformSyncStates.github.lastSyncAttempt = new Date();
    await profile.save();
  }

  // Capture baseEvaluationRevision before scoring starts
  const baseEvaluationRevision = options.baseEvaluationRevision ?? profile.developerScoreMeta?.evaluationRevision ?? 0;

  const oldScore = profile.developerScore || 0;
  const oldDataHash = profile.platformSyncStates?.github?.dataHash || null;

  try {
    // 2. Fetch metrics from provider (REST + GraphQL)
    const metrics = await fetchGithubMetrics(username);

    // Compute evidence data hash
    const newDataHash = sha256(canonicalJSON(metrics));
    const now = new Date();

    // 3. Update profile metrics and caching metadata
    let syncStatus = 'SYNCED';
    let calendarSyncError = null;

    const previousGithubMetrics = profile.codingStats?.rawMetrics?.github || {};

    // Check if PR/issue fetch failed or was incomplete (e.g. pagination ceiling exceeded or rate limit)
    if (metrics.prsError) {
      syncStatus = 'PARTIAL';
      // Preserve prior valid PR and issue metrics
      if (previousGithubMetrics.qualifiedMergedPRsCount !== undefined && previousGithubMetrics.qualifiedMergedPRsCount !== null) {
        metrics.mergedPRsCount = previousGithubMetrics.mergedPRsCount;
        metrics.qualifiedMergedPRsCount = previousGithubMetrics.qualifiedMergedPRsCount;
        metrics.issuesCount = previousGithubMetrics.issuesCount;
        metrics.qualifiedIssuesCount = previousGithubMetrics.qualifiedIssuesCount;
        metrics.prsAndIssues = previousGithubMetrics.prsAndIssues;
      }
    }

    if (metrics.calendarError) {
      syncStatus = 'PARTIAL';
      // Preserve prior valid active days if current calendar fetch failed
      if (previousGithubMetrics.activeDaysLast365 !== undefined && previousGithubMetrics.activeDaysLast365 !== null) {
        metrics.activeDaysLast365 = previousGithubMetrics.activeDaysLast365;
      }
    }

    profile.codingStats.rawMetrics.github = metrics;
    profile.codingStats.githubRepos = metrics.publicRepos ?? 0;
    profile.codingStats.githubFollowers = metrics.followers ?? 0;
    profile.codingStats.githubLastSyncedAt = now;
    profile.codingStats.lastSyncedAt = now;

    if (metrics.calendar) {
      // GraphQL calendar succeeded
      profile.githubContributionCalendar = {
        source: 'github_graphql',
        calendarTotalContributions: metrics.calendar.calendarTotalContributions ?? 0,
        restrictedContributionsCount: metrics.calendar.restrictedContributionsCount ?? 0,
        hasAnyRestrictedContributions: Boolean(metrics.calendar.hasAnyRestrictedContributions),
        weeks: metrics.calendar.weeks ?? [],
        currentStreak: metrics.calendar.currentStreak ?? 0,
        longestStreak: metrics.calendar.longestStreak ?? 0,
        totalCommitContributions: metrics.calendar.totalCommitContributions ?? 0,
        totalPullRequestContributions: metrics.calendar.totalPullRequestContributions ?? 0,
        totalIssueContributions: metrics.calendar.totalIssueContributions ?? 0,
        fetchedAt: now,
        lastSuccessfulSync: now,
        syncStatus: 'SYNCED',
        syncError: null,
      };
      profile.codingStats.githubContributions = metrics.calendar.calendarTotalContributions ?? 0;
      profile.platformSyncStates.github.calendarLastSuccessfulSync = now;
      profile.platformSyncStates.github.calendarSyncError = null;
    } else {
      // REST succeeded, but GraphQL calendar failed -> PARTIAL state (V13 Part 10.5)
      syncStatus = 'PARTIAL';
      calendarSyncError = metrics.calendarError || 'GraphQL calendar fetch unavailable';
      profile.platformSyncStates.github.calendarSyncError = calendarSyncError;

      if (profile.githubContributionCalendar && Array.isArray(profile.githubContributionCalendar.weeks) && profile.githubContributionCalendar.weeks.length > 0) {
        // Retain prior cached calendar, mark as STALE
        profile.githubContributionCalendar.syncStatus = 'STALE';
        profile.githubContributionCalendar.syncError = calendarSyncError;
      } else {
        // No prior calendar data
        profile.githubContributionCalendar = {
          source: 'github_graphql',
          calendarTotalContributions: 0,
          restrictedContributionsCount: 0,
          hasAnyRestrictedContributions: false,
          weeks: [],
          currentStreak: 0,
          longestStreak: 0,
          totalCommitContributions: 0,
          totalPullRequestContributions: 0,
          totalIssueContributions: 0,
          fetchedAt: null,
          lastSuccessfulSync: null,
          syncStatus: 'UNAVAILABLE',
          syncError: calendarSyncError,
        };
      }
    }

    const combinedSyncError = [calendarSyncError, metrics.prsError].filter(Boolean).join('; ') || null;

    profile.lastSyncStatus = 'success';
    profile.lastSyncError = combinedSyncError;
    profile.consecutiveSyncFailures = 0;

    if (syncStatus === 'SYNCED') {
      profile.platformSyncStates.github.syncStatus = 'SYNCED';
      profile.platformSyncStates.github.activeMilestoneEventId = milestoneEventId;
      profile.platformSyncStates.github.lastSyncAttempt = now;
      profile.platformSyncStates.github.lastSuccessfulSync = now;
      profile.platformSyncStates.github.lastVerifiedAt = now;
      profile.platformSyncStates.github.sourceDataUpdatedAt = metrics.sourceDataUpdatedAt ? new Date(metrics.sourceDataUpdatedAt) : now;
      profile.platformSyncStates.github.dataHash = newDataHash;
      profile.platformSyncStates.github.error = null;
      profile.platformSyncStates.github.consecutiveFailures = 0;
    } else {
      // Partial/incomplete sync: record PARTIAL status and do not refresh lastSuccessfulSync
      profile.platformSyncStates.github.syncStatus = 'PARTIAL';
      profile.platformSyncStates.github.activeMilestoneEventId = milestoneEventId;
      profile.platformSyncStates.github.lastSyncAttempt = now;
      profile.platformSyncStates.github.sourceDataUpdatedAt = metrics.sourceDataUpdatedAt ? new Date(metrics.sourceDataUpdatedAt) : now;
      profile.platformSyncStates.github.dataHash = newDataHash;
      profile.platformSyncStates.github.error = combinedSyncError;
    }

    // Save profile state before external activity upserts and score recalculation
    await profile.save();

    // 4. Upsert qualified PRs into Activity collection (V13 Part 26.2 & 27 Phase 3)
    // Only perform activity upserts when PR fetch was completely successful (no prsError)
    if (!metrics.prsError && Array.isArray(metrics.prsAndIssues?.qualifiedPRNodes) && metrics.prsAndIssues.qualifiedPRNodes.length > 0) {
      for (const pr of metrics.prsAndIssues.qualifiedPRNodes) {
        if (!pr) continue;
        const externalId = `gh_pr_${pr.id || pr.number}`;
        try {
          await Activity.findOneAndUpdate(
            { userId: profile.userId, externalId },
            {
              $set: {
                title: pr.title ? String(pr.title).slice(0, 200) : 'Merged Pull Request',
                description: pr.body ? String(pr.body).slice(0, 2000) : 'Verified merged pull request on GitHub',
                category: 'Technical',
                subCategory: 'Open Source Contribution',
                activityDate: pr.mergedAt ? new Date(pr.mergedAt) : now,
                githubPRUrl: pr.url || null,
                githubRepoUrl: pr.repository?.url || null,
                status: 'Approved',
                isArchived: false,
              },
              $setOnInsert: {
                userId: profile.userId,
                points: 10,
              },
            },
            { upsert: true, new: true }
          );
        } catch (actErr) {
          console.warn(`[githubSync] Failed to upsert activity for PR ${externalId}:`, actErr.message);
        }
      }
    }

    // 5. Recalculate scoring passing durable milestoneEventId and evidence hashes
    const updatedProfile = await recalculateAndSaveScore(profile._id, 'GitHub profile sync', {
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
      $set: { 'platformSyncStates.github.activeMilestoneEventId': null }
    });
    if (updatedProfile?.platformSyncStates?.github) {
      updatedProfile.platformSyncStates.github.activeMilestoneEventId = null;
    }

    const newScore = updatedProfile.developerScore || 0;
    const scoreDelta = newScore - oldScore;

    // 6. Create AuditLog
    await AuditLog.create({
      action: 'github_sync',
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
    const isRateLimit = String(err.message || '').toLowerCase().includes('rate limit');
    const isAuthExpired = String(err.message || '').toLowerCase().includes('authentication failed');

    profile.lastSyncStatus = 'failed';
    profile.lastSyncError = String(err.message || err);
    profile.consecutiveSyncFailures = (profile.consecutiveSyncFailures || 0) + 1;
    profile.lastFailedSyncAt = now;
    profile.codingStats.lastUpdated = now;

    if (!profile.platformSyncStates) profile.platformSyncStates = {};
    if (!profile.platformSyncStates.github) profile.platformSyncStates.github = {};
    
    profile.platformSyncStates.github.syncStatus = isRateLimit ? 'RATE_LIMITED' : (isAuthExpired ? 'AUTH_EXPIRED' : 'ERROR');
    profile.platformSyncStates.github.lastSyncAttempt = now;
    profile.platformSyncStates.github.error = String(err.message || err);
    profile.platformSyncStates.github.consecutiveFailures = profile.consecutiveSyncFailures;
    profile.platformSyncStates.github.activeMilestoneEventId = milestoneEventId;

    await profile.save();

    await AuditLog.create({
      action: 'github_sync',
      performedBy: userId,
      role: 'student',
      targetModel: 'User',
      targetId: userId,
      details: {
        success: false,
        username,
        milestoneEventId,
        error: String(err.message || err),
        durationMs: Date.now() - startTime,
      }
    });

    throw err;
  }
};

