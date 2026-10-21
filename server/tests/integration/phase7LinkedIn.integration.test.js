/**
 * phase7LinkedIn.integration.test.js — ScholrBoard V13 Phase 7
 *
 * Integration tests against dedicated test database (scholrboard_test):
 *   7.1: Linking via linkCodingProfile normalizes URL, sets connectionStatus: 'LINKED', syncStatus: 'UNAVAILABLE'.
 *   7.2: Sync with basic scope sets syncStatus: 'PARTIAL', updates lastVerifiedAt, does NOT advance lastSuccessfulSync.
 *   7.3: Sync with verified enterprise metrics sets syncStatus: 'SUCCESS' and advances lastSuccessfulSync.
 *   7.4: Provider error preserves previously cached profile URL and handle, records ERROR status.
 *   7.5: Expired authorization (401) records AUTH_EXPIRED and preserves cached data.
 *   7.6: Provider rate limit (429) records RATE_LIMITED.
 *   7.7: Retry idempotency and durable milestoneEventId lifecycle across retries.
 *   7.8: Zero scoring impact regression proof: Developer Score v3 and Placement Readiness v2 are completely identical.
 *   7.9: Unlinking LinkedIn unsets handle/URL, sets connectionStatus: 'UNLINKED', preserves other platforms.
 *   7.10: Live smoke test handler returns UNVERIFIED when credentials unset.
 */

import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { validateIntegrationTestDatabaseUri } from '../helpers/testDatabaseGuard.js';
import Profile from '../../models/Profile.js';
import User from '../../models/User.js';
import AuditLog from '../../models/AuditLog.js';
import ScoreHistory from '../../models/ScoreHistory.js';
import { linkCodingProfile, unlinkCodingProfile } from '../../controllers/codingController.js';
import { syncLinkedinProfile } from '../../services/linkedinSyncService.js';
import { verifyLiveLinkedInIntegration } from '../../services/providers/linkedinProvider.js';
import { recalculateAndSaveScore } from '../../services/developerScoringService.js';
import { recalculateAndSavePlacementScore } from '../../services/placementReadinessService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const TEST_URI = process.env.MONGODB_URI_TEST;
validateIntegrationTestDatabaseUri(TEST_URI);

let testUser;

before(async () => {
  await mongoose.connect(TEST_URI, {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000,
  });

  testUser = await User.create({
    name: 'LinkedIn Test Candidate',
    email: `li_candidate_${Date.now()}@test.scholrboard.com`,
    password: 'Password123!',
    role: 'student',
  });
});

after(async () => {
  if (testUser?._id) {
    await Profile.collection.deleteMany({ userId: testUser._id });
    await User.collection.deleteMany({ _id: testUser._id });
    await AuditLog.collection.deleteMany({ performedBy: testUser._id });
    await ScoreHistory.collection.deleteMany({ userId: testUser._id });
  }
  await mongoose.disconnect();
});

beforeEach(async () => {
  await Profile.collection.deleteMany({ userId: testUser._id });
  await AuditLog.collection.deleteMany({ performedBy: testUser._id });
  await ScoreHistory.collection.deleteMany({ userId: testUser._id });
});

test('Integration 7.1: Linking via linkCodingProfile normalizes URL, sets connectionStatus: LINKED, syncStatus: UNAVAILABLE', async () => {
  const req = {
    user: { _id: testUser._id },
    params: { platform: 'linkedin' },
    body: { username: 'https://linkedin.com/in/sarah-dev/' },
  };

  let responseData = null;
  const res = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    },
  };

  await linkCodingProfile(req, res);

  assert.equal(responseData?.success, true);
  const profile = await Profile.findOne({ userId: testUser._id });
  assert.ok(profile);

  assert.equal(profile.codingStats.profiles.linkedin, 'sarah-dev');
  assert.equal(profile.socialLinks.linkedin, 'https://www.linkedin.com/in/sarah-dev');
  assert.equal(profile.codingStats.linkedInConnected, true);

  assert.equal(profile.platformSyncStates.linkedin.connectionStatus, 'LINKED');
  assert.equal(profile.platformSyncStates.linkedin.syncStatus, 'UNAVAILABLE');
  assert.strictEqual(profile.platformSyncStates.linkedin.lastVerifiedAt, null, 'User-provided profile link must NOT mark lastVerifiedAt');

  // Missing metrics must be strictly null, unverified reference
  assert.strictEqual(profile.codingStats.rawMetrics.linkedin.identityVerified, false);
  assert.strictEqual(profile.codingStats.rawMetrics.linkedin.followers, null);
  assert.strictEqual(profile.codingStats.rawMetrics.linkedin.connections, null);
  assert.strictEqual(profile.codingStats.rawMetrics.linkedin.activityMetricsAvailable, false);
});

