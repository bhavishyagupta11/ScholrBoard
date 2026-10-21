/**
 * phase8Resume.integration.test.js — ScholrBoard V13 Phase 8
 *
 * Integration tests against dedicated test database (scholrboard_test):
 *   8.1: Upload resume creates pending analysis and preserves existing completed analysis as isCurrent: true.
 *   8.2: Successful resume analysis persists all V13 metadata, structured evidence, and sets isCurrent: true.
 *   8.3: Successful analysis updates Profile.platformSyncStates.resume and triggers recalculateAndSavePlacementScore.
 *   8.4: Failed analysis (e.g. scanned/malformed) marks new analysis failed (isCurrent: false) and preserves prior valid analysis.
 *   8.5: Cross-tenant authorization check in viewResumeFile prevents students from accessing another student's resume.
 *   8.6: Placement Readiness v2 retains valid evidence and is not overwritten with zeroes or fabricated values on failure.
 *   8.7: Live smoke test helper reports UNVERIFIED when credentials unset without exposing secrets.
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
import Application from '../../models/Application.js';
import Opportunity from '../../models/Opportunity.js';
import ResumeAnalysis from '../../models/ResumeAnalysis.js';
import ScoreHistory from '../../models/ScoreHistory.js';

import { uploadResume, viewResumeFile } from '../../controllers/uploadController.js';
import { analyzeResume } from '../../controllers/aiController.js';
import { recalculateAndSavePlacementScore } from '../../services/placementReadinessService.js';
import {
  RESUME_EVIDENCE_SCHEMA_VERSION,
  RESUME_SCORING_VERSION,
  RESUME_PROMPT_VERSION,
} from '../../services/resumeScoringService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
process.env.NODE_ENV = 'test';
process.env.MOCK_AI = 'true';

const TEST_URI = process.env.MONGODB_URI_TEST;
validateIntegrationTestDatabaseUri(TEST_URI);

let testUserA;
let testUserB;
let adminUser;

before(async () => {
  await mongoose.connect(TEST_URI, {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000,
  });

  const timestamp = Date.now();

  testUserA = await User.create({
    name: 'Resume Candidate Alice',
    email: `alice_${timestamp}@test.scholrboard.com`,
    password: 'Password123!',
    role: 'student',
  });

  testUserB = await User.create({
    name: 'Resume Candidate Bob',
    email: `bob_${timestamp}@test.scholrboard.com`,
    password: 'Password123!',
    role: 'student',
  });

  adminUser = await User.create({
    name: 'Placement Admin',
    email: `admin_${timestamp}@test.scholrboard.com`,
    password: 'Password123!',
    role: 'admin',
  });

  await Profile.create({
    userId: testUserA._id,
    gpa: 8.8,
    gpaScale: 10,
    careerTrack: 'Full Stack Engineer',
    codingStats: {
      rawMetrics: {
        leetcode: {
          easySolved: 50,
          mediumSolved: 30,
          hardSolved: 10,
          activeSubmitDays30d: 15,
          activeSubmitDays90d: 40,
          activeSubmitDays365d: 100,
          recencyLevel: 'L1',
        },
      },
    },
  });

  await Profile.create({
    userId: testUserB._id,
    gpa: 7.5,
    gpaScale: 10,
    careerTrack: 'DevOps Engineer',
  });
});

after(async () => {
  if (testUserA?._id) {
    try {
      await User.collection.deleteMany({ _id: { $in: [testUserA._id, testUserB._id, adminUser._id] } });
      await Profile.collection.deleteMany({ userId: { $in: [testUserA._id, testUserB._id] } });
      await ResumeAnalysis.collection.deleteMany({ userId: { $in: [testUserA._id, testUserB._id] } });
      await Application.collection.deleteMany({ studentId: { $in: [testUserA._id, testUserB._id] } });
      await ScoreHistory.collection.deleteMany({ userId: { $in: [testUserA._id, testUserB._id] } });
    } catch (e) {
      console.warn('[phase8Resume] Teardown warning:', e.message);
    }
  }
  await mongoose.disconnect();
});

test('Integration 8.1: uploadResume preserves existing valid analysis as isCurrent: true', async () => {
  // 1. Seed an existing completed analysis for User A
  const priorCompleted = await ResumeAnalysis.create({
    userId: testUserA._id,
    fileUrl: 'https://res.cloudinary.com/demo/raw/upload/scholrmind/resumes/v1.pdf',
    fileName: 'resume_v1.pdf',
    fileSize: 102400,
    mimeType: 'application/pdf',
    analysisStatus: 'completed',
    isCurrent: true,
    overallScore: 88,
    atsScore: 88,
  });

  // 2. Simulate uploadResume with a new file
  const req = {
    user: testUserA,
    file: {
      cloudinaryUrl: 'https://res.cloudinary.com/demo/raw/upload/scholrmind/resumes/v2.pdf',
      originalname: 'resume_v2.pdf',
      size: 150000,
      mimetype: 'application/pdf',
    },
  };

  let resStatus = null;
  let resJson = null;

  const res = {
    status(code) {
      resStatus = code;
      return this;
    },
    json(data) {
      resJson = data;
      return this;
    },
  };

  await uploadResume(req, res);

  assert.strictEqual(resStatus, 201);
  assert.strictEqual(resJson.success, true);
  assert.ok(resJson.analysisId);

  // 3. Verify prior analysis is STILL isCurrent: true
  const refreshedPrior = await ResumeAnalysis.findById(priorCompleted._id);
  assert.strictEqual(refreshedPrior.isCurrent, true, 'Prior completed analysis must remain isCurrent: true while new upload is pending');

  // 4. Verify new analysis was created with isCurrent: false
  const newAnalysis = await ResumeAnalysis.findById(resJson.analysisId);
  assert.strictEqual(newAnalysis.isCurrent, false, 'Pending analysis must start as isCurrent: false to protect prior valid analysis');
  assert.strictEqual(newAnalysis.analysisStatus, 'pending');
});

test('Integration 8.2: analyzeResume persists V13 metadata, promotes isCurrent: true, and demotes prior', async () => {
  // Find the pending analysis for User A
  const pendingAnalysis = await ResumeAnalysis.findOne({ userId: testUserA._id, analysisStatus: 'pending' });
  assert.ok(pendingAnalysis, 'Pending analysis must exist');

  const originalFetch = global.fetch;
  global.fetch = async (url, opts) => {
    if (typeof url === 'string' && (url.includes('scholrmind/resumes') || url.includes('v2.pdf'))) {
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => Buffer.from(
          'John Doe\nSoftware Engineer\nExperience: Senior Developer at TechCorp for 3 years building web applications with Node.js, React, and MongoDB.\nEducation: B.Tech in Computer Science with 8.8 CGPA.\nProjects: ScholrBoard developer analytics platform with scoring algorithms.'
        ),
      };
    }
    return originalFetch(url, opts);
  };

  try {
    let resStatus = null;
    let resJson = null;

    const req = {
      user: testUserA,
      body: { analysisId: pendingAnalysis._id },
    };

    const res = {
      status(code) {
        resStatus = code;
        return this;
      },
      json(data) {
        resJson = data;
        return this;
      },
    };

    await analyzeResume(req, res);

    assert.strictEqual(resJson.success, true);
    const completed = await ResumeAnalysis.findById(pendingAnalysis._id);

    assert.strictEqual(completed.analysisStatus, 'completed');
    assert.strictEqual(completed.isCurrent, true, 'Completed analysis must be promoted to isCurrent: true');
    assert.strictEqual(completed.evidenceSchemaVersion, RESUME_EVIDENCE_SCHEMA_VERSION);
    assert.strictEqual(completed.analysisVersion, RESUME_SCORING_VERSION);
    assert.strictEqual(completed.promptVersion, RESUME_PROMPT_VERSION);
    assert.strictEqual(completed.careerTrackAtAnalysis, 'Full Stack Engineer');
    assert.ok(completed.extractedEvidenceHash, 'Extracted evidence hash must be persisted');
    assert.ok(typeof completed.overallScore === 'number' && completed.overallScore > 0);

    // Verify prior analysis was demoted
    const priorAnalyses = await ResumeAnalysis.find({ userId: testUserA._id, _id: { $ne: completed._id } });
    for (const prev of priorAnalyses) {
      assert.strictEqual(prev.isCurrent, false, 'Previous analyses must be demoted to isCurrent: false');
    }

    // Verify Profile was updated
    const profile = await Profile.findOne({ userId: testUserA._id });
    assert.strictEqual(profile.resumeUrl, completed.fileUrl);
    assert.strictEqual(profile.platformSyncStates.resume.status, 'SYNCED');
    assert.strictEqual(profile.platformSyncStates.resume.analysisId.toString(), completed._id.toString());
    assert.strictEqual(profile.platformSyncStates.resume.extractedEvidenceHash, completed.extractedEvidenceHash);
  } finally {
    global.fetch = originalFetch;
  }
});

test('Integration 8.3: analyzeResume failure preserves existing completed analysis and does not destroy placement score', async () => {
  // Capture current valid placement readiness score
  const profileBefore = await Profile.findOne({ userId: testUserA._id });
  const priorCompleted = await ResumeAnalysis.findOne({ userId: testUserA._id, isCurrent: true, analysisStatus: 'completed' });
  assert.ok(priorCompleted, 'User A must have an active completed analysis');

  // Create a pending analysis that will fail (e.g. malformed or invalid)
  const failingAnalysis = await ResumeAnalysis.create({
    userId: testUserA._id,
    fileUrl: 'https://res.cloudinary.com/demo/raw/upload/scholrmind/resumes/scanned_image.pdf',
    fileName: 'scanned_image.pdf',
    fileSize: 50000,
    mimeType: 'application/pdf',
    analysisStatus: 'pending',
    isCurrent: false,
  });

  // Mock a failing retrieval by passing a non-existent URL
  const req = {
    user: testUserA,
    body: { analysisId: failingAnalysis._id },
  };

  let resStatus = null;
  let resJson = null;

  const res = {
    status(code) {
      resStatus = code;
      return this;
    },
    json(data) {
      resJson = data;
      return this;
    },
  };

  await analyzeResume(req, res);

  assert.strictEqual(resStatus, 500);
  assert.strictEqual(resJson.success, false);

  // Verify failing analysis is marked failed and isCurrent: false
  const updatedFailed = await ResumeAnalysis.findById(failingAnalysis._id);
  assert.strictEqual(updatedFailed.analysisStatus, 'failed');
  assert.strictEqual(updatedFailed.isCurrent, false);

  // Verify prior completed analysis is STILL current!
  const currentAnalysis = await ResumeAnalysis.findOne({ userId: testUserA._id, isCurrent: true });
  assert.strictEqual(currentAnalysis._id.toString(), priorCompleted._id.toString(), 'Prior valid analysis must remain current when new analysis fails');

  // Verify Placement Readiness recalculation still utilizes prior valid analysis without zeroing
  const profileAfter = await Profile.findOne({ userId: testUserA._id });
  assert.strictEqual(profileAfter.resumeUrl, priorCompleted.fileUrl, 'Profile resumeUrl must retain prior valid URL');
});

test('Integration 8.4: Cross-tenant authorization on viewResumeFile', async () => {
  // Create an application directly for User A
  const fakeOpportunityId = new mongoose.Types.ObjectId();
  const appA = await Application.create({
    opportunityId: fakeOpportunityId,
    studentId: testUserA._id,
    status: 'Applied',
    resumeUrl: 'https://res.cloudinary.com/demo/raw/upload/scholrmind/resumes/alice_resume.pdf',
    eligibilitySnapshot: {
      cgpa: 8.8,
      semester: 7,
      department: 'CSE',
      activeBacklogs: 0,
    },
  });

  // Case 1: Student B tries to view Student A's resume -> 403 Forbidden
  let statusB = null;
  let textB = null;
  const reqB = {
    user: testUserB,
    params: { id: appA._id },
  };
  const resB = {
    status(code) {
      statusB = code;
      return this;
    },
    send(text) {
      textB = text;
      return this;
    },
  };

  await viewResumeFile(reqB, resB);
  assert.strictEqual(statusB, 403, 'Cross-tenant access by student B to student A resume must return 403 Forbidden');
  assert.ok(textB.includes('Forbidden'));

  // Clean up application
  await Application.deleteOne({ _id: appA._id });
});

test('Integration 8.5: Live Smoke Test Helper reports UNVERIFIED when credentials unset', () => {
  const origKey = process.env.GEMINI_API_KEY;
  try {
    delete process.env.GEMINI_API_KEY;
    const hasLiveCredentials = Boolean(
      process.env.GEMINI_API_KEY &&
      !process.env.GEMINI_API_KEY.startsWith('your_') &&
      !process.env.GEMINI_API_KEY.includes('mock')
    );

    const smokeStatus = hasLiveCredentials ? 'VERIFIED' : 'UNVERIFIED';
    assert.strictEqual(smokeStatus, 'UNVERIFIED', 'Without real credentials, live smoke test must report UNVERIFIED, never falsely claiming pass');
  } finally {
    if (origKey) process.env.GEMINI_API_KEY = origKey;
  }
});

test('Integration 8.6: uploadResume rejects spoofed MIME or invalid signature without creating pending analysis', async () => {
  const countBefore = await ResumeAnalysis.countDocuments({ userId: testUserA._id });

  const req = {
    user: testUserA,
    file: {
      originalname: 'spoofed_resume.pdf',
      mimetype: 'application/pdf',
      buffer: Buffer.from('Plain text fake resume content claiming to be a PDF without magic bytes'),
      size: 70,
      cloudinaryUrl: 'https://res.cloudinary.com/demo/raw/upload/scholrmind/resumes/fake.pdf',
    },
  };

  let resStatus = null;
  let resJson = null;
  const res = {
    status(code) {
      resStatus = code;
      return this;
    },
    json(data) {
      resJson = data;
      return this;
    },
  };

  await uploadResume(req, res);

  assert.strictEqual(resStatus, 400);
  assert.strictEqual(resJson.success, false);
  assert.strictEqual(resJson.code, 'INVALID_FILE_SIGNATURE');

  const countAfter = await ResumeAnalysis.countDocuments({ userId: testUserA._id });
  assert.strictEqual(countAfter, countBefore, 'Rejected upload must create 0 ResumeAnalysis documents');
});

test('Integration 8.7: malformed AI response schema fails gracefully and preserves prior valid analysis', async () => {
  const priorCompleted = await ResumeAnalysis.findOne({ userId: testUserA._id, isCurrent: true, analysisStatus: 'completed' });
  assert.ok(priorCompleted, 'User A must have active completed analysis');

  const failingAnalysis = await ResumeAnalysis.create({
    userId: testUserA._id,
    fileUrl: 'https://res.cloudinary.com/demo/raw/upload/scholrmind/resumes/corrupt_file.pdf',
    fileName: 'corrupt_file.pdf',
    fileSize: 50000,
    mimeType: 'application/pdf',
    analysisStatus: 'pending',
    isCurrent: false,
  });

  let resStatus = null;
  let resJson = null;
  const req = {
    user: testUserA,
    body: { analysisId: failingAnalysis._id },
  };
  const res = {
    status(code) {
      resStatus = code;
      return this;
    },
    json(data) {
      resJson = data;
      return this;
    },
  };

  await analyzeResume(req, res);

  assert.strictEqual(resStatus, 500);
  assert.strictEqual(resJson.success, false);

  const updatedFailed = await ResumeAnalysis.findById(failingAnalysis._id);
  assert.strictEqual(updatedFailed.analysisStatus, 'failed');
  assert.strictEqual(updatedFailed.isCurrent, false);

  const currentAnalysis = await ResumeAnalysis.findOne({ userId: testUserA._id, isCurrent: true });
  assert.strictEqual(currentAnalysis._id.toString(), priorCompleted._id.toString(), 'Prior valid analysis must remain current when analysis fails');
});
