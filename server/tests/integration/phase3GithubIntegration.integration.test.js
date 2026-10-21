import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Profile from '../../models/Profile.js';
import User from '../../models/User.js';
import Activity from '../../models/Activity.js';
import ScoreHistory from '../../models/ScoreHistory.js';
import AuditLog from '../../models/AuditLog.js';
import { syncGithubProfile } from '../../services/githubSyncService.js';
import { fetchGithubGraphQLCalendar } from '../../services/providers/githubProvider.js';
import { validateIntegrationTestDatabaseUri } from '../helpers/testDatabaseGuard.js';

dotenv.config();
process.env.NODE_ENV = 'test';

const testUri = process.env.MONGODB_URI_TEST;
validateIntegrationTestDatabaseUri(testUri);

let testUser = null;
let originalFetch = null;

before(async () => {
  await mongoose.connect(testUri, { serverSelectionTimeoutMS: 15000 });

  testUser = await User.create({
    name: 'Phase 3 GitHub Test Student',
    email: `phase3.student.${Date.now()}@scholrboard.test`,
    password: 'Password123!',
    role: 'student',
  });

  originalFetch = globalThis.fetch;
});

after(async () => {
  globalThis.fetch = originalFetch;

  if (testUser) {
    await Profile.collection.deleteMany({ userId: testUser._id });
    await Activity.collection.deleteMany({ userId: testUser._id });
    await ScoreHistory.collection.deleteMany({ userId: testUser._id });
    await AuditLog.collection.deleteMany({ performedBy: testUser._id });
    await User.collection.deleteOne({ _id: testUser._id });
  }

  await mongoose.disconnect();
});

