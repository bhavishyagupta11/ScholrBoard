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
 * Fetches and normalizes GitHub user metrics.
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
    const [user, repos] = await Promise.all([
      fetchJson(userUrl, token),
      fetchJson(reposUrl, token)
    ]);

    const languages = {};
    const topics = new Set();
    let stars = 0;
    let forks = 0;
    let effectiveRepositoryCount = 0;

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

        // Effective repository logic: not a fork, size > 0, and has activity (pushed_at) OR stars > 0
        const isForked = !!repo.fork;
        const size = Number(repo.size || 0);
        const hasActivity = !!repo.pushed_at;
        const hasStars = Number(repo.stargazers_count || 0) > 0;

        if (!isForked && size > 0 && (hasActivity || hasStars)) {
          effectiveRepositoryCount++;
        }
      }
    }

    const topLanguages = Object.entries(languages)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }));

    return {
      publicRepos: Number(user.public_repos || 0),
      effectiveRepositoryCount,
      followers: Number(user.followers || 0),
      stars,
      forks,
      topLanguages,
      topics: Array.from(topics).slice(0, 20)
    };
  } catch (err) {
    if (err.message === 'profile not found') {
      throw new Error(`GitHub profile not found for: ${cleanUsername}`);
    }
    if (err.message === 'rate limit exceeded') {
      throw new Error('GitHub API rate limit exceeded');
    }
    throw new Error(`GitHub sync failed: ${err.message}`);
  }
};
