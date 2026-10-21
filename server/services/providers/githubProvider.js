const sanitizeErrorMessage = (message, token) => {
  if (!message) return 'Unknown error';
  let str = String(message);
  if (token && typeof token === 'string' && token.length > 4) {
    str = str.replaceAll(token, '[REDACTED_TOKEN]');
  }
  return str;
};

const fetchJson = async (url, token, retries = 2) => {
  const headers = {
    Accept: 'application/json',
    'User-Agent': 'ScholrBoard-Sync/1.0',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url, { headers, signal: controller.signal }).finally(() => clearTimeout(timeout));
      
      if (res.status === 404) {
        throw new Error('profile not found');
      }
      if (res.status === 429) {
        throw new Error('rate limit exceeded');
      }
      if (!res.ok) {
        throw new Error(`API error (${res.status})`);
      }
      return await res.json();
    } catch (err) {
      if (attempt === retries || err.message === 'profile not found' || err.message === 'rate limit exceeded') {
        throw err;
      }
      // Delay before retry
      await new Promise(resolve => setTimeout(resolve, 500 * attempt));
    }
  }
};

/**
 * Execute a GitHub GraphQL query with authentication and retry logic.
 * Never leaks token in error messages.
 */
export const fetchGraphQL = async (query, variables, token, retries = 2) => {
  if (!token) {
    throw new Error('GITHUB_TOKEN is required for GraphQL requests');
  }

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'User-Agent': 'ScholrBoard-Sync/1.0',
    Authorization: `Bearer ${token}`,
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, variables }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      if (res.status === 401 || res.status === 403) {
        const errorText = await res.text().catch(() => '');
        if (errorText.toLowerCase().includes('rate limit')) {
          throw new Error('rate limit exceeded');
        }
        throw new Error('GitHub authentication failed or token expired');
      }
      if (res.status === 404) {
        throw new Error('profile not found');
      }
      if (res.status === 429) {
        throw new Error('rate limit exceeded');
      }
      if (!res.ok) {
        throw new Error(`API error (${res.status})`);
      }

      const json = await res.json();
      if (Array.isArray(json.errors) && json.errors.length > 0) {
        const firstError = json.errors[0];
        const msg = String(firstError.message || '');
        if (firstError.type === 'NOT_FOUND' || msg.includes('Could not resolve to a User')) {
          throw new Error('profile not found');
        }
        if (firstError.type === 'RATE_LIMITED' || msg.toLowerCase().includes('rate limit')) {
          throw new Error('rate limit exceeded');
        }
        throw new Error(sanitizeErrorMessage(`GraphQL error: ${msg}`, token));
      }

      return json.data;
    } catch (err) {
      if (
        attempt === retries ||
        err.message === 'profile not found' ||
        err.message === 'rate limit exceeded' ||
        err.message.includes('authentication failed') ||
        err.message.includes('required for GraphQL')
      ) {
        throw new Error(sanitizeErrorMessage(err.message, token));
      }
      await new Promise(resolve => setTimeout(resolve, 500 * attempt));
    }
  }
};

export const GITHUB_GRAPHQL_CALENDAR_QUERY = `
query ContributionCalendar($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays {
            date
            contributionCount
            contributionLevel
            color
            weekday
          }
        }
      }
      totalCommitContributions
      totalPullRequestContributions
      totalIssueContributions
      restrictedContributionsCount
      hasAnyRestrictedContributions
    }
  }
}
`;

export const GITHUB_GRAPHQL_PULL_REQUESTS_QUERY = `
query UserPullRequestsPage($login: String!, $after: String) {
  user(login: $login) {
    pullRequests(first: 100, after: $after, states: [MERGED], orderBy: {field: CREATED_AT, direction: DESC}) {
      totalCount
      pageInfo {
        endCursor
        hasNextPage
      }
      nodes {
        id
        number
        title
        body
        url
        merged
        mergedAt
        changedFiles
        repository {
          nameWithOwner
          url
        }
        author {
          login
          __typename
        }
      }
    }
  }
}
`;

