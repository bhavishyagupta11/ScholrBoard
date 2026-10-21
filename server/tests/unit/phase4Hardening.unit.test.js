import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchLeetcodeMetrics,
  parseSubmissionCalendar,
  calculateLongestStreakFromTimestamps,
} from '../../services/providers/leetcodeProvider.js';
import { fetchCodeforcesMetrics } from '../../services/providers/codeforcesProvider.js';

test('Phase 4.1: LeetCode parseSubmissionCalendar parses multi-window active submit days, longest streak, and L1 recency', () => {
  const evalDate = new Date('2025-10-15T00:00:00Z');
  const nowSec = Math.floor(evalDate.getTime() / 1000);

  // Timestamps:
  // 5 days ago (in 30d, 90d, 365d)
  const ts5d = nowSec - 5 * 86400;
  // 45 days ago (in 90d, 365d)
  const ts45d = nowSec - 45 * 86400;
  // 120 days ago (in 365d)
  const ts120d = nowSec - 120 * 86400;
  // 400 days ago (outside 365d)
  const ts400d = nowSec - 400 * 86400;

  const calendarPayload = {
    [ts5d]: 3,
    [ts45d]: 1,
    [ts120d]: 4,
    [ts400d]: 2,
  };

  const parsed = parseSubmissionCalendar(JSON.stringify(calendarPayload), evalDate);

  assert.equal(parsed.recencyLevel, 'L1', 'Must be Level 1 when submissionCalendar is present and valid');
  assert.equal(parsed.activeSubmitDays30d, 1, 'Exactly 1 active day in 30d window');
  assert.equal(parsed.activeSubmitDays90d, 2, 'Exactly 2 active days in 90d window (5d and 45d)');
  assert.equal(parsed.activeSubmitDays365d, 3, 'Exactly 3 active days in 365d window (5d, 45d, 120d)');
  assert.equal(new Date(parsed.lastActivityDate).getTime(), ts5d * 1000, 'lastActivityDate must be the latest timestamp');
  assert.ok(parsed.submissionCalendarRaw, 'Must preserve raw calendar string');
});

test('Phase 4.2: LeetCode parseSubmissionCalendar distinguishes confirmed zero activity from missing/null/malformed calendar data', () => {
  // Case 1: Confirmed zero activity (valid empty calendar object or "{}" string)
  const emptyStringCalendar = parseSubmissionCalendar('{}');
  assert.equal(emptyStringCalendar.recencyLevel, 'L3', 'Empty calendar has zero submissions; recencyLevel must be L3');
  assert.equal(emptyStringCalendar.activeSubmitDays30d, 0, 'Confirmed 0 in 30d window');
  assert.equal(emptyStringCalendar.activeSubmitDays90d, 0, 'Confirmed 0 in 90d window');
  assert.equal(emptyStringCalendar.activeSubmitDays365d, 0, 'Confirmed 0 in 365d window');
  assert.equal(emptyStringCalendar.longestStreak, 0, 'Confirmed 0 longest streak');
  assert.equal(emptyStringCalendar.lastActivityDate, null);

  const emptyObjCalendar = parseSubmissionCalendar({});
  assert.equal(emptyObjCalendar.recencyLevel, 'L3');
  assert.equal(emptyObjCalendar.activeSubmitDays30d, 0);
  assert.equal(emptyObjCalendar.longestStreak, 0);

  // Date boundary recency classification:
  const refDate = new Date('2025-10-15T00:00:00Z');
  const refSec = Math.floor(refDate.getTime() / 1000);

  // Submissions within 30d => L1
  const cal30d = parseSubmissionCalendar(JSON.stringify({ [refSec - 10 * 86400]: 1 }), refDate);
  assert.equal(cal30d.recencyLevel, 'L1', 'Submissions within 30d must be L1');

  // Submissions between 31d and 90d => L2
  const cal90d = parseSubmissionCalendar(JSON.stringify({ [refSec - 60 * 86400]: 1 }), refDate);
  assert.equal(cal90d.recencyLevel, 'L2', 'Submissions between 31d and 90d must be L2');

  // Submissions older than 90d => L3
  const calOlder = parseSubmissionCalendar(JSON.stringify({ [refSec - 150 * 86400]: 1 }), refDate);
  assert.equal(calOlder.recencyLevel, 'L3', 'Submissions older than 90d must be L3');

  // Case 2: Missing submissionCalendar field (undefined)
  const missingCalendar = parseSubmissionCalendar(undefined);
  assert.equal(missingCalendar.recencyLevel, null, 'Missing calendar evaluates to recencyLevel null');
  assert.equal(missingCalendar.activeSubmitDays30d, null, 'Unavailable data must be null, not 0');
  assert.equal(missingCalendar.activeSubmitDays90d, null);
  assert.equal(missingCalendar.activeSubmitDays365d, null);
  assert.equal(missingCalendar.longestStreak, null, 'Unknown longest streak must be null, not 0');
  assert.equal(missingCalendar.lastActivityDate, null);
  assert.equal(missingCalendar.submissionCalendarRaw, null);

  // Case 3: Explicitly null calendar (null)
  const nullCalendar = parseSubmissionCalendar(null);
  assert.equal(nullCalendar.recencyLevel, null, 'Explicitly null calendar is unknown; recencyLevel must be null');
  assert.equal(nullCalendar.activeSubmitDays30d, null, 'Null calendar must evaluate to null, not 0');
  assert.equal(nullCalendar.activeSubmitDays90d, null);
  assert.equal(nullCalendar.activeSubmitDays365d, null);
  assert.equal(nullCalendar.longestStreak, null, 'Null calendar streak must be null, not 0');
  assert.equal(nullCalendar.lastActivityDate, null);
  assert.equal(nullCalendar.submissionCalendarRaw, null);

  // Case 4: Malformed JSON, invalid types, or non-object arrays
  const malformedJson = parseSubmissionCalendar('{ invalid_json: ');
  assert.equal(malformedJson.recencyLevel, null, 'Malformed JSON evaluates to recencyLevel null');
  assert.equal(malformedJson.activeSubmitDays30d, null);
  assert.equal(malformedJson.longestStreak, null);

  const arrayCalendar = parseSubmissionCalendar([1, 2, 3]);
  assert.equal(arrayCalendar.recencyLevel, null);
  assert.equal(arrayCalendar.activeSubmitDays30d, null);
  assert.equal(arrayCalendar.longestStreak, null);

  const numberCalendar = parseSubmissionCalendar(99999);
  assert.equal(numberCalendar.recencyLevel, null);
  assert.equal(numberCalendar.activeSubmitDays30d, null);
  assert.equal(numberCalendar.longestStreak, null);
});

