import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Profile from '../../models/Profile.js';
import Activity from '../../models/Activity.js';
import ScoreHistory from '../../models/ScoreHistory.js';
import GpaScaleAuditLog from '../../models/GpaScaleAuditLog.js';
import { calculateCpScore, calculateUnifiedScore } from '../../services/developerScoringService.js';

test('Phase 2.1: Profile schema instantiates with all additive V13 fields without errors', () => {
  const dummyUserId = new mongoose.Types.ObjectId();
  const profile = new Profile({
    userId: dummyUserId,
  });

  // 1. Per-platform sync states
  assert.ok(profile.platformSyncStates);
  assert.equal(profile.platformSyncStates.github.syncStatus, 'NOT_CONNECTED');
  assert.equal(profile.platformSyncStates.github.calendarLastSuccessfulSync, null);
  assert.equal(profile.platformSyncStates.github.calendarSyncError, null);
  assert.equal(profile.platformSyncStates.github.dataHash, null);
  assert.equal(profile.platformSyncStates.leetcode.syncStatus, 'NOT_CONNECTED');
  assert.equal(profile.platformSyncStates.codeforces.syncStatus, 'NOT_CONNECTED');
  assert.equal(profile.platformSyncStates.resume.syncStatus, 'NOT_CONNECTED');

  // 2. GitHub contribution calendar
  assert.ok(profile.githubContributionCalendar);
  assert.equal(profile.githubContributionCalendar.source, 'github_graphql');
  assert.equal(profile.githubContributionCalendar.calendarTotalContributions, 0);
  assert.equal(profile.githubContributionCalendar.restrictedContributionsCount, 0);
  assert.equal(profile.githubContributionCalendar.hasAnyRestrictedContributions, false);
  assert.deepEqual(profile.githubContributionCalendar.weeks, []);
  assert.equal(profile.githubContributionCalendar.syncStatus, 'NOT_CONNECTED');

  // 3. Raw metrics - preserves null for missing/unverified metrics
  assert.ok(profile.codingStats.rawMetrics.github);
  assert.equal(profile.codingStats.rawMetrics.github.mergedPRsCount, null);
  assert.equal(profile.codingStats.rawMetrics.github.qualifiedMergedPRsCount, null);
  assert.equal(profile.codingStats.rawMetrics.github.issuesCount, null);
  assert.equal(profile.codingStats.rawMetrics.github.qualifiedIssuesCount, null);
  assert.equal(profile.codingStats.rawMetrics.github.activeDaysLast365, null);
  assert.equal(profile.codingStats.rawMetrics.github.recentlyActiveRepos, null);

  assert.ok(profile.codingStats.rawMetrics.leetcode);
  assert.equal(profile.codingStats.rawMetrics.leetcode.lastActivityDate, null);
  assert.equal(profile.codingStats.rawMetrics.leetcode.submissionCalendarRaw, null);
  assert.equal(profile.codingStats.rawMetrics.leetcode.activeSubmitDays30d, null);
  assert.equal(profile.codingStats.rawMetrics.leetcode.recencyLevel, null);

  // Codeforces contestsParticipated defaults strictly to null when unknown
  assert.ok(profile.codingStats.rawMetrics.codeforces);
  assert.equal(profile.codingStats.rawMetrics.codeforces.contestsParticipated, null);

  // 4. Scoring metadata - includes lastVerifiedAt
  assert.equal(profile.developerScoreMeta.lastVerifiedAt, null);
  assert.equal(profile.placementReadinessMeta.lastVerifiedAt, null);

  // 5. Scoring lock & legacy placement
  assert.ok(profile.scoringLock);
  assert.equal(profile.scoringLock.developer.lockedAt, null);
  assert.equal(profile.scoringLock.placementReadiness.lockedAt, null);
  assert.ok(profile.placementReadinessLegacy);
  assert.equal(profile.placementReadinessLegacy.score, null);
});

test('Phase 2.2: Profile stores GitHub calendar matching GraphQL weeks[].contributionDays[] structure', () => {
  const dummyUserId = new mongoose.Types.ObjectId();
  const testWeeks = [
    {
      contributionDays: [
        {
          date: '2026-01-01',
          contributionCount: 5,
          contributionLevel: 'SECOND_QUARTILE',
          color: '#40c463',
          weekday: 4,
        },
      ],
    },
  ];

  const profile = new Profile({
    userId: dummyUserId,
    githubContributionCalendar: {
      weeks: testWeeks,
      calendarTotalContributions: 5,
    },
  });

  assert.equal(profile.githubContributionCalendar.weeks.length, 1);
  const day = profile.githubContributionCalendar.weeks[0].contributionDays[0];
  assert.equal(day.date, '2026-01-01');
  assert.equal(day.contributionCount, 5);
  assert.equal(day.contributionLevel, 'SECOND_QUARTILE');
  assert.equal(day.color, '#40c463');
  assert.equal(day.weekday, 4);
  assert.equal(profile.githubContributionCalendar.calendarTotalContributions, 5);
});

