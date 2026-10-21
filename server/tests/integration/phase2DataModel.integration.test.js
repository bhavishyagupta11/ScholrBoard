import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Profile from '../../models/Profile.js';
import User from '../../models/User.js';
import Activity from '../../models/Activity.js';
import { validateIntegrationTestDatabaseUri } from '../helpers/testDatabaseGuard.js';

dotenv.config();
process.env.NODE_ENV = 'test';

const testUri = process.env.MONGODB_URI_TEST;
validateIntegrationTestDatabaseUri(testUri);

let testUser = null;
let testProfile = null;
let testActivity = null;

before(async () => {
  await mongoose.connect(testUri, { serverSelectionTimeoutMS: 15000 });

  testUser = await User.create({
    name: 'Phase 2 Test Student',
    email: `phase2.student.${Date.now()}@scholrboard.test`,
    password: 'Password123!',
    role: 'student',
  });
});

after(async () => {
  if (testUser) {
    await Profile.collection.deleteMany({ userId: testUser._id });
    await Activity.collection.deleteMany({ userId: testUser._id });
    await User.collection.deleteOne({ _id: testUser._id });
  }
  await mongoose.disconnect();
});

test('Integration 2.1: Real MongoDB persistence of dynamic GitHub contribution calendar and platform sync states', async () => {
  const sampleWeeks = [
    {
      contributionDays: [
        {
          date: '2026-03-01',
          contributionCount: 3,
          contributionLevel: 'FIRST_QUARTILE',
          color: '#9be9a8',
          weekday: 0,
        },
        {
          date: '2026-03-02',
          contributionCount: 8,
          contributionLevel: 'THIRD_QUARTILE',
          color: '#30a14e',
          weekday: 1,
        },
      ],
    },
  ];

  const now = new Date();

  testProfile = await Profile.create({
    userId: testUser._id,
    bio: 'Profile with extended Phase 2 data model fields',
    platformSyncStates: {
      github: {
        syncStatus: 'SYNCED',
        lastSuccessfulSync: now,
        calendarLastSuccessfulSync: now,
        calendarSyncError: null,
        dataHash: 'test_hash_gh_123',
      },
      leetcode: {
        syncStatus: 'PARTIAL',
        error: 'Contest history unavailable',
      },
    },
    githubContributionCalendar: {
      source: 'github_graphql',
      calendarTotalContributions: 11,
      restrictedContributionsCount: 2,
      hasAnyRestrictedContributions: true,
      weeks: sampleWeeks,
      currentStreak: 2,
      longestStreak: 5,
      totalCommitContributions: 9,
      totalPullRequestContributions: 2,
      totalIssueContributions: 0,
      fetchedAt: now,
      lastSuccessfulSync: now,
      syncStatus: 'SYNCED',
    },
    developerScoreMeta: {
      score: 75,
      coverage: 80,
      confidence: 'High',
      freshness: 'Fresh',
      lastVerifiedAt: now,
    },
    placementReadinessMeta: {
      score: 68,
      coverage: 70,
      confidence: 'Medium',
      freshness: 'Fresh',
      lastVerifiedAt: now,
    },
  });

  // Re-fetch from MongoDB to verify round-trip persistence
  const fetched = await Profile.findById(testProfile._id).lean();

  assert.ok(fetched);
  assert.equal(fetched.platformSyncStates.github.syncStatus, 'SYNCED');
  assert.equal(fetched.platformSyncStates.github.calendarSyncError, null);
  assert.equal(fetched.platformSyncStates.github.dataHash, 'test_hash_gh_123');
  assert.equal(fetched.platformSyncStates.leetcode.syncStatus, 'PARTIAL');

  // Verify dynamic weeks and GraphQL contributionDays
  assert.equal(fetched.githubContributionCalendar.weeks.length, 1);
  assert.equal(fetched.githubContributionCalendar.weeks[0].contributionDays.length, 2);
  assert.equal(fetched.githubContributionCalendar.weeks[0].contributionDays[0].date, '2026-03-01');
  assert.equal(fetched.githubContributionCalendar.weeks[0].contributionDays[0].contributionLevel, 'FIRST_QUARTILE');
  assert.equal(fetched.githubContributionCalendar.weeks[0].contributionDays[0].color, '#9be9a8');
  assert.equal(fetched.githubContributionCalendar.weeks[0].contributionDays[0].contributionCount, 3);
  assert.equal(fetched.githubContributionCalendar.weeks[0].contributionDays[1].contributionCount, 8);
  assert.equal(fetched.githubContributionCalendar.restrictedContributionsCount, 2);
  assert.equal(fetched.githubContributionCalendar.hasAnyRestrictedContributions, true);

  // Verify raw metrics preserves null (absence of evidence is not 0)
  assert.equal(fetched.codingStats.rawMetrics.github.mergedPRsCount, null);
  assert.equal(fetched.codingStats.rawMetrics.github.activeDaysLast365, null);
  assert.equal(fetched.codingStats.rawMetrics.leetcode.lastActivityDate, null);
  assert.equal(fetched.codingStats.rawMetrics.codeforces.contestsParticipated, null);

  // Verify lastVerifiedAt
  assert.ok(fetched.developerScoreMeta.lastVerifiedAt);
  assert.ok(fetched.placementReadinessMeta.lastVerifiedAt);
});

