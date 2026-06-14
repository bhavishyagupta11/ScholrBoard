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

const calculateLongestStreak = (submissionCalendarStr) => {
  if (!submissionCalendarStr) return 0;
  try {
    const calendar = JSON.parse(submissionCalendarStr);
    const timestamps = Object.keys(calendar)
      .map(t => Number(t))
      .filter(t => calendar[t] > 0);

    if (timestamps.length === 0) return 0;

    const uniqueDays = new Set(
      timestamps.map(ts => {
        const d = new Date(ts * 1000);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      })
    );

    const sortedDays = Array.from(uniqueDays).sort();

    let maxStreak = 0;
    let currentStreak = 0;
    let prevDate = null;

    for (const dayStr of sortedDays) {
      const currentDate = new Date(dayStr);
      if (prevDate === null) {
        currentStreak = 1;
      } else {
        const diffTime = Math.abs(currentDate - prevDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          currentStreak++;
        } else if (diffDays > 1) {
          if (currentStreak > maxStreak) {
            maxStreak = currentStreak;
          }
          currentStreak = 1;
        }
      }
      prevDate = currentDate;
    }

    if (currentStreak > maxStreak) {
      maxStreak = currentStreak;
    }

    return maxStreak;
  } catch (err) {
    console.error('Error calculating longest streak:', err);
    return 0;
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
  const calendarUrl = `${base}/${encodeURIComponent(cleanUsername)}/calendar`;

  try {
    const [solvedData, contestData, calendarData] = await Promise.allSettled([
      fetchJson(solvedUrl),
      fetchJson(contestUrl),
      fetchJson(calendarUrl)
    ]);

    if (solvedData.status === 'rejected') {
      throw solvedData.reason;
    }

    const solved = solvedData.value || {};
    const contest = contestData.status === 'fulfilled' ? contestData.value : {};
    const calendar = calendarData.status === 'fulfilled' ? calendarData.value : {};

    const totalSolved = Number(solved.solvedProblem || solved.totalSolved || 0);
    const easySolved = Number(solved.easySolved || 0);
    const mediumSolved = Number(solved.mediumSolved || 0);
    const hardSolved = Number(solved.hardSolved || 0);

    const contestRating = Math.round(Number(contest.contestRating || contest.rating || 0));
    const contestGlobalRanking = contest.contestGlobalRanking || null;
    const attendedContestsCount = Number(contest.attendedContestsCount || 0);

    const streak = Number(calendar.streak || 0);
    const submissionCalendar = calendar.submissionCalendar || '{}';
    const longestStreak = calculateLongestStreak(submissionCalendar);

    return {
      totalSolved,
      easySolved,
      mediumSolved,
      hardSolved,
      contestRating,
      contestGlobalRanking,
      attendedContestsCount,
      streak,
      longestStreak
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
