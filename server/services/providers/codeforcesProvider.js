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
      
      const body = await res.json().catch(() => ({}));
      
      if (res.status === 400 || (body && body.status === 'FAILED')) {
        throw new Error('profile not found');
      }
      if (res.status === 429) {
        throw new Error('rate limit exceeded');
      }
      if (!res.ok) {
        throw new Error(`API error (${res.status})`);
      }
      return body;
    } catch (err) {
      if (attempt === retries || err.message === 'profile not found' || err.message === 'rate limit exceeded') {
        throw err;
      }
      await new Promise(resolve => setTimeout(resolve, 500 * attempt));
    }
  }
};

/**
 * Fetches and normalizes Codeforces user metrics.
 */
export const fetchCodeforcesMetrics = async (username) => {
  if (!username || typeof username !== 'string' || !username.trim()) {
    throw new Error('Invalid username provided');
  }

  const cleanUsername = username.trim().replace(/^@/, '');
  const infoUrl = `https://codeforces.com/api/user.info?handles=${encodeURIComponent(cleanUsername)}`;
  const ratingUrl = `https://codeforces.com/api/user.rating?handle=${encodeURIComponent(cleanUsername)}`;

  try {
    const [infoRes, ratingRes] = await Promise.allSettled([
      fetchJson(infoUrl),
      fetchJson(ratingUrl)
    ]);

    if (infoRes.status === 'rejected') {
      throw infoRes.reason;
    }

    const data = infoRes.value;
    const info = data.result?.[0];
    
    if (!info) {
      throw new Error('profile not found');
    }

    let lastContestAt = null;
    if (ratingRes.status === 'fulfilled' && ratingRes.value && ratingRes.value.status === 'OK') {
      const contests = ratingRes.value.result || [];
      if (contests.length > 0) {
        const lastContest = contests[contests.length - 1];
        if (lastContest.ratingUpdateTimeSeconds) {
          lastContestAt = new Date(lastContest.ratingUpdateTimeSeconds * 1000);
        }
      }
    }

    return {
      rating: Number(info.rating || 0),
      maxRating: Number(info.maxRating || 0),
      rank: info.rank || null,
      maxRank: info.maxRank || null,
      contribution: Number(info.contribution || 0),
      lastContestAt
    };
  } catch (err) {
    if (err.message === 'profile not found') {
      throw new Error(`Codeforces handle not found: ${cleanUsername}`);
    }
    if (err.message === 'rate limit exceeded') {
      throw new Error('Codeforces API rate limit exceeded');
    }
    throw new Error(`Codeforces sync failed: ${err.message}`);
  }
};
