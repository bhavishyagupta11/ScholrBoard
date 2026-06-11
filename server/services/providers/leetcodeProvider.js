const fetchJson = async (url, retries = 2) => {
  const headers = {
    Accept: 'application/json',
    'User-Agent': 'ScholrBoard-Sync/1.0',
  };

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
      await new Promise(resolve => setTimeout(resolve, 500 * attempt));
    }
  }
};

/**
 * Fetches and normalizes LeetCode user metrics.
 */
export const fetchLeetcodeMetrics = async (username) => {
  if (!username || typeof username !== 'string' || !username.trim()) {
    throw new Error('Invalid username provided');
  }

  const cleanUsername = username.trim().replace(/^@/, '');
  const base = process.env.LEETCODE_API_BASE || 'https://alfa-leetcode-api.onrender.com';

  const solvedUrl = `${base}/${encodeURIComponent(cleanUsername)}/solved`;
  const contestUrl = `${base}/${encodeURIComponent(cleanUsername)}/contest`;

  try {
    const [solvedData, contestData] = await Promise.allSettled([
      fetchJson(solvedUrl),
      fetchJson(contestUrl)
    ]);

    if (solvedData.status === 'rejected') {
      throw solvedData.reason;
    }

    const solved = solvedData.value || {};
    const contest = contestData.status === 'fulfilled' ? contestData.value : {};

    const totalSolved = Number(solved.solvedProblem || solved.totalSolved || 0);
    const easySolved = Number(solved.easySolved || 0);
    const mediumSolved = Number(solved.mediumSolved || 0);
    const hardSolved = Number(solved.hardSolved || 0);

    const contestRating = Math.round(Number(contest.contestRating || contest.rating || 0));
    const contestGlobalRanking = contest.contestGlobalRanking || null;
    const attendedContestsCount = Number(contest.attendedContestsCount || 0);

    return {
      totalSolved,
      easySolved,
      mediumSolved,
      hardSolved,
      contestRating,
      contestGlobalRanking,
      attendedContestsCount
    };
  } catch (err) {
    if (err.message === 'profile not found') {
      throw new Error(`LeetCode profile not found for: ${cleanUsername}`);
    }
    if (err.message === 'rate limit exceeded') {
      throw new Error('LeetCode API rate limit exceeded');
    }
    throw new Error(`LeetCode sync failed: ${err.message}`);
  }
};
