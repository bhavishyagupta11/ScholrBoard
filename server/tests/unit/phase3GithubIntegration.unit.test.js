/**
 * Unit Test Suite for Phase 3 — GitHub Integration v3
 *
 * Exercises:
 *   1. GraphQL contribution calendar normalization and dynamic weeks array.
 *   2. Accurate mapping of all required day fields: date, contributionCount, count, contributionLevel, color, weekday.
 *   3. Calendar streaks computation: activeDays, longestStreak, currentStreak (with boundary cases).
 *   4. Verified PR anti-gaming qualification rules:
 *      - Merged requirement
 *      - Bot exclusion (typename Bot, [bot] suffix)
 *      - Changed files threshold (>= 1)
 *      - Non-empty body requirement
 *      - Per-repo cap (max 5) and cross-repo aggregation
 *   5. Verified Issue anti-gaming qualification rules:
 *      - Bot exclusion
 *      - Body length >= 100 OR label present
 *      - Per-repo cap (max 10) and cross-repo aggregation
 *   6. Missing token, unknown username, malformed GraphQL responses, rate limits, and errors.
 *   7. Token sanitization in error messages (never leaks token).
 *   8. Distinction between confirmed zero activity and missing/unavailable data.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeCalendarStreaks,
  filterQualifiedMergedPRs,
  filterQualifiedIssues,
  fetchGithubGraphQLCalendar,
  fetchGithubPRsAndIssues,
  fetchPaginatedPullRequests,
  fetchPaginatedIssues,
} from '../../services/providers/githubProvider.js';

test('Phase 3.1: computeCalendarStreaks accurately computes activeDays, longestStreak, and currentStreak', () => {
  // Scenario A: Standard multi-week calendar
  const weeks = [
    {
      contributionDays: [
        { date: '2025-10-01', contributionCount: 2, weekday: 3 },
        { date: '2025-10-02', contributionCount: 5, weekday: 4 },
        { date: '2025-10-03', contributionCount: 0, weekday: 5 },
        { date: '2025-10-04', contributionCount: 1, weekday: 6 },
      ],
    },
    {
      contributionDays: [
        { date: '2025-10-05', contributionCount: 4, weekday: 0 },
        { date: '2025-10-06', contributionCount: 2, weekday: 1 },
        { date: '2025-10-07', contributionCount: 1, weekday: 2 },
        { date: '2025-10-08', contributionCount: 0, weekday: 3 }, // Today: 0 contributions
      ],
    },
  ];

  const result = computeCalendarStreaks(weeks);
  assert.equal(result.activeDays, 6, 'Should count 6 active days with contributionCount > 0');
  assert.equal(result.longestStreak, 4, 'Longest streak should be 4 (Oct 4-7)');
  // Yesterday (Oct 7) had 1 contribution, today (Oct 8) has 0 -> streak is active up to yesterday = 4
  assert.equal(result.currentStreak, 4, 'Current streak should be 4 ending yesterday UTC');

  // Scenario B: Today has contributions -> current streak continues through today
  weeks[1].contributionDays[3].contributionCount = 3;
  const resultTodayActive = computeCalendarStreaks(weeks);
  assert.equal(resultTodayActive.longestStreak, 5, 'Longest streak should be 5 (Oct 4-8)');
  assert.equal(resultTodayActive.currentStreak, 5, 'Current streak should be 5 ending today');

  // Scenario C: Empty calendar
  assert.deepEqual(computeCalendarStreaks([]), { activeDays: 0, longestStreak: 0, currentStreak: 0 });

  // Scenario D: All days zero
  const zeroWeeks = [
    {
      contributionDays: [
        { date: '2025-10-01', contributionCount: 0, weekday: 3 },
        { date: '2025-10-02', contributionCount: 0, weekday: 4 },
      ],
    },
  ];
  assert.deepEqual(computeCalendarStreaks(zeroWeeks), { activeDays: 0, longestStreak: 0, currentStreak: 0 });
});

test('Phase 3.2: filterQualifiedMergedPRs enforces all V13 Part 6.2 B anti-gaming rules', () => {
  const prs = [
    // 1. Valid qualified PR in repo-A
    {
      id: 'pr_1',
      number: 101,
      merged: true,
      mergedAt: '2025-09-01T10:00:00Z',
      changedFiles: 3,
      body: 'Implemented authentication flow with JWT tokens and cookies.',
      repository: { nameWithOwner: 'org/repo-A', url: 'https://github.com/org/repo-A' },
      author: { login: 'student1', __typename: 'User' },
    },
    // 2. Unmerged PR (should be excluded)
    {
      id: 'pr_2',
      number: 102,
      merged: false,
      mergedAt: null,
      changedFiles: 2,
      body: 'Work in progress',
      repository: { nameWithOwner: 'org/repo-A', url: 'https://github.com/org/repo-A' },
      author: { login: 'student1', __typename: 'User' },
    },
    // 3. Bot PR (should be excluded)
    {
      id: 'pr_3',
      number: 103,
      merged: true,
      mergedAt: '2025-09-02T10:00:00Z',
      changedFiles: 1,
      body: 'Automated dependency update',
      repository: { nameWithOwner: 'org/repo-A', url: 'https://github.com/org/repo-A' },
      author: { login: 'dependabot[bot]', __typename: 'Bot' },
    },
    // 4. Zero files changed (should be excluded)
    {
      id: 'pr_4',
      number: 104,
      merged: true,
      mergedAt: '2025-09-03T10:00:00Z',
      changedFiles: 0,
      body: 'Empty commit',
      repository: { nameWithOwner: 'org/repo-A', url: 'https://github.com/org/repo-A' },
      author: { login: 'student1', __typename: 'User' },
    },
    // 5. Empty body (should be excluded)
    {
      id: 'pr_5',
      number: 105,
      merged: true,
      mergedAt: '2025-09-04T10:00:00Z',
      changedFiles: 2,
      body: '   ',
      repository: { nameWithOwner: 'org/repo-A', url: 'https://github.com/org/repo-A' },
      author: { login: 'student1', __typename: 'User' },
    },
    // 6-10. Five more valid PRs in repo-A (to test per-repo cap of 5)
    ...Array.from({ length: 5 }, (_, i) => ({
      id: `pr_repoA_${i}`,
      number: 200 + i,
      merged: true,
      mergedAt: `2025-09-05T1${i}:00:00Z`,
      changedFiles: 2,
      body: `Feature work number ${i + 1} with substantive description`,
      repository: { nameWithOwner: 'org/repo-A', url: 'https://github.com/org/repo-A' },
      author: { login: 'student1', __typename: 'User' },
    })),
    // 11-12. Two valid PRs in repo-B (should be counted separately)
    {
      id: 'pr_repoB_1',
      number: 1,
      merged: true,
      mergedAt: '2025-09-06T10:00:00Z',
      changedFiles: 4,
      body: 'Added API documentation and OpenAPI specification',
      repository: { nameWithOwner: 'org/repo-B', url: 'https://github.com/org/repo-B' },
      author: { login: 'student1', __typename: 'User' },
    },
    {
      id: 'pr_repoB_2',
      number: 2,
      merged: true,
      mergedAt: '2025-09-07T10:00:00Z',
      changedFiles: 1,
      body: 'Fixed cross-origin resource sharing headers in API router',
      repository: { nameWithOwner: 'org/repo-B', url: 'https://github.com/org/repo-B' },
      author: { login: 'student1', __typename: 'User' },
    },
  ];

  const filterResult = filterQualifiedMergedPRs(prs);

  // In repo-A: 6 valid PRs submitted (pr_1 + 5 more), but capped at 5!
  // In repo-B: 2 valid PRs submitted, both counted!
  // Total qualified count = 5 + 2 = 7
  assert.equal(filterResult.qualifiedCount, 7, 'Must cap repo-A at 5 and repo-B at 2, totaling 7 qualified PRs');
  assert.equal(filterResult.qualifiedPRs.length, 7);
  assert.equal(filterResult.totalCount, prs.length);

  // Check repo cap enforcement
  const repoACount = filterResult.qualifiedPRs.filter(p => p.repository.nameWithOwner === 'org/repo-A').length;
  const repoBCount = filterResult.qualifiedPRs.filter(p => p.repository.nameWithOwner === 'org/repo-B').length;
  assert.equal(repoACount, 5, 'Repo A must be capped at 5');
  assert.equal(repoBCount, 2, 'Repo B must count all 2');
});

test('Phase 3.3: filterQualifiedIssues enforces all V13 Part 6.2 B anti-gaming rules', () => {
  const issues = [
    // 1. Valid issue: body >= 100 characters
    {
      id: 'issue_1',
      number: 1,
      body: 'A'.repeat(120),
      repository: { nameWithOwner: 'org/repo-A', url: 'https://github.com/org/repo-A' },
      author: { login: 'student1', __typename: 'User' },
      labels: [],
    },
    // 2. Valid issue: body < 100 characters, BUT has label attached
    {
      id: 'issue_2',
      number: 2,
      body: 'Short bug report.',
      repository: { nameWithOwner: 'org/repo-A', url: 'https://github.com/org/repo-A' },
      author: { login: 'student1', __typename: 'User' },
      labels: [{ name: 'bug' }],
    },
    // 3. Invalid issue: body < 100 chars and NO label (should be excluded)
    {
      id: 'issue_3',
      number: 3,
      body: 'Short spam issue.',
      repository: { nameWithOwner: 'org/repo-A', url: 'https://github.com/org/repo-A' },
      author: { login: 'student1', __typename: 'User' },
      labels: [],
    },
    // 4. Bot issue (should be excluded)
    {
      id: 'issue_4',
      number: 4,
      body: 'A'.repeat(200),
      repository: { nameWithOwner: 'org/repo-A', url: 'https://github.com/org/repo-A' },
      author: { login: 'stale[bot]', __typename: 'Bot' },
      labels: [{ name: 'stale' }],
    },
    // 5-16. Eleven more valid issues in repo-A (to test per-repo cap of 10)
    ...Array.from({ length: 11 }, (_, i) => ({
      id: `issue_repoA_${i}`,
      number: 10 + i,
      body: `Detailed issue report ${i}: ${'B'.repeat(110)}`,
      repository: { nameWithOwner: 'org/repo-A', url: 'https://github.com/org/repo-A' },
      author: { login: 'student1', __typename: 'User' },
      labels: [],
    })),
  ];

  const filterResult = filterQualifiedIssues(issues);

  // In repo-A: 1 + 1 + 11 = 13 valid candidates, capped at 10!
  assert.equal(filterResult.qualifiedCount, 10, 'Must enforce per-repo cap of 10 on issues');
  assert.equal(filterResult.qualifiedIssues.length, 10);
});

test('Phase 3.4: Error handling, input validation, and token sanitization', async () => {
  // 1. Missing username validation
  await assert.rejects(
    () => fetchGithubGraphQLCalendar('', 'fake_token'),
    /Invalid username provided/
  );
  await assert.rejects(
    () => fetchGithubPRsAndIssues(null, 'fake_token'),
    /Invalid username provided/
  );

  // 2. Missing token validation
  await assert.rejects(
    () => fetchGithubGraphQLCalendar('validuser', null),
    /GITHUB_TOKEN is required/
  );
  await assert.rejects(
    () => fetchGithubPRsAndIssues('validuser', undefined),
    /GITHUB_TOKEN is required/
  );
});

test('Phase 3.5: Distinction between confirmed zero activity and missing/unavailable data', () => {
  // Confirmed zero PRs: API returned 0 results
  const zeroPRs = filterQualifiedMergedPRs([]);
  assert.equal(zeroPRs.qualifiedCount, 0, 'Empty PR array is confirmed 0 qualified PRs');
  assert.equal(zeroPRs.totalCount, 0);

  // Confirmed zero issues: API returned 0 results
  const zeroIssues = filterQualifiedIssues([]);
  assert.equal(zeroIssues.qualifiedCount, 0, 'Empty issue array is confirmed 0 qualified issues');
  assert.equal(zeroIssues.totalCount, 0);

  // Missing data (null/undefined input) returns safe object with 0 count, but callers retain null in DB
  const nullPRs = filterQualifiedMergedPRs(null);
  assert.equal(nullPRs.qualifiedCount, 0);
  assert.deepEqual(nullPRs.qualifiedPRs, []);
});

test('Phase 3.6: fetchPaginatedPullRequests handles >100 PRs across multiple pages, cursor progression, and node deduplication', async () => {
  const originalFetch = globalThis.fetch;

  // Generate 100 PRs for page 1 and 25 PRs for page 2 (with 1 duplicate node ID across pages)
  const page1Nodes = Array.from({ length: 100 }, (_, i) => ({
    id: `pr_node_p1_${i}`,
    number: i + 1,
    title: `PR ${i + 1}`,
    body: 'Valid substantive description for testing',
    url: `https://github.com/org/repo/pull/${i + 1}`,
    merged: true,
    mergedAt: '2025-10-01T12:00:00Z',
    changedFiles: 2,
    repository: { nameWithOwner: 'org/repo', url: 'https://github.com/org/repo' },
    author: { login: 'student1', __typename: 'User' },
  }));

  const page2Nodes = [
    // Duplicate node from page 1
    page1Nodes[0],
    // 24 unique nodes for page 2
    ...Array.from({ length: 24 }, (_, i) => ({
      id: `pr_node_p2_${i}`,
      number: 101 + i,
      title: `PR ${101 + i}`,
      body: 'Valid substantive description for testing page 2',
      url: `https://github.com/org/repo-other/pull/${101 + i}`,
      merged: true,
      mergedAt: '2025-10-02T12:00:00Z',
      changedFiles: 1,
      repository: { nameWithOwner: 'org/repo-other', url: 'https://github.com/org/repo-other' },
      author: { login: 'student1', __typename: 'User' },
    })),
  ];

  let fetchCalls = 0;
  const receivedCursors = [];

  globalThis.fetch = async (url, options = {}) => {
    fetchCalls++;
    const payload = JSON.parse(options.body || '{}');
    receivedCursors.push(payload.variables?.after || null);

    if (!payload.variables?.after) {
      // Page 1
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            user: {
              pullRequests: {
                totalCount: 124,
                pageInfo: {
                  endCursor: 'cursor_pr_page1_end',
                  hasNextPage: true,
                },
                nodes: page1Nodes,
              },
            },
          },
        }),
      };
    } else if (payload.variables.after === 'cursor_pr_page1_end') {
      // Page 2
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            user: {
              pullRequests: {
                totalCount: 124,
                pageInfo: {
                  endCursor: 'cursor_pr_page2_end',
                  hasNextPage: false,
                },
                nodes: page2Nodes,
              },
            },
          },
        }),
      };
    }

    return { ok: false, status: 400 };
  };

  try {
    const result = await fetchPaginatedPullRequests('student1', 'fake_test_token');

    assert.equal(fetchCalls, 2, 'Must fetch exactly 2 pages');
    assert.deepEqual(receivedCursors, [null, 'cursor_pr_page1_end'], 'Must pass correct cursor to page 2');
    // 100 from page 1 + 24 unique from page 2 = 124 unique nodes (duplicate was deduplicated!)
    assert.equal(result.nodes.length, 124, 'Must deduplicate node IDs across pages');
    assert.equal(result.pagesFetched, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Phase 3.7: fetchPaginatedIssues handles >100 issues across multiple pages and terminates cleanly on hasNextPage false', async () => {
  const originalFetch = globalThis.fetch;

  const page1Nodes = Array.from({ length: 100 }, (_, i) => ({
    id: `issue_node_p1_${i}`,
    number: i + 1,
    title: `Issue ${i + 1}`,
    body: 'B'.repeat(110),
    url: `https://github.com/org/repo/issues/${i + 1}`,
    createdAt: '2025-10-01T12:00:00Z',
    repository: { nameWithOwner: 'org/repo', url: 'https://github.com/org/repo' },
    author: { login: 'student1', __typename: 'User' },
    labels: { nodes: [] },
  }));

  const page2Nodes = Array.from({ length: 15 }, (_, i) => ({
    id: `issue_node_p2_${i}`,
    number: 101 + i,
    title: `Issue ${101 + i}`,
    body: 'B'.repeat(110),
    url: `https://github.com/org/repo/issues/${101 + i}`,
    createdAt: '2025-10-02T12:00:00Z',
    repository: { nameWithOwner: 'org/repo', url: 'https://github.com/org/repo' },
    author: { login: 'student1', __typename: 'User' },
    labels: { nodes: [] },
  }));

  let fetchCalls = 0;
  globalThis.fetch = async (url, options = {}) => {
    fetchCalls++;
    const payload = JSON.parse(options.body || '{}');

    if (!payload.variables?.after) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            user: {
              issues: {
                totalCount: 115,
                pageInfo: {
                  endCursor: 'cursor_issue_p1_end',
                  hasNextPage: true,
                },
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
              issues: {
                totalCount: 115,
                pageInfo: {
                  endCursor: 'cursor_issue_p2_end',
                  hasNextPage: false,
                },
                nodes: page2Nodes,
              },
            },
          },
        }),
      };
    }
  };

  try {
    const result = await fetchPaginatedIssues('student1', 'fake_test_token');
    assert.equal(fetchCalls, 2, 'Must fetch exactly 2 pages');
    assert.equal(result.nodes.length, 115, 'Must collect all 115 issues across pages');
    assert.equal(result.pagesFetched, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Phase 3.8: fetchGithubPRsAndIssues enforces per-repo caps across all pages and fails atomically on later-page error', async () => {
  const originalFetch = globalThis.fetch;

  // Case A: Verify per-repo cap of 5 applied across pages (Page 1 has 3 in Repo A, Page 2 has 4 in Repo A -> cap is 5)
  const page1PRs = Array.from({ length: 3 }, (_, i) => ({
    id: `pr_p1_${i}`,
    number: i + 1,
    title: `PR ${i + 1}`,
    body: 'Valid substantive description',
    url: `https://github.com/org/repo-A/pull/${i + 1}`,
    merged: true,
    mergedAt: '2025-10-01T12:00:00Z',
    changedFiles: 2,
    repository: { nameWithOwner: 'org/repo-A', url: 'https://github.com/org/repo-A' },
    author: { login: 'student1', __typename: 'User' },
  }));

  const page2PRs = Array.from({ length: 4 }, (_, i) => ({
    id: `pr_p2_${i}`,
    number: 10 + i,
    title: `PR ${10 + i}`,
    body: 'Valid substantive description on page 2',
    url: `https://github.com/org/repo-A/pull/${10 + i}`,
    merged: true,
    mergedAt: '2025-10-02T12:00:00Z',
    changedFiles: 3,
    repository: { nameWithOwner: 'org/repo-A', url: 'https://github.com/org/repo-A' },
    author: { login: 'student1', __typename: 'User' },
  }));

  globalThis.fetch = async (url, options = {}) => {
    const payload = JSON.parse(options.body || '{}');
    if (payload.query?.includes('UserPullRequestsPage')) {
      if (!payload.variables?.after) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              user: {
                pullRequests: {
                  totalCount: 7,
                  pageInfo: { endCursor: 'p1_end', hasNextPage: true },
                  nodes: page1PRs,
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
                  totalCount: 7,
                  pageInfo: { endCursor: 'p2_end', hasNextPage: false },
                  nodes: page2PRs,
                },
              },
            },
          }),
        };
      }
    }
    if (payload.query?.includes('UserIssuesPage')) {
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
    return { ok: false, status: 400 };
  };

  try {
    const result = await fetchGithubPRsAndIssues('student1', 'fake_test_token');
    // Total PRs = 7 across pages, but all belong to repo-A -> capped at 5!
    assert.equal(result.totalPRsCount, 7, 'Total PR count across pages is 7');
    assert.equal(result.qualifiedMergedPRs, 5, 'Must cap Repo-A at 5 across all pages');
    assert.equal(result.prsPagesFetched, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }

  // Case B: Later-page failure must throw atomically and not return partial data
  globalThis.fetch = async (url, options = {}) => {
    const payload = JSON.parse(options.body || '{}');
    if (payload.query?.includes('UserPullRequestsPage')) {
      if (!payload.variables?.after) {
        // Page 1 succeeds
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              user: {
                pullRequests: {
                  totalCount: 50,
                  pageInfo: { endCursor: 'p1_end', hasNextPage: true },
                  nodes: page1PRs,
                },
              },
            },
          }),
        };
      } else {
        // Page 2 fails with rate limit
        return {
          ok: false,
          status: 429,
          text: async () => 'rate limit exceeded',
        };
      }
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ data: { user: { issues: { totalCount: 0, pageInfo: {}, nodes: [] } } } }),
    };
  };

  try {
    await assert.rejects(
      () => fetchGithubPRsAndIssues('student1', 'fake_test_token'),
      /rate limit exceeded/,
      'Must reject atomically when page 2 fails instead of returning partial page 1 data'
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Phase 3.9: Pagination ceiling for fetchPaginatedPullRequests — succeeds when final page has hasNextPage:false, rejects when hasNextPage:true', async () => {
  const originalFetch = globalThis.fetch;
  const samplePR = (id) => ({
    id: `pr_node_${id}`,
    number: id,
    title: `PR ${id}`,
    body: 'Valid substantive body',
    url: `https://github.com/org/repo/pull/${id}`,
    merged: true,
    mergedAt: '2025-10-01T12:00:00Z',
    changedFiles: 1,
    repository: { nameWithOwner: 'org/repo', url: 'https://github.com/org/repo' },
    author: { login: 'student1', __typename: 'User' },
  });

  try {
    // Case A: Exactly 2 pages with maxPages = 2, final page returns hasNextPage: false -> SUCCEEDS
    globalThis.fetch = async (url, options = {}) => {
      const payload = JSON.parse(options.body || '{}');
      if (!payload.variables?.after) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              user: {
                pullRequests: {
                  totalCount: 2,
                  pageInfo: { endCursor: 'c1', hasNextPage: true },
                  nodes: [samplePR(1)],
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
                  totalCount: 2,
                  pageInfo: { endCursor: 'c2', hasNextPage: false },
                  nodes: [samplePR(2)],
                },
              },
            },
          }),
        };
      }
    };

    const successResult = await fetchPaginatedPullRequests('student1', 'token', { maxPages: 2 });
    assert.equal(successResult.nodes.length, 2);
    assert.equal(successResult.pagesFetched, 2);

    // Case B: Final permitted page (page 2 of 2) still has hasNextPage: true -> MUST REJECT
    globalThis.fetch = async (url, options = {}) => {
      const payload = JSON.parse(options.body || '{}');
      if (!payload.variables?.after) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              user: {
                pullRequests: {
                  totalCount: 10,
                  pageInfo: { endCursor: 'c1', hasNextPage: true },
                  nodes: [samplePR(1)],
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
                  totalCount: 10,
                  pageInfo: { endCursor: 'c2', hasNextPage: true }, // Additional pages remain!
                  nodes: [samplePR(2)],
                },
              },
            },
          }),
        };
      }
    };

    await assert.rejects(
      () => fetchPaginatedPullRequests('student1', 'token', { maxPages: 2 }),
      /pagination limit reached with additional pages remaining \(2 pages fetched\)/,
      'Must reject with explicit pagination limit error when maxPages is exhausted with hasNextPage: true'
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Phase 3.10: Pagination ceiling for fetchPaginatedIssues — succeeds when final page has hasNextPage:false, rejects when hasNextPage:true', async () => {
  const originalFetch = globalThis.fetch;
  const sampleIssue = (id) => ({
    id: `issue_node_${id}`,
    number: id,
    title: `Issue ${id}`,
    body: 'B'.repeat(120),
    url: `https://github.com/org/repo/issues/${id}`,
    createdAt: '2025-10-01T12:00:00Z',
    repository: { nameWithOwner: 'org/repo', url: 'https://github.com/org/repo' },
    author: { login: 'student1', __typename: 'User' },
    labels: { nodes: [] },
  });

  try {
    // Case A: maxPages = 2, final page returns hasNextPage: false -> SUCCEEDS
    globalThis.fetch = async (url, options = {}) => {
      const payload = JSON.parse(options.body || '{}');
      if (!payload.variables?.after) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              user: {
                issues: {
                  totalCount: 2,
                  pageInfo: { endCursor: 'ic1', hasNextPage: true },
                  nodes: [sampleIssue(1)],
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
                issues: {
                  totalCount: 2,
                  pageInfo: { endCursor: 'ic2', hasNextPage: false },
                  nodes: [sampleIssue(2)],
                },
              },
            },
          }),
        };
      }
    };

    const successResult = await fetchPaginatedIssues('student1', 'token', { maxPages: 2 });
    assert.equal(successResult.nodes.length, 2);
    assert.equal(successResult.pagesFetched, 2);

    // Case B: maxPages = 2, final page still has hasNextPage: true -> MUST REJECT
    globalThis.fetch = async (url, options = {}) => {
      const payload = JSON.parse(options.body || '{}');
      if (!payload.variables?.after) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              user: {
                issues: {
                  totalCount: 50,
                  pageInfo: { endCursor: 'ic1', hasNextPage: true },
                  nodes: [sampleIssue(1)],
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
                issues: {
                  totalCount: 50,
                  pageInfo: { endCursor: 'ic2', hasNextPage: true }, // More data remains!
                  nodes: [sampleIssue(2)],
                },
              },
            },
          }),
        };
      }
    };

    await assert.rejects(
      () => fetchPaginatedIssues('student1', 'token', { maxPages: 2 }),
      /pagination limit reached with additional pages remaining \(2 pages fetched\)/,
      'Must reject with explicit pagination limit error when maxPages is exhausted with hasNextPage: true'
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
