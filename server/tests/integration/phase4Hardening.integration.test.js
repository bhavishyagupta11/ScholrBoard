import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Profile from '../../models/Profile.js';
import User from '../../models/User.js';
import ScoreHistory from '../../models/ScoreHistory.js';
import AuditLog from '../../models/AuditLog.js';
import { syncLeetcodeProfile } from '../../services/leetcodeSyncService.js';
import { syncCodeforcesProfile } from '../../services/codeforcesSyncService.js';
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
    name: 'Phase 4 LC CF Test Student',
    email: `phase4.student.${Date.now()}@scholrboard.test`,
    password: 'Password123!',
    role: 'student',
  });

  originalFetch = globalThis.fetch;
});

after(async () => {
  globalThis.fetch = originalFetch;

  if (testUser) {
    await Profile.collection.deleteMany({ userId: testUser._id });
    await ScoreHistory.collection.deleteMany({ userId: testUser._id });
    await AuditLog.collection.deleteMany({ performedBy: testUser._id });
    await User.collection.deleteOne({ _id: testUser._id });
  }

  await mongoose.disconnect();
});

test('Integration 4.1: Full successful LeetCode sync with submissionCalendar window metrics and L1 recency', async () => {
  await Profile.deleteMany({ userId: testUser._id });

  const profile = await Profile.create({
    userId: testUser._id,
    codingStats: {
      profiles: { leetcode: 'coder_elite' },
      leetcodeProblemsSolved: 0,
      leetcodeContestRating: 0,
    },
    platformSyncStates: {
      leetcode: { syncStatus: 'NOT_CONNECTED' },
    },
  });

  const nowSec = Math.floor(Date.now() / 1000);
  const ts10d = nowSec - 10 * 86400;
  const ts40d = nowSec - 40 * 86400;

  globalThis.fetch = async (url) => {
    const urlStr = String(url);
    if (urlStr.includes('/solved')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          solvedProblem: 250,
          easySolved: 100,
          mediumSolved: 120,
          hardSolved: 30,
        }),
      };
    }
    if (urlStr.includes('/contest')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          contestRating: 1820,
          contestGlobalRanking: 11000,
          attendedContestsCount: 18,
        }),
      };
    }
    if (urlStr.includes('/calendar')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          streak: 15,
          submissionCalendar: JSON.stringify({
            [ts10d]: 4,
            [ts40d]: 2,
          }),
        }),
      };
    }
    return { ok: false, status: 404 };
  };

  const updated = await syncLeetcodeProfile(testUser._id, { jobId: 'job_lc_full_success_1' });

  // 1. Verify Profile codingStats and rawMetrics
  const profileDoc = await Profile.findOne({ userId: testUser._id });
  assert.equal(profileDoc.codingStats.leetcodeProblemsSolved, 250);
  assert.equal(profileDoc.codingStats.leetcodeContestRating, 1820);
  assert.equal(profileDoc.codingStats.leetcodeStreak, 15);
  assert.equal(profileDoc.codingStats.rawMetrics.leetcode.totalSolved, 250);
  assert.equal(profileDoc.codingStats.rawMetrics.leetcode.activeSubmitDays30d, 1);
  assert.equal(profileDoc.codingStats.rawMetrics.leetcode.activeSubmitDays90d, 2);
  assert.equal(profileDoc.codingStats.rawMetrics.leetcode.recencyLevel, 'L1');
  assert.ok(profileDoc.codingStats.rawMetrics.leetcode.submissionCalendarRaw);

  // 2. Platform sync state
  assert.equal(profileDoc.platformSyncStates.leetcode.syncStatus, 'SYNCED');
  assert.ok(profileDoc.platformSyncStates.leetcode.lastSuccessfulSync);
  assert.equal(profileDoc.platformSyncStates.leetcode.error, null);
  assert.equal(profileDoc.platformSyncStates.leetcode.consecutiveFailures, 0);

  // 3. Developer score updated
  assert.ok(profileDoc.developerScore > 0, 'Developer score must be calculated');
  assert.equal(profileDoc.developerScoreMeta.dimensions.get('dsa').recencyLevel, 'L1');
});

