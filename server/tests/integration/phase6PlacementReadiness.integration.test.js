/**
 * phase6PlacementReadiness.integration.test.js
 *
 * ScholrBoard V13 Phase 6 Integration Test Suite.
 * MongoDB integration tests against dedicated test database (scholrboard_test)
 * validating Placement Readiness v2 persistence, dynamic denominator outer normalization,
 * confirmed zero vs missing, GPA scale administration and audit log, stale evidence aging,
 * legacy score invalidation migration idempotency, transaction rollback, and lease concurrency.
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Profile from '../../models/Profile.js';
import User from '../../models/User.js';
import ScoreHistory from '../../models/ScoreHistory.js';
import ResumeAnalysis from '../../models/ResumeAnalysis.js';
import GpaScaleAuditLog from '../../models/GpaScaleAuditLog.js';
import {
  recalculateAndSavePlacementScore,
  calculatePlacementScore,
  computePlacementSnapshotHash,
} from '../../services/placementReadinessService.js';
import { invalidateLegacyPlacementScores } from '../../scripts/invalidateLegacyPlacementScores.js';
import {
  acquireLock,
  releaseLock,
  sweepAgingScores,
} from '../../services/scoreHistoryService.js';
import { validateIntegrationTestDatabaseUri } from '../helpers/testDatabaseGuard.js';

dotenv.config();
process.env.NODE_ENV = 'test';

const testUri = process.env.MONGODB_URI_TEST;
validateIntegrationTestDatabaseUri(testUri);

let studentUser = null;
let adminUser = null;

before(async () => {
  await mongoose.connect(testUri, { serverSelectionTimeoutMS: 15000 });

  studentUser = await User.create({
    name: 'Phase 6 Placement Student',
    email: `phase6.student.${Date.now()}@scholrboard.test`,
    password: 'Password123!',
    role: 'student',
  });

  adminUser = await User.create({
    name: 'Phase 6 Placement Admin',
    email: `phase6.admin.${Date.now()}@scholrboard.test`,
    password: 'Password123!',
    role: 'admin',
  });
});

after(async () => {
  if (studentUser) {
    await Profile.collection.deleteMany({ userId: studentUser._id });
    await ScoreHistory.collection.deleteMany({ userId: studentUser._id });
    await ResumeAnalysis.collection.deleteMany({ userId: studentUser._id });
    await GpaScaleAuditLog.collection.deleteMany({ userId: studentUser._id });
    await User.collection.deleteOne({ _id: studentUser._id });
  }

  if (adminUser) {
    await User.collection.deleteOne({ _id: adminUser._id });
  }

  await mongoose.disconnect();
});

test('Integration 6.1: Full recalculation and persistence of Placement Readiness v2 with all dimensions and ScoreHistory milestone', async () => {
  await Profile.collection.deleteMany({ userId: studentUser._id });
  await ScoreHistory.collection.deleteMany({ userId: studentUser._id });
  await ResumeAnalysis.collection.deleteMany({ userId: studentUser._id });

  const evalDate = new Date();

  // Create completed resume analysis
  const resumeAnalysis = await ResumeAnalysis.create({
    userId: studentUser._id,
    fileUrl: 'https://cdn.scholrboard.test/resumes/student1.pdf',
    analysisStatus: 'completed',
    analysisTimestamp: evalDate,
    fieldConfidence: {
      sections: 'HIGH',
      workExperience: 'HIGH',
      skills: 'HIGH',
      genericQuality: 'HIGH',
      projects: 'HIGH',
    },
    sectionFeedback: [
      { section: 'Work Experience', score: 9 },
      { section: 'Projects', score: 8 },
      { section: 'Skills', score: 9 },
    ],
    parsedData: {
      experience: [
        { title: 'Software Engineering Intern', durationMonths: 4, isTechnical: true },
      ],
      projects: [
        { title: 'Distributed Cache System' },
        { title: 'Real-time Analytics Engine' },
      ],
    },
    skillsDetected: ['Go', 'Distributed Systems', 'Docker', 'Kubernetes'],
    careerTrackAtAnalysis: 'backend_distributed_systems',
    keywordAlignment: 0.85,
  });

  const profile = await Profile.create({
    userId: studentUser._id,
    gpa: 8.8,
    gpaScale: 10.0,
    careerTrack: 'backend_distributed_systems',
    careerGoal: 'Principal Distributed Systems Engineer',
    bio: 'Software engineer focused on high-throughput distributed systems and concurrency.',
    skills: ['Go', 'Distributed Systems', 'Docker', 'Kubernetes', 'PostgreSQL'],
    resumeUrl: 'https://cdn.scholrboard.test/resumes/student1.pdf',
    education: [{ institution: 'NIT Warangal', degree: 'B.Tech CSE', year: 2026 }],
    projects: [
      { name: 'Distributed Cache System', title: 'Distributed Cache System', description: 'Raft consensus in Go' },
      { name: 'Real-time Analytics Engine', title: 'Real-time Analytics Engine', description: 'Kafka stream processor' },
    ],
    experience: [
      { company: 'Tech Corp', role: 'SWE Intern', type: 'internship', verified: true },
    ],
    achievements: [
      { title: 'Smart India Hackathon Finalist', category: 'hackathon', verified: true },
      { title: 'Contributor to CNCF project', category: 'open_source', verified: true },
      { title: 'State Science Olympiad Rank 1', category: 'academic', verified: true },
    ],
    achievementPoints: 350,
    codingStats: {
      githubRepos: 8,
      leetcodeProblemsSolved: 280,
      profiles: { leetcode: 'phase6coder' },
      rawMetrics: {
        leetcode: {
          easySolved: 80,
          mediumSolved: 140,
          hardSolved: 60,
          recencyLevel: 'L1',
          activeSubmitDays30d: 18,
          activeSubmitDays90d: 45,
          activeSubmitDays365d: 110,
          attendedContestsCount: 12,
          contestRating: 1720,
        },
      },
    },
    platformSyncStates: {
      leetcode: { syncStatus: 'SYNCED', lastSuccessfulSync: evalDate, dataHash: 'lc_p6_1' },
    },
  });

  const milestoneEventId = `evt_phase6_full_${Date.now()}`;
  const updatedProfile = await recalculateAndSavePlacementScore(profile._id, 'Initial Placement Readiness calculation', {
    milestoneEventId,
    resumeAnalysis,
  });

  // 1. Placement Readiness score must be in valid numeric range 0-100
  assert.ok(typeof updatedProfile.placementReadinessScore === 'number' && updatedProfile.placementReadinessScore > 0);
  assert.equal(updatedProfile.placementReadinessMeta.placementMethodologyVersion, 'v2.0.0');

  // 2. All 6 dimensions must be populated in placementReadinessMeta.dimensions
  const dims = updatedProfile.placementReadinessMeta.dimensions;
  assert.ok(dims.get('placementDsa')?.score > 0);
  assert.ok(dims.get('resumeReadiness')?.score > 0);
  assert.ok(dims.get('portfolio')?.score > 0);
  assert.ok(dims.get('academic')?.score > 0);
  assert.ok(dims.get('achievements')?.score > 0);
  assert.ok(dims.get('completeness')?.score > 0);

  // 3. Metadata properties
  assert.equal(updatedProfile.placementReadinessMeta.coverage, 100);
  assert.equal(updatedProfile.placementReadinessMeta.confidence, 'High');
  assert.equal(updatedProfile.placementReadinessMeta.freshness, 'Fresh');

  // 4. ScoreHistory record created with scoreType: 'placement_readiness'
  const history = await ScoreHistory.findOne({
    userId: studentUser._id,
    milestoneEventId,
  });
  assert.ok(history, 'ScoreHistory snapshot for placement readiness must be persisted');
  assert.equal(history.scoreType, 'placement_readiness');
  assert.equal(history.placementMethodologyVersion, 'v2.0.0');
  assert.equal(history.score, updatedProfile.placementReadinessScore);
  assert.equal(history.coverage, 100);
  assert.equal(history.snapshotSequence, 1);
});

test('Integration 6.2: Missing optional platforms: student with only academic and completeness normalizes over available weight', async () => {
  await Profile.collection.deleteMany({ userId: studentUser._id });
  await ScoreHistory.collection.deleteMany({ userId: studentUser._id });
  await ResumeAnalysis.collection.deleteMany({ userId: studentUser._id });

  const profile = await Profile.create({
    userId: studentUser._id,
    gpa: 9.2,
    gpaScale: 10.0, // academic = 92 (nominalWeight 0.17)
    bio: 'Diligent computer science undergraduate specializing in theory and mathematics.',
    skills: ['C', 'C++', 'Algorithms'],
    projects: [],
    education: [{ institution: 'IIT Bombay', degree: 'B.Tech CSE', year: 2026 }],
    careerGoal: 'Algorithm Researcher',
    // Completeness = 60 (nominalWeight 0.05)
    codingStats: {},
    platformSyncStates: {
      leetcode: { syncStatus: 'NOT_CONNECTED' },
    },
  });

  const milestoneEventId = `evt_phase6_partial_${Date.now()}`;
  const updatedProfile = await recalculateAndSavePlacementScore(profile._id, 'Academic-only calculation', {
    milestoneEventId,
  });

  // 1. Score is normalized over available weight (0.17 + 0.05 = 0.22), NOT penalized with zero for LeetCode or Resume
  assert.ok(typeof updatedProfile.placementReadinessScore === 'number' && updatedProfile.placementReadinessScore >= 80);
  assert.equal(updatedProfile.placementReadinessMeta.coverage, 22, 'Coverage must reflect available 22% weight');

  // 2. Unlinked platforms must have score = null in dimensions map, not zero
  const dims = updatedProfile.placementReadinessMeta.dimensions;
  assert.equal(dims.get('placementDsa').score, null);
  assert.equal(dims.get('resumeReadiness').score, null);
  assert.equal(dims.get('portfolio').score, null);
  assert.equal(dims.get('achievements').score, null);
  assert.equal(dims.get('academic').score, 92);
  assert.equal(dims.get('completeness').score, 60);

  // 3. ScoreHistory record persisted
  const history = await ScoreHistory.findOne({
    userId: studentUser._id,
    milestoneEventId,
  });
  assert.ok(history);
  assert.equal(history.score, updatedProfile.placementReadinessScore);
  assert.equal(history.coverage, 22);
});

test('Integration 6.3: Confirmed zero contest vs missing contest in Placement DSA', async () => {
  // Student A: confirmed zero contest rating
  const profileZero = {
    codingStats: {
      rawMetrics: {
        leetcode: {
          easySolved: 50,
          mediumSolved: 20,
          hardSolved: 0,
          recencyLevel: 'L1',
          activeSubmitDays30d: 10,
          activeSubmitDays90d: 20,
          activeSubmitDays365d: 30,
          attendedContestsCount: 3,
          contestRating: 0, // Genuine 0
        },
      },
    },
  };

  // Student B: missing contest data
  const profileMissing = {
    codingStats: {
      rawMetrics: {
        leetcode: {
          easySolved: 50,
          mediumSolved: 20,
          hardSolved: 0,
          recencyLevel: 'L1',
          activeSubmitDays30d: 10,
          activeSubmitDays90d: 20,
          activeSubmitDays365d: 30,
          attendedContestsCount: undefined, // Missing
          contestRating: undefined, // Missing
        },
      },
    },
  };

  const resZero = calculatePlacementScore(profileZero);
  const resMissing = calculatePlacementScore(profileMissing);

  const dsaZero = resZero.dimensions.get('placementDsa');
  const dsaMissing = resMissing.dimensions.get('placementDsa');

  assert.equal(dsaZero.subSignalStatus.contest, 'OBTAINED');
  assert.equal(dsaZero.breakdown.contestBonus, 0);
  assert.equal(dsaZero.dimensionCoverage, 100);

  assert.equal(dsaMissing.subSignalStatus.contest, 'UNAVAILABLE');
  assert.equal(dsaMissing.dimensionCoverage, 85);
});

test('Integration 6.4: GPA scale normalization, boundary conditions, and admin audit log', async () => {
  await Profile.collection.deleteMany({ userId: studentUser._id });
  await GpaScaleAuditLog.collection.deleteMany({ userId: studentUser._id });

  // 1. Boundary GPA 0.0
  const profileBoundaryZero = await Profile.create({
    userId: studentUser._id,
    gpa: 0.0,
    gpaScale: 10.0,
  });
  const resBoundaryZero = calculatePlacementScore(profileBoundaryZero);
  assert.equal(resBoundaryZero.dimensions.get('academic').score, 0);

  // 2. GPA 3.6 on 4.0 scale -> 90.0
  const profileUS = await Profile.create({
    userId: new mongoose.Types.ObjectId(),
    gpa: 3.6,
    gpaScale: 4.0,
  });
  const resUS = calculatePlacementScore(profileUS);
  assert.equal(resUS.dimensions.get('academic').score, 90);

  // 3. Admin audit log entry
  const auditEntry = await GpaScaleAuditLog.create({
    userId: studentUser._id,
    field: 'gpaScale',
    oldValue: 10.0,
    newValue: 4.0,
    changedBy: adminUser._id,
    changedAt: new Date(),
    reason: 'Student transferred to US exchange program',
  });
  assert.ok(auditEntry._id);
  assert.equal(auditEntry.newValue, 4.0);

  // Clean up
  await Profile.collection.deleteMany({ userId: profileUS.userId });
});

test('Integration 6.5: Stale evidence updates freshness/confidence without reducing raw score', async () => {
  await Profile.collection.deleteMany({ userId: studentUser._id });
  await ScoreHistory.collection.deleteMany({ userId: studentUser._id });

  const staleDate = new Date(Date.now() - 100 * 86400000); // 100 days old (>90 days stale)

  const profile = await Profile.create({
    userId: studentUser._id,
    gpa: 8.5,
    gpaScale: 10.0,
    codingStats: {
      leetcodeProblemsSolved: 200,
      rawMetrics: {
        leetcode: {
          easySolved: 80,
          mediumSolved: 100,
          hardSolved: 20,
          recencyLevel: 'L2',
          lastActivityDate: staleDate,
        },
      },
    },
    platformSyncStates: {
      leetcode: {
        syncStatus: 'SYNCED',
        lastSuccessfulSync: staleDate,
        dataHash: 'lc_stale_1',
      },
    },
  });

  const milestoneEventId = `evt_phase6_stale_${Date.now()}`;
  const updatedProfile = await recalculateAndSavePlacementScore(profile._id, 'Stale calculation', {
    milestoneEventId,
    evalDate: new Date(),
  });

  // Freshness is Stale, but raw placement score is calculated from actual evidence without artificial penalties
  assert.equal(updatedProfile.placementReadinessMeta.freshness, 'Stale');
  assert.ok(typeof updatedProfile.placementReadinessScore === 'number' && updatedProfile.placementReadinessScore > 0);
});

test('Integration 6.6: Legacy Placement Readiness invalidation script is idempotent and auditable', async () => {
  await Profile.collection.deleteMany({ userId: studentUser._id });

  // Create profile with legacy arbitrary score
  const legacyProfile = await Profile.create({
    userId: studentUser._id,
    placementReadinessScore: 85,
    placementReadinessMeta: { score: 85, placementMethodologyVersion: null },
    placementReadinessLegacy: { score: null },
  });

  // 1. Run migration
  const migrationResult1 = await invalidateLegacyPlacementScores();
  assert.ok(migrationResult1.totalInvalidated >= 1);

  const updatedProfile = await Profile.findById(legacyProfile._id);
  assert.equal(updatedProfile.placementReadinessScore, null, 'placementReadinessScore must be nullified');
  assert.equal(updatedProfile.placementReadinessLegacy.score, 85, 'legacy score preserved');
  assert.equal(updatedProfile.placementReadinessLegacy.reason, 'pre-v2-no-formula');
  assert.ok(updatedProfile.placementReadinessLegacy.markedLegacyAt instanceof Date);

  // 2. Second run encounter 0 unmigrated profiles (idempotent)
  const migrationResult2 = await invalidateLegacyPlacementScores();
  assert.equal(migrationResult2.totalInvalidated, 0, 'Second run must encounter zero records to invalidate');
});

test('Integration 6.7: Idempotent recalculation retry creates 0 duplicate milestones', async () => {
  await Profile.collection.deleteMany({ userId: studentUser._id });
  await ScoreHistory.collection.deleteMany({ userId: studentUser._id });

  const profile = await Profile.create({
    userId: studentUser._id,
    gpa: 8.0,
    gpaScale: 10.0,
  });

  const milestoneEventId = `evt_p6_retry_${Date.now()}`;

  // First recalculation
  await recalculateAndSavePlacementScore(profile._id, 'Event 1', {
    milestoneEventId,
  });

  const countAfterFirst = await ScoreHistory.countDocuments({ userId: studentUser._id });
  assert.equal(countAfterFirst, 1);

  // Retry with same event ID
  await recalculateAndSavePlacementScore(profile._id, 'Event 1 Retry', {
    milestoneEventId,
  });

  const countAfterSecond = await ScoreHistory.countDocuments({ userId: studentUser._id });
  assert.equal(countAfterSecond, 1, 'Retry must not generate duplicate ScoreHistory record');
});

test('Integration 6.8: Failed transaction rollback via failure injection leaves zero partial state', async () => {
  await Profile.collection.deleteMany({ userId: studentUser._id });
  await ScoreHistory.collection.deleteMany({ userId: studentUser._id });

  const profile = await Profile.create({
    userId: studentUser._id,
    gpa: 8.5,
    gpaScale: 10.0,
    placementReadinessScore: null,
  });

  const milestoneEventId = `evt_p6_rollback_${Date.now()}`;

  await assert.rejects(
    async () => {
      await recalculateAndSavePlacementScore(profile._id, 'Failed run', {
        milestoneEventId,
        _injectFailureBeforeProfileUpdate: true,
      });
    },
    /INJECTED_FAILURE_AFTER_HISTORY_CREATE/
  );

  // Assert rollback: zero score history records created
  const historyCount = await ScoreHistory.countDocuments({ userId: studentUser._id });
  assert.equal(historyCount, 0, 'No partial ScoreHistory records should exist after rollback');

  // Assert profile untouched
  const profileAfter = await Profile.findById(profile._id);
  assert.equal(profileAfter.placementReadinessScore, null);
});

test('Integration 6.9: Scoring lease lock prevents overlapping placement readiness execution', async () => {
  await Profile.collection.deleteMany({ userId: studentUser._id });

  const profile = await Profile.create({
    userId: studentUser._id,
    gpa: 9.0,
    gpaScale: 10.0,
  });

  const holderA = 'worker_node_A';
  const holderB = 'worker_node_B';

  const acquiredA = await acquireLock(profile._id, 'placementReadiness', holderA, 30);
  assert.equal(acquiredA, true, 'First lock acquisition should succeed');

  const acquiredB = await acquireLock(profile._id, 'placementReadiness', holderB, 30);
  assert.equal(acquiredB, false, 'Second concurrent lock acquisition must be rejected');

  await releaseLock(profile._id, 'placementReadiness', holderA);

  const acquiredBAfterRelease = await acquireLock(profile._id, 'placementReadiness', holderB, 30);
  assert.equal(acquiredBAfterRelease, true, 'Lock should be acquirable after release');

  await releaseLock(profile._id, 'placementReadiness', holderB);
});

test('Integration 6.10: Sweep aging scores updates placementReadinessMeta.freshness without modifying raw score', async () => {
  await Profile.collection.deleteMany({ userId: studentUser._id });
  await ScoreHistory.collection.deleteMany({ userId: studentUser._id });

  const staleDate = new Date(Date.now() - 120 * 86400000);

  const profile = await Profile.create({
    userId: studentUser._id,
    placementReadinessScore: 78,
    placementMethodologyVersion: 'v2.0.0',
    placementReadinessMeta: {
      score: 78,
      freshness: 'Fresh', // Out of sync with actual sync time
      confidence: 'High',
      coverage: 80,
      lastVerifiedAt: staleDate,
      calculatedAt: staleDate,
      evaluationRevision: 1,
    },
    platformSyncStates: {
      leetcode: {
        syncStatus: 'SYNCED',
        lastSuccessfulSync: staleDate,
      },
    },
  });

  const sweepStats = await sweepAgingScores({ batchSize: 50 });
  assert.ok(sweepStats.sweptCount >= 1);

  const updatedProfile = await Profile.findById(profile._id);
  assert.equal(updatedProfile.placementReadinessMeta.freshness, 'Stale');
  assert.equal(updatedProfile.placementReadinessScore, 78, 'Raw score must be completely preserved');

  const historyCount = await ScoreHistory.countDocuments({ userId: studentUser._id });
  assert.equal(historyCount, 0, 'Aging sweep must not write to ScoreHistory');
});
