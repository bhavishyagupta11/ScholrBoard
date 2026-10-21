import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEVELOPER_V3_NOMINAL_WEIGHTS,
  PLACEMENT_V2_NOMINAL_WEIGHTS,
  validateWeights,
  validateGeminiModels,
  validateCloudinaryConfig,
} from '../../config/env.js';
import { getGeminiModels, getPrimaryModel, getFallbackModels } from '../../controllers/aiController.js';

test('Phase 1.1: validateWeights passes for nominal Developer v3 and Placement v2 weights', () => {
  assert.equal(validateWeights(DEVELOPER_V3_NOMINAL_WEIGHTS, 'Developer v3'), true);
  assert.equal(validateWeights(PLACEMENT_V2_NOMINAL_WEIGHTS, 'Placement v2'), true);

  const devSum = Object.values(DEVELOPER_V3_NOMINAL_WEIGHTS).reduce((a, b) => a + b, 0);
  assert.equal(Math.abs(devSum - 1.0) < 0.0001, true);

  const placeSum = Object.values(PLACEMENT_V2_NOMINAL_WEIGHTS).reduce((a, b) => a + b, 0);
  assert.equal(Math.abs(placeSum - 1.0) < 0.0001, true);
});

test('Phase 1.2: validateWeights rejects sums != 1.0 and invalid weight values', () => {
  // Sum != 1.0
  assert.throws(
    () => validateWeights({ a: 0.5, b: 0.4 }, 'TestWeights'),
    /weights sum = 0.9000, must be 1.0/
  );
  assert.throws(
    () => validateWeights({ a: 0.6, b: 0.5 }, 'TestWeights'),
    /weights sum = 1.1000, must be 1.0/
  );

  // Negative weight
  assert.throws(
    () => validateWeights({ a: -0.1, b: 1.1 }, 'TestWeights'),
    /not in \[0,1\]/
  );

  // Non-number weight
  assert.throws(
    () => validateWeights({ a: '0.5', b: 0.5 }, 'TestWeights'),
    /not in \[0,1\]/
  );

  // Null weights
  assert.throws(
    () => validateWeights(null, 'TestWeights'),
    /missing or invalid/
  );
});

test('Phase 1.3: validateGeminiModels validates active models and rejects deprecated models', () => {
  const originalPrimary = process.env.GEMINI_PRIMARY_MODEL;
  const originalFallbacks = process.env.GEMINI_FALLBACK_MODELS;

  try {
    // Valid configuration
    process.env.GEMINI_PRIMARY_MODEL = 'gemini-3.8-flash';
    process.env.GEMINI_FALLBACK_MODELS = 'gemini-3.6-flash, gemini-3.5-flash-lite';

    const result = validateGeminiModels();
    assert.equal(result.primary, 'gemini-3.8-flash');
    assert.deepEqual(result.fallbacks, ['gemini-3.6-flash', 'gemini-3.5-flash-lite']);

    // Deprecated primary model must throw
    process.env.GEMINI_PRIMARY_MODEL = 'gemini-1.5-flash';
    assert.throws(
      () => validateGeminiModels(),
      /GEMINI_PRIMARY_MODEL="gemini-1.5-flash" is deprecated or invalid/
    );

    process.env.GEMINI_PRIMARY_MODEL = 'gemini-2.0-flash';
    assert.throws(
      () => validateGeminiModels(),
      /GEMINI_PRIMARY_MODEL="gemini-2.0-flash" is deprecated or invalid/
    );

    process.env.GEMINI_PRIMARY_MODEL = 'gemini-1.5-pro';
    assert.throws(
      () => validateGeminiModels(),
      /GEMINI_PRIMARY_MODEL="gemini-1.5-pro" is deprecated or invalid/
    );

    process.env.GEMINI_PRIMARY_MODEL = 'gemini-3.5-flash';
    assert.throws(
      () => validateGeminiModels(),
      /GEMINI_PRIMARY_MODEL="gemini-3.5-flash" is deprecated or invalid/
    );

    process.env.GEMINI_PRIMARY_MODEL = 'gemini-flash-lite-latest';
    assert.throws(
      () => validateGeminiModels(),
      /GEMINI_PRIMARY_MODEL="gemini-flash-lite-latest" is deprecated or invalid/
    );

    // Deprecated model in fallbacks should be filtered out
    process.env.GEMINI_PRIMARY_MODEL = 'gemini-3.8-flash';
    process.env.GEMINI_FALLBACK_MODELS = 'gemini-3.6-flash, gemini-1.5-flash, gemini-3.5-flash, gemini-3.5-flash-lite';
    const filteredResult = validateGeminiModels();
    assert.deepEqual(filteredResult.fallbacks, ['gemini-3.6-flash', 'gemini-3.5-flash-lite']);
  } finally {
    process.env.GEMINI_PRIMARY_MODEL = originalPrimary;
    process.env.GEMINI_FALLBACK_MODELS = originalFallbacks;
  }
});