test('Integration 4.2: LeetCode partial sync retains prior valid contest/calendar metrics without advancing lastSuccessfulSync', async () => {
  const profileBefore = await Profile.findOne({ userId: testUser._id });
  const priorSuccessfulSync = profileBefore.platformSyncStates.leetcode.lastSuccessfulSync;
  assert.ok(priorSuccessfulSync, 'Baseline sync must have a recorded lastSuccessfulSync');

  // Simulate subsequent sync where contest and calendar proxies fail, but solved succeeds
  globalThis.fetch = async (url) => {
    const urlStr = String(url);
    if (urlStr.includes('/solved')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          solvedProblem: 255, // 5 new problems solved
          easySolved: 102,
          mediumSolved: 122,
          hardSolved: 31,
        }),
      };
    }
    if (urlStr.includes('/contest')) {
      return { ok: false, status: 503, text: async () => 'Contest proxy maintenance' };
    }
    if (urlStr.includes('/calendar')) {
      return { ok: false, status: 500, text: async () => 'Calendar timeout' };
    }
    return { ok: false, status: 404 };
  };

  await syncLeetcodeProfile(testUser._id, { jobId: 'job_lc_partial_sync_1' });

  const profileAfter = await Profile.findOne({ userId: testUser._id });

  // 1. Must record PARTIAL syncStatus and error
  assert.equal(profileAfter.platformSyncStates.leetcode.syncStatus, 'PARTIAL');
  assert.ok(profileAfter.platformSyncStates.leetcode.error.includes('Contest data unavailable'));

  // 2. Updated problem count persisted
  assert.equal(profileAfter.codingStats.leetcodeProblemsSolved, 255);

  // 3. Prior valid contest and calendar metrics preserved
  assert.equal(profileAfter.codingStats.rawMetrics.leetcode.contestRating, 1820, 'Prior contest rating must be preserved');
  assert.equal(profileAfter.codingStats.rawMetrics.leetcode.activeSubmitDays30d, 1, 'Prior active submit days preserved');
  assert.equal(profileAfter.codingStats.rawMetrics.leetcode.recencyLevel, 'L1', 'Prior L1 recency preserved');

  // 4. lastSuccessfulSync must NOT advance on partial sync
  assert.equal(
    new Date(profileAfter.platformSyncStates.leetcode.lastSuccessfulSync).getTime(),
    new Date(priorSuccessfulSync).getTime(),
    'lastSuccessfulSync must not advance on partial sync'
  );
});

test('Integration 4.2b: LeetCode fulfilled sync with null/missing/malformed calendar preserves valid activity metrics and does NOT overwrite with zeros', async () => {
  const profileBefore = await Profile.findOne({ userId: testUser._id });
  const priorSuccessfulSync = profileBefore.platformSyncStates.leetcode.lastSuccessfulSync;
  assert.equal(profileBefore.codingStats.rawMetrics.leetcode.activeSubmitDays30d, 1);
  assert.equal(profileBefore.codingStats.leetcodeStreak, 15);
  assert.equal(profileBefore.codingStats.leetcodeLongestStreak, 1);

  // Solved and contest succeed; calendar endpoint returns HTTP 200 but explicitly null submissionCalendar
  globalThis.fetch = async (url) => {
    const urlStr = String(url);
    if (urlStr.includes('/solved')) {
      return { ok: true, status: 200, json: async () => ({ solvedProblem: 260, easySolved: 105, mediumSolved: 124, hardSolved: 31 }) };
    }
    if (urlStr.includes('/contest')) {
      return { ok: true, status: 200, json: async () => ({ contestRating: 1825, contestGlobalRanking: 10500, attendedContestsCount: 19 }) };
    }
    if (urlStr.includes('/calendar')) {
      return { ok: true, status: 200, json: async () => ({ streak: 5, submissionCalendar: null }) };
    }
    return { ok: false, status: 404 };
  };

  await syncLeetcodeProfile(testUser._id, { jobId: 'job_lc_partial_calendar_null_1' });

  const profileAfter = await Profile.findOne({ userId: testUser._id });

  // 1. Sync status must be PARTIAL
  assert.equal(profileAfter.platformSyncStates.leetcode.syncStatus, 'PARTIAL');
  assert.ok(profileAfter.platformSyncStates.leetcode.error.includes('Calendar submission data unavailable, null, or malformed'));

  // 2. Previously valid activity metrics must NOT be overwritten with zeros or null
  assert.equal(profileAfter.codingStats.rawMetrics.leetcode.activeSubmitDays30d, 1, 'Must retain prior activeSubmitDays30d');
  assert.equal(profileAfter.codingStats.rawMetrics.leetcode.longestStreak, 1, 'Must retain prior longestStreak in rawMetrics');
  assert.equal(profileAfter.codingStats.leetcodeLongestStreak, 1, 'Must retain prior longestStreak on codingStats');
  assert.equal(profileAfter.codingStats.leetcodeStreak, 15, 'Must retain prior streak on codingStats');
  assert.equal(profileAfter.codingStats.rawMetrics.leetcode.recencyLevel, 'L1', 'Must retain prior L1 recencyLevel');

  // 3. lastSuccessfulSync must NOT advance
  assert.equal(
    new Date(profileAfter.platformSyncStates.leetcode.lastSuccessfulSync).getTime(),
    new Date(priorSuccessfulSync).getTime(),
    'lastSuccessfulSync must not advance on partial sync with null calendar'
  );
});