export const GITHUB_GRAPHQL_ISSUES_QUERY = `
query UserIssuesPage($login: String!, $after: String) {
  user(login: $login) {
    issues(first: 100, after: $after, orderBy: {field: CREATED_AT, direction: DESC}) {
      totalCount
      pageInfo {
        endCursor
        hasNextPage
      }
      nodes {
        id
        number
        title
        body
        url
        createdAt
        repository {
          nameWithOwner
          url
        }
        author {
          login
          __typename
        }
        labels(first: 10) {
          nodes {
            name
          }
        }
      }
    }
  }
}
`;

/**
 * Legacy single-page query maintained for backward compatibility.
 */
export const GITHUB_GRAPHQL_PRS_ISSUES_QUERY = `
query UserPRsAndIssues($login: String!) {
  user(login: $login) {
    pullRequests(first: 100, states: [MERGED], orderBy: {field: CREATED_AT, direction: DESC}) {
      totalCount
      pageInfo {
        endCursor
        hasNextPage
      }
      nodes {
        id
        number
        title
        body
        url
        merged
        mergedAt
        changedFiles
        repository {
          nameWithOwner
          url
        }
        author {
          login
          __typename
        }
      }
    }
    issues(first: 100, orderBy: {field: CREATED_AT, direction: DESC}) {
      totalCount
      pageInfo {
        endCursor
        hasNextPage
      }
      nodes {
        id
        number
        title
        body
        url
        createdAt
        repository {
          nameWithOwner
          url
        }
        author {
          login
          __typename
        }
        labels(first: 10) {
          nodes {
            name
          }
        }
      }
    }
  }
}
`;

/**
 * Computes calendar streaks from normalized weeks array:
 * - activeDays: total count of days with contributionCount > 0
 * - longestStreak: max contiguous active days
 * - currentStreak: contiguous active days ending today or yesterday UTC
 */