test('Integration 7.2: Sync with basic scope sets syncStatus: PARTIAL, updates lastVerifiedAt, does NOT advance lastSuccessfulSync', async () => {
  // Setup linked profile
  await Profile.create({
    userId: testUser._id,
    socialLinks: { linkedin: 'https://www.linkedin.com/in/janecoder' },
    codingStats: {
      profiles: { linkedin: 'janecoder' },
      linkedInConnected: true,
    },
  });

  const mockFetch = async () => ({
    status: 200,
    ok: true,
    json: async () => ({
      sub: 'li_sub_5555',
      name: 'Jane Coder',
      vanityName: 'janecoder',
    }),
  });

  const updated = await syncLinkedinProfile(testUser._id, {
    accessToken: 'mock-valid-basic-token',
    fetchImpl: mockFetch,
    scopes: ['openid', 'profile', 'email'],
  });

  assert.equal(updated.platformSyncStates.linkedin.connectionStatus, 'LINKED');
  assert.equal(updated.platformSyncStates.linkedin.syncStatus, 'PARTIAL');
  assert.ok(updated.platformSyncStates.linkedin.lastVerifiedAt, 'Authorized OAuth sync must set lastVerifiedAt');
  assert.strictEqual(updated.codingStats.rawMetrics.linkedin.identityVerified, true, 'Authorized response must verify identity');
  assert.strictEqual(updated.platformSyncStates.linkedin.lastSuccessfulSync, null, 'lastSuccessfulSync must NOT advance when activity metrics unavailable');
  assert.strictEqual(updated.codingStats.rawMetrics.linkedin.followers, null);
  assert.strictEqual(updated.codingStats.rawMetrics.linkedin.activityMetricsAvailable, false);
});

test('Integration 7.3: Sync with verified enterprise metrics sets syncStatus: SUCCESS and advances lastSuccessfulSync', async () => {
  await Profile.create({
    userId: testUser._id,
    socialLinks: { linkedin: 'https://www.linkedin.com/in/techleader' },
    codingStats: {
      profiles: { linkedin: 'techleader' },
      linkedInConnected: true,
    },
  });

  const mockFetch = async () => ({
    status: 200,
    ok: true,
    json: async () => ({
      sub: 'li_sub_9999',
      name: 'Tech Leader',
      vanityName: 'techleader',
      followers: 2400,
      connections: 500,
    }),
  });

  const updated = await syncLinkedinProfile(testUser._id, {
    accessToken: 'mock-enterprise-token',
    fetchImpl: mockFetch,
    scopes: ['openid', 'profile', 'r_organization_social'],
  });

  assert.equal(updated.platformSyncStates.linkedin.syncStatus, 'SUCCESS');
  assert.ok(updated.platformSyncStates.linkedin.lastSuccessfulSync, 'lastSuccessfulSync must advance on complete verified sync');
  assert.equal(updated.codingStats.rawMetrics.linkedin.followers, 2400);
  assert.equal(updated.codingStats.rawMetrics.linkedin.connections, 500);
  assert.equal(updated.codingStats.rawMetrics.linkedin.activityMetricsAvailable, true);
});