test('Integration 4.2c: LeetCode confirmed empty calendar legitimately updates activity metrics to confirmed zeros and advances lastSuccessfulSync', async () => {
  const profileBefore = await Profile.findOne({ userId: testUser._id });
  assert.equal(profileBefore.codingStats.rawMetrics.leetcode.activeSubmitDays30d, 1);

  // Solved, contest, and calendar all succeed with valid confirmed empty calendar "{}"
  globalThis.fetch = async (url) => {
    const urlStr = String(url);
    if (urlStr.includes('/solved')) {
      return { ok: true, status: 200, json: async () => ({ solvedProblem: 265, easySolved: 108, mediumSolved: 126, hardSolved: 31 }) };
    }
    if (urlStr.includes('/contest')) {
      return { ok: true, status: 200, json: async () => ({ contestRating: 1830, contestGlobalRanking: 10200, attendedContestsCount: 20 }) };
    }
    if (urlStr.includes('/calendar')) {
      return { ok: true, status: 200, json: async () => ({ streak: 0, longestStreak: 0, submissionCalendar: '{}' }) };
    }
    return { ok: false, status: 404 };
  };

  await syncLeetcodeProfile(testUser._id, { jobId: 'job_lc_confirmed_empty_cal_1' });

  const profileAfter = await Profile.findOne({ userId: testUser._id });

  // 1. Sync status must be SYNCED
  assert.equal(profileAfter.platformSyncStates.leetcode.syncStatus, 'SYNCED');

  // 2. Confirmed empty calendar legitimately updates active submit days to confirmed zero
  assert.equal(profileAfter.codingStats.rawMetrics.leetcode.activeSubmitDays30d, 0, 'Legitimately updated to confirmed 0');
  assert.equal(profileAfter.codingStats.rawMetrics.leetcode.activeSubmitDays90d, 0, 'Legitimately updated to confirmed 0');
  assert.equal(profileAfter.codingStats.rawMetrics.leetcode.activeSubmitDays365d, 0, 'Legitimately updated to confirmed 0');
  assert.equal(profileAfter.codingStats.rawMetrics.leetcode.recencyLevel, 'L3', 'Confirmed empty calendar must have recencyLevel L3');
  assert.equal(profileAfter.codingStats.leetcodeStreak, 0, 'Legitimately updated to confirmed 0 streak');
  assert.equal(profileAfter.codingStats.leetcodeLongestStreak, 0, 'Legitimately updated to confirmed 0 longest streak');
  assert.equal(profileAfter.developerScoreMeta.dimensions.get('dsa').recencyLevel, 'L3', 'Downstream DSA dimension recency must reflect L3');

  // 3. lastSuccessfulSync MUST advance
  assert.ok(
    new Date(profileAfter.platformSyncStates.leetcode.lastSuccessfulSync).getTime() >
    new Date(profileBefore.platformSyncStates.leetcode.lastSuccessfulSync).getTime(),
    'lastSuccessfulSync must advance on complete verified sync with confirmed empty calendar'
  );
});