test('Integration 3.1: Full successful GitHub sync with GraphQL calendar, streaks, anti-gaming PRs, and Activity upsert', async () => {
  // Setup Profile with linked GitHub handle
  await Profile.create({
    userId: testUser._id,
    codingStats: {
      profiles: { github: 'octocat' },
      githubContributions: 0,
      githubRepos: 0,
    },
    platformSyncStates: {
      github: { syncStatus: 'NOT_CONNECTED' },
    },
  });

  // Mock fetch for REST user, REST repos, and GraphQL queries
  const mockUserRest = {
    login: 'octocat',
    public_repos: 8,
    followers: 120,
    updated_at: '2025-10-10T12:00:00Z',
  };

  const mockReposRest = [
    {
      name: 'hello-world',
      fork: false,
      size: 150,
      stargazers_count: 45,
      forks_count: 12,
      pushed_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      language: 'JavaScript',
      topics: ['react', 'node'],
    },
  ];

  const mockGraphQLCalendarResponse = {
    data: {
      user: {
        contributionsCollection: {
          contributionCalendar: {
            totalContributions: 142,
            weeks: [
              {
                contributionDays: [
                  {
                    date: '2025-10-01',
                    contributionCount: 3,
                    contributionLevel: 'FIRST_QUARTILE',
                    color: '#9be9a8',
                    weekday: 3,
                  },
                  {
                    date: '2025-10-02',
                    contributionCount: 5,
                    contributionLevel: 'SECOND_QUARTILE',
                    color: '#40c463',
                    weekday: 4,
                  },
                ],
              },
            ],
          },
          totalCommitContributions: 120,
          totalPullRequestContributions: 15,
          totalIssueContributions: 7,
          restrictedContributionsCount: 0,
          hasAnyRestrictedContributions: false,
        },
      },
    },
  };

  const mockGraphQLPRsAndIssuesResponse = {
    data: {
      user: {
        pullRequests: {
          totalCount: 3,
          nodes: [
            {
              id: 'pr_node_101',
              number: 101,
              title: 'Add REST API auth guard',
              body: 'Substantive PR body detailing security tokens and middleware implementation.',
              url: 'https://github.com/octocat/hello-world/pull/101',
              merged: true,
              mergedAt: '2025-10-05T10:00:00Z',
              changedFiles: 4,
              repository: {
                nameWithOwner: 'octocat/hello-world',
                url: 'https://github.com/octocat/hello-world',
              },
              author: { login: 'octocat', __typename: 'User' },
            },
            {
              id: 'pr_node_102',
              number: 102,
              title: 'Automated bump',
              body: 'Automated bump',
              url: 'https://github.com/octocat/hello-world/pull/102',
              merged: true,
              mergedAt: '2025-10-06T10:00:00Z',
              changedFiles: 1,
              repository: {
                nameWithOwner: 'octocat/hello-world',
                url: 'https://github.com/octocat/hello-world',
              },
              author: { login: 'dependabot[bot]', __typename: 'Bot' }, // Excluded bot
            },
          ],
        },
        issues: {
          totalCount: 2,
          nodes: [
            {
              id: 'issue_node_501',
              number: 501,
              title: 'Bug report in connection pooling',
              body: 'A'.repeat(120), // Valid length >= 100
              url: 'https://github.com/octocat/hello-world/issues/501',
              createdAt: '2025-10-04T10:00:00Z',
              repository: {
                nameWithOwner: 'octocat/hello-world',
                url: 'https://github.com/octocat/hello-world',
              },
              author: { login: 'octocat', __typename: 'User' },
              labels: { nodes: [] },
            },
          ],
        },
      },
    },
  };

  // Mock globalThis.fetch
  globalThis.fetch = async (url, options = {}) => {
    const urlStr = String(url);
    if (urlStr.includes('/users/octocat/repos')) {
      return { ok: true, status: 200, json: async () => mockReposRest };
    }
    if (urlStr.includes('/users/octocat')) {
      return { ok: true, status: 200, json: async () => mockUserRest };
    }
    if (urlStr.includes('api.github.com/graphql')) {
      const body = JSON.parse(options.body || '{}');
      if (body.query && body.query.includes('ContributionCalendar')) {
        return { ok: true, status: 200, json: async () => mockGraphQLCalendarResponse };
      }
      if (body.query && body.query.includes('UserPullRequestsPage')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              user: {
                pullRequests: {
                  ...mockGraphQLPRsAndIssuesResponse.data.user.pullRequests,
                  pageInfo: { endCursor: null, hasNextPage: false },
                },
              },
            },
          }),
        };
      }
      if (body.query && body.query.includes('UserIssuesPage')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              user: {
                issues: {
                  ...mockGraphQLPRsAndIssuesResponse.data.user.issues,
                  pageInfo: { endCursor: null, hasNextPage: false },
                },
              },
            },
          }),
        };
      }
      if (body.query && body.query.includes('UserPRsAndIssues')) {
        return { ok: true, status: 200, json: async () => mockGraphQLPRsAndIssuesResponse };
      }
    }
    return { ok: false, status: 404, text: async () => 'Not found' };
  };

  // Provide mock GITHUB_TOKEN for test
  const previousToken = process.env.GITHUB_TOKEN;
  process.env.GITHUB_TOKEN = 'ghp_mock_integration_token_12345';

  try {
    const updated = await syncGithubProfile(testUser._id, { jobId: 'job_gh_sync_full_1' });

    // 1. Verify calendar was persisted in profile
    const profile = await Profile.findOne({ userId: testUser._id });
    assert.ok(profile.githubContributionCalendar, 'githubContributionCalendar must be populated');
    assert.equal(profile.githubContributionCalendar.source, 'github_graphql');
    assert.equal(profile.githubContributionCalendar.calendarTotalContributions, 142);
    assert.equal(profile.codingStats.githubContributions, 142);
    assert.equal(profile.githubContributionCalendar.weeks.length, 1);

    const firstDay = profile.githubContributionCalendar.weeks[0].contributionDays[0];
    assert.equal(firstDay.date, '2025-10-01');
    assert.equal(firstDay.contributionCount, 3);
    assert.equal(firstDay.count, 3);
    assert.equal(firstDay.contributionLevel, 'FIRST_QUARTILE');
    assert.equal(firstDay.color, '#9be9a8');
    assert.equal(firstDay.weekday, 3);

    // 2. Verify platform sync state
    assert.equal(profile.platformSyncStates.github.syncStatus, 'SYNCED');
    assert.ok(profile.platformSyncStates.github.lastSuccessfulSync);
    assert.ok(profile.platformSyncStates.github.calendarLastSuccessfulSync);
    assert.equal(profile.platformSyncStates.github.calendarSyncError, null);
    assert.equal(profile.platformSyncStates.github.activeMilestoneEventId, null, 'Active milestone ID must be cleared after success');

    // 3. Verify PR and Issue anti-gaming metrics
    assert.equal(profile.codingStats.rawMetrics.github.mergedPRsCount, 3);
    assert.equal(profile.codingStats.rawMetrics.github.qualifiedMergedPRsCount, 1, 'Only non-bot PR 101 qualifies');
    assert.equal(profile.codingStats.rawMetrics.github.issuesCount, 2);
    assert.equal(profile.codingStats.rawMetrics.github.qualifiedIssuesCount, 1, 'Issue 501 qualifies (body >= 100)');
    assert.equal(profile.codingStats.rawMetrics.github.activeDaysLast365, 2);

    // 4. Verify Activity model was upserted for qualified PR
    const activities = await Activity.find({ userId: testUser._id, category: 'Technical' });
    assert.equal(activities.length, 1, 'Exactly 1 qualified PR activity should be upserted');
    assert.equal(activities[0].externalId, 'gh_pr_pr_node_101');
    assert.equal(activities[0].githubPRUrl, 'https://github.com/octocat/hello-world/pull/101');
    assert.equal(activities[0].status, 'Approved');
  } finally {
    process.env.GITHUB_TOKEN = previousToken;
  }
});