test('Integration 7.4: Provider error preserves previously cached profile URL and handle, records ERROR status', async () => {
  await Profile.create({
    userId: testUser._id,
    socialLinks: { linkedin: 'https://www.linkedin.com/in/prior-profile' },
    codingStats: {
      profiles: { linkedin: 'prior-profile' },
      linkedInConnected: true,
    },
  });

  const mockFetch = async () => ({
    status: 500,
    ok: false,
  });

  await assert.rejects(
    async () =>
      syncLinkedinProfile(testUser._id, {
        accessToken: 'failing-token',
        fetchImpl: mockFetch,
      }),
    /LinkedIn provider returned HTTP 500/i
  );

  const profile = await Profile.findOne({ userId: testUser._id });
  assert.equal(profile.platformSyncStates.linkedin.syncStatus, 'ERROR');
  assert.equal(profile.platformSyncStates.linkedin.consecutiveFailures, 1);
  assert.equal(profile.socialLinks.linkedin, 'https://www.linkedin.com/in/prior-profile', 'Must preserve cached profile URL on error');
  assert.equal(profile.codingStats.profiles.linkedin, 'prior-profile', 'Must preserve cached handle on error');
});

test('Integration 7.5: Expired authorization (401) records AUTH_EXPIRED and preserves cached data', async () => {
  await Profile.create({
    userId: testUser._id,
    socialLinks: { linkedin: 'https://www.linkedin.com/in/cached-handle' },
    codingStats: {
      profiles: { linkedin: 'cached-handle' },
      linkedInConnected: true,
    },
  });

  const mockFetch = async () => ({
    status: 401,
    ok: false,
  });

  await assert.rejects(
    async () =>
      syncLinkedinProfile(testUser._id, {
        accessToken: 'expired-token',
        fetchImpl: mockFetch,
      }),
    (err) => err.code === 'AUTH_EXPIRED'
  );

  const profile = await Profile.findOne({ userId: testUser._id });
  assert.equal(profile.platformSyncStates.linkedin.syncStatus, 'AUTH_EXPIRED');
  assert.equal(profile.socialLinks.linkedin, 'https://www.linkedin.com/in/cached-handle');
});

test('Integration 7.6: Provider rate limit (429) records RATE_LIMITED', async () => {
  await Profile.create({
    userId: testUser._id,
    socialLinks: { linkedin: 'https://www.linkedin.com/in/ratelimited-handle' },
    codingStats: {
      profiles: { linkedin: 'ratelimited-handle' },
      linkedInConnected: true,
    },
  });

  const mockFetch = async () => ({
    status: 429,
    ok: false,
  });

  await assert.rejects(
    async () =>
      syncLinkedinProfile(testUser._id, {
        accessToken: 'throttled-token',
        fetchImpl: mockFetch,
      }),
    (err) => err.code === 'RATE_LIMITED'
  );

  const profile = await Profile.findOne({ userId: testUser._id });
  assert.equal(profile.platformSyncStates.linkedin.syncStatus, 'RATE_LIMITED');
});

test('Integration 7.7: Retry idempotency and durable milestoneEventId lifecycle across retries', async () => {
  await Profile.create({
    userId: testUser._id,
    socialLinks: { linkedin: 'https://www.linkedin.com/in/idempotent-candidate' },
    codingStats: {
      profiles: { linkedin: 'idempotent-candidate' },
      linkedInConnected: true,
    },
  });

  const durableEventId = `job_li_retry_test_${Date.now()}`;

  const updated1 = await syncLinkedinProfile(testUser._id, {
    milestoneEventId: durableEventId,
  });

  assert.equal(updated1.platformSyncStates.linkedin.connectionStatus, 'LINKED');
  assert.strictEqual(updated1.platformSyncStates.linkedin.activeMilestoneEventId, null, 'Active milestone ID cleared on completion');

  // Retry with same durable event ID
  const updated2 = await syncLinkedinProfile(testUser._id, {
    milestoneEventId: durableEventId,
  });

  assert.equal(updated2.platformSyncStates.linkedin.connectionStatus, 'LINKED');
  assert.strictEqual(updated2.platformSyncStates.linkedin.activeMilestoneEventId, null);
});