test('Integration 4.2d: Incomplete calendar without prior valid data preserves null streaks and does not manufacture zero', async () => {
  const freshUser = await User.create({
    name: 'Fresh LC Student',
    email: `fresh.lc.${Date.now()}@scholrboard.test`,
    password: 'Password123!',
    role: 'student',
  });

  try {
    await Profile.create({
      userId: freshUser._id,
      codingStats: {
        profiles: { leetcode: 'fresh_coder' },
        leetcodeProblemsSolved: 0,
        leetcodeStreak: null,
        leetcodeLongestStreak: null,
      },
      platformSyncStates: {
        leetcode: { syncStatus: 'NOT_CONNECTED' },
      },
    });

    // Solved succeeds, contest succeeds, but calendar returns 500
    globalThis.fetch = async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/solved')) {
        return { ok: true, status: 200, json: async () => ({ solvedProblem: 40 }) };
      }
      if (urlStr.includes('/contest')) {
        return { ok: true, status: 200, json: async () => ({ contestRating: 1400 }) };
      }
      if (urlStr.includes('/calendar')) {
        return { ok: false, status: 500, text: async () => 'Calendar service unavailable' };
      }
      return { ok: false, status: 404 };
    };

    await syncLeetcodeProfile(freshUser._id, { jobId: 'job_fresh_lc_incomplete_1' });

    const updatedProfile = await Profile.findOne({ userId: freshUser._id });

    // 1. Sync status must be PARTIAL
    assert.equal(updatedProfile.platformSyncStates.leetcode.syncStatus, 'PARTIAL');

    // 2. Streaks and activity metrics must remain NULL (unknown), NOT manufactured 0
    assert.equal(updatedProfile.codingStats.leetcodeStreak, null, 'Unknown streak must remain null');
    assert.equal(updatedProfile.codingStats.leetcodeLongestStreak, null, 'Unknown longest streak must remain null');
    assert.equal(updatedProfile.codingStats.rawMetrics.leetcode.activeSubmitDays30d, null);
    assert.equal(updatedProfile.codingStats.rawMetrics.leetcode.recencyLevel, null, 'Unknown calendar recency must be null');
    assert.equal(updatedProfile.developerScoreMeta.dimensions.get('dsa').recencyLevel, null, 'DSA dimension must have recencyLevel null');
    assert.equal(updatedProfile.developerScoreMeta.confidence, 'Low', 'Unknown recency cannot masquerade as L3; confidence must be Low');

    // 3. lastSuccessfulSync must remain null (never advanced)
    assert.equal(updatedProfile.platformSyncStates.leetcode.lastSuccessfulSync, null);
  } finally {
    await Profile.collection.deleteMany({ userId: freshUser._id });
    await ScoreHistory.collection.deleteMany({ userId: freshUser._id });
    await AuditLog.collection.deleteMany({ performedBy: freshUser._id });
    await User.collection.deleteOne({ _id: freshUser._id });
  }
});

test('Integration 4.3: LeetCode complete sync failure preserves prior metrics and records ERROR status', async () => {
  const profileBeforeFailure = await Profile.findOne({ userId: testUser._id });
  const priorSolved = profileBeforeFailure.codingStats.leetcodeProblemsSolved;
  const priorRating = profileBeforeFailure.codingStats.rawMetrics.leetcode.contestRating;

  // Simulate complete network failure on solved API
  globalThis.fetch = async () => {
    throw new Error('Connection refused');
  };

  await assert.rejects(
    () => syncLeetcodeProfile(testUser._id, { jobId: 'job_lc_failure_1' }),
    /LeetCode sync failed/
  );

  const profile = await Profile.findOne({ userId: testUser._id });
  assert.equal(profile.platformSyncStates.leetcode.syncStatus, 'ERROR');
  assert.equal(profile.platformSyncStates.leetcode.consecutiveFailures, 1);
  assert.equal(profile.codingStats.leetcodeProblemsSolved, priorSolved, 'Prior solved count untouched');
  assert.equal(profile.codingStats.rawMetrics.leetcode.contestRating, priorRating, 'Prior contest rating untouched');
});