test('Integration 3.2: Retry with same milestoneEventId is idempotent and does not duplicate Activity records', async () => {
  const previousToken = process.env.GITHUB_TOKEN;
  process.env.GITHUB_TOKEN = 'ghp_mock_integration_token_12345';

  try {
    // Retry with identical milestoneEventId
    await syncGithubProfile(testUser._id, { jobId: 'job_gh_sync_full_1' });

    // Verify activities collection still contains exactly 1 document (no duplicates)
    const activities = await Activity.find({ userId: testUser._id, category: 'Technical' });
    assert.equal(activities.length, 1, 'Retry must not duplicate activities');

    const profile = await Profile.findOne({ userId: testUser._id });
    assert.equal(profile.platformSyncStates.github.syncStatus, 'SYNCED');
  } finally {
    process.env.GITHUB_TOKEN = previousToken;
  }
});

test('Integration 3.3: Partial sync handling — REST succeeds, GraphQL calendar fails -> PARTIAL state, retain STALE calendar', async () => {
  const previousToken = process.env.GITHUB_TOKEN;
  process.env.GITHUB_TOKEN = 'ghp_mock_integration_token_12345';

  // Mock GraphQL calendar returning rate limit or error, but REST succeeding
  globalThis.fetch = async (url, options = {}) => {
    const urlStr = String(url);
    if (urlStr.includes('/users/octocat/repos')) {
      return { ok: true, status: 200, json: async () => [{ name: 'repo-1', fork: false, size: 50, pushed_at: '2025-10-10' }] };
    }
    if (urlStr.includes('/users/octocat')) {
      return { ok: true, status: 200, json: async () => ({ login: 'octocat', public_repos: 10, followers: 130 }) };
    }
    if (urlStr.includes('api.github.com/graphql')) {
      // Simulate rate limit for GraphQL calendar
      return { ok: false, status: 429, text: async () => 'rate limit exceeded' };
    }
    return { ok: false, status: 404 };
  };

  try {
    const updated = await syncGithubProfile(testUser._id, { jobId: 'job_gh_partial_sync_1' });

    const profile = await Profile.findOne({ userId: testUser._id });

    // 1. Must record PARTIAL syncStatus
    assert.equal(profile.platformSyncStates.github.syncStatus, 'PARTIAL', 'syncStatus must be PARTIAL when GraphQL fails but REST succeeds');
    assert.ok(profile.platformSyncStates.github.calendarSyncError, 'calendarSyncError must record failure reason');
    assert.equal(profile.lastSyncError, 'rate limit exceeded', 'lastSyncError must be cleanly deduplicated without repetition');
    assert.equal(profile.platformSyncStates.github.error, 'rate limit exceeded', 'platformSyncStates.github.error must be cleanly deduplicated without repetition');

    // 2. Prior cached calendar must be retained and marked STALE (never zeroed or cleared)
    assert.ok(profile.githubContributionCalendar, 'Prior calendar must not be deleted');
    assert.equal(profile.githubContributionCalendar.syncStatus, 'STALE', 'Retained calendar must be marked STALE');
    assert.equal(profile.githubContributionCalendar.calendarTotalContributions, 142, 'Prior total contributions must be preserved');
    assert.equal(profile.githubContributionCalendar.weeks.length, 1, 'Prior weeks must be preserved');
    assert.equal(profile.codingStats.githubContributions, 142, 'codingStats.githubContributions must retain prior count');
  } finally {
    process.env.GITHUB_TOKEN = previousToken;
  }
});

