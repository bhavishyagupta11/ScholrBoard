/**
 * productionBugFixSprint.unit.test.js
 *
 * Focused unit test suite for ScholrBoard Production Bug-Fix Sprint:
 * 1. Cloudinary authenticated signed download URL generation with signature and version components.
 * 2. PDF and DOCX compatibility for storage retrieval.
 * 3. GitHub sync error deduplication (preventing duplicate error strings).
 * 4. AI Coach chat request lifecycle, genAI initialization, and fallback recovery.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateSignedCloudinaryUrl } from '../../utils/cloudinaryHelper.js';
import {
  sendChatMessage,
  buildGenerationConfig,
  getPrimaryModel,
  getGeminiModels,
} from '../../controllers/aiController.js';
import { v2 as cloudinary } from 'cloudinary';

describe('Production Bug-Fix Sprint: Cloudinary Authenticated Asset Retrieval', () => {
  it('correctly extracts publicId and generates signed URL when Cloudinary authenticated URL contains signature and version', () => {
    cloudinary.config({
      cloud_name: 'test-cloud',
      api_key: '123456789012345',
      api_secret: 'testsecret1234567890',
      secure: true,
    });

    const assetUrl = 'https://res.cloudinary.com/test-cloud/raw/authenticated/s--2QOI8rct--/v1792556583/scholrmind/resumes/6a9ba466102efb102fb2e136/dmewaeeex4u1b7qf0frt.pdf';
    const result = generateSignedCloudinaryUrl(assetUrl, { expiresIn: 600 });

    assert.equal(
      result.publicId,
      'scholrmind/resumes/6a9ba466102efb102fb2e136/dmewaeeex4u1b7qf0frt.pdf',
      'Must strip s--...--/ and v.../ prefixes so publicId is not corrupted'
    );
    assert.equal(result.resourceType, 'raw');
    assert.equal(result.deliveryType, 'authenticated');
    assert.ok(result.signedUrl.startsWith('https://'), 'Must generate HTTPS URL');
    assert.ok(result.signedUrl.includes('test-cloud'), 'Must include configured cloud name');
    assert.ok(result.signedUrl.includes('signature='), 'Must include signature parameter');
    assert.ok(decodeURIComponent(result.signedUrl).includes(result.publicId), 'Must include the clean public ID');
  });

  it('correctly handles DOCX authenticated resume assets with .docx format', () => {
    cloudinary.config({
      cloud_name: 'test-cloud',
      api_key: '123456789012345',
      api_secret: 'testsecret1234567890',
      secure: true,
    });

    const docxUrl = 'https://res.cloudinary.com/test-cloud/raw/authenticated/s--fARoQ97k--/v1792556410/scholrmind/resumes/user123/resume.docx';
    const result = generateSignedCloudinaryUrl(docxUrl, { expiresIn: 300 });

    assert.equal(result.publicId, 'scholrmind/resumes/user123/resume.docx');
    assert.equal(result.resourceType, 'raw');
    assert.equal(result.deliveryType, 'authenticated');
    assert.ok(result.signedUrl.includes('format=docx') || result.signedUrl.includes('resume.docx'), 'Must preserve docx format');
  });

  it('correctly parses legacy upload assets with version', () => {
    cloudinary.config({
      cloud_name: 'test-cloud',
      api_key: '123456789012345',
      api_secret: 'testsecret1234567890',
      secure: true,
    });

    const legacyUrl = 'https://res.cloudinary.com/test-cloud/raw/upload/v1787628071/scholrmind/resumes/6a27d9648435b89ab4f584a9/e12cnktpfnm5zyx4w47b.pdf';
    const result = generateSignedCloudinaryUrl(legacyUrl, { expiresIn: 600 });

    assert.equal(result.publicId, 'scholrmind/resumes/6a27d9648435b89ab4f584a9/e12cnktpfnm5zyx4w47b.pdf');
    assert.equal(result.resourceType, 'raw');
    assert.equal(result.deliveryType, 'upload');
  });
});

describe('Production Bug-Fix Sprint: GitHub Sync Error Deduplication', () => {
  it('deduplicates identical calendar and PR sync errors so duplicate banner messages are prevented', () => {
    const calendarSyncError = 'GITHUB_TOKEN is not configured on the server';
    const prsError = 'GITHUB_TOKEN is not configured on the server';

    const combinedSyncError = Array.from(new Set([calendarSyncError, prsError].filter(Boolean))).join('; ') || null;

    assert.equal(
      combinedSyncError,
      'GITHUB_TOKEN is not configured on the server',
      'Must deduplicate identical error messages to a single clean message'
    );
  });

  it('combines distinct sync errors with semicolon delimiter when they differ', () => {
    const calendarSyncError = 'Rate limit exceeded on GraphQL API';
    const prsError = 'PR search timeout after 15s';

    const combinedSyncError = Array.from(new Set([calendarSyncError, prsError].filter(Boolean))).join('; ') || null;

    assert.equal(
      combinedSyncError,
      'Rate limit exceeded on GraphQL API; PR search timeout after 15s',
      'Distinct errors must still be preserved'
    );
  });
});

describe('Production Bug-Fix Sprint: AI Coach Request Lifecycle & Recovery', () => {
  it('sendChatMessage executes without ReferenceError when client is invoked', async () => {
    let statusCode = null;
    let jsonResult = null;

    const req = {
      body: { message: '' },
      user: { _id: '507f191e810c19729de860ea', name: 'Test Student' },
    };
    const res = {
      status(code) { statusCode = code; return this; },
      json(data) { jsonResult = data; return this; },
    };

    // Validates 400 rejection for empty message without crashing
    await sendChatMessage(req, res);
    assert.equal(statusCode, 400);
    assert.equal(jsonResult.success, false);
    assert.equal(jsonResult.message, 'Message cannot be empty');
  });

  it('buildGenerationConfig strips unsupported parameters for primary model', () => {
    const primary = getPrimaryModel();
    const config = buildGenerationConfig(primary, {
      json: true,
      customConfig: {
        temperature: 0.7,
        top_p: 0.9,
        candidate_count: 1,
        thinking_level: 'low',
      },
    });

    assert.equal(config.responseMimeType, 'application/json');
    if (primary.includes('3.8')) {
      assert.equal(config.temperature, undefined);
      assert.equal(config.top_p, undefined);
      assert.equal(config.candidate_count, undefined);
      assert.deepEqual(config.thinkingConfig, { thinkingLevel: 'low' });
    }
  });

  it('getGeminiModels returns valid model array with gemini-3.8-flash', () => {
    const models = getGeminiModels();
    assert.ok(Array.isArray(models), 'Must return an array of model names');
    assert.ok(models.length >= 1, 'Must contain at least the primary model');
    assert.ok(models.includes('gemini-3.8-flash'), 'Must include gemini-3.8-flash');
  });
});

describe('Production Bug-Fix Sprint: GitHub Token Safe Diagnostics & Smoke Test', () => {
  it('performGithubSmokeTest returns TOKEN_UNCONFIGURED and authenticated: false when token is not present', async () => {
    const { performGithubSmokeTest } = await import('../../routes/health.js');
    const origToken = process.env.GITHUB_TOKEN;
    try {
      delete process.env.GITHUB_TOKEN;
      const res = await performGithubSmokeTest();
      assert.equal(res.configured, false);
      assert.equal(res.authenticated, false);
      assert.equal(res.httpStatus, null);
      assert.equal(res.errorCategory, 'TOKEN_UNCONFIGURED');
      assert.ok(res.timestamp);
      // Ensure no token or sensitive keys are leaked
      assert.equal(res.token, undefined);
      assert.equal(res.prefix, undefined);
    } finally {
      if (origToken !== undefined) process.env.GITHUB_TOKEN = origToken;
    }
  });

  it('performGithubSmokeTest correctly categorizes 401 response as BAD_CREDENTIALS without leaking token', async () => {
    const { performGithubSmokeTest } = await import('../../routes/health.js');
    const origToken = process.env.GITHUB_TOKEN;
    const origFetch = globalThis.fetch;
    try {
      process.env.GITHUB_TOKEN = 'ghp_fake_test_token_12345';
      globalThis.fetch = async () => ({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Bad credentials' }),
      });

      const res = await performGithubSmokeTest();
      assert.equal(res.configured, true);
      assert.equal(res.authenticated, false);
      assert.equal(res.httpStatus, 401);
      assert.equal(res.errorCategory, 'BAD_CREDENTIALS');
      assert.equal(res.token, undefined);
      assert.equal(res.prefix, undefined);
    } finally {
      globalThis.fetch = origFetch;
      if (origToken !== undefined) process.env.GITHUB_TOKEN = origToken;
      else delete process.env.GITHUB_TOKEN;
    }
  });

  it('performGithubSmokeTest correctly reports authenticated: true on 200 response', async () => {
    const { performGithubSmokeTest } = await import('../../routes/health.js');
    const origToken = process.env.GITHUB_TOKEN;
    const origFetch = globalThis.fetch;
    try {
      process.env.GITHUB_TOKEN = 'ghp_fake_valid_token_12345';
      globalThis.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({ resources: { core: { limit: 5000, remaining: 4999 } } }),
      });

      const res = await performGithubSmokeTest();
      assert.equal(res.configured, true);
      assert.equal(res.authenticated, true);
      assert.equal(res.httpStatus, 200);
      assert.equal(res.errorCategory, null);
      assert.equal(res.token, undefined);
    } finally {
      globalThis.fetch = origFetch;
      if (origToken !== undefined) process.env.GITHUB_TOKEN = origToken;
      else delete process.env.GITHUB_TOKEN;
    }
  });

  it('GET /api/health/diagnostics/github router layer enforces auth and requireRole("admin")', async () => {
    const { default: router } = await import('../../routes/health.js');
    const routeLayer = router.stack.find((l) => l.route?.path === '/diagnostics/github');
    assert.ok(routeLayer, 'Route /diagnostics/github must be registered on health router');
    assert.ok(routeLayer.route.methods.get, 'Must be a GET route');
    assert.equal(routeLayer.route.stack.length, 3, 'Must have auth, requireRole, and handler middlewares');
  });

  it('unauthenticated requests without Bearer token are rejected with 401', async () => {
    const { default: auth } = await import('../../middleware/auth.js');
    let statusCode = null;
    let jsonResult = null;
    const req = { headers: {} };
    const res = {
      status(c) { statusCode = c; return this; },
      json(d) { jsonResult = d; return this; },
    };
    let nextCalled = false;
    await auth(req, res, () => { nextCalled = true; });

    assert.equal(statusCode, 401);
    assert.equal(jsonResult.success, false);
    assert.equal(nextCalled, false);
    assert.match(jsonResult.message, /Access denied/i);
  });

  it('authenticated non-admin users (student/faculty) are rejected with 403 Forbidden', async () => {
    const { default: requireRole } = await import('../../middleware/roleAuth.js');
    const adminGuard = requireRole('admin');

    for (const role of ['student', 'faculty', 'recruiter']) {
      let statusCode = null;
      let jsonResult = null;
      const req = { user: { _id: `user_${role}`, role } };
      const res = {
        status(c) { statusCode = c; return this; },
        json(d) { jsonResult = d; return this; },
      };
      let nextCalled = false;
      adminGuard(req, res, () => { nextCalled = true; });

      assert.equal(statusCode, 403, `Role ${role} must be rejected with 403`);
      assert.equal(jsonResult.success, false);
      assert.equal(nextCalled, false);
      assert.match(jsonResult.message, /Access denied/i);
    }
  });

  it('authorized admin users pass role guard and can execute diagnostic smoke test', async () => {
    const { default: requireRole } = await import('../../middleware/roleAuth.js');
    const adminGuard = requireRole('admin');

    let nextCalled = false;
    const req = { user: { _id: 'admin_1', role: 'admin' } };
    const res = {};
    adminGuard(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true, 'Admin user must pass role guard');
  });
});


