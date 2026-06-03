import Profile from '../models/Profile.js';

const normalizeUsername = (value) => String(value || '').trim().replace(/^@/, '');

const fetchJson = async (url, options = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 10000);
  const response = await fetch(url, {
    ...options,
    signal: controller.signal,
    headers: {
      Accept: 'application/json',
      'User-Agent': 'ScholrMind/1.0',
      ...(options.headers || {}),
    },
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`External API request failed (${response.status}) ${body.slice(0, 120)}`);
  }

  return response.json();
};

const syncFallback = async (req, res, platform, username, error) => {
  const profileUrlByPlatform = {
    github: `https://github.com/${username}`,
    leetcode: `https://leetcode.com/${username}`,
    codeforces: `https://codeforces.com/profile/${username}`,
  };

  const codingStats = await updateCodingProfile(req.user._id, {
    [`codingStats.profiles.${platform}`]: username,
    [`codingStats.platformDetails.${platform}`]: {
      username,
      profileUrl: profileUrlByPlatform[platform],
      syncMode: 'linked',
      warning: 'Live stats could not be fetched. Profile was linked and can be synced again later.',
      lastError: String(error?.message || error).slice(0, 250),
      syncedAt: new Date(),
    },
    ...(platform === 'github' ? { 'socialLinks.github': profileUrlByPlatform.github } : {}),
    ...(platform === 'leetcode' ? { 'socialLinks.leetcode': profileUrlByPlatform.leetcode } : {}),
    ...(platform === 'codeforces' ? { 'socialLinks.codeforces': profileUrlByPlatform.codeforces } : {}),
  });

  return res.json({
    success: true,
    degraded: true,
    message: `${platform} profile linked. Live stats are temporarily unavailable.`,
    codingStats,
  });
};

const updateCodingProfile = async (userId, update) => {
  const profile = await Profile.findOneAndUpdate(
    { userId },
    { $set: { ...update, 'codingStats.lastUpdated': new Date() } },
    { new: true, upsert: true, runValidators: true }
  );

  return profile.codingStats;
};

export const syncGithub = async (req, res) => {
  try {
    const username = normalizeUsername(req.body.username);
    if (!username) {
      return res.status(400).json({ success: false, message: 'GitHub username is required' });
    }

    const userUrl = `https://api.github.com/users/${encodeURIComponent(username)}`;
    const reposUrl = `https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated`;
    const headers = process.env.GITHUB_TOKEN
      ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
      : {};

    const [githubUser, repos] = await Promise.all([
      fetchJson(userUrl, { headers }),
      fetchJson(reposUrl, { headers }),
    ]);

    const languages = {};
    const topics = new Set();
    let stars = 0;
    let forks = 0;

    for (const repo of repos) {
      if (repo.language) languages[repo.language] = (languages[repo.language] || 0) + 1;
      (repo.topics || []).forEach((topic) => topics.add(topic));
      stars += repo.stargazers_count || 0;
      forks += repo.forks_count || 0;
    }

    const codingStats = await updateCodingProfile(req.user._id, {
      'socialLinks.github': githubUser.html_url,
      'codingStats.githubRepos': githubUser.public_repos || 0,
      'codingStats.githubFollowers': githubUser.followers || 0,
      'codingStats.githubContributions': stars + forks,
      'codingStats.profiles.github': username,
      'codingStats.platformDetails.github': {
        username,
        profileUrl: githubUser.html_url,
        publicRepos: githubUser.public_repos || 0,
        followers: githubUser.followers || 0,
        following: githubUser.following || 0,
        stars,
        forks,
        topLanguages: Object.entries(languages)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([name, count]) => ({ name, count })),
        topics: Array.from(topics).slice(0, 20),
        syncedAt: new Date(),
      },
    });

    return res.json({ success: true, message: 'GitHub profile synced', codingStats });
  } catch (error) {
    console.error('syncGithub error:', error);
    return syncFallback(req, res, 'github', normalizeUsername(req.body.username), error);
  }
};

