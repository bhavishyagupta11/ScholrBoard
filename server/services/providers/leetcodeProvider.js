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
 * Calculates the longest daily submission streak from an array of unix timestamps (in seconds).
 */
export const calculateLongestStreakFromTimestamps = (timestamps) => {
  if (!Array.isArray(timestamps) || timestamps.length === 0) return 0;

  const uniqueDays = new Set(
    timestamps.map(ts => {
      const d = new Date(Number(ts) * 1000);
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
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
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
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
};

/**
 * Backward-compatible helper to calculate longest streak from a raw JSON string.
 */
export const calculateLongestStreak = (submissionCalendarStr) => {
  if (!submissionCalendarStr) return 0;
  try {
    const calendar = typeof submissionCalendarStr === 'string'
      ? JSON.parse(submissionCalendarStr)
      : submissionCalendarStr;
    const timestamps = Object.keys(calendar)
      .map(t => Number(t))
      .filter(t => !isNaN(t) && calendar[t] > 0);
    return calculateLongestStreakFromTimestamps(timestamps);
  } catch (err) {
    return 0;
  }
};

/**
 * Parses LeetCode submissionCalendar into multi-window active submit days and assigns recencyLevel.
 *
 * Windows evaluated relative to evalDate (default: now):
 * - activeSubmitDays30d: days in [evalDate - 30d, evalDate]
 * - activeSubmitDays90d: days in [evalDate - 90d, evalDate]
 * - activeSubmitDays365d: days in [evalDate - 365d, evalDate]
 * - recencyLevel: 'L1' (calendar verified), 'L2' (lastActivityDate only), or 'L3' (absent/unavailable)
 */
export const parseSubmissionCalendar = (submissionCalendarInput, evalDate = new Date()) => {
  if (submissionCalendarInput === null || submissionCalendarInput === undefined) {
    return {
      activeSubmitDays30d: null,
      activeSubmitDays90d: null,
      activeSubmitDays365d: null,
      lastActivityDate: null,
      longestStreak: null,
      submissionCalendarRaw: null,
      recencyLevel: null,
    };
  }

  let calendarObj;
  let rawStr = typeof submissionCalendarInput === 'string'
    ? submissionCalendarInput
    : (typeof submissionCalendarInput === 'object' ? JSON.stringify(submissionCalendarInput) : null);

  try {
    calendarObj = typeof submissionCalendarInput === 'string'
      ? JSON.parse(submissionCalendarInput)
      : submissionCalendarInput;
  } catch (err) {
    return {
      activeSubmitDays30d: null,
      activeSubmitDays90d: null,
      activeSubmitDays365d: null,
      lastActivityDate: null,
      longestStreak: null,
      submissionCalendarRaw: rawStr,
      recencyLevel: null,
    };
  }

  if (!calendarObj || typeof calendarObj !== 'object' || Array.isArray(calendarObj)) {
    return {
      activeSubmitDays30d: null,
      activeSubmitDays90d: null,
      activeSubmitDays365d: null,
      lastActivityDate: null,
      longestStreak: null,
      submissionCalendarRaw: rawStr,
      recencyLevel: null,
    };
  }

  const validTimestamps = Object.keys(calendarObj)
    .map(t => Number(t))
    .filter(t => !isNaN(t) && Number(calendarObj[t]) > 0);

  if (validTimestamps.length === 0) {
    // Confirmed zero submissions: active days = 0, longest streak = 0, recency = 'L3' (no recorded activity)
    return {
      activeSubmitDays30d: 0,
      activeSubmitDays90d: 0,
      activeSubmitDays365d: 0,
      lastActivityDate: null,
      longestStreak: 0,
      submissionCalendarRaw: rawStr,
      recencyLevel: 'L3',
    };
  }

  const nowMs = evalDate.getTime();
  const ms30 = 30 * 24 * 60 * 60 * 1000;
  const ms90 = 90 * 24 * 60 * 60 * 1000;
  const ms365 = 365 * 24 * 60 * 60 * 1000;

  let count30 = 0;
  let count90 = 0;
  let count365 = 0;
  let maxTs = 0;

  for (const ts of validTimestamps) {
    const tsMs = ts * 1000;
    if (tsMs > maxTs) {
      maxTs = tsMs;
    }
    const ageMs = nowMs - tsMs;
    // Allow slight future tolerance (1 day) to handle server/client timezone drift
    if (ageMs <= ms30 && ageMs >= -86400000) {
      count30++;
    }
    if (ageMs <= ms90 && ageMs >= -86400000) {
      count90++;
    }
    if (ageMs <= ms365 && ageMs >= -86400000) {
      count365++;
    }
  }

  const longestStreak = calculateLongestStreakFromTimestamps(validTimestamps);
  const lastActivityDate = maxTs > 0 ? new Date(maxTs) : null;

  // L1: verified activity within the last 30 days
  // L2: verified activity within the last 90 days, but not within L1
  // L3: activity older than 90 days or no recorded activity
  let recencyLevel = 'L3';
  if (count30 > 0) {
    recencyLevel = 'L1';
  } else if (count90 > 0) {
    recencyLevel = 'L2';
  } else {
    recencyLevel = 'L3';
  }

  return {
    activeSubmitDays30d: count30,
    activeSubmitDays90d: count90,
    activeSubmitDays365d: count365,
    lastActivityDate,
    longestStreak,
    submissionCalendarRaw: rawStr,
    recencyLevel,
  };
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
    const totalSolved = Number(solved.solvedProblem || solved.totalSolved || 0);
    const easySolved = Number(solved.easySolved || 0);
    const mediumSolved = Number(solved.mediumSolved || 0);
    const hardSolved = Number(solved.hardSolved || 0);

    let isPartial = false;
    const subCallErrors = [];

    // 1. Contest Sub-Call Handling
    let contestRating = null;
    let contestGlobalRanking = null;
    let attendedContestsCount = null;
    let totalParticipants = null;
    let topPercentage = null;

    if (contestData.status === 'fulfilled') {
      const contest = contestData.value || {};
      const attended = contest.attendedContestsCount != null
        ? Number(contest.attendedContestsCount)
        : (contest.contestAttend != null ? Number(contest.contestAttend) : null);
      attendedContestsCount = attended;

      const rawRating = contest.contestRating != null
        ? Number(contest.contestRating)
        : (contest.rating != null ? Number(contest.rating) : null);

      // If user attended 0 contests or rating is non-positive / missing, store null (unrated state)
      contestRating = (attended !== 0 && rawRating != null && rawRating > 0)
        ? Math.round(rawRating)
        : null;

      const rawRank = contest.contestGlobalRanking != null
        ? Number(contest.contestGlobalRanking)
        : (contest.globalRanking != null ? Number(contest.globalRanking) : null);
      contestGlobalRanking = (rawRank != null && rawRank > 0) ? rawRank : null;

      const rawParticipants = contest.totalParticipants != null
        ? Number(contest.totalParticipants)
        : (contest.contestTotalParticipants != null ? Number(contest.contestTotalParticipants) : null);
      totalParticipants = (rawParticipants != null && rawParticipants > 0) ? rawParticipants : null;

      const rawTopPct = contest.topPercentage != null
        ? Number(contest.topPercentage)
        : (contest.contestTopPercentage != null ? Number(contest.contestTopPercentage) : null);
      topPercentage = (rawTopPct != null && !isNaN(rawTopPct) && rawTopPct >= 0 && rawTopPct <= 100)
        ? Number(rawTopPct.toFixed(2))
        : null;
    } else {
      isPartial = true;
      subCallErrors.push(`Contest data unavailable: ${contestData.reason?.message || 'failed'}`);
    }

    // 2. Calendar Sub-Call Handling & Window Parsing
    let streak = null;
    let longestStreak = null;
    let activeSubmitDays30d = null;
    let activeSubmitDays90d = null;
    let activeSubmitDays365d = null;
    let lastActivityDate = null;
    let submissionCalendarRaw = null;
    let recencyLevel = null;

    if (calendarData.status === 'fulfilled') {
      const calendar = calendarData.value || {};
      const rawCalendarInput = calendar.submissionCalendar !== undefined ? calendar.submissionCalendar : calendar.calendar;
      const parsedCalendar = parseSubmissionCalendar(rawCalendarInput);
      
      activeSubmitDays30d = parsedCalendar.activeSubmitDays30d;
      activeSubmitDays90d = parsedCalendar.activeSubmitDays90d;
      activeSubmitDays365d = parsedCalendar.activeSubmitDays365d;
      longestStreak = parsedCalendar.longestStreak;
      submissionCalendarRaw = parsedCalendar.submissionCalendarRaw;
      lastActivityDate = parsedCalendar.lastActivityDate || (calendar.lastActivityDate ? new Date(calendar.lastActivityDate) : null);
      recencyLevel = parsedCalendar.recencyLevel;

      if (activeSubmitDays30d !== null) {
        streak = calendar.streak != null ? Number(calendar.streak) : (parsedCalendar.activeSubmitDays30d === 0 ? 0 : null);
      } else {
        streak = null;
      }

      // If calendar was unparseable or absent but an explicit lastActivityDate was present in provider envelope
      if (recencyLevel === null && lastActivityDate && activeSubmitDays30d === null) {
        const lastDateAgeMs = Date.now() - new Date(lastActivityDate).getTime();
        if (lastDateAgeMs <= 30 * 24 * 60 * 60 * 1000 && lastDateAgeMs >= -86400000) {
          recencyLevel = 'L1';
        } else if (lastDateAgeMs <= 90 * 24 * 60 * 60 * 1000 && lastDateAgeMs >= -86400000) {
          recencyLevel = 'L2';
        } else {
          recencyLevel = 'L3';
        }
      }

      // If calendar submission activity data was unavailable, null, or malformed, flag partial sync
      if (activeSubmitDays30d === null) {
        isPartial = true;
        subCallErrors.push('Calendar submission data unavailable, null, or malformed');
      }
    } else {
      isPartial = true;
      subCallErrors.push(`Calendar data unavailable: ${calendarData.reason?.message || 'failed'}`);
    }

    return {
      totalSolved,
      easySolved,
      mediumSolved,
      hardSolved,
      contestRating,
      contestGlobalRanking,
      attendedContestsCount,
      totalParticipants,
      topPercentage,
      streak,
      longestStreak,
      activeSubmitDays30d,
      activeSubmitDays90d,
      activeSubmitDays365d,
      lastActivityDate,
      submissionCalendarRaw,
      recencyLevel,
      isPartial,
      partialError: subCallErrors.length > 0 ? subCallErrors.join('; ') : null,
      sourceDataUpdatedAt: lastActivityDate || null,
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