test('Phase 2.3: Activity schema supports githubPRUrl, githubRepoUrl, and externalId', () => {
  const dummyUserId = new mongoose.Types.ObjectId();
  const activity = new Activity({
    userId: dummyUserId,
    title: 'Implemented Feature X Pull Request',
    category: 'Technical',
    activityDate: new Date('2026-05-15'),
    githubPRUrl: 'https://github.com/org/repo/pull/42',
    githubRepoUrl: 'https://github.com/org/repo',
    externalId: 'gh_pr_12345678',
  });

  assert.equal(activity.githubPRUrl, 'https://github.com/org/repo/pull/42');
  assert.equal(activity.githubRepoUrl, 'https://github.com/org/repo');
  assert.equal(activity.externalId, 'gh_pr_12345678');
});

test('Phase 2.4: ScoreHistory and GpaScaleAuditLog models instantiate cleanly', () => {
  assert.ok(ScoreHistory.modelName, 'ScoreHistory');
  assert.ok(GpaScaleAuditLog.modelName, 'GpaScaleAuditLog');
});

test('Phase 2.5: Codeforces missing-vs-zero distinction and downstream scoring protection', () => {
  // Case A: Confirmed Zero Contests (contestsParticipated === 0)
  // Per V13 Part 6.2 D: cpScore is null, excluded from denominator (benefit of doubt; no penalty)
  const zeroContestsResult = calculateCpScore({
    rating: 0,
    maxRating: 0,
    contestsParticipated: 0,
  });
  assert.equal(zeroContestsResult, null);

  // Case B: Missing / Unknown Data (contestsParticipated === null)
  // Downstream scoring must NEVER interpret null as confirmed 0 contests
  const missingContestsResult = calculateCpScore({
    rating: 0,
    maxRating: 0,
    contestsParticipated: null,
  });
  assert.equal(missingContestsResult, null);

  // Case C: Valid Active Contests (contestsParticipated > 0)
  const activeContestsResult = calculateCpScore({
    rating: 1400,
    maxRating: 1500,
    contestsParticipated: 10,
    lastContestAt: new Date(),
  });
  assert.equal(typeof activeContestsResult, 'number');
  assert.equal(activeContestsResult > 0, true);

  // Verify calculateUnifiedScore dynamically normalizes weights when Codeforces data is missing or confirmed 0:
  // A student with only GitHub (score: 80) and LeetCode (score: 90) linked must NOT be penalized by Codeforces being missing/0
  const profileWithMissingCf = {
    githubScore: 80,
    dsaScore: 90,
    codingStats: {
      profiles: {
        github: 'octocat',
        leetcode: 'tourist',
        codeforces: 'tourist',
      },
      rawMetrics: {
        codeforces: {
          rating: 0,
          contestsParticipated: null, // missing data
        },
      },
    },
  };

  const scoreMissing = calculateUnifiedScore(profileWithMissingCf);
  // Codeforces weight should be excluded from denominator (breakdown.cpWeight === 0)
  assert.equal(scoreMissing.breakdown.cpWeight, 0);
  // Score should be normalized over GitHub (0.30) and LeetCode (0.35) only:
  // sum = 80*0.30 + 90*0.35 = 24 + 31.5 = 55.5; den = 0.65; score = 55.5 / 0.65 = 85.38 -> 85
  assert.equal(scoreMissing.score, 85);

  // Confirmed zero contests must also NOT reduce the student's score
  const profileWithZeroContests = {
    ...profileWithMissingCf,
    codingStats: {
      ...profileWithMissingCf.codingStats,
      rawMetrics: {
        codeforces: {
          rating: 0,
          contestsParticipated: 0, // confirmed zero
        },
      },
    },
  };

  const scoreZero = calculateUnifiedScore(profileWithZeroContests);
  assert.equal(scoreZero.breakdown.cpWeight, 0);
  assert.equal(scoreZero.score, 85);
});