test('Phase 4.3: LeetCode fetchLeetcodeMetrics handles successful responses across solved, contest, and calendar', async () => {
  const originalFetch = globalThis.fetch;

  const mockCalendar = {
    streak: 12,
    submissionCalendar: JSON.stringify({
      [Math.floor(Date.now() / 1000) - 86400]: 3,
    }),
  };

  globalThis.fetch = async (url) => {
    const urlStr = String(url);
    if (urlStr.includes('/solved')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          solvedProblem: 320,
          easySolved: 120,
          mediumSolved: 150,
          hardSolved: 50,
        }),
      };
    }
    if (urlStr.includes('/contest')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          contestRating: 1785.4,
          contestGlobalRanking: 14200,
          attendedContestsCount: 15,
        }),
      };
    }
    if (urlStr.includes('/calendar')) {
      return {
        ok: true,
        status: 200,
        json: async () => mockCalendar,
      };
    }
    return { ok: false, status: 404 };
  };

  try {
    const metrics = await fetchLeetcodeMetrics('coder123');

    assert.equal(metrics.totalSolved, 320);
    assert.equal(metrics.easySolved, 120);
    assert.equal(metrics.mediumSolved, 150);
    assert.equal(metrics.hardSolved, 50);
    assert.equal(metrics.contestRating, 1785);
    assert.equal(metrics.contestGlobalRanking, 14200);
    assert.equal(metrics.attendedContestsCount, 15);
    assert.equal(metrics.streak, 12);
    assert.equal(metrics.recencyLevel, 'L1');
    assert.equal(metrics.activeSubmitDays30d, 1);
    assert.equal(metrics.isPartial, false);
    assert.equal(metrics.partialError, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Phase 4.4: LeetCode fetchLeetcodeMetrics handles partial sub-call failures and flags isPartial', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url) => {
    const urlStr = String(url);
    if (urlStr.includes('/solved')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          solvedProblem: 100,
          easySolved: 50,
          mediumSolved: 40,
          hardSolved: 10,
        }),
      };
    }
    if (urlStr.includes('/contest')) {
      // Contest proxy returns 503 Service Unavailable
      return { ok: false, status: 503, text: async () => 'Contest service down' };
    }
    if (urlStr.includes('/calendar')) {
      // Calendar proxy returns 500 Internal Error
      return { ok: false, status: 500, text: async () => 'Calendar internal error' };
    }
    return { ok: false, status: 404 };
  };

  try {
    const metrics = await fetchLeetcodeMetrics('coder123');

    // Primary solved metrics succeed
    assert.equal(metrics.totalSolved, 100);
    assert.equal(metrics.easySolved, 50);
    assert.equal(metrics.mediumSolved, 40);
    assert.equal(metrics.hardSolved, 10);

    // Sub-call failures must set unavailable fields to null (NOT confirmed 0)
    assert.equal(metrics.contestRating, null, 'Unavailable contest rating must be null');
    assert.equal(metrics.contestGlobalRanking, null);
    assert.equal(metrics.attendedContestsCount, null);
    assert.equal(metrics.activeSubmitDays30d, null);
    assert.equal(metrics.activeSubmitDays90d, null);
    assert.equal(metrics.activeSubmitDays365d, null);
    assert.equal(metrics.streak, null, 'Unavailable streak must be null, not 0');
    assert.equal(metrics.longestStreak, null, 'Unavailable longest streak must be null, not 0');
    assert.equal(metrics.recencyLevel, null, 'Unavailable calendar must evaluate to recencyLevel null');

    // Partial state must be recorded
    assert.equal(metrics.isPartial, true);
    assert.ok(metrics.partialError.includes('Contest data unavailable'));
    assert.ok(metrics.partialError.includes('Calendar data unavailable'));
  } finally {
    globalThis.fetch = originalFetch;
  }

  // Sub-case B: Calendar HTTP 200 with confirmed empty calendar "{}"
  globalThis.fetch = async (url) => {
    const urlStr = String(url);
    if (urlStr.includes('/solved')) {
      return { ok: true, status: 200, json: async () => ({ solvedProblem: 50 }) };
    }
    if (urlStr.includes('/contest')) {
      return { ok: true, status: 200, json: async () => ({ contestRating: 1500 }) };
    }
    if (urlStr.includes('/calendar')) {
      return { ok: true, status: 200, json: async () => ({ streak: 0, submissionCalendar: '{}' }) };
    }
    return { ok: false, status: 404 };
  };

  try {
    const metrics = await fetchLeetcodeMetrics('coder123');
    assert.equal(metrics.isPartial, false, 'Confirmed empty calendar is a complete successful sync');
    assert.equal(metrics.activeSubmitDays30d, 0);
    assert.equal(metrics.activeSubmitDays90d, 0);
    assert.equal(metrics.activeSubmitDays365d, 0);
    assert.equal(metrics.streak, 0, 'Confirmed empty calendar must confirm 0 streak');
    assert.equal(metrics.longestStreak, 0);
    assert.equal(metrics.recencyLevel, 'L3', 'Confirmed empty calendar has no submissions; recencyLevel must be L3');
  } finally {
    globalThis.fetch = originalFetch;
  }

  // Sub-case C: Calendar HTTP 200 but submissionCalendar is missing, null, or malformed
  for (const badCalendarPayload of [
    { streak: 5 }, // missing submissionCalendar
    { streak: 5, submissionCalendar: null }, // explicitly null
    { streak: 5, submissionCalendar: '{ broken json' }, // malformed JSON
  ]) {
    globalThis.fetch = async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/solved')) {
        return { ok: true, status: 200, json: async () => ({ solvedProblem: 50 }) };
      }
      if (urlStr.includes('/contest')) {
        return { ok: true, status: 200, json: async () => ({ contestRating: 1500 }) };
      }
      if (urlStr.includes('/calendar')) {
        return { ok: true, status: 200, json: async () => badCalendarPayload };
      }
      return { ok: false, status: 404 };
    };

    try {
      const metrics = await fetchLeetcodeMetrics('coder123');
      assert.equal(metrics.isPartial, true, 'Missing/null/malformed calendar must flag isPartial');
      assert.equal(metrics.activeSubmitDays30d, null, 'Must be null, not 0');
      assert.equal(metrics.streak, null, 'Streak from calendar must be null, not 0');
      assert.equal(metrics.longestStreak, null, 'Longest streak from calendar must be null, not 0');
      assert.equal(metrics.recencyLevel, null, 'Recency level must be null when calendar is unavailable');
      assert.ok(metrics.partialError.includes('Calendar submission data unavailable, null, or malformed'));
    } finally {
      globalThis.fetch = originalFetch;
    }
  }
});