test('Integration 4.4: Full successful Codeforces sync with contest history and CP score calculation', async () => {
  await Profile.updateOne(
    { userId: testUser._id },
    {
      $set: {
        'codingStats.profiles.codeforces': 'tourist_student',
        'platformSyncStates.codeforces': { syncStatus: 'NOT_CONNECTED' },
      },
    }
  );

  globalThis.fetch = async (url) => {
    const urlStr = String(url);
    if (urlStr.includes('/api/user.info')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: 'OK',
          result: [{
            rating: 1540,
            maxRating: 1610,
            rank: 'specialist',
            maxRank: 'expert',
            contribution: 5,
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
            { ratingUpdateTimeSeconds: 1720000000, newRating: 1400 },
            { ratingUpdateTimeSeconds: 1725000000, newRating: 1540 },
          ],
        }),
      };
    }
    return { ok: false, status: 404 };
  };

  await syncCodeforcesProfile(testUser._id, { jobId: 'job_cf_full_success_1' });

  const profileDoc = await Profile.findOne({ userId: testUser._id });

  assert.equal(profileDoc.codingStats.codeforcesRating, 1540);
  assert.equal(profileDoc.codingStats.codeforcesMaxRating, 1610);
  assert.equal(profileDoc.codingStats.codeforcesRank, 'specialist');
  assert.equal(profileDoc.codingStats.rawMetrics.codeforces.contestsParticipated, 2);
  assert.ok(profileDoc.codingStats.rawMetrics.codeforces.lastContestAt);

  assert.equal(profileDoc.platformSyncStates.codeforces.syncStatus, 'SYNCED');
  assert.ok(profileDoc.platformSyncStates.codeforces.lastSuccessfulSync);
  assert.equal(profileDoc.platformSyncStates.codeforces.error, null);

  // CP score calculated and integrated into developerScore
  assert.ok(profileDoc.developerScore > 0);
  assert.ok(profileDoc.developerScoreMeta.dimensions.get('cp').score > 0);
});

test('Integration 4.5: Codeforces confirmed zero contests vs partial sub-call failure', async () => {
  // Case A: Confirmed 0 contests (user.rating returns OK with empty array result: [])
  globalThis.fetch = async (url) => {
    const urlStr = String(url);
    if (urlStr.includes('/api/user.info')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: 'OK',
          result: [{ rating: 0, maxRating: 0, rank: 'unrated' }],
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

  await syncCodeforcesProfile(testUser._id, { jobId: 'job_cf_zero_contests_1' });

  let profile = await Profile.findOne({ userId: testUser._id });
  assert.equal(profile.codingStats.rawMetrics.codeforces.contestsParticipated, 0, 'Confirmed zero contests must be 0, not null');
  assert.equal(profile.platformSyncStates.codeforces.syncStatus, 'SYNCED');
  const priorSuccessTime = profile.platformSyncStates.codeforces.lastSuccessfulSync;

  // Case B: Partial sync where user.info succeeds but user.rating fails -> PARTIAL state, retain prior 0
  globalThis.fetch = async (url) => {
    const urlStr = String(url);
    if (urlStr.includes('/api/user.info')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: 'OK',
          result: [{ rating: 0, maxRating: 0, rank: 'unrated' }],
        }),
      };
    }
    if (urlStr.includes('/api/user.rating')) {
      return { ok: false, status: 503, text: async () => 'Rating service unavailable' };
    }
    return { ok: false, status: 404 };
  };

  await syncCodeforcesProfile(testUser._id, { jobId: 'job_cf_partial_sync_1' });

  profile = await Profile.findOne({ userId: testUser._id });
  assert.equal(profile.platformSyncStates.codeforces.syncStatus, 'PARTIAL');
  assert.equal(profile.codingStats.rawMetrics.codeforces.contestsParticipated, 0, 'Retains prior confirmed 0');
  assert.equal(
    new Date(profile.platformSyncStates.codeforces.lastSuccessfulSync).getTime(),
    new Date(priorSuccessTime).getTime(),
    'lastSuccessfulSync must not advance on partial sync'
  );
});

test('Integration 4.6: Codeforces complete failure with rate limit (429) records RATE_LIMITED status', async () => {
  globalThis.fetch = async () => ({
    ok: false,
    status: 429,
    json: async () => ({ status: 'FAILED', comment: 'Rate limit exceeded' }),
  });

  await assert.rejects(
    () => syncCodeforcesProfile(testUser._id, { jobId: 'job_cf_rate_limit_1' }),
    /rate limit exceeded/i
  );

  const profile = await Profile.findOne({ userId: testUser._id });
  assert.equal(profile.platformSyncStates.codeforces.syncStatus, 'RATE_LIMITED');
  assert.ok(profile.platformSyncStates.codeforces.consecutiveFailures >= 1);
});