export const computeCalendarStreaks = (weeks) => {
  if (!Array.isArray(weeks) || weeks.length === 0) {
    return { activeDays: 0, longestStreak: 0, currentStreak: 0 };
  }

  const allDays = [];
  for (const week of weeks) {
    if (Array.isArray(week.contributionDays)) {
      for (const day of week.contributionDays) {
        if (day && day.date) {
          allDays.push(day);
        }
      }
    }
  }

  if (allDays.length === 0) {
    return { activeDays: 0, longestStreak: 0, currentStreak: 0 };
  }

  allDays.sort((a, b) => a.date.localeCompare(b.date));

  let activeDays = 0;
  let longestStreak = 0;
  let currentRun = 0;
  let previousActiveDate = null;

  for (const day of allDays) {
    const count = Number(day.contributionCount ?? day.count ?? 0);
    if (count > 0) {
      activeDays++;
      if (previousActiveDate) {
        const prevMs = Date.parse(`${previousActiveDate}T00:00:00Z`);
        const currMs = Date.parse(`${day.date}T00:00:00Z`);
        const diffDays = Math.round((currMs - prevMs) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          currentRun++;
        } else {
          currentRun = 1;
        }
      } else {
        currentRun = 1;
      }
      previousActiveDate = day.date;
      if (currentRun > longestStreak) {
        longestStreak = currentRun;
      }
    } else {
      currentRun = 0;
      previousActiveDate = null;
    }
  }

  // Current streak calculation: walk backwards from calendar end
  let currentStreak = 0;
  const lastIndex = allDays.length - 1;
  const lastDay = allDays[lastIndex];
  const secondLastDay = lastIndex > 0 ? allDays[lastIndex - 1] : null;

  let startIndex = -1;
  if (Number(lastDay.contributionCount ?? lastDay.count ?? 0) > 0) {
    startIndex = lastIndex;
  } else if (secondLastDay && Number(secondLastDay.contributionCount ?? secondLastDay.count ?? 0) > 0) {
    startIndex = lastIndex - 1;
  }

  if (startIndex >= 0) {
    currentStreak = 1;
    for (let i = startIndex; i > 0; i--) {
      const curr = allDays[i];
      const prev = allDays[i - 1];
      const prevCount = Number(prev.contributionCount ?? prev.count ?? 0);
      if (prevCount <= 0) break;

      const currMs = Date.parse(`${curr.date}T00:00:00Z`);
      const prevMs = Date.parse(`${prev.date}T00:00:00Z`);
      const diffDays = Math.round((currMs - prevMs) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  return { activeDays, longestStreak, currentStreak };
};

/**
 * Filter qualified merged pull requests according to V13 Part 6.2 B anti-gaming rules:
 * - merged (not just opened)
 * - author NOT a bot (GitHub account type)
 * - >= 1 file changed
 * - non-empty body
 * - per-repo cap: max 5 counted from any single repository
 * qualifiedMergedPRs = Σ over repos of min(5, qualifiedPRsInRepo)
 */
export const filterQualifiedMergedPRs = (prNodes) => {
  if (!Array.isArray(prNodes)) {
    return { qualifiedCount: 0, qualifiedPRs: [], totalCount: 0 };
  }

  const qualifiedPRs = [];
  const repoCounts = new Map();

  for (const pr of prNodes) {
    if (!pr) continue;

    // 1. Merged check
    const isMerged = pr.merged === true || Boolean(pr.mergedAt);
    if (!isMerged) continue;

    // 2. Author not a bot
    const authorType = pr.author?.__typename || pr.user?.type;
    const authorLogin = String(pr.author?.login || pr.user?.login || '');
    if (authorType === 'Bot' || authorLogin.endsWith('[bot]')) continue;

    // 3. At least 1 file changed
    if (pr.changedFiles !== undefined && pr.changedFiles !== null && Number(pr.changedFiles) < 1) {
      continue;
    }

    // 4. Non-empty body
    const bodyText = typeof pr.body === 'string' ? pr.body.trim() : '';
    if (!bodyText) continue;

    // 5. Per-repo cap (max 5)
    const repoKey = pr.repository?.nameWithOwner || pr.repository?.url || 'unknown_repo';
    const currentRepoCount = repoCounts.get(repoKey) || 0;
    if (currentRepoCount >= 5) {
      continue;
    }

    repoCounts.set(repoKey, currentRepoCount + 1);
    qualifiedPRs.push(pr);
  }

  return {
    qualifiedCount: qualifiedPRs.length,
    qualifiedPRs,
    totalCount: prNodes.length,
  };
};

/**
 * Filter qualified issues according to V13 Part 6.2 B anti-gaming rules:
 * - body.length >= 100 chars OR at least one label attached
 * - author NOT a bot
 * - per-repo cap: max 10 from any single repository
 * qualifiedIssues = Σ over repos of min(10, qualifiedIssuesInRepo)
 */
export const filterQualifiedIssues = (issueNodes) => {
  if (!Array.isArray(issueNodes)) {
    return { qualifiedCount: 0, qualifiedIssues: [], totalCount: 0 };
  }

  const qualifiedIssues = [];
  const repoCounts = new Map();

  for (const issue of issueNodes) {
    if (!issue) continue;

    // 1. Author not a bot
    const authorType = issue.author?.__typename || issue.user?.type;
    const authorLogin = String(issue.author?.login || issue.user?.login || '');
    if (authorType === 'Bot' || authorLogin.endsWith('[bot]')) continue;

    // 2. body.length >= 100 chars OR at least one label attached
    const bodyLength = typeof issue.body === 'string' ? issue.body.trim().length : 0;
    const hasLabel =
      (Array.isArray(issue.labels?.nodes) && issue.labels.nodes.length > 0) ||
      (Array.isArray(issue.labels) && issue.labels.length > 0);
    if (bodyLength < 100 && !hasLabel) continue;

    // 3. Per-repo cap (max 10)
    const repoKey = issue.repository?.nameWithOwner || issue.repository?.url || 'unknown_repo';
    const currentRepoCount = repoCounts.get(repoKey) || 0;
    if (currentRepoCount >= 10) {
      continue;
    }

    repoCounts.set(repoKey, currentRepoCount + 1);
    qualifiedIssues.push(issue);
  }

  return {
    qualifiedCount: qualifiedIssues.length,
    qualifiedIssues,
    totalCount: issueNodes.length,
  };
};

/**
 * Fetches and normalizes GitHub contribution calendar using GitHub's GraphQL API.
 * Range: from = 365 days ago UTC, to = today UTC.
 */
export const fetchGithubGraphQLCalendar = async (username, token) => {
  if (!username || typeof username !== 'string' || !username.trim()) {
    throw new Error('Invalid username provided');
  }

  const cleanUsername = username.trim().replace(/^@/, '');
  const toDate = new Date();
  const to = toDate.toISOString();
  const fromDate = new Date(toDate.getTime() - 365 * 24 * 60 * 60 * 1000);
  const from = fromDate.toISOString();

  const data = await fetchGraphQL(
    GITHUB_GRAPHQL_CALENDAR_QUERY,
    { login: cleanUsername, from, to },
    token
  );

  if (!data?.user) {
    throw new Error(`GitHub profile not found for: ${cleanUsername}`);
  }

  const collection = data.user.contributionsCollection;
  if (!collection || !collection.contributionCalendar) {
    throw new Error('Malformed GitHub GraphQL contributionsCollection response');
  }

  const rawCalendar = collection.contributionCalendar;
  const rawWeeks = Array.isArray(rawCalendar.weeks) ? rawCalendar.weeks : [];

  const normalizedWeeks = rawWeeks.map(week => ({
    contributionDays: (Array.isArray(week.contributionDays) ? week.contributionDays : []).map(day => {
      const count = Number(day.contributionCount || 0);
      return {
        date: String(day.date),
        contributionCount: count,
        count,
        contributionLevel: ['NONE', 'FIRST_QUARTILE', 'SECOND_QUARTILE', 'THIRD_QUARTILE', 'FOURTH_QUARTILE'].includes(day.contributionLevel)
          ? day.contributionLevel
          : (count > 0 ? 'FIRST_QUARTILE' : 'NONE'),
        color: day.color ? String(day.color) : (count > 0 ? '#39d353' : '#161b22'),
        weekday: Number(day.weekday ?? (new Date(day.date).getUTCDay())),
      };
    })
  }));

  const { activeDays, longestStreak, currentStreak } = computeCalendarStreaks(normalizedWeeks);

  return {
    calendarTotalContributions: Number(rawCalendar.totalContributions || 0),
    restrictedContributionsCount: Number(collection.restrictedContributionsCount || 0),
    hasAnyRestrictedContributions: Boolean(collection.hasAnyRestrictedContributions),
    weeks: normalizedWeeks,
    activeDays,
    longestStreak,
    currentStreak,
    totalCommitContributions: Number(collection.totalCommitContributions || 0),
    totalPullRequestContributions: Number(collection.totalPullRequestContributions || 0),
    totalIssueContributions: Number(collection.totalIssueContributions || 0),
  };
};

/**
 * Fetches all pages of pull requests for a user via GraphQL using cursor pagination.
 * Deduplicates by stable node ID.
 * Respects pageInfo { endCursor hasNextPage }.
 */
export const fetchPaginatedPullRequests = async (username, token, options = {}) => {
  if (!username || typeof username !== 'string' || !username.trim()) {
    throw new Error('Invalid username provided');
  }
  if (!token) {
    throw new Error('GITHUB_TOKEN is required for GraphQL requests');
  }

  const cleanUsername = username.trim().replace(/^@/, '');
  const maxPages = options.maxPages || 20;

  const prMap = new Map();
  let cursor = null;
  let pageCount = 0;
  let totalCount = 0;

  while (pageCount < maxPages) {
    pageCount++;
    const data = await fetchGraphQL(
      GITHUB_GRAPHQL_PULL_REQUESTS_QUERY,
      { login: cleanUsername, after: cursor },
      token
    );

    if (!data?.user) {
      throw new Error(`GitHub profile not found for: ${cleanUsername}`);
    }

    const prConnection = data.user.pullRequests;
    if (!prConnection) {
      throw new Error('Malformed GitHub GraphQL pullRequests response');
    }

    totalCount = prConnection.totalCount ?? totalCount;
    const nodes = Array.isArray(prConnection.nodes) ? prConnection.nodes : [];

    for (const node of nodes) {
      if (node && node.id) {
        if (!prMap.has(node.id)) {
          prMap.set(node.id, node);
        }
      }
    }

    const pageInfo = prConnection.pageInfo;
    if (pageInfo?.hasNextPage) {
      if (pageCount >= maxPages) {
        throw new Error(
          `GitHub pull requests pagination limit reached with additional pages remaining (${pageCount} pages fetched). Retrieval is incomplete.`
        );
      }
      if (pageInfo.endCursor) {
        cursor = pageInfo.endCursor;
      } else {
        throw new Error('Malformed GitHub GraphQL pullRequests pageInfo: hasNextPage is true but endCursor is missing');
      }
    } else {
      break;
    }
  }

  return {
    totalCount: totalCount || prMap.size,
    nodes: Array.from(prMap.values()),
    pagesFetched: pageCount,
  };
};

/**
 * Fetches all pages of issues for a user via GraphQL using cursor pagination.
 * Deduplicates by stable node ID.
 * Respects pageInfo { endCursor hasNextPage }.
 */
export const fetchPaginatedIssues = async (username, token, options = {}) => {
  if (!username || typeof username !== 'string' || !username.trim()) {
    throw new Error('Invalid username provided');
  }
  if (!token) {
    throw new Error('GITHUB_TOKEN is required for GraphQL requests');
  }

  const cleanUsername = username.trim().replace(/^@/, '');
  const maxPages = options.maxPages || 20;

  const issueMap = new Map();
  let cursor = null;
  let pageCount = 0;
  let totalCount = 0;

  while (pageCount < maxPages) {
    pageCount++;
    const data = await fetchGraphQL(
      GITHUB_GRAPHQL_ISSUES_QUERY,
      { login: cleanUsername, after: cursor },
      token
    );

    if (!data?.user) {
      throw new Error(`GitHub profile not found for: ${cleanUsername}`);
    }

    const issueConnection = data.user.issues;
    if (!issueConnection) {
      throw new Error('Malformed GitHub GraphQL issues response');
    }

    totalCount = issueConnection.totalCount ?? totalCount;
    const nodes = Array.isArray(issueConnection.nodes) ? issueConnection.nodes : [];

    for (const node of nodes) {
      if (node && node.id) {
        if (!issueMap.has(node.id)) {
          issueMap.set(node.id, node);
        }
      }
    }

    const pageInfo = issueConnection.pageInfo;
    if (pageInfo?.hasNextPage) {
      if (pageCount >= maxPages) {
        throw new Error(
          `GitHub issues pagination limit reached with additional pages remaining (${pageCount} pages fetched). Retrieval is incomplete.`
        );
      }
      if (pageInfo.endCursor) {
        cursor = pageInfo.endCursor;
      } else {
        throw new Error('Malformed GitHub GraphQL issues pageInfo: hasNextPage is true but endCursor is missing');
      }
    } else {
      break;
    }
  }

  return {
    totalCount: totalCount || issueMap.size,
    nodes: Array.from(issueMap.values()),
    pagesFetched: pageCount,
  };
};

/**
 * Fetches pull requests and issues for a user via GraphQL across all pages,
 * deduplicates records by stable node ID, and applies anti-gaming rules across the complete dataset.
 */
export const fetchGithubPRsAndIssues = async (username, token, options = {}) => {
  if (!username || typeof username !== 'string' || !username.trim()) {
    throw new Error('Invalid username provided');
  }
  if (!token) {
    throw new Error('GITHUB_TOKEN is required for GitHub PR and issue search');
  }

  const cleanUsername = username.trim().replace(/^@/, '');

  // Fetch pull requests and issues concurrently with independent cursor loops
  const [prsResult, issuesResult] = await Promise.all([
    fetchPaginatedPullRequests(cleanUsername, token, options),
    fetchPaginatedIssues(cleanUsername, token, options),
  ]);

  // Apply anti-gaming filters across the entire deduplicated dataset
  const prFilter = filterQualifiedMergedPRs(prsResult.nodes);
  const issueFilter = filterQualifiedIssues(issuesResult.nodes);

  return {
    totalPRsCount: prsResult.totalCount,
    qualifiedMergedPRs: prFilter.qualifiedCount,
    qualifiedPRNodes: prFilter.qualifiedPRs,
    totalIssuesCount: issuesResult.totalCount,
    qualifiedIssues: issueFilter.qualifiedCount,
    qualifiedIssueNodes: issueFilter.qualifiedIssues,
    prsPagesFetched: prsResult.pagesFetched,
    issuesPagesFetched: issuesResult.pagesFetched,
  };
};

/**
 * Fetches and normalizes complete GitHub metrics (REST + GraphQL).
 */
export const fetchGithubMetrics = async (username) => {
  if (!username || typeof username !== 'string' || !username.trim()) {
    throw new Error('Invalid username provided');
  }

  const cleanUsername = username.trim().replace(/^@/, '');
  const token = process.env.GITHUB_TOKEN;

  const userUrl = `https://api.github.com/users/${encodeURIComponent(cleanUsername)}`;
  const reposUrl = `https://api.github.com/users/${encodeURIComponent(cleanUsername)}/repos?per_page=100&sort=updated`;

  try {
    // 1. Fetch REST user and repos
    const [user, repos] = await Promise.all([
      fetchJson(userUrl, token),
      fetchJson(reposUrl, token),
    ]);

    const languages = {};
    const topics = new Set();
    let stars = 0;
    let forks = 0;
    let effectiveRepositoryCount = 0;
    let recentlyActiveRepos = 0;

    const twoYearsAgoMs = Date.now() - (2 * 365 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgoMs = Date.now() - (90 * 24 * 60 * 60 * 1000);

    if (Array.isArray(repos)) {
      for (const repo of repos) {
        if (repo.language) {
          languages[repo.language] = (languages[repo.language] || 0) + 1;
        }
        if (Array.isArray(repo.topics)) {
          repo.topics.forEach(topic => topics.add(topic));
        }
        stars += Number(repo.stargazers_count || 0);
        forks += Number(repo.forks_count || 0);

        const isForked = Boolean(repo.fork);
        const size = Number(repo.size || 0);
        const hasActivity = Boolean(repo.pushed_at);
        const hasStars = Number(repo.stargazers_count || 0) > 0;
        const pushedMs = repo.pushed_at ? new Date(repo.pushed_at).getTime() : 0;

        if (!isForked && size > 0 && (hasActivity || hasStars)) {
          effectiveRepositoryCount++;
        }

        // Meaningful repo maintenance metrics (V13 Part 6.2 C)
        if (!isForked && size > 0 && pushedMs > twoYearsAgoMs) {
          if (pushedMs > ninetyDaysAgoMs) {
            recentlyActiveRepos++;
          }
        }
      }
    }

    const topLanguages = Object.entries(languages)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }));

    // 2. Fetch GraphQL contribution calendar and PRs/issues if token is available
    let calendar = null;
    let calendarError = null;
    let prsAndIssues = null;
    let prsError = null;

    if (token) {
      const [calResult, prsResult] = await Promise.allSettled([
        fetchGithubGraphQLCalendar(cleanUsername, token),
        fetchGithubPRsAndIssues(cleanUsername, token),
      ]);

      if (calResult.status === 'fulfilled') {
        calendar = calResult.value;
      } else {
        calendarError = calResult.reason?.message || 'Calendar fetch failed';
      }

      if (prsResult.status === 'fulfilled') {
        prsAndIssues = prsResult.value;
      } else {
        prsError = prsResult.reason?.message || 'PRs and issues fetch failed';
      }
    } else {
      calendarError = 'GITHUB_TOKEN is not configured on the server';
      prsError = 'GITHUB_TOKEN is not configured on the server';
    }

    return {
      publicRepos: Number(user.public_repos || 0),
      effectiveRepositoryCount,
      recentlyActiveRepos,
      followers: Number(user.followers || 0),
      stars,
      forks,
      topLanguages,
      topics: Array.from(topics).slice(0, 20),
      // GraphQL Calendar sub-signals
      calendar,
      calendarError,
      activeDaysLast365: calendar ? calendar.activeDays : null,
      // Verified PR and issue anti-gaming metrics
      prsAndIssues,
      prsError,
      mergedPRsCount: prsAndIssues ? prsAndIssues.totalPRsCount : null,
      qualifiedMergedPRsCount: prsAndIssues ? prsAndIssues.qualifiedMergedPRs : null,
      issuesCount: prsAndIssues ? prsAndIssues.totalIssuesCount : null,
      qualifiedIssuesCount: prsAndIssues ? prsAndIssues.qualifiedIssues : null,
      sourceDataUpdatedAt: user.updated_at ? new Date(user.updated_at) : null,
    };
  } catch (err) {
    if (err.message === 'profile not found') {
      throw new Error(`GitHub profile not found for: ${cleanUsername}`);
    }
    if (err.message === 'rate limit exceeded') {
      throw new Error('GitHub API rate limit exceeded');
    }
    throw new Error(`GitHub sync failed: ${sanitizeErrorMessage(err.message, token)}`);
  }
};