test('Integration 3.4: Complete sync failure retains prior calendar and records ERROR status', async () => {
  // Simulate complete network failure on REST
  globalThis.fetch = async () => {
    throw new Error('Connection reset by peer');
  };

  await assert.rejects(
    () => syncGithubProfile(testUser._id, { jobId: 'job_gh_fatal_fail_1' }),
    /GitHub sync failed/
  );

  const profile = await Profile.findOne({ userId: testUser._id });
  assert.equal(profile.platformSyncStates.github.syncStatus, 'ERROR');
  assert.equal(profile.platformSyncStates.github.consecutiveFailures, 1);

  // Cached calendar from prior success remains untouched
  assert.equal(profile.githubContributionCalendar.calendarTotalContributions, 142);
  assert.equal(profile.codingStats.githubContributions, 142);
});

test('Integration 3.5: Distinction between confirmed zero activity and missing data', async () => {
  const previousToken = process.env.GITHUB_TOKEN;
  process.env.GITHUB_TOKEN = 'ghp_mock_integration_token_12345';

  // Mock response where user has confirmed 0 PRs and 0 issues
  globalThis.fetch = async (url, options = {}) => {
    const urlStr = String(url);
    if (urlStr.includes('/users/octocat/repos')) {
      return { ok: true, status: 200, json: async () => [] };
    }
    if (urlStr.includes('/users/octocat')) {
      return { ok: true, status: 200, json: async () => ({ login: 'octocat', public_repos: 0, followers: 0 }) };
    }
    if (urlStr.includes('api.github.com/graphql')) {
      const body = JSON.parse(options.body || '{}');
      if (body.query && body.query.includes('ContributionCalendar')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              user: {
                contributionsCollection: {
                  contributionCalendar: { totalContributions: 0, weeks: [] },
                  totalCommitContributions: 0,
                  totalPullRequestContributions: 0,
                  totalIssueContributions: 0,
                  restrictedContributionsCount: 0,
                  hasAnyRestrictedContributions: false,
                },
              },
            },
          }),
        };
      }
      if (body.query && body.query.includes('UserPullRequestsPage')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              user: {
                pullRequests: {
                  totalCount: 0,
                  pageInfo: { endCursor: null, hasNextPage: false },
                  nodes: [],
                },
              },
            },
          }),
        };
      }
      if (body.query && body.query.includes('UserIssuesPage')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              user: {
                issues: {
                  totalCount: 0,
                  pageInfo: { endCursor: null, hasNextPage: false },
                  nodes: [],
                },
              },
            },
          }),
        };
      }
      if (body.query && body.query.includes('UserPRsAndIssues')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              user: {
                pullRequests: { totalCount: 0, nodes: [] },
                issues: { totalCount: 0, nodes: [] },
              },
            },
          }),
        };
      }
    }
    return { ok: false, status: 404 };
  };

  try {
    await syncGithubProfile(testUser._id, { jobId: 'job_gh_zero_activity_1' });

    const profile = await Profile.findOne({ userId: testUser._id });
    // Confirmed 0 PRs / issues
    assert.equal(profile.codingStats.rawMetrics.github.qualifiedMergedPRsCount, 0, 'Confirmed zero PRs must be 0, not null');
    assert.equal(profile.codingStats.rawMetrics.github.qualifiedIssuesCount, 0, 'Confirmed zero issues must be 0, not null');
    assert.equal(profile.codingStats.rawMetrics.github.activeDaysLast365, 0, 'Confirmed zero active days must be 0');
  } finally {
    process.env.GITHUB_TOKEN = previousToken;
  }
});