test('Integration 4.7: Retry with same milestoneEventId is idempotent and advances monotonically', async () => {
  // First set up clean success on LeetCode
  globalThis.fetch = async (url) => {
    const urlStr = String(url);
    if (urlStr.includes('/solved')) {
      return { ok: true, status: 200, json: async () => ({ solvedProblem: 100 }) };
    }
    if (urlStr.includes('/contest')) {
      return { ok: true, status: 200, json: async () => ({ contestRating: 1500, attendedContestsCount: 5 }) };
    }
    if (urlStr.includes('/calendar')) {
      return { ok: true, status: 200, json: async () => ({ streak: 5, submissionCalendar: '{}' }) };
    }
    return { ok: false, status: 404 };
  };

  const fixedEventId = 'job_lc_idempotent_event_test_1';
  await syncLeetcodeProfile(testUser._id, { milestoneEventId: fixedEventId });

  const historyCountBefore = await ScoreHistory.countDocuments({ userId: testUser._id, scoreType: 'developer' });

  // Retry with the exact same milestoneEventId and payload
  await syncLeetcodeProfile(testUser._id, { milestoneEventId: fixedEventId });

  const historyCountAfter = await ScoreHistory.countDocuments({ userId: testUser._id, scoreType: 'developer' });
  assert.equal(historyCountAfter, historyCountBefore, 'Idempotent retry with same milestoneEventId must not create duplicate ScoreHistory');
});

test('Integration 4.8: Live Codeforces public endpoint smoke test (conditional on environment)', async (t) => {
  globalThis.fetch = originalFetch;

  try {
    const cfController = new AbortController();
    const timeout = setTimeout(() => cfController.abort(), 4000);
    const res = await fetch('https://codeforces.com/api/user.info?handles=tourist', {
      headers: { 'User-Agent': 'ScholrBoard-SmokeTest/1.0' },
      signal: cfController.signal,
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) {
      t.skip(`Live Codeforces API check status: UNVERIFIED (HTTP ${res.status}).`);
      return;
    }
    const data = await res.json();
    assert.equal(data.status, 'OK');
    assert.ok(data.result && data.result.length > 0);
    console.log(`[LIVE VERIFIED] Public Codeforces API live check verified: tourist rating=${data.result[0].rating}`);
  } catch (err) {
    console.warn('[LIVE UNVERIFIED] Live Codeforces check skipped:', err.message);
    t.skip(`Live Codeforces API verification status: UNVERIFIED (${err.message}).`);
  }
});

test('Integration 4.9: Live LeetCode public endpoint smoke test (conditional on environment)', async (t) => {
  globalThis.fetch = originalFetch;

  try {
    const lcController = new AbortController();
    const timeout = setTimeout(() => lcController.abort(), 4000);
    const res = await fetch('https://alfa-leetcode-api.onrender.com/tourist/solved', {
      headers: { 'User-Agent': 'ScholrBoard-SmokeTest/1.0' },
      signal: lcController.signal,
    }).finally(() => clearTimeout(timeout));

    if (res.status === 429) {
      console.warn('[LIVE UNVERIFIED] Live LeetCode proxy returned HTTP 429 (community proxy rate limit reached).');
      t.skip('Live LeetCode verification status: UNVERIFIED (Community proxy rate limit HTTP 429).');
      return;
    }

    if (!res.ok) {
      console.warn(`[LIVE UNVERIFIED] Live LeetCode proxy returned HTTP ${res.status}.`);
      t.skip(`Live LeetCode verification status: UNVERIFIED (HTTP ${res.status}).`);
      return;
    }

    const data = await res.json();
    assert.ok(data.solvedProblem !== undefined || data.totalSolved !== undefined);
    console.log(`[LIVE VERIFIED] Public LeetCode live check verified: solvedProblem=${data.solvedProblem || data.totalSolved}`);
  } catch (err) {
    console.warn('[LIVE UNVERIFIED] Live LeetCode check skipped:', err.message);
    t.skip(`Live LeetCode verification status: UNVERIFIED (${err.message}).`);
  }
});