test('Integration 7.8: Zero scoring impact regression proof: Developer Score v3 and Placement Readiness v2 are completely identical', async () => {
  const profileDoc = await Profile.create({
    userId: testUser._id,
    gpa: 8.8,
    gpaScale: 10.0,
    bio: 'Dedicated software engineering student with extensive experience in React and Node.js backend development.',
    skills: ['JavaScript', 'TypeScript', 'Node.js', 'MongoDB'],
    projects: [{ name: 'Campus Portal', description: 'Interactive portal built with Node.js and MongoDB' }],
    education: [{ institution: 'State University', degree: 'Computer Science' }],
    careerGoal: 'Full Stack Engineer',
    achievementPoints: 450,
    achievements: [{ title: 'Code Olympiad Finalist' }],
    codingStats: {
      githubContributions: 200,
      githubRepos: 10,
      githubFollowers: 15,
      leetcodeProblemsSolved: 120,
      leetcodeEasySolved: 50,
      leetcodeMediumSolved: 60,
      leetcodeHardSolved: 10,
      rawMetrics: {
        github: {
          publicRepos: 10,
          effectiveRepositoryCount: 10,
          followers: 15,
          stars: 20,
          forks: 5,
        },
        leetcode: {
          totalSolved: 120,
          easySolved: 50,
          mediumSolved: 60,
          hardSolved: 10,
        },
      },
    },
  });

  // State 1: Calculate baseline scores before LinkedIn is linked
  const devState1 = await recalculateAndSaveScore(profileDoc._id, 'test_initial_calc', { milestoneEventId: `evt_dev_s1_${Date.now()}` });
  const plcState1 = await recalculateAndSavePlacementScore(profileDoc._id, 'test_initial_calc', { milestoneEventId: `evt_plc_s1_${Date.now()}` });

  assert.ok(devState1.developerScore > 0);
  assert.ok(plcState1.placementReadinessScore > 0);

  // Helper for mock HTTP res
  const makeMockRes = () => {
    let data = null;
    return {
      status(code) { this.statusCode = code; return this; },
      json(d) { data = d; return this; },
      getData() { return data; },
    };
  };

  // State 2: User-provided LinkedIn URL linked (user reference, unverified)
  const linkRes = makeMockRes();
  await linkCodingProfile({
    user: { _id: testUser._id },
    params: { platform: 'linkedin' },
    body: { username: 'https://linkedin.com/in/zero-impact-candidate' },
  }, linkRes);
  assert.equal(linkRes.getData()?.success, true);

  const devState2 = await recalculateAndSaveScore(profileDoc._id, 'test_state2_calc', { milestoneEventId: `evt_dev_s2_${Date.now()}` });
  const plcState2 = await recalculateAndSavePlacementScore(profileDoc._id, 'test_state2_calc', { milestoneEventId: `evt_plc_s2_${Date.now()}` });

  assert.strictEqual(devState2.developerScore, devState1.developerScore, 'Developer Score invariant on user-provided link');
  assert.strictEqual(devState2.developerScoreMeta.coverage, devState1.developerScoreMeta.coverage);
  assert.strictEqual(plcState2.placementReadinessScore, plcState1.placementReadinessScore, 'Placement Readiness invariant on user-provided link');
  assert.strictEqual(plcState2.placementReadinessMeta.coverage, plcState1.placementReadinessMeta.coverage);

  // State 3: Authorized basic-profile sync (identity verified, metrics null)
  const mockFetchBasic = async () => ({
    status: 200,
    ok: true,
    json: async () => ({
      sub: 'li_sub_invariance_test',
      name: 'Zero Impact Candidate',
      vanityName: 'zero-impact-candidate',
    }),
  });
  await syncLinkedinProfile(testUser._id, {
    accessToken: 'mock-auth-token',
    fetchImpl: mockFetchBasic,
    scopes: ['openid', 'profile'],
  });

  const devState3 = await recalculateAndSaveScore(profileDoc._id, 'test_state3_calc', { milestoneEventId: `evt_dev_s3_${Date.now()}` });
  const plcState3 = await recalculateAndSavePlacementScore(profileDoc._id, 'test_state3_calc', { milestoneEventId: `evt_plc_s3_${Date.now()}` });

  assert.strictEqual(devState3.developerScore, devState1.developerScore, 'Developer Score invariant on authorized basic sync');
  assert.strictEqual(devState3.developerScoreMeta.coverage, devState1.developerScoreMeta.coverage);
  assert.strictEqual(plcState3.placementReadinessScore, plcState1.placementReadinessScore, 'Placement Readiness invariant on authorized basic sync');
  assert.strictEqual(plcState3.placementReadinessMeta.coverage, plcState1.placementReadinessMeta.coverage);

  // State 4: Sync rate-limited / error state
  const mockFetchRateLimited = async () => ({ status: 429, ok: false });
  await assert.rejects(
    async () => syncLinkedinProfile(testUser._id, { accessToken: 'throttled-token', fetchImpl: mockFetchRateLimited }),
    (err) => err.code === 'RATE_LIMITED'
  );

  const devState4 = await recalculateAndSaveScore(profileDoc._id, 'test_state4_calc', { milestoneEventId: `evt_dev_s4_${Date.now()}` });
  const plcState4 = await recalculateAndSavePlacementScore(profileDoc._id, 'test_state4_calc', { milestoneEventId: `evt_plc_s4_${Date.now()}` });

  assert.strictEqual(devState4.developerScore, devState1.developerScore, 'Developer Score invariant on sync failure/rate-limit');
  assert.strictEqual(devState4.developerScoreMeta.coverage, devState1.developerScoreMeta.coverage);
  assert.strictEqual(plcState4.placementReadinessScore, plcState1.placementReadinessScore, 'Placement Readiness invariant on sync failure/rate-limit');
  assert.strictEqual(plcState4.placementReadinessMeta.coverage, plcState1.placementReadinessMeta.coverage);

  // State 5: LinkedIn unlinked
  const unlinkRes = makeMockRes();
  await unlinkCodingProfile({
    user: { _id: testUser._id },
    params: { platform: 'linkedin' },
  }, unlinkRes);
  assert.equal(unlinkRes.getData()?.success, true);

  const devState5 = await recalculateAndSaveScore(profileDoc._id, 'test_state5_calc', { milestoneEventId: `evt_dev_s5_${Date.now()}` });
  const plcState5 = await recalculateAndSavePlacementScore(profileDoc._id, 'test_state5_calc', { milestoneEventId: `evt_plc_s5_${Date.now()}` });

  assert.strictEqual(devState5.developerScore, devState1.developerScore, 'Developer Score invariant after LinkedIn unlinking');
  assert.strictEqual(devState5.developerScoreMeta.coverage, devState1.developerScoreMeta.coverage);
  assert.strictEqual(plcState5.placementReadinessScore, plcState1.placementReadinessScore, 'Placement Readiness invariant after LinkedIn unlinking');
  assert.strictEqual(plcState5.placementReadinessMeta.coverage, plcState1.placementReadinessMeta.coverage);
});