test('Integration 2.2: Real MongoDB persistence and indexing of Activity externalId and GitHub URLs', async () => {
  testActivity = await Activity.create({
    userId: testUser._id,
    title: 'Closed critical open source vulnerability PR',
    category: 'Technical',
    activityDate: new Date('2026-04-10'),
    githubPRUrl: 'https://github.com/scholrboard/v2/pull/101',
    githubRepoUrl: 'https://github.com/scholrboard/v2',
    externalId: 'ext_pr_101',
  });

  const fetchedActivity = await Activity.findOne({ externalId: 'ext_pr_101' }).lean();
  assert.ok(fetchedActivity);
  assert.equal(fetchedActivity.title, 'Closed critical open source vulnerability PR');
  assert.equal(fetchedActivity.githubPRUrl, 'https://github.com/scholrboard/v2/pull/101');
  assert.equal(fetchedActivity.githubRepoUrl, 'https://github.com/scholrboard/v2');
  assert.equal(fetchedActivity.externalId, 'ext_pr_101');
});

test('Integration 2.3: Codeforces confirmed zero contests is distinguishable from missing and error states', async () => {
  // 1. Missing state: contestsParticipated is null
  const missingProfile = await Profile.create({
    userId: new mongoose.Types.ObjectId(),
    'codingStats.rawMetrics.codeforces': {
      rating: 0,
      contestsParticipated: null,
    },
    'platformSyncStates.codeforces': {
      syncStatus: 'NOT_CONNECTED',
    },
  });
  const fetchedMissing = await Profile.findById(missingProfile._id).lean();
  assert.equal(fetchedMissing.codingStats.rawMetrics.codeforces.contestsParticipated, null);
  await Profile.collection.deleteOne({ _id: missingProfile._id });

  // 2. Confirmed zero state: contestsParticipated is 0
  const zeroProfile = await Profile.create({
    userId: new mongoose.Types.ObjectId(),
    'codingStats.rawMetrics.codeforces': {
      rating: 0,
      contestsParticipated: 0,
    },
    'platformSyncStates.codeforces': {
      syncStatus: 'SYNCED',
    },
  });
  const fetchedZero = await Profile.findById(zeroProfile._id).lean();
  assert.equal(fetchedZero.codingStats.rawMetrics.codeforces.contestsParticipated, 0);
  assert.notEqual(
    fetchedZero.codingStats.rawMetrics.codeforces.contestsParticipated,
    fetchedMissing.codingStats.rawMetrics.codeforces.contestsParticipated
  );
  await Profile.collection.deleteOne({ _id: zeroProfile._id });

  // 3. Rate-limited/failed state retains valid metrics
  const errorProfile = await Profile.create({
    userId: new mongoose.Types.ObjectId(),
    'codingStats.rawMetrics.codeforces': {
      rating: 1550,
      contestsParticipated: 8,
    },
    'platformSyncStates.codeforces': {
      syncStatus: 'RATE_LIMITED',
      error: 'Codeforces API rate limit exceeded',
    },
  });
  const fetchedError = await Profile.findById(errorProfile._id).lean();
  // Valid metrics retained
  assert.equal(fetchedError.codingStats.rawMetrics.codeforces.rating, 1550);
  assert.equal(fetchedError.codingStats.rawMetrics.codeforces.contestsParticipated, 8);
  assert.equal(fetchedError.platformSyncStates.codeforces.syncStatus, 'RATE_LIMITED');
  await Profile.collection.deleteOne({ _id: errorProfile._id });
});