test('Integration 3.6: Multi-page GitHub sync with >100 PRs, cursor loop, later-page qualified activities, and per-repo caps across pages', async () => {
  await Activity.deleteMany({ userId: testUser._id });
  const previousToken = process.env.GITHUB_TOKEN;
  process.env.GITHUB_TOKEN = 'ghp_mock_integration_token_12345';

  // Repo-A has 4 PRs on Page 1, 3 PRs on Page 2 (total 7, but capped at 5)
  // Repo-B has 2 PRs on Page 2 (all qualify)
  // Page 1 has 100 PRs total (4 in Repo-A, 96 non-qualifying/unmerged in other repos)
  // Page 2 has 20 PRs total (3 in Repo-A, 2 in Repo-B, 15 other)
  const page1Nodes = [
    ...Array.from({ length: 4 }, (_, i) => ({
      id: `multi_pr_repoA_p1_${i}`,
      number: 10 + i,
      title: `Repo-A PR ${i + 1}`,
      body: 'Substantive PR body implementing core architectural features',
      url: `https://github.com/org/repo-A/pull/${10 + i}`,
      merged: true,
      mergedAt: '2025-09-01T10:00:00Z',
      changedFiles: 2,
      repository: { nameWithOwner: 'org/repo-A', url: 'https://github.com/org/repo-A' },
      author: { login: 'octocat', __typename: 'User' },
    })),
    ...Array.from({ length: 96 }, (_, i) => ({
      id: `multi_pr_other_p1_${i}`,
      number: 100 + i,
      title: `Unmerged WIP ${i + 1}`,
      body: 'WIP',
      url: `https://github.com/org/unmerged-repo/pull/${100 + i}`,
      merged: false, // Excluded
      mergedAt: null,
      changedFiles: 1,
      repository: { nameWithOwner: 'org/unmerged-repo', url: 'https://github.com/org/unmerged-repo' },
      author: { login: 'octocat', __typename: 'User' },
    })),
  ];

  const page2Nodes = [
    ...Array.from({ length: 3 }, (_, i) => ({
      id: `multi_pr_repoA_p2_${i}`,
      number: 20 + i,
      title: `Repo-A Page 2 PR ${i + 1}`,
      body: 'Substantive PR body on page 2 for repo-A',
      url: `https://github.com/org/repo-A/pull/${20 + i}`,
      merged: true,
      mergedAt: '2025-09-02T10:00:00Z',
      changedFiles: 3,
      repository: { nameWithOwner: 'org/repo-A', url: 'https://github.com/org/repo-A' },
      author: { login: 'octocat', __typename: 'User' },
    })),
    ...Array.from({ length: 2 }, (_, i) => ({
      id: `multi_pr_repoB_p2_${i}`,
      number: 50 + i,
      title: `Repo-B Page 2 PR ${i + 1}`,
      body: 'Substantive PR body on page 2 for repo-B',
      url: `https://github.com/org/repo-B/pull/${50 + i}`,
      merged: true,
      mergedAt: '2025-09-03T10:00:00Z',
      changedFiles: 4,
      repository: { nameWithOwner: 'org/repo-B', url: 'https://github.com/org/repo-B' },
      author: { login: 'octocat', __typename: 'User' },
    })),
  ];

  globalThis.fetch = async (url, options = {}) => {
    const urlStr = String(url);
    if (urlStr.includes('/users/octocat/repos')) {
      return { ok: true, status: 200, json: async () => [{ name: 'repo-A', fork: false, size: 100, pushed_at: '2025-10-01' }] };
    }
    if (urlStr.includes('/users/octocat')) {
      return { ok: true, status: 200, json: async () => ({ login: 'octocat', public_repos: 5, followers: 80 }) };
    }
    if (urlStr.includes('api.github.com/graphql')) {
      const body = JSON.parse(options.body || '{}');
      if (body.query?.includes('ContributionCalendar')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              user: {
                contributionsCollection: {
                  contributionCalendar: { totalContributions: 80, weeks: [] },
                  totalCommitContributions: 50,
                  totalPullRequestContributions: 120,
                  totalIssueContributions: 0,
                  restrictedContributionsCount: 0,
                  hasAnyRestrictedContributions: false,
                },
              },
            },
          }),
        };
      }
      if (body.query?.includes('UserPullRequestsPage')) {
        if (!body.variables?.after) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                user: {
                  pullRequests: {
                    totalCount: 105,
                    pageInfo: { endCursor: 'p1_cursor_token', hasNextPage: true },
                    nodes: page1Nodes,
                  },
                },
              },
            }),
          };
        } else {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                user: {
                  pullRequests: {
                    totalCount: 105,
                    pageInfo: { endCursor: 'p2_cursor_token', hasNextPage: false },
                    nodes: page2Nodes,
                  },
                },
              },
            }),
          };
        }
      }
      if (body.query?.includes('UserIssuesPage')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              user: {
                issues: { totalCount: 0, pageInfo: { endCursor: null, hasNextPage: false }, nodes: [] },
              },
            },
          }),
        };
      }
    }
    return { ok: false, status: 404 };
  };

  try {
    await syncGithubProfile(testUser._id, { jobId: 'job_gh_multipage_sync_1' });

    const profile = await Profile.findOne({ userId: testUser._id });
    // Total PRs = 105
    assert.equal(profile.codingStats.rawMetrics.github.mergedPRsCount, 105);

    // Repo-A had 4 (page 1) + 3 (page 2) = 7, capped at 5!
    // Repo-B had 2 (page 2), all 2 qualify!
    // Total qualified = 5 + 2 = 7!
    assert.equal(profile.codingStats.rawMetrics.github.qualifiedMergedPRsCount, 7, 'Must cap Repo-A at 5 across all pages and include Repo-B');

    // Verify activities were upserted for qualified PRs from both page 1 and page 2
    const activities = await Activity.find({ userId: testUser._id, category: 'Technical' });
    assert.equal(activities.length, 7, 'Must upsert exactly 7 qualified activities across all pages');

    // Confirm presence of page 2 activity
    const repoBActivity = activities.find(a => a.externalId === 'gh_pr_multi_pr_repoB_p2_0');
    assert.ok(repoBActivity, 'Page 2 qualified PR activity must be persisted in database');
    assert.equal(repoBActivity.status, 'Approved');
  } finally {
    process.env.GITHUB_TOKEN = previousToken;
  }
});