test('Integration 7.9: Unlinking LinkedIn unsets handle/URL, sets connectionStatus: UNLINKED, preserves other platforms', async () => {
  await Profile.create({
    userId: testUser._id,
    socialLinks: {
      github: 'https://github.com/myuser',
      linkedin: 'https://www.linkedin.com/in/remove-me',
    },
    codingStats: {
      profiles: {
        github: 'myuser',
        linkedin: 'remove-me',
      },
      linkedInConnected: true,
      rawMetrics: {
        linkedin: { profileUrl: 'https://www.linkedin.com/in/remove-me' },
      },
    },
    platformSyncStates: {
      linkedin: { connectionStatus: 'LINKED', syncStatus: 'UNAVAILABLE' },
    },
  });

  const req = {
    user: { _id: testUser._id },
    params: { platform: 'linkedin' },
  };

  let responseData = null;
  const res = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    },
  };

  await unlinkCodingProfile(req, res);

  assert.equal(responseData?.success, true);
  const profile = await Profile.findOne({ userId: testUser._id });

  assert.strictEqual(profile.codingStats?.profiles?.linkedin, undefined);
  assert.strictEqual(profile.socialLinks?.linkedin, undefined);
  assert.equal(profile.codingStats?.linkedInConnected, false);
  assert.equal(profile.platformSyncStates?.linkedin?.connectionStatus, 'UNLINKED');
  assert.equal(profile.platformSyncStates?.linkedin?.syncStatus, 'NOT_CONNECTED');

  // Preserve other platforms
  assert.equal(profile.codingStats?.profiles?.github, 'myuser');
  assert.equal(profile.socialLinks?.github, 'https://github.com/myuser');
});

test('Integration 7.10: Live integration verification check returns status UNVERIFIED cleanly when environment lacks live tokens', async () => {
  const report = await verifyLiveLinkedInIntegration({ env: {} });
  assert.equal(report.status, 'UNVERIFIED');
  assert.equal(report.verified, false);
  assert.match(report.reason, /No LinkedIn credentials/i);
});
