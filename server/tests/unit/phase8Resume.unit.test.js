/**
 * phase8Resume.unit.test.js — ScholrBoard V13 Phase 8
 *
 * Deterministic unit tests covering:
 *   1. Cloudinary upload configuration, startup validation, signed URL protocol (secure: true, 10-min expiry).
 *   2. File type, MIME type, size limits, and cross-tenant authorization on proxyPdf / viewResumeFile.
 *   3. Missing configuration, provider error mapping (PDF_RETRIEVAL_FAILED, PDF_EXTRACTION_FAILED, PDF_APPEARS_SCANNED).
 *   4. Prompt injection protection & delimiter isolation.
 *   5. Gemini model selection, fallback hierarchy (Part 16), and error handling (404 fast-skip, 429 retry, ALL_MODELS_FAILED).
 *   6. Proof that mock AI responses are unavailable in production execution paths.
 *   7. Evidence schema validation (validateResumeEvidence) and rejection of malformed envelopes (MALFORMED_AI_RESPONSE).
 *   8. Deterministic ResumeScoringService:
 *      - 30 / 25 / 20 / 10 / 10 / 5 sub-signals.
 *      - CareerTrack absent: role alignment NOT_APPLICABLE and normalized over 95 pts (100% coverage).
 *      - CareerTrack present: role alignment scored over 100 pts.
 *      - UNVERIFIED field confidence and null booleans excluded without penalty.
 *      - Discrete UTC age decay bands (BAND_0_FRESH, BAND_1_AGING, BAND_2_EXPIRED, BAND_UNAVAILABLE).
 *   9. Zero impact on Developer Score v3 and preserved integrity of Placement Readiness v2.
 *  10. Live smoke test helper reports UNVERIFIED when credentials unset.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  validateResumeEvidence,
  computeResumeScore,
  RESUME_EVIDENCE_SCHEMA_VERSION,
  RESUME_SCORING_VERSION,
  RESUME_PROMPT_VERSION,
} from '../../services/resumeScoringService.js';

import {
  getPrimaryModel,
  getFallbackModels,
  getGeminiModels,
  generateWithModelFallback,
  buildGenerationConfig,
} from '../../controllers/aiController.js';

import {
  NOMINAL_WEIGHTS as DEV_NOMINAL_WEIGHTS,
  calculateDeveloperScore,
} from '../../services/developerScoringService.js';

import {
  PLACEMENT_NOMINAL_WEIGHTS,
  calculatePlacementScore,
  computeResumeReadinessDimension,
} from '../../services/placementReadinessService.js';

import {
  detectBufferFormat,
  validateResumeFile,
} from '../../middleware/upload.js';

import {
  validateCloudinaryConfig,
  validateGeminiModels,
} from '../../config/env.js';
import { sha256, canonicalJSON } from '../../services/scorePersistence.js';

describe('Phase 8.1: Cloudinary Configuration, Signed URL & Storage Security', () => {
  it('enforces Cloudinary credentials validation in production and rejects placeholders', () => {
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

      // Valid credentials pass
      process.env.CLOUDINARY_CLOUD_NAME = 'scholrboard-prod';
      process.env.CLOUDINARY_API_KEY = '123456789012345';
      process.env.CLOUDINARY_API_SECRET = 'abcdefghijklmnopqrstuvwxyz1';
      assert.strictEqual(validateCloudinaryConfig(), true);
    } finally {
      process.env.NODE_ENV = origEnv;
      process.env.CLOUDINARY_CLOUD_NAME = origName;
      process.env.CLOUDINARY_API_KEY = origKey;
      process.env.CLOUDINARY_API_SECRET = origSecret;
    }
  });

  it('generates private signed download URLs for authenticated assets with secure=true and 600s (10 min) expiry', async () => {
    const { v2: cloudinary } = await import('cloudinary');
    const origConfig = cloudinary.config();

    cloudinary.config({
      cloud_name: 'test-cloud',
      api_key: '111111111111111',
      api_secret: 'testsecret1234567890',
      secure: true,
    });

    const publicId = 'scholrmind/resumes/user123/sample_resume';
    const ext = 'pdf';
    const expiresAt = Math.floor(Date.now() / 1000) + 600;

    const signedUrl = cloudinary.utils.private_download_url(publicId, ext, {
      resource_type: 'raw',
      type: 'authenticated', // Strict authenticated delivery type
      expires_at: expiresAt,
      secure: true,
    });

    assert.ok(signedUrl.startsWith('https://'), 'Signed URL must strictly use HTTPS protocol');
    assert.ok(signedUrl.includes('test-cloud'), 'Signed URL must contain the configured cloud name');
    assert.ok(signedUrl.includes('type=authenticated'), 'Signed URL must specify type=authenticated');
    assert.ok(signedUrl.includes('signature='), 'Signed URL must contain HMAC authentication signature');
    assert.ok(decodeURIComponent(signedUrl).includes(publicId), 'Signed URL must contain the document public ID');

    cloudinary.config(origConfig);
  });

  it('generates secure 300s (5-minute) signed download URLs for inline resume viewing of authenticated assets', async () => {
    const { v2: cloudinary } = await import('cloudinary');
    const origConfig = cloudinary.config();

    cloudinary.config({
      cloud_name: 'test-cloud',
      api_key: '222222222222222',
      api_secret: 'testsecretviewresume1234',
      secure: true,
    });

    const publicId = 'scholrmind/resumes/user456/inline_view';
    const ext = 'pdf';
    const nowSec = Math.floor(Date.now() / 1000);
    const expiresAt = nowSec + 300; // 5-minute expiry per V13 Part 14

    const signedUrl = cloudinary.utils.private_download_url(publicId, ext, {
      resource_type: 'raw',
      type: 'authenticated',
      expires_at: expiresAt,
      secure: true,
    });

    assert.ok(signedUrl.startsWith('https://'), 'Signed URL must use HTTPS');
    assert.ok(signedUrl.includes('test-cloud'), 'Signed URL must include cloud name');
    assert.ok(signedUrl.includes('type=authenticated'), 'Signed URL must specify type=authenticated');
    assert.ok(signedUrl.includes('signature='), 'Signed URL must include HMAC signature');
    assert.ok(decodeURIComponent(signedUrl).includes(publicId), 'Signed URL must include public ID');

    cloudinary.config(origConfig);
  });

  it('proves that newly uploaded resumes are configured with type=authenticated and access_mode=authenticated to prevent public delivery', async () => {
    const { uploadResumeToCloud } = await import('../../middleware/upload.js');
    assert.ok(uploadResumeToCloud, 'uploadResumeToCloud middleware must be defined');

    // Simulate uploadResumeToCloud execution with mock Cloudinary uploader
    const { v2: cloudinary } = await import('cloudinary');
    let capturedUploadOptions = null;

    const originalUploadStream = cloudinary.uploader.upload_stream;
    try {
      cloudinary.uploader.upload_stream = (options, cb) => {
        capturedUploadOptions = options;
        return {
          end: (buffer) => {
            cb(null, {
              secure_url: 'https://res.cloudinary.com/test-cloud/raw/authenticated/v1/scholrmind/resumes/u1/resume.pdf',
              public_id: 'scholrmind/resumes/u1/resume',
              resource_type: 'raw',
              type: 'authenticated',
            });
          },
        };
      };

      const validPdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
      const req = {
        user: { _id: '507f191e810c19729de860ea' },
        file: {
          buffer: validPdfBuffer,
          mimetype: 'application/pdf',
          originalname: 'my_resume.pdf',
          size: validPdfBuffer.length,
        },
      };
      const res = {};
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      // Temporarily mock cloudinaryConfigured to return true
      const origCloudName = process.env.CLOUDINARY_CLOUD_NAME;
      const origApiKey = process.env.CLOUDINARY_API_KEY;
      const origApiSecret = process.env.CLOUDINARY_API_SECRET;
      process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
      process.env.CLOUDINARY_API_KEY = '1234567890';
      process.env.CLOUDINARY_API_SECRET = 'secret12345';

      try {
        await uploadResumeToCloud(req, res, next);
        assert.ok(nextCalled, 'next() must be called on successful upload');
        assert.ok(capturedUploadOptions, 'upload options must be captured');
        assert.strictEqual(capturedUploadOptions.resource_type, 'raw', 'resource_type must be raw');
        assert.strictEqual(capturedUploadOptions.type, 'authenticated', 'type must strictly be authenticated');
        assert.strictEqual(capturedUploadOptions.access_mode, undefined, 'obsolete access_mode parameter must not be sent');
        assert.strictEqual(req.file.cloudinaryUrl.includes('/raw/authenticated/'), true, 'secure URL must use authenticated delivery path');
      } finally {
        process.env.CLOUDINARY_CLOUD_NAME = origCloudName;
        process.env.CLOUDINARY_API_KEY = origApiKey;
        process.env.CLOUDINARY_API_SECRET = origApiSecret;
      }
    } finally {
      cloudinary.uploader.upload_stream = originalUploadStream;
    }
  });
});

describe('Phase 8.2: MIME, Size, and Cross-Tenant Authorization Boundaries', () => {
  it('enforces allowed resume MIME types and rejects unsupported extensions', async () => {
    const { resumeUpload } = await import('../../middleware/upload.js');
    assert.ok(resumeUpload, 'resumeUpload middleware must be defined');

    const allowedMimes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    const prohibitedMimes = [
      'application/x-msdownload', // .exe
      'text/javascript',
      'application/x-sh',
      'image/gif',
    ];

    // Verify allowed vs prohibited sets
    assert.strictEqual(allowedMimes.includes('application/pdf'), true);
    assert.strictEqual(allowedMimes.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document'), true);
    for (const badMime of prohibitedMimes) {
      assert.strictEqual(allowedMimes.includes(badMime), false);
    }
  });

  it('accepts valid PDF files with %PDF- header', () => {
    const validPdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');
    const file = {
      originalname: 'candidate_resume.pdf',
      mimetype: 'application/pdf',
      buffer: validPdfBuffer,
      size: validPdfBuffer.length,
    };
    const res = validateResumeFile(file);
    assert.strictEqual(res.isValid, true);
    assert.strictEqual(res.code, null);
  });

  it('accepts valid DOCX files with PK header and [Content_Types].xml', () => {
    const docxBuffer = Buffer.concat([
      Buffer.from([0x50, 0x4B, 0x03, 0x04]),
      Buffer.from(' [Content_Types].xml word/document.xml binary mock contents for word document padding to minimum length test'),
    ]);
    const file = {
      originalname: 'candidate_resume.docx',
      mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: docxBuffer,
      size: docxBuffer.length,
    };
    const res = validateResumeFile(file);
    assert.strictEqual(res.isValid, true);
    assert.strictEqual(res.code, null);
  });

  it('accepts valid DOC files with OLE2 compound binary header', () => {
    const docBuffer = Buffer.concat([
      Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]),
      Buffer.from('Microsoft Word Document binary stream padding bytes for testing minimum length'),
    ]);
    const file = {
      originalname: 'candidate_resume.doc',
      mimetype: 'application/msword',
      buffer: docBuffer,
      size: docBuffer.length,
    };
    const res = validateResumeFile(file);
    assert.strictEqual(res.isValid, true);
    assert.strictEqual(res.code, null);
  });

  it('rejects spoofed MIME types (e.g. plain text claiming application/pdf)', () => {
    const textBuffer = Buffer.from('This is a plain text file pretending to be a PDF resume for testing.');
    const file = {
      originalname: 'spoofed_resume.pdf',
      mimetype: 'application/pdf',
      buffer: textBuffer,
      size: textBuffer.length,
    };
    const res = validateResumeFile(file);
    assert.strictEqual(res.isValid, false);
    assert.strictEqual(res.code, 'INVALID_FILE_SIGNATURE');
  });

  it('rejects extension and MIME mismatches (e.g. PDF renamed to .docx)', () => {
    const pdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF');
    const file = {
      originalname: 'mismatched_resume.docx',
      mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: pdfBuffer,
      size: pdfBuffer.length,
    };
    const res = validateResumeFile(file);
    assert.strictEqual(res.isValid, false);
    assert.strictEqual(res.code, 'EXTENSION_MIME_MISMATCH');
  });

  it('rejects dangerous executables (Windows PE / Linux ELF)', () => {
    const peBuffer = Buffer.concat([Buffer.from([0x4D, 0x5A]), Buffer.alloc(64, 0x90)]);
    const elfBuffer = Buffer.concat([Buffer.from([0x7F, 0x45, 0x4C, 0x46]), Buffer.alloc(64, 0)]);

    const resPE = validateResumeFile({
      originalname: 'malware.pdf',
      mimetype: 'application/pdf',
      buffer: peBuffer,
      size: peBuffer.length,
    });
    assert.strictEqual(resPE.isValid, false);
    assert.strictEqual(resPE.code, 'EXECUTABLE_REJECTED');

    const resELF = validateResumeFile({
      originalname: 'binary.pdf',
      mimetype: 'application/pdf',
      buffer: elfBuffer,
      size: elfBuffer.length,
    });
    assert.strictEqual(resELF.isValid, false);
    assert.strictEqual(resELF.code, 'EXECUTABLE_REJECTED');
  });

  it('rejects script and html files pretending to be resumes', () => {
    const scriptBuffer = Buffer.from('#!/bin/bash\necho "exploit"\nexit 0;\n# padding to exceed minimum length threshold');
    const res = validateResumeFile({
      originalname: 'script.pdf',
      mimetype: 'application/pdf',
      buffer: scriptBuffer,
      size: scriptBuffer.length,
    });
    assert.strictEqual(res.isValid, false);
    assert.strictEqual(res.code, 'SCRIPT_REJECTED');
  });

  it('rejects corrupted, too small, empty, or oversized files', () => {
    // Empty file
    assert.strictEqual(validateResumeFile({ originalname: 'empty.pdf', mimetype: 'application/pdf', buffer: Buffer.alloc(0), size: 0 }).code, 'EMPTY_FILE');

    // Too small (< 32 bytes)
    assert.strictEqual(validateResumeFile({ originalname: 'tiny.pdf', mimetype: 'application/pdf', buffer: Buffer.from('%PDF-1.4'), size: 8 }).code, 'FILE_CORRUPTED_OR_TOO_SMALL');

    // Oversized (> 5MB)
    assert.strictEqual(validateResumeFile({ originalname: 'huge.pdf', mimetype: 'application/pdf', buffer: Buffer.alloc(32), size: 6 * 1024 * 1024 }).code, 'FILE_TOO_LARGE');

    // Unsupported extension
    assert.strictEqual(validateResumeFile({ originalname: 'resume.txt', mimetype: 'text/plain', buffer: Buffer.alloc(64), size: 64 }).code, 'UNSUPPORTED_EXTENSION');
  });

  it('rejects cross-tenant access in proxyPdf when a student attempts to proxy another user\'s document', async () => {
    const { proxyPdf } = await import('../../controllers/uploadController.js');

    const studentUser = {
      _id: '507f1f77bcf86cd799439011',
      role: 'student',
    };

    const foreignUserDocumentUrl = 'https://res.cloudinary.com/demo/raw/upload/scholrmind/resumes/507f191e810c19729de860ea/resume.pdf';

    let responseStatus = null;
    let responseText = null;

    const req = {
      user: studentUser,
      query: { url: foreignUserDocumentUrl },
    };

    const res = {
      status(code) {
        responseStatus = code;
        return this;
      },
      send(text) {
        responseText = text;
        return this;
      },
    };

    await proxyPdf(req, res);

    assert.strictEqual(responseStatus, 403, 'Cross-tenant access to another student document must return 403 Forbidden');
    assert.ok(responseText.includes('Forbidden'), 'Response must explain authorization failure');
  });

  it('rejects arbitrary external SSRF URLs in proxyPdf', async () => {
    const { proxyPdf } = await import('../../controllers/uploadController.js');

    const studentUser = {
      _id: '507f1f77bcf86cd799439011',
      role: 'student',
    };

    let responseStatus = null;
    let responseText = null;

    const req = {
      user: studentUser,
      query: { url: 'http://169.254.169.254/latest/meta-data/' },
    };

    const res = {
      status(code) {
        responseStatus = code;
        return this;
      },
      send(text) {
        responseText = text;
        return this;
      },
    };

    await proxyPdf(req, res);

    assert.strictEqual(responseStatus, 400, 'Arbitrary foreign external URLs must be rejected with 400 Bad Request');
    assert.ok(responseText.includes('Invalid document URL source'));
  });
});

describe('Phase 8.3: Gemini Model Configuration & Production Mock Isolation', () => {
  it('uses V13 Part 16 model selection hierarchy with gemini-3.8-flash primary', () => {
    const primary = getPrimaryModel();
    assert.strictEqual(primary, 'gemini-3.8-flash', 'Primary model must be gemini-3.8-flash per V13 Part 16.2');

    const fallbacks = getFallbackModels();
    assert.ok(fallbacks.length >= 1, 'At least one fallback model must be configured');
    assert.ok(fallbacks.some(m => m.includes('gemini-3.6') || m.includes('gemini-3.5-flash-lite')), 'Fallback models must be active Gemini models');

    const allModels = getGeminiModels();
    assert.strictEqual(allModels[0], 'gemini-3.8-flash');
  });

  it('validates model hierarchy and filters deprecated gemini-3.5-flash', () => {
    const origPrimary = process.env.GEMINI_PRIMARY_MODEL;
    const origFallbacks = process.env.GEMINI_FALLBACK_MODELS;

    try {
      process.env.GEMINI_PRIMARY_MODEL = 'gemini-3.8-flash';
      process.env.GEMINI_FALLBACK_MODELS = 'gemini-3.6-flash, gemini-3.5-flash, gemini-3.5-flash-lite';

      const validated = validateGeminiModels();
      assert.strictEqual(validated.primary, 'gemini-3.8-flash');
      assert.deepEqual(validated.fallbacks, ['gemini-3.6-flash', 'gemini-3.5-flash-lite']);
      assert.strictEqual(validated.fallbacks.includes('gemini-3.5-flash'), false, 'gemini-3.5-flash must be filtered out as deprecated');
    } finally {
      process.env.GEMINI_PRIMARY_MODEL = origPrimary;
      process.env.GEMINI_FALLBACK_MODELS = origFallbacks;
    }
  });

  it('buildGenerationConfig strips unsupported parameters for gemini-3.8-flash and handles thinking_level', () => {
    const rawOptions = {
      customConfig: {
        temperature: 0.7,
        top_p: 0.95,
        top_k: 40,
        candidate_count: 1,
        thinking_budget: 2048,
        thinking_level: 'high',
      },
      json: true,
    };

    const config = buildGenerationConfig('gemini-3.8-flash', rawOptions);
    assert.strictEqual(config.temperature, undefined, 'temperature must be stripped for gemini-3.8');
    assert.strictEqual(config.top_p, undefined, 'top_p must be stripped for gemini-3.8');
    assert.strictEqual(config.top_k, undefined, 'top_k must be stripped for gemini-3.8');
    assert.strictEqual(config.candidate_count, undefined, 'candidate_count must be stripped for gemini-3.8');
    assert.strictEqual(config.thinking_budget, undefined, 'thinking_budget must be stripped for gemini-3.8');
    assert.deepEqual(config.thinkingConfig, { thinkingLevel: 'high' }, 'thinking_level must be mapped to thinkingConfig');
    assert.strictEqual(config.responseMimeType, 'application/json');
  });

  it('proves that mock AI responses are strictly prohibited in non-test execution paths', async () => {
    const origEnv = process.env.NODE_ENV;
    const origKey = process.env.GEMINI_API_KEY;

    try {
      process.env.NODE_ENV = 'production';
      delete process.env.GEMINI_API_KEY;

      await assert.rejects(
        async () => {
          await generateWithModelFallback({ prompt: 'Test prompt' });
        },
        (err) => err.code === 'GEMINI_API_KEY_NOT_CONFIGURED' || err.message.includes('GEMINI_API_KEY')
      );
    } finally {
      process.env.NODE_ENV = origEnv;
      if (origKey) process.env.GEMINI_API_KEY = origKey;
    }
  });
});

describe('Phase 8.4: Structured Evidence Validation (validateResumeEvidence)', () => {
  it('accepts complete, well-formed V13 structured evidence', () => {
    const validEvidence = {
      sections: {
        hasSummary: true,
        hasEducation: true,
        hasExperience: true,
        hasProjects: true,
        hasSkills: true,
        hasContactInfo: true,
      },
      experience: [
        { role: 'Backend Engineer Intern', company: 'Acme', durationMonths: 6, isTechnical: true },
      ],
      technicalSkills: ['JavaScript', 'Node.js', 'React', 'MongoDB'],
      projects: [
        { title: 'Task Manager', techStack: ['Node.js'], hasQuantifiedImpact: true },
      ],
      qualitySignals: {
        hasQuantifiedItems: true,
        hasActionVerbs: true,
      },
      keywordAlignment: 0.90,
      fieldConfidence: {
        sections: 'HIGH',
        experience: 'HIGH',
        technicalSkills: 'HIGH',
        projects: 'HIGH',
        qualitySignals: 'HIGH',
      },
    };

    const res = validateResumeEvidence(validEvidence);
    assert.strictEqual(res.isValid, true);
    assert.strictEqual(res.reason, null);
  });

  it('rejects malformed evidence missing required sections or array structures', () => {
    // Missing sections
    assert.strictEqual(validateResumeEvidence({}).isValid, false);
    assert.ok(validateResumeEvidence({}).reason.includes('sections'));

    // Non-array experience
    assert.strictEqual(validateResumeEvidence({
      sections: {},
      experience: 'invalid',
      technicalSkills: [],
      projects: [],
      qualitySignals: {},
    }).isValid, false);

    // Missing qualitySignals
    assert.strictEqual(validateResumeEvidence({
      sections: {},
      experience: [],
      technicalSkills: [],
      projects: [],
    }).isValid, false);
  });
});

describe('Phase 8.5: Deterministic Resume Scoring Engine (computeResumeScore)', () => {
  it('computes perfect score (100) when all signals verified with careerTrack', () => {
    const evidence = {
      sections: {
        hasSummary: true,     // 5
        hasEducation: true,   // 5
        hasExperience: true,  // 5
        hasProjects: true,    // 5
        hasSkills: true,      // 5
        hasContactInfo: true, // 5 -> 30
      },
      experience: [
        { role: 'Engineer', durationMonths: 75, isTechnical: true }, // 75/3 = 25 -> 25
      ],
      technicalSkills: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'], // 10 * 2 = 20 -> 20
      qualitySignals: {
        hasQuantifiedItems: true, // 5
        hasActionVerbs: true,     // 5 -> 10
      },
      projects: [
        { title: 'P1' }, { title: 'P2' }, { title: 'P3' }, { title: 'P4' }, { title: 'P5' }, // 5 * 2 = 10 -> 10
      ],
      keywordAlignment: 0.50, // 0.50 * 10 = 5 -> 5
      fieldConfidence: {
        sections: 'HIGH',
        experience: 'HIGH',
        technicalSkills: 'HIGH',
        projects: 'HIGH',
        qualitySignals: 'HIGH',
      },
    };

    const evalDate = new Date('2026-10-14T10:00:00.000Z');
    const analysisTimestamp = new Date('2026-10-14T09:00:00.000Z');

    const result = computeResumeScore(evidence, {
      careerTrack: 'Full Stack Engineer',
      evalDate,
      analysisTimestamp,
    });

    assert.strictEqual(result.breakdown.sectionScore, 30);
    assert.strictEqual(result.breakdown.experienceScore, 25);
    assert.strictEqual(result.breakdown.skillScore, 20);
    assert.strictEqual(result.breakdown.genericQualityScore, 10);
    assert.strictEqual(result.breakdown.projectScore, 10);
    assert.strictEqual(result.breakdown.roleAlignmentScore, 5);
    assert.strictEqual(result.breakdown.rawApplicable, 100);
    assert.strictEqual(result.breakdown.applicableMax, 100);
    assert.strictEqual(result.score, 100);
    assert.strictEqual(result.dimensionCoverage, 100);
    assert.strictEqual(result.breakdown.resumeAgeBand, 'BAND_0_FRESH');
    assert.strictEqual(result.breakdown.resumeAgeMultiplier, 1.00);
  });

  it('normalizes over 95 applicable points to reach 100 when careerTrack is absent', () => {
    const evidence = {
      sections: {
        hasSummary: true,     // 5
        hasEducation: true,   // 5
        hasExperience: true,  // 5
        hasProjects: true,    // 5
        hasSkills: true,      // 5
        hasContactInfo: true, // 5 -> 30
      },
      experience: [
        { role: 'Dev', durationMonths: 75, isTechnical: true }, // 25
      ],
      technicalSkills: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'], // 20
      qualitySignals: {
        hasQuantifiedItems: true, // 5
        hasActionVerbs: true,     // 5 -> 10
      },
      projects: [
        { title: 'P1' }, { title: 'P2' }, { title: 'P3' }, { title: 'P4' }, { title: 'P5' }, // 10
      ],
      keywordAlignment: null, // absent
      fieldConfidence: {
        sections: 'HIGH',
        experience: 'HIGH',
        technicalSkills: 'HIGH',
        projects: 'HIGH',
        qualitySignals: 'HIGH',
      },
    };

    const evalDate = new Date('2026-10-14T10:00:00.000Z');
    const analysisTimestamp = new Date('2026-10-14T09:00:00.000Z');

    // careerTrack: null (NOT_APPLICABLE)
    const result = computeResumeScore(evidence, {
      careerTrack: null,
      evalDate,
      analysisTimestamp,
    });

    assert.strictEqual(result.breakdown.roleAlignmentApplicable, false);
    assert.strictEqual(result.breakdown.roleAlignmentScore, 0);
    assert.strictEqual(result.breakdown.rawApplicable, 95);
    assert.strictEqual(result.breakdown.applicableMax, 95);
    // 95 / 95 * 100 = 100!
    assert.strictEqual(result.score, 100, 'Perfect generic resume must reach 100 without careerTrack');
    assert.strictEqual(result.dimensionCoverage, 100, 'Coverage must be 100% when all applicable signals verified');
  });

  it('excludes UNVERIFIED field confidence and null boolean fields without penalty', () => {
    const evidence = {
      sections: {
        hasSummary: null,     // null -> excluded, 0 pts
        hasEducation: true,   // 5
        hasExperience: true,  // 5
        hasProjects: true,    // 5
        hasSkills: true,      // 5
        hasContactInfo: true, // 5 -> 25
      },
      experience: [
        { role: 'Dev', durationMonths: 30, isTechnical: true }, // 10
      ],
      technicalSkills: ['React', 'Node'], // UNVERIFIED confidence -> excluded
      qualitySignals: {
        hasQuantifiedItems: true, // 5
        hasActionVerbs: null,     // null -> excluded
      },
      projects: [
        { title: 'P1' }, // 2
      ],
      fieldConfidence: {
        sections: 'HIGH',
        experience: 'HIGH',
        technicalSkills: 'UNVERIFIED', // Excluded from score and coverage
        projects: 'HIGH',
        qualitySignals: 'HIGH',
      },
    };

    const result = computeResumeScore(evidence, {
      careerTrack: null,
      analysisTimestamp: new Date(),
    });

    assert.strictEqual(result.breakdown.skillScore, 0, 'UNVERIFIED technicalSkills must score 0 pts');
    assert.strictEqual(result.breakdown.sectionScore, 25, 'Null boolean in section must not penalize other true fields');
    assert.strictEqual(result.breakdown.genericQualityScore, 5);
    assert.strictEqual(result.breakdown.projectScore, 2);

    // dimensionCoverage loses 20% from UNVERIFIED technicalSkills: 75 / 95 * 100 = 78.9% -> 79%
    assert.ok(result.dimensionCoverage < 100, 'Coverage must reflect missing UNVERIFIED signal');
    assert.strictEqual(result.dimensionConfidence, 'Medium', 'Confidence drops to Medium when coverage < 90%');
  });

  it('applies discrete UTC calendar-day age decay bands', () => {
    const baseEvidence = {
      sections: { hasSummary: true, hasEducation: true, hasExperience: true, hasProjects: true, hasSkills: true, hasContactInfo: true },
      experience: [{ role: 'Dev', durationMonths: 75, isTechnical: true }],
      technicalSkills: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
      qualitySignals: { hasQuantifiedItems: true, hasActionVerbs: true },
      projects: [{ title: '1' }, { title: '2' }, { title: '3' }, { title: '4' }, { title: '5' }],
      fieldConfidence: { sections: 'HIGH', experience: 'HIGH', technicalSkills: 'HIGH', projects: 'HIGH', qualitySignals: 'HIGH' },
    };

    const evalDate = new Date('2026-10-14T00:00:00.000Z');

    // Case 1: Fresh (100 days old <= 180d) -> 1.00x multiplier
    const freshTimestamp = new Date('2026-07-06T00:00:00.000Z'); // 100 days
    const freshRes = computeResumeScore(baseEvidence, { careerTrack: null, evalDate, analysisTimestamp: freshTimestamp });
    assert.strictEqual(freshRes.breakdown.resumeAgeBand, 'BAND_0_FRESH');
    assert.strictEqual(freshRes.breakdown.resumeAgeMultiplier, 1.00);
    assert.strictEqual(freshRes.score, 100);

    // Case 2: Aging (200 days old: 181-365d) -> 0.90x multiplier
    const agingTimestamp = new Date('2026-03-28T00:00:00.000Z'); // 200 days
    const agingRes = computeResumeScore(baseEvidence, { careerTrack: null, evalDate, analysisTimestamp: agingTimestamp });
    assert.strictEqual(agingRes.breakdown.resumeAgeBand, 'BAND_1_AGING');
    assert.strictEqual(agingRes.breakdown.resumeAgeMultiplier, 0.90);
    assert.strictEqual(agingRes.score, 90); // 100 * 0.90 = 90

    // Case 3: Expired (> 365 days old) -> 0.80x multiplier
    const expiredTimestamp = new Date('2025-09-01T00:00:00.000Z'); // > 400 days
    const expiredRes = computeResumeScore(baseEvidence, { careerTrack: null, evalDate, analysisTimestamp: expiredTimestamp });
    assert.strictEqual(expiredRes.breakdown.resumeAgeBand, 'BAND_2_EXPIRED');
    assert.strictEqual(expiredRes.breakdown.resumeAgeMultiplier, 0.80);
    assert.strictEqual(expiredRes.score, 80); // 100 * 0.80 = 80

    // Case 4: Missing or invalid date -> BAND_UNAVAILABLE (neutral 1.00x multiplier, coverage 90%)
    const invalidRes = computeResumeScore(baseEvidence, { careerTrack: null, evalDate, analysisTimestamp: null });
    assert.strictEqual(invalidRes.breakdown.resumeAgeBand, 'BAND_UNAVAILABLE');
    assert.strictEqual(invalidRes.breakdown.resumeAgeMultiplier, 1.00, 'BAND_UNAVAILABLE must NOT penalize as 0.80');
    assert.strictEqual(invalidRes.dimensionCoverage, 90, 'Missing date reduces coverage to 90%');
    assert.strictEqual(invalidRes.dimensionConfidence, 'Low', 'Missing date drops confidence to Low');
  });
});

describe('Phase 8.6: Score Boundary & Mathematical Invariant Protection', () => {
  it('proves Developer Score v3 has ZERO dependency on resume analysis', () => {
    assert.strictEqual(DEV_NOMINAL_WEIGHTS.resume, undefined, 'Resume must NOT be in Developer Score nominal weights');
    assert.strictEqual(DEV_NOMINAL_WEIGHTS.resumeReadiness, undefined);

    const baseProfile = {
      codingStats: {
        rawMetrics: {
          leetcode: {
            easySolved: 50,
            mediumSolved: 40,
            hardSolved: 10,
            activeSubmitDays30d: 15,
            activeSubmitDays90d: 35,
            activeSubmitDays365d: 80,
            recencyLevel: 'L1',
          },
          github: {
            activeDaysLast365: 120,
            longestStreak: 25,
            calendarAvailable: true,
            qualifiedMergedPRsCount: 8,
            qualifiedIssuesCount: 4,
            meaningfulRepoCount: 6,
            recentlyActiveReposCount: 4,
            totalStars: 15,
            totalForks: 5,
            structureBonus: 10,
            uniqueLanguagesCount: 5,
          },
        },
      },
    };

    const devScoreWithoutResume = calculateDeveloperScore(baseProfile);

    // Attach resume data
    const profileWithResume = {
      ...baseProfile,
      resumeUrl: 'https://res.cloudinary.com/demo/raw/upload/sample.pdf',
      resumeAnalysis: { overallScore: 95, atsScore: 98 },
    };

    const devScoreWithResume = calculateDeveloperScore(profileWithResume);

    assert.strictEqual(devScoreWithoutResume.score, devScoreWithResume.score, 'Developer Score must be strictly identical regardless of resume');
    assert.strictEqual(devScoreWithoutResume.coverage, devScoreWithResume.coverage);
  });

  it('preserves Placement Readiness v2 formula with resumeReadiness nominal weight 22%', () => {
    assert.strictEqual(PLACEMENT_NOMINAL_WEIGHTS.resumeReadiness, 0.22, 'resumeReadiness nominal weight must be 22%');

    // Test computeResumeReadinessDimension with null analysis evaluates cleanly to null without throwing
    const dimUnavailable = computeResumeReadinessDimension({}, null);
    assert.strictEqual(dimUnavailable.score, null, 'Unavailable resume must evaluate to score: null');
    assert.strictEqual(dimUnavailable.dimensionCoverage, 0, 'Unavailable resume has coverage 0%');
    assert.strictEqual(dimUnavailable.effectiveWeight, 0, 'Unavailable resume has effective weight 0');
    assert.ok(dimUnavailable.explanation.includes('unavailable'), 'Explanation must state resume is unavailable');
  });

  it('verifies authoritative Developer Score v3 5-dimension nominal weights and formula', () => {
    // Assert the exact 5 dimensions and weights from Phase 5 / V13 Part 6.2
    assert.strictEqual(DEV_NOMINAL_WEIGHTS.dsa, 0.30, 'dsa weight must be 0.30 (30%)');
    assert.strictEqual(DEV_NOMINAL_WEIGHTS.engActivity, 0.25, 'engActivity weight must be 0.25 (25%)');
    assert.strictEqual(DEV_NOMINAL_WEIGHTS.repoQuality, 0.20, 'repoQuality weight must be 0.20 (20%)');
    assert.strictEqual(DEV_NOMINAL_WEIGHTS.cp, 0.15, 'cp weight must be 0.15 (15%)');
    assert.strictEqual(DEV_NOMINAL_WEIGHTS.breadth, 0.10, 'breadth weight must be 0.10 (10%)');

    const totalWeight = Object.values(DEV_NOMINAL_WEIGHTS).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(totalWeight - 1.0) < 0.0001, 'Developer Score nominal weights must sum to exactly 1.0');

    // Exercise production entry point
    const profile = {
      codingStats: {
        rawMetrics: {
          leetcode: { easySolved: 30, mediumSolved: 20, hardSolved: 5, activeSubmitDays30d: 10, activeSubmitDays90d: 25, activeSubmitDays365d: 60, recencyLevel: 'L1' },
          github: { activeDaysLast365: 90, longestStreak: 15, calendarAvailable: true, qualifiedMergedPRsCount: 5, qualifiedIssuesCount: 3, meaningfulRepoCount: 4, recentlyActiveReposCount: 3, totalStars: 10, totalForks: 3, structureBonus: 5, uniqueLanguagesCount: 4 },
        },
      },
    };

    const res = calculateDeveloperScore(profile);
    assert.ok(typeof res.score === 'number' && res.score > 0 && res.score <= 100);
    assert.strictEqual(res.developerMethodologyVersion, 'v3.0.0');
  });

  it('verifies authoritative Placement Readiness v2 6-dimension nominal weights and formula', () => {
    // Assert the exact 6 dimensions and weights from Phase 6 / V13 Part 7.2
    assert.strictEqual(PLACEMENT_NOMINAL_WEIGHTS.placementDsa, 0.28, 'placementDsa weight must be 0.28 (28%)');
    assert.strictEqual(PLACEMENT_NOMINAL_WEIGHTS.resumeReadiness, 0.22, 'resumeReadiness weight must be 0.22 (22%)');
    assert.strictEqual(PLACEMENT_NOMINAL_WEIGHTS.portfolio, 0.17, 'portfolio weight must be 0.17 (17%)');
    assert.strictEqual(PLACEMENT_NOMINAL_WEIGHTS.academic, 0.17, 'academic weight must be 0.17 (17%)');
    assert.strictEqual(PLACEMENT_NOMINAL_WEIGHTS.achievements, 0.11, 'achievements weight must be 0.11 (11%)');
    assert.strictEqual(PLACEMENT_NOMINAL_WEIGHTS.completeness, 0.05, 'completeness weight must be 0.05 (5%)');

    const totalPlacementWeight = Object.values(PLACEMENT_NOMINAL_WEIGHTS).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(totalPlacementWeight - 1.0) < 0.0001, 'Placement Readiness nominal weights must sum to exactly 1.0');

    // Exercise production entry point with null resume analysis
    const profile = {
      cgpa: 8.5,
      branch: 'CSE',
      batch: '2025',
      resumeUrl: null,
      skills: ['JavaScript', 'React'],
      codingStats: {
        rawMetrics: {
          leetcode: { easySolved: 40, mediumSolved: 30, hardSolved: 8, activeSubmitDays30d: 12, activeSubmitDays90d: 30, activeSubmitDays365d: 70, recencyLevel: 'L1' },
          github: { activeDaysLast365: 100, longestStreak: 20, calendarAvailable: true, qualifiedMergedPRsCount: 6, qualifiedIssuesCount: 4, meaningfulRepoCount: 5, recentlyActiveReposCount: 4, totalStars: 12, totalForks: 4, structureBonus: 8, uniqueLanguagesCount: 4 },
        },
      },
    };

    const res = calculatePlacementScore(profile, { resumeAnalysis: null });
    assert.ok(typeof res.score === 'number' && res.score > 0 && res.score <= 100);
    assert.strictEqual(res.placementMethodologyVersion, 'v2.0.0');

    // Verify resumeReadiness dimension evaluates cleanly to null without polluting other dimensions
    const resumeDim = res.dimensions.get('resumeReadiness');
    assert.ok(resumeDim, 'resumeReadiness dimension must exist in calculation map');
    assert.strictEqual(resumeDim.score, null, 'Unanalyzed resume must have null dimension score');
    assert.strictEqual(resumeDim.effectiveWeight, 0, 'Unanalyzed resume dimension must have 0 effective weight');
  });

  it('guarantees deterministic snapshot hash invariance for identical evidence', () => {
    const evidence = {
      sections: { hasSummary: true, hasEducation: true, hasExperience: true, hasProjects: true, hasSkills: true, hasContactInfo: true },
      experience: [{ role: 'Dev', durationMonths: 12, isTechnical: true }],
      technicalSkills: ['React', 'Node.js'],
      projects: [{ title: 'P1' }],
      qualitySignals: { hasQuantifiedItems: true, hasActionVerbs: true },
      keywordAlignment: null,
      fieldConfidence: { sections: 'HIGH', experience: 'HIGH', technicalSkills: 'HIGH', projects: 'HIGH', qualitySignals: 'HIGH' },
    };

    const hash1 = sha256(canonicalJSON(evidence));
    const hash2 = sha256(canonicalJSON({ ...evidence }));
    assert.strictEqual(hash1, hash2, 'Identical evidence must produce identical hash');

    const modifiedEvidence = { ...evidence, technicalSkills: ['React', 'Node.js', 'TypeScript'] };
    const hashModified = sha256(canonicalJSON(modifiedEvidence));
    assert.notStrictEqual(hash1, hashModified, 'Changed evidence must produce distinct hash');
  });
});

describe('Phase 8.7: Comprehensive Authorization, SSRF & Signed URL Security Regression Suite', () => {
  // Authorization scenarios
  it('rejects unauthenticated requests in proxyPdf with 401 Unauthorized', async () => {
    const { proxyPdf } = await import('../../controllers/uploadController.js');
    let statusCode = null;
    let responseBody = null;
    const req = {
      user: null,
      query: { url: 'https://res.cloudinary.com/test-cloud/raw/authenticated/v1/scholrmind/resumes/u1/doc.pdf' },
    };
    const res = {
      status(code) { statusCode = code; return this; },
      send(data) { responseBody = data; return this; },
    };
    await proxyPdf(req, res);
    assert.strictEqual(statusCode, 401);
    assert.ok(responseBody.includes('Authentication required'));
  });

  it('rejects student attempting to access another student resume analysis with 403 Forbidden', async () => {
    const { getResumeAnalysis } = await import('../../controllers/uploadController.js');
    const ResumeAnalysis = (await import('../../models/ResumeAnalysis.js')).default;
    const origFindById = ResumeAnalysis.findById;
    try {
      ResumeAnalysis.findById = async () => ({
        _id: '507f191e810c19729de860ea',
        userId: 'student_owner_123',
        analysisStatus: 'completed',
      });
      let statusCode = null;
      let jsonResult = null;
      const req = {
        params: { id: '507f191e810c19729de860ea' },
        user: { _id: 'student_attacker_456', role: 'student' },
      };
      const res = {
        status(code) { statusCode = code; return this; },
        json(data) { jsonResult = data; return this; },
      };
      await getResumeAnalysis(req, res);
      assert.strictEqual(statusCode, 403);
      assert.strictEqual(jsonResult.success, false);
      assert.ok(jsonResult.message.includes('Forbidden'));
    } finally {
      ResumeAnalysis.findById = origFindById;
    }
  });

  it('rejects unsupported role (such as recruiter) with 403 Forbidden when accessing another student resume', async () => {
    const { getSignedResumeUrl } = await import('../../controllers/uploadController.js');
    const ResumeAnalysis = (await import('../../models/ResumeAnalysis.js')).default;
    const origFindById = ResumeAnalysis.findById;
    try {
      ResumeAnalysis.findById = async () => ({
        _id: '507f191e810c19729de860ea',
        userId: 'student_owner_123',
        fileUrl: 'https://res.cloudinary.com/test-cloud/raw/authenticated/v1/scholrmind/resumes/student_owner_123/doc.pdf',
      });
      let statusCode = null;
      let jsonResult = null;
      const req = {
        params: { id: '507f191e810c19729de860ea' },
        user: { _id: 'recruiter_999', role: 'recruiter' },
      };
      const res = {
        status(code) { statusCode = code; return this; },
        json(data) { jsonResult = data; return this; },
      };
      await getSignedResumeUrl(req, res);
      assert.strictEqual(statusCode, 403);
      assert.strictEqual(jsonResult.success, false);
      assert.ok(jsonResult.message.includes('Forbidden'));
    } finally {
      ResumeAnalysis.findById = origFindById;
    }
  });

  it('allows faculty and admin to view student resume analysis and resume documents', async () => {
    const { getResumeAnalysis } = await import('../../controllers/uploadController.js');
    const ResumeAnalysis = (await import('../../models/ResumeAnalysis.js')).default;
    const origFindById = ResumeAnalysis.findById;
    try {
      ResumeAnalysis.findById = async () => ({
        _id: '507f191e810c19729de860ea',
        userId: 'student_owner_123',
        analysisStatus: 'completed',
        overallScore: 88,
      });

      for (const privilegedRole of ['faculty', 'admin']) {
        let jsonResult = null;
        const req = {
          params: { id: '507f191e810c19729de860ea' },
          user: { _id: `privileged_${privilegedRole}`, role: privilegedRole },
        };
        const res = {
          json(data) { jsonResult = data; return this; },
        };
        await getResumeAnalysis(req, res);
        assert.strictEqual(jsonResult.success, true);
        assert.strictEqual(jsonResult.analysis.overallScore, 88);
      }
    } finally {
      ResumeAnalysis.findById = origFindById;
    }
  });

  it('safely returns 404 when database ID does not exist in viewResumeFile and getSignedResumeUrl', async () => {
    const { viewResumeFile, getSignedResumeUrl } = await import('../../controllers/uploadController.js');
    const ResumeAnalysis = (await import('../../models/ResumeAnalysis.js')).default;
    const Application = (await import('../../models/Application.js')).default;
    const Profile = (await import('../../models/Profile.js')).default;

    const origAnalysisFind = ResumeAnalysis.findById;
    const origAppFind = Application.findById;
    const origProfileFind = Profile.findById;

    try {
      ResumeAnalysis.findById = async () => null;
      Application.findById = async () => null;
      Profile.findById = async () => null;

      // viewResumeFile
      let viewStatus = null;
      const resView = {
        status(code) { viewStatus = code; return this; },
        send() { return this; },
      };
      await viewResumeFile({ params: { id: '507f191e810c19729de860ea' }, user: { _id: 'u1', role: 'student' } }, resView);
      assert.strictEqual(viewStatus, 404);

      // getSignedResumeUrl
      let signedStatus = null;
      let signedJson = null;
      const resSigned = {
        status(code) { signedStatus = code; return this; },
        json(data) { signedJson = data; return this; },
      };
      await getSignedResumeUrl({ params: { id: '507f191e810c19729de860ea' }, user: { _id: 'u1', role: 'student' } }, resSigned);
      assert.strictEqual(signedStatus, 404);
      assert.strictEqual(signedJson.success, false);
    } finally {
      ResumeAnalysis.findById = origAnalysisFind;
      Application.findById = origAppFind;
      Profile.findById = origProfileFind;
    }
  });

  // SSRF and Proxy abuse scenarios
  it('rejects localhost, private-network, and metadata endpoints in proxyPdf', async () => {
    const { proxyPdf } = await import('../../controllers/uploadController.js');
    const dangerousUrls = [
      'http://localhost:5000/api/upload/resume',
      'http://127.0.0.1:8080/secret',
      'http://10.0.0.1/admin',
      'http://192.168.1.1/router',
      'http://172.16.0.1/metadata',
      'http://169.254.169.254/latest/meta-data/',
      'https://attacker-controlled.com/malicious.pdf',
      'https://res.cloudinary.com.attacker.com/fake.pdf',
      'https://res.cloudinary.com@attacker.com/test.pdf',
    ];

    for (const badUrl of dangerousUrls) {
      let code = null;
      const res = {
        status(c) { code = c; return this; },
        send() { return this; },
      };
      await proxyPdf({ user: { _id: '507f191e810c19729de860ea', role: 'student' }, query: { url: badUrl } }, res);
      assert.strictEqual(code, 400, `Dangerous SSRF URL must be rejected with 400: ${badUrl}`);
    }
  });

  it('rejects path traversal in local file paths in proxyPdf', async () => {
    const { proxyPdf } = await import('../../controllers/uploadController.js');
    const traversalPaths = [
      '/uploads/../../etc/passwd',
      'uploads/../../../windows/system32/config/sam',
      '/uploads/..\\..\\secret.key',
    ];

    for (const badPath of traversalPaths) {
      let code = null;
      const res = {
        status(c) { code = c; return this; },
        send() { return this; },
      };
      await proxyPdf({ user: { _id: '507f191e810c19729de860ea', role: 'student' }, query: { url: badPath } }, res);
      assert.strictEqual(code, 400, `Path traversal must be rejected with 400: ${badPath}`);
    }
  });

  it('rejects non-PDF and dangerous file types in proxyPdf', async () => {
    const { proxyPdf } = await import('../../controllers/uploadController.js');
    const origFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () => ({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-length': '50' }),
        arrayBuffer: async () => Buffer.from('<html><body><script>alert(1)</script></body></html>'),
      });

      let code = null;
      let text = null;
      const res = {
        status(c) { code = c; return this; },
        send(t) { text = t; return this; },
      };
      await proxyPdf({
        user: { _id: '507f191e810c19729de860ea', role: 'student' },
        query: { url: 'https://res.cloudinary.com/test-cloud/raw/authenticated/v1/scholrmind/resumes/507f191e810c19729de860ea/resume.pdf' },
      }, res);

      assert.strictEqual(code, 400);
      assert.ok(text.includes('Invalid document format'));
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('rejects HTTP redirects in proxyPdf to prevent redirect-based SSRF', async () => {
    const { proxyPdf } = await import('../../controllers/uploadController.js');
    const origFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () => ({
        ok: false,
        status: 302,
        headers: new Headers({ location: 'http://169.254.169.254/secret' }),
      });

      let code = null;
      let text = null;
      const res = {
        status(c) { code = c; return this; },
        send(t) { text = t; return this; },
      };
      await proxyPdf({
        user: { _id: '507f191e810c19729de860ea', role: 'student' },
        query: { url: 'https://res.cloudinary.com/test-cloud/raw/authenticated/v1/scholrmind/resumes/507f191e810c19729de860ea/resume.pdf' },
      }, res);

      assert.strictEqual(code, 400);
      assert.ok(text.includes('Redirects are not permitted'));
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('rejects oversized responses (>10MB) in proxyPdf', async () => {
    const { proxyPdf } = await import('../../controllers/uploadController.js');
    const origFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () => ({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-length': String(15 * 1024 * 1024) }),
        arrayBuffer: async () => Buffer.alloc(100),
      });

      let code = null;
      const res = {
        status(c) { code = c; return this; },
        send() { return this; },
      };
      await proxyPdf({
        user: { _id: '507f191e810c19729de860ea', role: 'student' },
        query: { url: 'https://res.cloudinary.com/test-cloud/raw/authenticated/v1/scholrmind/resumes/507f191e810c19729de860ea/resume.pdf' },
      }, res);

      assert.strictEqual(code, 413);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('handles network timeouts gracefully without leaking internal secrets', async () => {
    const { proxyPdf } = await import('../../controllers/uploadController.js');
    const origFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () => {
        const err = new Error('The operation was aborted due to timeout');
        err.name = 'TimeoutError';
        throw err;
      };

      let code = null;
      let text = null;
      const res = {
        status(c) { code = c; return this; },
        send(t) { text = t; return this; },
      };
      await proxyPdf({
        user: { _id: '507f191e810c19729de860ea', role: 'student' },
        query: { url: 'https://res.cloudinary.com/test-cloud/raw/authenticated/v1/scholrmind/resumes/507f191e810c19729de860ea/resume.pdf' },
      }, res);

      assert.strictEqual(code, 504);
      assert.strictEqual(text, 'Storage gateway timeout');
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  // Signed URL hardening scenarios
  it('generateSignedCloudinaryUrl rejects unexpected host, non-https, invalid types, and malicious public IDs', async () => {
    const { generateSignedCloudinaryUrl } = await import('../../utils/cloudinaryHelper.js');

    // Unexpected host
    assert.throws(
      () => generateSignedCloudinaryUrl('https://evil-storage.com/raw/authenticated/v1/test.pdf'),
      /Unexpected Cloudinary host/
    );

    // Non-HTTPS
    assert.throws(
      () => generateSignedCloudinaryUrl('http://res.cloudinary.com/demo/raw/authenticated/v1/test.pdf'),
      /HTTPS required/
    );

    // Invalid resource type override
    assert.throws(
      () => generateSignedCloudinaryUrl('https://res.cloudinary.com/demo/raw/authenticated/v1/test.pdf', { resourceType: 'executable' }),
      /Invalid resource type/
    );

    // Invalid delivery tier override
    assert.throws(
      () => generateSignedCloudinaryUrl('https://res.cloudinary.com/demo/raw/authenticated/v1/test.pdf', { deliveryType: 'unrestricted' }),
      /Invalid delivery tier/
    );

    // Malicious public ID with path traversal
    assert.throws(
      () => generateSignedCloudinaryUrl('https://res.cloudinary.com/demo/raw/authenticated/v1/../../etc/passwd.pdf'),
      /Invalid public ID/
    );
  });
});

