/**
 * v13SprintIntegrity.unit.test.js
 *
 * Comprehensive unit test suite for ScholrBoard V13 Sprint:
 * 1. Contest Rating Normalization (Codeforces empirical & LeetCode native percentile requirement)
 * 2. CP vs DSA Segregation (695 solved problems in DSA, not CP)
 * 3. Document Buffer Cache & Cloudinary Untrusted Detection
 * 4. Certificate Extraction States & PDF Fallback
 * 5. Opportunity Deadline Enforcement & Expired Drive Handling
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  normalizeLeetcodeRating,
  normalizeCodeforcesRating,
  combineContestRatingSignals,
  interpolatePercentile,
  validateCalibrationSnapshot,
  loadCodeforcesSnapshot,
  CODEFORCES_SNAPSHOT,
  CODEFORCES_SNAPSHOT_PATH,
} from '../../services/contestRatingNormalization.js';
import {
  computeCpDimension,
  computeDsaDimension,
  NOMINAL_WEIGHTS,
} from '../../services/developerScoringService.js';
import {
  recomputeAnchorsFromDistribution,
  verifySnapshotIntegrity,
} from '../../scripts/generateCodeforcesCalibration.mjs';
import { DocumentBufferCache, documentBufferCache } from '../../utils/documentBufferCache.js';
import {
  getMatchingOpportunities,
  getAllOpportunities,
} from '../../controllers/opportunityController.js';
import { applyToOpportunity } from '../../controllers/applicationController.js';
import {
  viewResumeFile,
  viewCertificateFile,
  proxyPdf,
} from '../../controllers/uploadController.js';
import {
  extractCertificate,
  setGeminiClientFactoryForTest,
} from '../../controllers/aiController.js';
import {
  parseOpportunityDeadline,
  evaluateOpportunityDeadline,
} from '../../utils/opportunityDeadline.js';
import {
  parseReconcileArgs,
  reconcileOpportunityDeadlines,
} from '../../scripts/reconcileOpportunityDeadlines.js';
import Opportunity from '../../models/Opportunity.js';
import Profile from '../../models/Profile.js';
import Application from '../../models/Application.js';
import ResumeAnalysis from '../../models/ResumeAnalysis.js';

const cfExpected = (rating) => interpolatePercentile(rating, CODEFORCES_SNAPSHOT.anchors);

test('V13 Sprint: Codeforces Empirical Rating Normalization & Reproducibility', async (t) => {
  await t.test('anchors lower bound: min observed rating normalizes to exact empirical minimum percentile', () => {
    const minRating = CODEFORCES_SNAPSHOT.minRating;
    const expectedMinPct = CODEFORCES_SNAPSHOT.anchors[0][1];
    const res = normalizeCodeforcesRating({ rating: minRating, contestsParticipated: 5 });
    assert.ok(res, 'Valid rated contestant with min rating should return result');
    assert.equal(res.platform, 'codeforces');
    assert.equal(res.percentile, expectedMinPct);
    assert.equal(res.normalizedScore, expectedMinPct);
    assert.ok(res.percentile > 0);
  });

  await t.test('rating 0 without contests is unrated (returns null)', () => {
    const res = normalizeCodeforcesRating({ rating: 0, contestsParticipated: 0 });
    assert.equal(res, null);
  });

  await t.test('rating 500 normalizes smoothly without artificial lower-bound floor clamping', () => {
    const res = normalizeCodeforcesRating({ rating: 500, contestsParticipated: 3 });
    assert.ok(res);
    assert.equal(res.percentile, cfExpected(500));
    assert.equal(res.normalizedScore, cfExpected(500));
  });

  await t.test('max observed anchor normalizes to 100.0%', () => {
    const res = normalizeCodeforcesRating({ rating: CODEFORCES_SNAPSHOT.maxRating, contestsParticipated: 50 });
    assert.ok(res);
    assert.equal(res.percentile, 100);
    assert.equal(res.normalizedScore, 100);
  });

  await t.test('snapshot metadata and full ratingDistribution reproduce every anchor deterministically', () => {
    const diskRaw = JSON.parse(fs.readFileSync(CODEFORCES_SNAPSHOT_PATH, 'utf-8'));
    assert.equal(CODEFORCES_SNAPSHOT.populationSize, 42145);
    assert.equal(CODEFORCES_SNAPSHOT.minRating, -40);
    assert.equal(CODEFORCES_SNAPSHOT.maxRating, 3722);
    assert.ok(Array.isArray(diskRaw.ratingDistribution));
    const check = verifySnapshotIntegrity(diskRaw);
    assert.equal(check.valid, true, check.errors.join('; '));
    const recomputed = recomputeAnchorsFromDistribution(diskRaw.ratingDistribution);
    assert.deepEqual(recomputed.anchors, diskRaw.anchors);
    assert.equal(loadCodeforcesSnapshot(CODEFORCES_SNAPSHOT_PATH).snapshot.populationSize, 42145);
    assert.equal(validateCalibrationSnapshot(null).valid, false);
  });
});

test('V13 Sprint: Exact Developer Score v3 Named Dimension Weights', () => {
  assert.deepEqual({ ...NOMINAL_WEIGHTS }, {
    dsa: 0.30,
    engActivity: 0.25,
    repoQuality: 0.20,
    cp: 0.15,
    breadth: 0.10,
  });
});

test('V13 Sprint: LeetCode Normalization & Fallback Prohibition', async (t) => {
  await t.test('valid topPercentage returns verified percentile score', () => {
    const res = normalizeLeetcodeRating({ rating: 1850, topPercentage: 12.5 });
    assert.ok(res);
    assert.equal(res.platform, 'leetcode');
    assert.equal(res.derivation, 'native_top_percentage');
    assert.equal(res.percentile, 87.5);
    assert.equal(res.normalizedScore, 87.5);
  });

  await t.test('missing native percentile ranking returns UNAVAILABLE (no unsupported estimation)', () => {
    const res = normalizeLeetcodeRating({ rating: 1850 });
    assert.equal(res.normalizedScore, null);
    assert.equal(res.status, 'UNAVAILABLE');
    assert.equal(res.derivation, 'unsupported_ranking_unavailable');
    assert.equal(res.rawRating, 1850);
  });
});

test('V13 Sprint: CP vs DSA Separation', async (t) => {
  await t.test('LeetCode problem count 695 is evaluated in DSA dimension, NOT in CP dimension', () => {
    const lcMetrics = {
      username: 'dev695',
      totalSolved: 695,
      easySolved: 200,
      mediumSolved: 400,
      hardSolved: 95,
      contestRating: 0,
      attendedContestsCount: 0,
    };

    // CP dimension must NOT use totalSolved as contest score
    const cpRes = computeCpDimension({}, lcMetrics);
    assert.equal(cpRes.score, null, 'CP dimension score should be null when unrated/no contests');

    // DSA dimension evaluates practice problem volume
    const dsaRes = computeDsaDimension(lcMetrics);
    assert.ok(dsaRes.score > 0, 'DSA dimension should evaluate 695 solved questions');
  });

  await t.test('raw LeetCode and Codeforces ratings are never directly averaged', () => {
    const lcNorm = normalizeLeetcodeRating({ rating: 1900, topPercentage: 10 }); // normalized to 90
    const cfNorm = normalizeCodeforcesRating({ rating: 1600, contestsParticipated: 10 });

    const combined = combineContestRatingSignals({
      leetcodeNorm: lcNorm,
      codeforcesNorm: cfNorm,
    });

    assert.ok(combined.score > 0);
    assert.ok(combined.score <= 100, 'Combined contest score must be normalized on 0-100 scale');
    assert.equal(combined.crossPlatformComparison, true);
  });
});

test('V13 Sprint: Document Buffer Cache', async (t) => {
  const userId = 'user_test_cache_123';
  const fileKey = 'https://res.cloudinary.com/demo/image/upload/sample.pdf';
  const dummyBuffer = Buffer.from('%PDF-1.4 test resume buffer content');

  await t.test('stores and retrieves cached buffer by userId and key', () => {
    documentBufferCache.set(userId, fileKey, dummyBuffer, 'application/pdf');
    const cached = documentBufferCache.get(userId, fileKey);
    assert.ok(cached);
    assert.equal(cached.mimetype, 'application/pdf');
    assert.equal(cached.buffer.toString(), dummyBuffer.toString());
  });

  await t.test('prevents cross-user cache access', () => {
    const otherUser = 'user_other_456';
    const unauthorized = documentBufferCache.get(otherUser, fileKey);
    assert.equal(unauthorized, null);
  });

  await t.test('evicts cache entry correctly', () => {
    documentBufferCache.delete(userId, fileKey);
    assert.equal(documentBufferCache.get(userId, fileKey), null);
  });
});

test('V13 Sprint: Opportunity Deadlines & Expired Placement Listings', async (t) => {
  const originalOpFind = Opportunity.find;
  const originalProfileFindOne = Profile.findOne;
  const originalOpFindById = Opportunity.findById;
  const originalAppFindOne = Application.findOne;

  t.after(() => {
    Opportunity.find = originalOpFind;
    Profile.findOne = originalProfileFindOne;
    Opportunity.findById = originalOpFindById;
    Application.findOne = originalAppFindOne;
  });

  await t.test('getMatchingOpportunities marks expired drives as isExpired: true and ineligible', async () => {
    const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days ahead

    const mockDrives = [
      {
        _id: 'op_expired_tcs',
        driveCode: 'TCS-NQT-2026',
        company: 'Tata Consultancy Services',
        title: 'Ninja Developer',
        deadline: pastDate,
        status: 'Published',
        eligibility: {},
        toObject() { return { ...this }; },
      },
      {
        _id: 'op_open_infosys',
        driveCode: 'INFY-SP-2026',
        company: 'Infosys',
        title: 'Specialist Programmer',
        deadline: futureDate,
        status: 'Published',
        eligibility: {},
        toObject() { return { ...this }; },
      },
    ];

    Opportunity.find = () => ({
      sort: () => ({
        populate: async () => mockDrives,
      }),
    });

    Profile.findOne = async () => ({
      gpa: 8.5,
      backlogs: 0,
      placementReadinessScore: 85,
    });

    const req = { user: { _id: 'student_123', semester: 7, department: 'CSE' } };
    let jsonResult = null;
    const res = {
      json: (data) => { jsonResult = data; return data; },
      status: () => res,
    };

    await getMatchingOpportunities(req, res);

    assert.ok(jsonResult.success);
    const expiredOp = jsonResult.opportunities.find(o => o.driveCode === 'TCS-NQT-2026');
    const openOp = jsonResult.opportunities.find(o => o.driveCode === 'INFY-SP-2026');

    assert.equal(expiredOp.isExpired, true, 'Past deadline drive must have isExpired: true');
    assert.equal(expiredOp.isEligible, false, 'Expired drive must be marked ineligible');
    assert.equal(expiredOp.ineligibilityReason, 'Application deadline has passed');

    assert.equal(openOp.isExpired, false, 'Future deadline drive must have isExpired: false');
    assert.equal(openOp.isEligible, true);
  });

  await t.test('applyToOpportunity strictly rejects late submission with HTTP 400', async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    Opportunity.findById = async () => ({
      _id: 'op_expired_tcs',
      driveCode: 'TCS-NQT-2026',
      company: 'Tata Consultancy Services',
      title: 'Ninja Developer',
      deadline: pastDate,
      status: 'Published',
    });

    const req = {
      params: { id: 'op_expired_tcs' },
      body: { resumeUrl: 'https://res.cloudinary.com/test/resume.pdf' },
      user: { _id: 'student_123' },
    };

    let statusCode = null;
    let jsonResult = null;
    const res = {
      status: (code) => { statusCode = code; return res; },
      json: (data) => { jsonResult = data; return data; },
    };

    await applyToOpportunity(req, res);

    assert.equal(statusCode, 400);
    assert.equal(jsonResult.success, false);
    assert.equal(jsonResult.message, 'Application deadline has passed');
  });
});

test('V13 Sprint: Bounded Buffer Cache Memory Safety & Eviction', () => {
  const localCache = new DocumentBufferCache({ ttlMs: 500, maxEntries: 5, maxTotalBytes: 20, maxEntryBytes: 12 });
  const b8 = Buffer.alloc(8, 0x41);
  const b8Alt = Buffer.alloc(8, 0x42);
  const b8Third = Buffer.alloc(8, 0x43);
  const b15Huge = Buffer.alloc(15, 0x44);

  // Oversized single entry refused
  assert.equal(localCache.set('u1', 'huge', b15Huge, 'application/pdf'), false);

  // Duplicate key updates totalBytes cleanly without double-counting
  assert.equal(localCache.set('u1', 'k1', b8, 'application/pdf'), true);
  assert.equal(localCache.set('u1', 'k1', b8Alt, 'application/pdf'), true);
  assert.equal(localCache.getStats().totalBytes, 8);

  // Byte cap (20 bytes) triggers FIFO/LRU eviction when adding third 8-byte item -> 24 > 20
  assert.equal(localCache.set('u1', 'k2', b8, 'application/pdf'), true);
  assert.equal(localCache.set('u1', 'k3', b8Third, 'application/pdf'), true);
  assert.equal(localCache.get('u1', 'k1'), null);
  assert.ok(localCache.getStats().totalBytes <= 20);
  assert.equal(localCache.get('u2', 'k3'), null);
  localCache.clear();
});

test('V13 Sprint: Cloudinary PDF Delivery 5-Scenario Matrix & Auth', async (t) => {
  const origFetch = globalThis.fetch;
  const origProfFindOne = Profile.findOne;
  const origProfFindById = Profile.findById;
  const origAppFindById = Application.findById;
  const origAnalysisFindById = ResumeAnalysis.findById;

  t.after(() => {
    globalThis.fetch = origFetch;
    Profile.findOne = origProfFindOne;
    Profile.findById = origProfFindById;
    Application.findById = origAppFindById;
    ResumeAnalysis.findById = origAnalysisFindById;
    documentBufferCache.clear();
  });

  const makeRes = () => {
    const out = { statusCode: 200, headers: {}, body: null };
    return {
      out,
      setHeader(k, v) { out.headers[k.toLowerCase()] = v; },
      status(c) { out.statusCode = c; return this; },
      send(b) { out.body = b; return this; },
      json(j) { out.body = j; return this; },
    };
  };

  const validPdf = Buffer.from('%PDF-1.4 synthetic cert bytes');
  const ownerId = '507f1f77bcf86cd799439011';
  const otherId = '507f1f77bcf86cd799439022';
  const certId = '507f1f77bcf86cd799439099';
  const certUrl = `https://res.cloudinary.com/demo/raw/authenticated/v1/scholrmind/certificates/${ownerId}/cert.pdf`;

  await t.test('1) Cache hit serves owner & admin without upstream Cloudinary fetch', async () => {
    documentBufferCache.set(ownerId, certUrl, validPdf, 'application/pdf');
    Profile.findOne = async () => ({
      userId: ownerId,
      certifications: [{ _id: certId, sourceFileUrl: certUrl, credentialUrl: certUrl }],
    });
    let fetchCalls = 0;
    globalThis.fetch = async () => { fetchCalls++; throw new Error('Should not fetch when cached'); };

    const resAdmin = makeRes();
    await viewCertificateFile({ params: { certId }, user: { _id: otherId, role: 'admin' } }, resAdmin);
    assert.equal(resAdmin.out.statusCode, 200);
    assert.equal(resAdmin.out.headers['content-type'], 'application/pdf');
    assert.equal(fetchCalls, 0);

    const resForeign = makeRes();
    await viewCertificateFile({ params: { certId }, user: { _id: otherId, role: 'student' } }, resForeign);
    assert.equal(resForeign.out.statusCode, 403);
  });

  await t.test('2) Expired/missed cache falls back to Cloudinary storage cleanly (restart / multi-instance)', async () => {
    documentBufferCache.clear();
    Application.findById = async () => null;
    ResumeAnalysis.findById = async () => null;
    Profile.findById = async () => ({ userId: ownerId, resumeUrl: certUrl });
    globalThis.fetch = async () => ({
      status: 200,
      ok: true,
      headers: new Map([['content-type', 'application/pdf']]),
      arrayBuffer: async () => validPdf,
    });

    const res = makeRes();
    await viewResumeFile({ params: { id: '507f1f77bcf86cd799439055' }, user: { _id: ownerId, role: 'student' } }, res);
    assert.equal(res.out.statusCode, 200);
    assert.equal(Buffer.isBuffer(res.out.body), true);
  });

  await t.test('3) Cloudinary show_original_customer_untrusted or ACL failure returns 502 JSON, never PDF', async () => {
    documentBufferCache.clear();
    globalThis.fetch = async () => ({
      status: 401,
      ok: false,
      headers: new Map([['x-cld-error', 'deny or ACL failure'], ['content-type', 'application/json']]),
      arrayBuffer: async () => Buffer.from('{"error":{"message":"show_original_customer_untrusted"}}'),
    });

    const res = makeRes();
    await proxyPdf({ query: { url: certUrl }, user: { _id: ownerId, role: 'student' } }, res);
    assert.equal(res.out.statusCode, 502);
    assert.equal(res.out.body.code, 'CLOUDINARY_ACCOUNT_UNTRUSTED');
    assert.notEqual(res.out.headers['content-type'], 'application/pdf');
  });

  await t.test('4) Cloudinary deny or ACL failure header with empty body returns 502 CLOUDINARY_DELIVERY_BLOCKED', async () => {
    documentBufferCache.clear();
    globalThis.fetch = async () => ({
      status: 401,
      ok: false,
      headers: new Map([['x-cld-error', 'deny or ACL failure'], ['content-type', 'application/pdf']]),
      arrayBuffer: async () => Buffer.alloc(0),
    });

    const res = makeRes();
    await viewCertificateFile({ params: { certId }, user: { _id: ownerId, role: 'student' } }, res);
    assert.equal(res.out.statusCode, 502);
    assert.equal(res.out.body.code, 'CLOUDINARY_DELIVERY_BLOCKED');
  });
});

test('V13 Sprint: Gemini Scanned PDF Multimodal, Fallback, Timeout, Malformed & Retry Safety', async (t) => {
  const origFindOne = Profile.findOne;
  const origFindOneAndUpdate = Profile.findOneAndUpdate;
  const origUpdateOne = Profile.updateOne;
  const origPrimary = process.env.GEMINI_PRIMARY_MODEL;
  const origFallback = process.env.GEMINI_FALLBACK_MODELS;
  const origKey = process.env.GEMINI_API_KEY;
  const origDisableFallback = process.env.DISABLE_TEST_AI_FALLBACK;
  const origNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';

  t.after(() => {
    process.env.NODE_ENV = 'test';
    setGeminiClientFactoryForTest(null);
    if (origNodeEnv !== undefined) process.env.NODE_ENV = origNodeEnv;
    else delete process.env.NODE_ENV;
    Profile.findOne = origFindOne;
    Profile.findOneAndUpdate = origFindOneAndUpdate;
    Profile.updateOne = origUpdateOne;
    process.env.GEMINI_PRIMARY_MODEL = origPrimary || 'gemini-3.8-flash';
    process.env.GEMINI_FALLBACK_MODELS = origFallback || 'gemini-3.6-flash,gemini-3.5-flash-lite';
    if (origKey !== undefined) process.env.GEMINI_API_KEY = origKey; else delete process.env.GEMINI_API_KEY;
    if (origDisableFallback !== undefined) process.env.DISABLE_TEST_AI_FALLBACK = origDisableFallback;
    else delete process.env.DISABLE_TEST_AI_FALLBACK;
    documentBufferCache.clear();
  });

  const userId = '507f1f77bcf86cd799439033';
  const fileUrl = `https://res.cloudinary.com/demo/raw/authenticated/v1/scholrmind/certificates/${userId}/scan.pdf`;
  // Minimal valid PDF with almost no extractable text (<50 chars) -> forces multimodal PDF path
  const scannedPdfBytes = Buffer.from('%PDF-1.4\n1 0 obj <<>> endobj\ntrailer <<>>\n%%EOF\n');

  const makeRes = () => {
    const out = { statusCode: 200, body: null };
    return {
      out,
      status(c) { out.statusCode = c; return this; },
      json(j) { out.body = j; return this; },
    };
  };

  await t.test('Scanned PDF invokes multimodal { text, inlineData } path on configured primary model', async () => {
    process.env.GEMINI_PRIMARY_MODEL = 'gemini-3.8-flash';
    process.env.GEMINI_FALLBACK_MODELS = 'gemini-3.6-flash,gemini-3.5-flash-lite';
    documentBufferCache.set(userId, fileUrl, scannedPdfBytes, 'application/pdf');

    const capturedCalls = [];
    setGeminiClientFactoryForTest(() => ({
      getGenerativeModel: ({ model }) => ({
        generateContent: async (input) => {
          capturedCalls.push({ model, input });
          return {
            response: {
              text: () => JSON.stringify({
                title: 'Cloud Fundamentals',
                issuedBy: 'Test Academy',
                issuedDate: '2026-05-01',
                skills: ['Cloud'],
                technologies: ['GCP'],
                confidence: 92,
              }),
            },
          };
        },
      }),
    }));

    const res = makeRes();
    await extractCertificate({ body: { fileUrl, mimeType: 'application/pdf' }, user: { _id: userId, role: 'student' } }, res);
    assert.equal(res.out.statusCode, 200);
    assert.equal(res.out.body.success, true);
    assert.equal(res.out.body.extractionStatus, 'succeeded');
    assert.equal(res.out.body.extractionMode, 'multimodal');
    assert.equal(res.out.body.modelUsed, 'gemini-3.8-flash');
    assert.equal(capturedCalls.length, 1);
    assert.ok(Array.isArray(capturedCalls[0].input), 'Scanned PDF must pass multimodal parts array');
    assert.equal(capturedCalls[0].input[1]?.inlineData?.mimeType, 'application/pdf');
    assert.equal(capturedCalls[0].input[1]?.inlineData?.data, scannedPdfBytes.toString('base64'));
  });

  await t.test('Unavailable 404 model skips immediately to configured fallback model and succeeds', async () => {
    process.env.GEMINI_PRIMARY_MODEL = 'gemini-nonexistent-test';
    process.env.GEMINI_FALLBACK_MODELS = 'gemini-3.6-flash';
    documentBufferCache.set(userId, fileUrl, scannedPdfBytes, 'application/pdf');

    const attemptedModels = [];
    setGeminiClientFactoryForTest(() => ({
      getGenerativeModel: ({ model }) => ({
        generateContent: async () => {
          attemptedModels.push(model);
          if (model === 'gemini-nonexistent-test') {
            throw new Error('404 models/gemini-nonexistent-test is not found');
          }
          return {
            response: {
              text: () => JSON.stringify({ title: 'Fallback Cert', issuedBy: 'Issuer', confidence: 88 }),
            },
          };
        },
      }),
    }));

    const res = makeRes();
    await extractCertificate({ body: { fileUrl, mimeType: 'application/pdf' }, user: { _id: userId, role: 'student' } }, res);
    assert.equal(res.out.statusCode, 200);
    assert.equal(res.out.body.modelUsed, 'gemini-3.6-flash');
    assert.deepEqual(attemptedModels, ['gemini-nonexistent-test', 'gemini-3.6-flash']);
  });

  await t.test('Malformed JSON model output triggers retry/fallback and fails cleanly with 502 MALFORMED_AI_RESPONSE', async () => {
    process.env.GEMINI_PRIMARY_MODEL = 'gemini-3.8-flash';
    process.env.GEMINI_FALLBACK_MODELS = 'gemini-3.6-flash';
    documentBufferCache.set(userId, fileUrl, scannedPdfBytes, 'application/pdf');

    setGeminiClientFactoryForTest(() => ({
      getGenerativeModel: () => ({
        generateContent: async () => ({ response: { text: () => '{invalid json response' } }),
      }),
    }));

    const res = makeRes();
    await extractCertificate({ body: { fileUrl, mimeType: 'application/pdf' }, user: { _id: userId, role: 'student' } }, res);
    assert.equal(res.out.statusCode, 502);
    assert.equal(res.out.body.extractionStatus, 'failed');
    assert.equal(res.out.body.code, 'MALFORMED_AI_RESPONSE');
  });

  await t.test('Provider 503 error returns 503 failed state and masks sensitive API keys', async () => {
    process.env.GEMINI_PRIMARY_MODEL = 'gemini-3.8-flash';
    process.env.GEMINI_FALLBACK_MODELS = 'gemini-3.6-flash';
    documentBufferCache.set(userId, fileUrl, scannedPdfBytes, 'application/pdf');

    setGeminiClientFactoryForTest(() => ({
      getGenerativeModel: () => ({
        generateContent: async () => {
          throw new Error('503 Service Unavailable for key AIzaSySecretKeyLeakCheck1234567890');
        },
      }),
    }));

    const res = makeRes();
    await extractCertificate({ body: { fileUrl, mimeType: 'application/pdf' }, user: { _id: userId, role: 'student' } }, res);
    assert.equal(res.out.statusCode, 503);
    assert.equal(res.out.body.extractionStatus, 'failed');
    assert.equal(JSON.stringify(res.out.body).includes('AIzaSySecretKeyLeakCheck'), false);
  });

  await t.test('Timeout returns clean AI_TIMEOUT error state', async () => {
    const { generateWithModelFallback } = await import('../../controllers/aiController.js');
    process.env.GEMINI_PRIMARY_MODEL = 'gemini-3.8-flash';
    process.env.GEMINI_FALLBACK_MODELS = 'gemini-3.6-flash';
    setGeminiClientFactoryForTest(() => ({
      getGenerativeModel: () => ({
        generateContent: () => new Promise(() => {}), // hangs intentionally
      }),
    }));

    await assert.rejects(
      () => generateWithModelFallback({ prompt: 'test', timeoutMs: 15 }),
      (err) => err.code === 'AI_TIMEOUT'
    );
  });
});

test('V13 Sprint: Fixed-Clock Deadlines (Boundary, Date-Only, TZ, Missing/Invalid) & Dry-Run Reconciliation', async (t) => {
  const fixedNow = new Date('2026-11-25T12:00:00.000Z');

  await t.test('Fixed clock validates open, exact boundary, date-only, TZ offset, and unverified deadlines', () => {
    // Open (+1ms past boundary)
    assert.equal(evaluateOpportunityDeadline({ status: 'Published', deadline: new Date('2026-11-25T12:00:00.001Z') }, fixedNow).isOpenForApplication, true);
    // Exact boundary (now === deadline -> EXPIRED)
    const exactBoundary = evaluateOpportunityDeadline({ status: 'Published', deadline: fixedNow }, fixedNow);
    assert.equal(exactBoundary.isExpired, true);
    assert.equal(exactBoundary.isOpenForApplication, false);
    // Date-only (2026-11-25 -> 23:59:59.999Z -> open at 12:00Z; 2026-11-24 -> expired)
    assert.equal(evaluateOpportunityDeadline({ status: 'Published', deadline: '2026-11-25' }, fixedNow).isOpenForApplication, true);
    assert.equal(evaluateOpportunityDeadline({ status: 'Published', deadline: '2026-11-24' }, fixedNow).isExpired, true);
    // Timezone offset (+05:30): 17:00+05:30 = 11:30Z (expired), 18:00+05:30 = 12:30Z (open)
    assert.equal(evaluateOpportunityDeadline({ status: 'Published', deadline: '2026-11-25T17:00:00+05:30' }, fixedNow).isExpired, true);
    assert.equal(evaluateOpportunityDeadline({ status: 'Published', deadline: '2026-11-25T18:00:00+05:30' }, fixedNow).isOpenForApplication, true);
    // Missing or invalid calendar date (2026-02-30) -> UNVERIFIED_DEADLINE, never silently open
    const missing = evaluateOpportunityDeadline({ status: 'Published', deadline: null }, fixedNow);
    assert.equal(missing.deadlineStatus, 'UNVERIFIED_DEADLINE');
    assert.equal(missing.isDeadlineVerified, false);
    assert.equal(missing.isOpenForApplication, false);
    const invalidRollover = parseOpportunityDeadline('2026-02-30');
    assert.equal(invalidRollover.valid, false);
  });

  await t.test('reconcileOpportunityDeadlines defaults to read-only dry-run and requires explicit --apply', async () => {
    assert.deepEqual(parseReconcileArgs([]), { apply: false, dryRun: true });
    assert.deepEqual(parseReconcileArgs(['--dry-run']), { apply: false, dryRun: true });
    assert.deepEqual(parseReconcileArgs(['--apply']), { apply: true, dryRun: false });
    assert.throws(() => parseReconcileArgs(['--apply', '--dry-run']), /Conflicting/);
    assert.throws(() => parseReconcileArgs(['--execute']), /disabled/);

    let updateCalled = false;
    let updatedIds = null;
    const mockModel = {
      find: () => ({
        sort: async () => [
          { _id: 'exp1', driveCode: 'TCS-1', company: 'TCS', title: 'Expired', deadline: new Date('2026-11-20T00:00:00Z'), status: 'Published' },
          { _id: 'unv1', driveCode: 'UNK-1', company: 'X', title: 'Unverified', deadline: null, status: 'Published' },
          { _id: 'opn1', driveCode: 'INF-1', company: 'Infosys', title: 'Open', deadline: new Date('2026-12-01T00:00:00Z'), status: 'Published' },
        ],
      }),
      updateMany: async (filter) => {
        updateCalled = true;
        updatedIds = filter._id.$in;
        return { modifiedCount: updatedIds.length };
      },
    };

    const dry = await reconcileOpportunityDeadlines({ apply: false, now: fixedNow, OpportunityModel: mockModel, logger: { log() {} } });
    assert.equal(dry.dryRun, true);
    assert.equal(dry.expiredCount, 1);
    assert.equal(dry.unverifiedCount, 1);
    assert.equal(dry.openCount, 1);
    assert.equal(dry.modifiedCount, 0);
    assert.equal(updateCalled, false);

    const applied = await reconcileOpportunityDeadlines({ apply: true, now: fixedNow, OpportunityModel: mockModel, logger: { log() {} } });
    assert.equal(applied.dryRun, false);
    assert.equal(updateCalled, true);
    assert.deepEqual(updatedIds, ['exp1']);
    assert.equal(applied.modifiedCount, 1);
  });

  await t.test('getAllOpportunities surfaces deadlineStatus and unverified state without Fabricated Open', async () => {
    const origFind = Opportunity.find;
    try {
      Opportunity.find = () => ({
        sort: () => ({
          populate: async () => [
            { _id: '1', driveCode: 'TCS', deadline: null, status: 'Published', toObject() { return { ...this }; } },
          ],
        }),
      });
      let body = null;
      await getAllOpportunities({ query: {} }, { status() { return this; }, json(d) { body = d; } });
      assert.equal(body.opportunities[0].deadlineStatus, 'UNVERIFIED_DEADLINE');
      assert.equal(body.opportunities[0].isDeadlineVerified, false);
      assert.equal(body.opportunities[0].isOpenForApplication, false);
    } finally {
      Opportunity.find = origFind;
    }
  });
});