export const syncLeetcode = async (req, res) => {
  try {
    const username = normalizeUsername(req.body.username);
    if (!username) {
      return res.status(400).json({ success: false, message: 'LeetCode username is required' });
    }

    const base = process.env.LEETCODE_API_BASE || 'https://alfa-leetcode-api.onrender.com';
    const [profileData, contestData] = await Promise.allSettled([
      fetchJson(`${base}/${encodeURIComponent(username)}/solved`),
      fetchJson(`${base}/${encodeURIComponent(username)}/contest`),
    ]);

    if (profileData.status === 'rejected') throw profileData.reason;

    const solved = profileData.value;
    const contest = contestData.status === 'fulfilled' ? contestData.value : {};
    const totalSolved = Number(solved.solvedProblem || solved.totalSolved || 0);
    const contestRating = Math.round(Number(contest.contestRating || contest.rating || 0));

    const codingStats = await updateCodingProfile(req.user._id, {
      'socialLinks.leetcode': `https://leetcode.com/${username}`,
      'codingStats.leetcodeProblemsSolved': totalSolved,
      'codingStats.leetcodeContestRating': contestRating,
      'codingStats.profiles.leetcode': username,
      'codingStats.platformDetails.leetcode': {
        username,
        profileUrl: `https://leetcode.com/${username}`,
        totalSolved,
        easySolved: Number(solved.easySolved || 0),
        mediumSolved: Number(solved.mediumSolved || 0),
        hardSolved: Number(solved.hardSolved || 0),
        contestRating,
        contestGlobalRanking: contest.contestGlobalRanking || null,
        attendedContestsCount: contest.attendedContestsCount || 0,
        syncedAt: new Date(),
      },
    });

    return res.json({ success: true, message: 'LeetCode profile synced', codingStats });
  } catch (error) {
    console.error('syncLeetcode error:', error);
    return syncFallback(req, res, 'leetcode', normalizeUsername(req.body.username), error);
  }
};

export const syncCodeforces = async (req, res) => {
  try {
    const username = normalizeUsername(req.body.username);
    if (!username) return res.status(400).json({ success: false, message: 'Codeforces handle is required' });

    const data = await fetchJson(`https://codeforces.com/api/user.info?handles=${encodeURIComponent(username)}`);
    const info = data.result?.[0];
    if (!info) return res.status(404).json({ success: false, message: 'Codeforces profile not found' });

    const codingStats = await updateCodingProfile(req.user._id, {
      'socialLinks.codeforces': `https://codeforces.com/profile/${username}`,
      'codingStats.codeforcesRating': info.rating || 0,
      'codingStats.codeforcesMaxRating': info.maxRating || 0,
      'codingStats.codeforcesRank': info.rank || '',
      'codingStats.profiles.codeforces': username,
      'codingStats.platformDetails.codeforces': {
        username,
        profileUrl: `https://codeforces.com/profile/${username}`,
        rating: info.rating || 0,
        maxRating: info.maxRating || 0,
        rank: info.rank || null,
        maxRank: info.maxRank || null,
        contribution: info.contribution || 0,
        syncedAt: new Date(),
      },
    });

    return res.json({ success: true, message: 'Codeforces profile synced', codingStats });
  } catch (error) {
    console.error('syncCodeforces error:', error);
    return syncFallback(req, res, 'codeforces', normalizeUsername(req.body.username), error);
  }
};

export const linkCodingProfile = async (req, res) => {
  try {
    const { platform } = req.params;
    const username = normalizeUsername(req.body.username);
    const supported = ['geeksforgeeks', 'hackerrank', 'codechef', 'linkedin'];

    if (!supported.includes(platform)) {
      return res.status(400).json({ success: false, message: 'Unsupported platform' });
    }
    if (!username) {
      return res.status(400).json({ success: false, message: 'Username or profile URL is required' });
    }

    const codingStats = await updateCodingProfile(req.user._id, {
      [`codingStats.profiles.${platform}`]: username,
      [`codingStats.platformDetails.${platform}`]: {
        username,
        syncMode: 'linked',
        note: 'Stored for profile analytics. Public API sync is not available for this platform yet.',
        syncedAt: new Date(),
      },
      ...(platform === 'linkedin' ? { 'codingStats.linkedInConnected': true, 'socialLinks.linkedin': username } : {}),
    });

    return res.json({ success: true, message: `${platform} profile linked`, codingStats });
  } catch (error) {
    console.error('linkCodingProfile error:', error);
    return res.status(500).json({ success: false, message: 'Unable to link coding profile' });
  }
};