test('Phase 4.5: LeetCode fetchLeetcodeMetrics input validation and error mapping', async () => {
  const originalFetch = globalThis.fetch;

  // 1. Validation
  await assert.rejects(() => fetchLeetcodeMetrics(''), /Invalid username provided/);
  await assert.rejects(() => fetchLeetcodeMetrics(null), /Invalid username provided/);

  // 2. 404 Profile not found
  globalThis.fetch = async () => ({ ok: false, status: 404 });
  try {
    await assert.rejects(
      () => fetchLeetcodeMetrics('unknown_ghost_user'),
      /LeetCode profile not found/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  // 3. 429 Rate limit
  globalThis.fetch = async () => ({ ok: false, status: 429 });
  try {
    await assert.rejects(
      () => fetchLeetcodeMetrics('busy_user'),
      /LeetCode API rate limit exceeded/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  // 4. 500 API error
  globalThis.fetch = async () => ({ ok: false, status: 500 });
  try {
    await assert.rejects(
      () => fetchLeetcodeMetrics('any_user'),
      /API error \(500\)/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Phase 4.6: Codeforces fetchCodeforcesMetrics handles successful responses with contest participation', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url) => {
    const urlStr = String(url);
    if (urlStr.includes('/api/user.info')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: 'OK',
          result: [{
            rating: 1650,
            maxRating: 1720,
            rank: 'expert',
            maxRank: 'expert',
            contribution: 12,
          }],
        }),
      };
    }
    if (urlStr.includes('/api/user.rating')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: 'OK',
          result: [
            { ratingUpdateTimeSeconds: 1725000000, newRating: 1550 },
            { ratingUpdateTimeSeconds: 1728000000, newRating: 1650 },
          ],
        }),
      };
    }
    return { ok: false, status: 404 };
  };

  try {
    const metrics = await fetchCodeforcesMetrics('tourist');

    assert.equal(metrics.rating, 1650);
    assert.equal(metrics.maxRating, 1720);
    assert.equal(metrics.rank, 'expert');
    assert.equal(metrics.maxRank, 'expert');
    assert.equal(metrics.contribution, 12);
    assert.equal(metrics.contestsParticipated, 2);
    assert.equal(new Date(metrics.lastContestAt).getTime(), 1728000000 * 1000);
    assert.equal(metrics.isPartial, false);
    assert.equal(metrics.partialError, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Phase 4.7: Codeforces fetchCodeforcesMetrics distinguishes confirmed zero contests from unavailable contest history', async () => {
  const originalFetch = globalThis.fetch;

  // Case A: Confirmed 0 contests (user.rating returns OK with empty array result: [])
  globalThis.fetch = async (url) => {
    const urlStr = String(url);
    if (urlStr.includes('/api/user.info')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: 'OK',
          result: [{ rating: 0, maxRating: 0, contribution: 0 }],
        }),
      };
    }
    if (urlStr.includes('/api/user.rating')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ status: 'OK', result: [] }),
      };
    }
    return { ok: false, status: 404 };
  };

  try {
    const confirmedZero = await fetchCodeforcesMetrics('newbie_unrated');
    assert.equal(confirmedZero.contestsParticipated, 0, 'Must be confirmed 0 when rating API returns empty list');
    assert.equal(confirmedZero.lastContestAt, null);
    assert.equal(confirmedZero.isPartial, false);
  } finally {
    globalThis.fetch = originalFetch;
  }

  // Case B: Unavailable contest history (user.rating fails with 503 or 429)
  globalThis.fetch = async (url) => {
    const urlStr = String(url);
    if (urlStr.includes('/api/user.info')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: 'OK',
          result: [{ rating: 1400, maxRating: 1400 }],
        }),
      };
    }
    if (urlStr.includes('/api/user.rating')) {
      return { ok: false, status: 503, text: async () => 'Rating service maintenance' };
    }
    return { ok: false, status: 404 };
  };

  try {
    const unavailableRating = await fetchCodeforcesMetrics('active_user');
    assert.equal(unavailableRating.rating, 1400);
    assert.equal(unavailableRating.contestsParticipated, null, 'Must be null (not 0) when user.rating sub-call fails');
    assert.equal(unavailableRating.lastContestAt, null);
    assert.equal(unavailableRating.isPartial, true);
    assert.ok(unavailableRating.partialError);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Phase 4.8: Codeforces fetchCodeforcesMetrics input validation and error mapping', async () => {
  const originalFetch = globalThis.fetch;

  // 1. Validation
  await assert.rejects(() => fetchCodeforcesMetrics(''), /Invalid username provided/);
  await assert.rejects(() => fetchCodeforcesMetrics(null), /Invalid username provided/);

  // 2. 400 / FAILED (user not found)
  globalThis.fetch = async () => ({
    ok: false,
    status: 400,
    json: async () => ({ status: 'FAILED', comment: 'handles: User not found' }),
  });
  try {
    await assert.rejects(
      () => fetchCodeforcesMetrics('nonexistent_user_999'),
      /Codeforces handle not found/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  // 3. 429 Rate limit
  globalThis.fetch = async () => ({ ok: false, status: 429 });
  try {
    await assert.rejects(
      () => fetchCodeforcesMetrics('rate_limited_user'),
      /Codeforces API rate limit exceeded/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  // 4. 500 API error
  globalThis.fetch = async () => ({ ok: false, status: 500 });
  try {
    await assert.rejects(
      () => fetchCodeforcesMetrics('server_error_user'),
      /Codeforces sync failed/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