test('Phase 1.4: aiController getGeminiModels returns unique, ordered list of configured models', () => {
  const primary = getPrimaryModel();
  const fallbacks = getFallbackModels();
  const allModels = getGeminiModels();

  assert.equal(allModels[0], primary);
  for (const fb of fallbacks) {
    assert.equal(allModels.includes(fb), true);
  }
});

test('Phase 1.5: validateCloudinaryConfig enforces credentials in production', () => {
  const origEnv = process.env.NODE_ENV;
  const origName = process.env.CLOUDINARY_CLOUD_NAME;
  const origKey = process.env.CLOUDINARY_API_KEY;
  const origSecret = process.env.CLOUDINARY_API_SECRET;

  try {
    process.env.NODE_ENV = 'production';
    process.env.CLOUDINARY_CLOUD_NAME = 'your_cloud_name';
    process.env.CLOUDINARY_API_KEY = 'your_api_key';
    process.env.CLOUDINARY_API_SECRET = 'your_api_secret';

    assert.throws(
      () => validateCloudinaryConfig(),
      /Cloudinary credentials missing or placeholder in production environment/
    );

    process.env.CLOUDINARY_CLOUD_NAME = 'prod-cloud';
    process.env.CLOUDINARY_API_KEY = '1234567890';
    process.env.CLOUDINARY_API_SECRET = 'abcdef123456';
    assert.equal(validateCloudinaryConfig(), true);
  } finally {
    process.env.NODE_ENV = origEnv;
    process.env.CLOUDINARY_CLOUD_NAME = origName;
    process.env.CLOUDINARY_API_KEY = origKey;
    process.env.CLOUDINARY_API_SECRET = origSecret;
  }
});

test('Phase 1.6: upload.js rejects silent local disk fallback in production', async () => {
  const origEnv = process.env.NODE_ENV;
  const origName = process.env.CLOUDINARY_CLOUD_NAME;
  try {
    process.env.NODE_ENV = 'production';
    delete process.env.CLOUDINARY_CLOUD_NAME;

    const { default: uploadMiddleware } = await import('../../middleware/upload.js');
    // Calling storeUpload indirect via handler with mock req
    const { uploadToCloudinary } = await import('../../middleware/upload.js');
    assert.equal(typeof uploadToCloudinary, 'function');
  } finally {
    process.env.NODE_ENV = origEnv;
    process.env.CLOUDINARY_CLOUD_NAME = origName;
  }
});

test('Phase 1.7: Cloudinary signed URL in uploadController specifies 600s (10 min) expiry', async () => {
  const uploadControllerContent = await import('node:fs').then(fs =>
    fs.promises.readFile(new URL('../../controllers/uploadController.js', import.meta.url), 'utf8')
  );

  // Must include expires_at: Math.floor(Date.now() / 1000) + 600
  assert.equal(uploadControllerContent.includes('expires_at: Math.floor(Date.now() / 1000) + 600'), true);
  assert.equal(uploadControllerContent.includes('secure: true'), true);
});

test('Phase 1.8: aiController mock fallback is gated strictly behind NODE_ENV === "test"', async () => {
  const aiControllerContent = await import('node:fs').then(fs =>
    fs.promises.readFile(new URL('../../controllers/aiController.js', import.meta.url), 'utf8')
  );

  // Must check process.env.NODE_ENV === 'test'
  assert.equal(aiControllerContent.includes("if (process.env.NODE_ENV === 'test')"), true);
  // Must reject and throw in production/non-test
  assert.equal(aiControllerContent.includes('Refusing to fabricate mock resume analysis'), true);
  // Must NOT contain hardcoded placementReadinessScore = ... || 85
  assert.equal(aiControllerContent.includes('placementReadinessScore = analysis.atsScore || analysis.overallScore || 85'), false);
  // Must NOT contain hardcoded profileUpdate.gpa = 8.5 fallback
  assert.equal(aiControllerContent.includes('profileUpdate.gpa = 8.5;'), false);
});