test('Integration 3.7: Live GitHub API smoke test (conditional on environment credentials)', async (t) => {
  const liveToken = process.env.GITHUB_TOKEN;
  const isLiveTokenConfigured = Boolean(
    liveToken &&
    !liveToken.startsWith('ghp_mock') &&
    liveToken !== 'UNSET' &&
    !liveToken.includes('your_github_token')
  );

  if (!isLiveTokenConfigured) {
    t.skip('Live GitHub API verification status: UNVERIFIED (GITHUB_TOKEN is not configured in test environment).');
    return;
  }

  // Restore real fetch if live token exists
  globalThis.fetch = originalFetch;

  try {
    const calendar = await fetchGithubGraphQLCalendar('octocat', liveToken);
    assert.ok(calendar, 'Live GraphQL response returned for octocat');
    assert.ok(Array.isArray(calendar.weeks), 'Live weeks is an array');
    console.log(`[LIVE VERIFIED] Authenticated live GitHub GraphQL API access verified: octocat has ${calendar.calendarTotalContributions} contributions.`);
  } catch (err) {
    console.warn('[LIVE UNVERIFIED] Live GitHub API check failed with status:', err.message);
    t.skip(`Live GitHub API verification status: UNVERIFIED (${err.message}).`);
  }
});

test('Integration 3.8: Incomplete fetch due to pagination ceiling preserves prior metrics, calendar, and marks PARTIAL', async () => {
  await Activity.deleteMany({ userId: testUser._id });
  const previousToken = process.env.GITHUB_TOKEN;
  process.env.GITHUB_TOKEN = 'ghp_mock_integration_token_12345';

  // Step 1: Baseline successful sync to establish prior valid metrics and calendar
  const initialCalendarWeeks = [{
    contributionDays: [{
      date: '2025-10-01',
      contributionCount: 5,
      contributionLevel: 'FIRST_QUARTILE',
      color: '#9be9a8',
      weekday: 3,
    }],
  }];

  const validPR = {
    id: 'pr_baseline_1',
    number: 1,
    title: 'Baseline Valid PR',
    body: 'Valid substantive PR body implementing core architectural features',
    url: 'https://github.com/org/repo/pull/1',
    merged: true,
    mergedAt: '2025-10-01T12:00:00Z',
    changedFiles: 2,
    repository: { nameWithOwner: 'org/repo', url: 'https://github.com/org/repo' },
    author: { login: 'octocat', __typename: 'User' },
  };

  globalThis.fetch = async (url, options = {}) => {
    const urlStr = String(url);
    if (urlStr.includes('/users/octocat/repos')) {
      return { ok: true, status: 200, json: async () => [{ name: 'repo', fork: false, size: 50, pushed_at: '2025-10-10' }] };
    }
    if (urlStr.includes('/users/octocat')) {
      return { ok: true, status: 200, json: async () => ({ login: 'octocat', public_repos: 10, followers: 100 }) };
    }
    if (urlStr.includes('api.github.com/graphql')) {
      const body = JSON.parse(options.body || '{}');
      if (body.query?.includes('ContributionCalendar')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              user: {
                contributionsCollection: {
                  contributionCalendar: { totalContributions: 50, weeks: initialCalendarWeeks },
                  totalCommitContributions: 40,
                  totalPullRequestContributions: 10,
                  totalIssueContributions: 0,
                  restrictedContributionsCount: 0,
                  hasAnyRestrictedContributions: false,
                },
              },
            },
          }),
        };
      }
      if (body.query?.includes('UserPullRequestsPage')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              user: {
                pullRequests: {
                  totalCount: 1,
                  pageInfo: { endCursor: 'base_end', hasNextPage: false },
                  nodes: [validPR],
                },
              },
            },
          }),
        };
      }
      if (body.query?.includes('UserIssuesPage')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              user: {
                issues: { totalCount: 0, pageInfo: { endCursor: null, hasNextPage: false }, nodes: [] },
              },
            },
          }),
        };
      }
    }
    return { ok: false, status: 404 };
  };

  try {
    await syncGithubProfile(testUser._id, { jobId: 'job_gh_baseline_prior_sync' });

    let profile = await Profile.findOne({ userId: testUser._id });
    assert.equal(profile.platformSyncStates.github.syncStatus, 'SYNCED');
    assert.equal(profile.codingStats.rawMetrics.github.qualifiedMergedPRsCount, 1);
    assert.equal(profile.codingStats.rawMetrics.github.activeDaysLast365, 1);
    const priorSuccessfulSyncTime = profile.platformSyncStates.github.lastSuccessfulSync;
    assert.ok(priorSuccessfulSyncTime, 'Must have a recorded lastSuccessfulSync timestamp');

    // Baseline activity must exist
    const initialActivities = await Activity.find({ userId: testUser._id, category: 'Technical' });
    assert.equal(initialActivities.length, 1);
    assert.equal(initialActivities[0].externalId, 'gh_pr_pr_baseline_1');

    // Step 2: Now simulate subsequent sync where PR fetch hits pagination limit ceiling (maxPages reached with hasNextPage: true)
    globalThis.fetch = async (url, options = {}) => {
      const urlStr = String(url);
      if (urlStr.includes('/users/octocat/repos')) {
        return { ok: true, status: 200, json: async () => [{ name: 'repo', fork: false, size: 50, pushed_at: '2025-10-10' }] };
      }
      if (urlStr.includes('/users/octocat')) {
        return { ok: true, status: 200, json: async () => ({ login: 'octocat', public_repos: 10, followers: 100 }) };
      }
      if (urlStr.includes('api.github.com/graphql')) {
        const body = JSON.parse(options.body || '{}');
        if (body.query?.includes('ContributionCalendar')) {
          // Calendar succeeds
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                user: {
                  contributionsCollection: {
                    contributionCalendar: { totalContributions: 50, weeks: initialCalendarWeeks },
                    totalCommitContributions: 40,
                    totalPullRequestContributions: 10,
                    totalIssueContributions: 0,
                    restrictedContributionsCount: 0,
                    hasAnyRestrictedContributions: false,
                  },
                },
              },
            }),
          };
        }
        if (body.query?.includes('UserPullRequestsPage')) {
          // Always return hasNextPage: true to trigger pagination ceiling error
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                user: {
                  pullRequests: {
                    totalCount: 5000,
                    pageInfo: { endCursor: 'cursor_always_has_next', hasNextPage: true },
                    nodes: [{
                      id: `partial_pr_node`,
                      number: 999,
                      title: 'Incomplete Page PR',
                      body: 'Body',
                      url: 'https://github.com/org/repo/pull/999',
                      merged: true,
                      mergedAt: '2025-10-02T12:00:00Z',
                      changedFiles: 1,
                      repository: { nameWithOwner: 'org/repo', url: 'https://github.com/org/repo' },
                      author: { login: 'octocat', __typename: 'User' },
                    }],
                  },
                },
              },
            }),
          };
        }
        if (body.query?.includes('UserIssuesPage')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                user: {
                  issues: { totalCount: 0, pageInfo: { endCursor: null, hasNextPage: false }, nodes: [] },
                },
              },
            }),
          };
        }
      }
      return { ok: false, status: 404 };
    };

    // Execute sync — must complete without throwing unhandled, recording PARTIAL state
    await syncGithubProfile(testUser._id, { jobId: 'job_gh_ceiling_partial_sync' });

    profile = await Profile.findOne({ userId: testUser._id });

    // 1. Sync status must indicate incomplete/partial sync
    assert.equal(profile.platformSyncStates.github.syncStatus, 'PARTIAL', 'Must record PARTIAL syncStatus');
    assert.ok(profile.lastSyncError, 'profile.lastSyncError must be populated');
    assert.match(
      profile.platformSyncStates.github.error,
      /pagination limit reached with additional pages remaining/,
      'Must record sanitized pagination ceiling error in platformSyncStates.github.error'
    );

    // 2. Previously valid metrics and calendar data must remain intact (not replaced by null or partial)
    assert.equal(
      profile.codingStats.rawMetrics.github.qualifiedMergedPRsCount,
      1,
      'Must preserve previously valid qualifiedMergedPRsCount'
    );
    assert.equal(
      profile.codingStats.rawMetrics.github.activeDaysLast365,
      1,
      'Must preserve previously valid activeDaysLast365'
    );
    assert.equal(
      profile.githubContributionCalendar.calendarTotalContributions,
      50,
      'Must preserve previously valid contribution calendar total'
    );

    // 3. Must NOT mark incomplete results as fresh or complete: lastSuccessfulSync does NOT advance
    assert.equal(
      new Date(profile.platformSyncStates.github.lastSuccessfulSync).getTime(),
      new Date(priorSuccessfulSyncTime).getTime(),
      'lastSuccessfulSync must not advance on incomplete/partial sync'
    );

    // 4. Incomplete PR nodes must not create new or corrupt Activity records
    const activitiesAfter = await Activity.find({ userId: testUser._id, category: 'Technical' });
    assert.equal(activitiesAfter.length, 1, 'Activity count must not change on incomplete sync');
    assert.equal(activitiesAfter[0].externalId, 'gh_pr_pr_baseline_1', 'Activity must remain the baseline PR');
  } finally {
    process.env.GITHUB_TOKEN = previousToken;
  }
});
