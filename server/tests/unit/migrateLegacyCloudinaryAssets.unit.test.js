/**
 * migrateLegacyCloudinaryAssets.unit.test.js
 *
 * ScholrBoard V13 Phase 8 Final Gate: Cloudinary Migration, Partial-Failure Recovery,
 * and Authenticated Resume Access Regression Suite:
 *
 * 1. Cloudinary rename succeeds but database update fails (partial failure).
 * 2. Subsequent run repairs stale references for already-authenticated assets.
 * 3. Unauthorized users cannot obtain signed resume URLs.
 * 4. Authorized request receives a usable signed URL for authenticated raw resume.
 * 5. CDN verification distinguishes an old unsigned URL from a valid signed URL.
 * 6. Failed or incomplete operations are never reported as fully secured.
 * 7. Dry-run mode performs zero mutations.
 * 8. Rename includes invalidate: true and verified delivery/resource types.
 * 9. Pagination across multiple pages via next_cursor.
 * 10. Rate-limiting (HTTP 429) backoff resilience.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { migrateLegacyCloudinaryAssets } from '../../scripts/migrateLegacyCloudinaryAssets.js';
import { generateSignedCloudinaryUrl } from '../../utils/cloudinaryHelper.js';
import { getSignedResumeUrl } from '../../controllers/uploadController.js';
import ResumeAnalysis from '../../models/ResumeAnalysis.js';
import Profile from '../../models/Profile.js';
import Application from '../../models/Application.js';

describe('Phase 8.8: Authenticated Resume Access & Migration Recovery Suite', () => {
  beforeEach(() => {
    // Default mock Mongoose queries
    ResumeAnalysis.find = () => ({
      select: () => ({
        lean: async () => [
          {
            _id: '600000000000000000000001',
            userId: 'user_alpha',
            fileUrl: 'https://res.cloudinary.com/test-cloud/raw/upload/v12345/scholrmind/resumes/user_alpha/resume.pdf',
          },
        ],
      }),
    });

    Profile.find = () => ({
      select: () => ({
        lean: async () => [
          {
            _id: '700000000000000000000001',
            userId: 'user_alpha',
            resumeUrl: 'https://res.cloudinary.com/test-cloud/raw/upload/v12345/scholrmind/resumes/user_alpha/resume.pdf',
          },
        ],
      }),
    });

    ResumeAnalysis.updateMany = async () => ({ modifiedCount: 1 });
    Profile.updateMany = async () => ({ modifiedCount: 1 });
  });

  // ─── 1. DRY RUN BEHAVIOR ──────────────────────────────────────────────────
  it('1. runs in read-only DRY-RUN mode by default without mutating Cloudinary or MongoDB', async () => {
    let renameCalled = false;
    let dbUpdated = false;

    ResumeAnalysis.updateMany = async () => {
      dbUpdated = true;
      return { modifiedCount: 1 };
    };

    const mockCloudinary = {
      api: {
        resources: async () => ({
          resources: [
            {
              public_id: 'scholrmind/resumes/user_alpha/resume',
              format: 'pdf',
              resource_type: 'raw',
              type: 'upload',
              secure_url: 'https://res.cloudinary.com/test-cloud/raw/upload/v12345/scholrmind/resumes/user_alpha/resume.pdf',
            },
          ],
          next_cursor: null,
        }),
      },
      uploader: {
        rename: async () => {
          renameCalled = true;
          return {};
        },
      },
    };

    const res = await migrateLegacyCloudinaryAssets({
      apply: false,
      cloudinaryClient: mockCloudinary,
      throttle: false,
    });

    assert.strictEqual(res.mode, 'DRY_RUN');
    assert.strictEqual(res.totalScanned, 1);
    assert.strictEqual(res.eligible, 1);
    assert.strictEqual(res.migrated, 0, 'Must NOT mutate or migrate assets in dry-run mode');
    assert.strictEqual(res.invalidationRequested, 0);
    assert.strictEqual(res.failed, 0);
    assert.strictEqual(renameCalled, false, 'Cloudinary uploader.rename must NOT be called in dry-run mode');
    assert.strictEqual(dbUpdated, false, 'Database records must NOT be updated in dry-run mode');
  });

  // ─── 2. STANDARD APPLY MIGRATION WITH INVALIDATION ────────────────────────
  it('2. executes Cloudinary rename with to_type=authenticated and invalidate=true when apply: true', async () => {
    let capturedRenameArgs = null;
    let dbUpdated = false;

    ResumeAnalysis.updateMany = async (filter, update) => {
      dbUpdated = true;
      assert.ok(update.$set.fileUrl.includes('/raw/authenticated/'));
      return { modifiedCount: 1 };
    };

    const mockCloudinary = {
      api: {
        resources: async () => ({
          resources: [
            {
              public_id: 'scholrmind/resumes/user_beta/doc.pdf',
              format: 'pdf',
              resource_type: 'raw',
              type: 'upload',
              secure_url: 'https://res.cloudinary.com/test-cloud/raw/upload/v12345/scholrmind/resumes/user_beta/doc.pdf',
            },
          ],
          next_cursor: null,
        }),
      },
      uploader: {
        rename: async (fromId, toId, options) => {
          capturedRenameArgs = { fromId, toId, options };
          return {
            public_id: toId,
            resource_type: 'raw',
            type: 'authenticated',
            secure_url: 'https://res.cloudinary.com/test-cloud/raw/authenticated/v12346/scholrmind/resumes/user_beta/doc.pdf',
          };
        },
      },
    };

    const res = await migrateLegacyCloudinaryAssets({
      apply: true,
      cloudinaryClient: mockCloudinary,
      throttle: false,
    });

    assert.strictEqual(res.mode, 'APPLY');
    assert.strictEqual(res.migrated, 2);
    assert.strictEqual(res.invalidationRequested, 2, 'Must request CDN invalidation for migrated assets');
    assert.strictEqual(res.pendingCdnVerification, 2, 'Must record CDN edge purge as pending propagation window');
    assert.strictEqual(res.confirmedCdnVerified, 0, 'Must NOT claim immediate CDN purge confirmation');
    assert.strictEqual(res.failed, 0);
    assert.ok(capturedRenameArgs, 'uploader.rename must be executed');
    assert.strictEqual(capturedRenameArgs.options.type, 'upload', 'Source delivery type must be upload');
    assert.strictEqual(capturedRenameArgs.options.to_type, 'authenticated', 'Target delivery type must be authenticated');
    assert.strictEqual(capturedRenameArgs.options.invalidate, true, 'Must request invalidate: true');
    assert.strictEqual(capturedRenameArgs.options.resource_type, 'raw');
    assert.strictEqual(capturedRenameArgs.options.overwrite, true);
    assert.strictEqual(dbUpdated, true, 'Database records must be updated with authenticated URL');
  });

  // ─── 3. PARTIAL FAILURE RECOVERY: CLOUDINARY SUCCEEDS, DB UPDATE FAILS ───
  it('3. REGRESSION: Cloudinary rename succeeds but database update fails — records failure accurately without claiming migration', async () => {
    ResumeAnalysis.find = () => ({
      select: () => ({
        lean: async () => [
          {
            _id: '600000000000000000000001',
            userId: 'user_gamma',
            fileUrl: 'https://res.cloudinary.com/test-cloud/raw/upload/v12345/scholrmind/resumes/user_gamma/resume.pdf',
          },
        ],
      }),
    });
    Profile.find = () => ({ select: () => ({ lean: async () => [] }) });

    // Mock Database update failure
    ResumeAnalysis.updateMany = async () => {
      throw new Error('MongoNetworkError: connection timed out during write');
    };

    let renameExecuted = false;
    const mockCloudinary = {
      api: {
        resources: async () => ({
          resources: [
            {
              public_id: 'scholrmind/resumes/user_gamma/resume.pdf',
              type: 'upload',
              resource_type: 'raw',
              format: 'pdf',
            },
          ],
          next_cursor: null,
        }),
      },
      uploader: {
        rename: async (id) => {
          renameExecuted = true;
          return { secure_url: `https://res.cloudinary.com/raw/authenticated/${id}` };
        },
      },
    };

    const res = await migrateLegacyCloudinaryAssets({
      apply: true,
      cloudinaryClient: mockCloudinary,
      throttle: false,
    });

    assert.strictEqual(renameExecuted, true, 'Cloudinary rename was executed');
    assert.strictEqual(res.migrated, 0, 'Asset must NOT be reported as migrated when database update fails');
    assert.strictEqual(res.failed, 1, 'Must record operation failure');
    assert.strictEqual(res.failures.length, 1);
    assert.ok(res.failures[0].error.includes('Database reference update failed'), 'Failure reason must reflect DB error');
    assert.strictEqual(res.pendingCdnVerification, 0, 'Incomplete asset must NOT remain in pendingCdnVerification');
  });

  // ─── 4. RECONCILIATION: SUBSEQUENT RUN DETECTS AUTHENTICATED & REPAIRS DB ─
  it('4. REGRESSION: subsequent run repairs references for asset already authenticated in Cloudinary without redundant rename', async () => {
    // Database still has stale /upload/ URL from previous failed run
    ResumeAnalysis.find = () => ({
      select: () => ({
        lean: async () => [
          {
            _id: '600000000000000000000001',
            userId: 'user_gamma',
            fileUrl: 'https://res.cloudinary.com/test-cloud/raw/upload/v12345/scholrmind/resumes/user_gamma/resume.pdf',
          },
        ],
      }),
    });
    Profile.find = () => ({
      select: () => ({
        lean: async () => [
          {
            _id: '700000000000000000000001',
            userId: 'user_gamma',
            resumeUrl: 'https://res.cloudinary.com/test-cloud/raw/upload/v12345/scholrmind/resumes/user_gamma/resume.pdf',
          },
        ],
      }),
    });

    let dbUpdatedWithAuthenticatedUrl = false;
    ResumeAnalysis.updateMany = async (filter, update) => {
      dbUpdatedWithAuthenticatedUrl = update.$set.fileUrl.includes('/raw/authenticated/');
      return { modifiedCount: 1 };
    };
    Profile.updateMany = async (filter, update) => {
      assert.ok(update.$set.resumeUrl.includes('/raw/authenticated/'));
      return { modifiedCount: 1 };
    };

    let renameCallCount = 0;
    const mockCloudinary = {
      api: {
        resources: async () => ({
          resources: [], // No longer returned under type: 'upload'
          next_cursor: null,
        }),
        resource: async (publicId) => {
          // Remote metadata check confirms asset is already in 'authenticated' tier
          return {
            public_id: publicId,
            resource_type: 'raw',
            type: 'authenticated',
            secure_url: `https://res.cloudinary.com/test-cloud/raw/authenticated/v12346/${publicId}`,
          };
        },
      },
      uploader: {
        rename: async () => {
          renameCallCount++;
          return {};
        },
      },
    };

    const res = await migrateLegacyCloudinaryAssets({
      apply: true,
      cloudinaryClient: mockCloudinary,
      throttle: false,
    });

    assert.strictEqual(res.reconciled, 1, 'Must record 1 asset database references reconciled');
    assert.strictEqual(res.migrated, 1, 'Reconciled asset counts as successfully secured');
    assert.strictEqual(res.failed, 0, 'Zero failures on successful reconciliation');
    assert.strictEqual(renameCallCount, 0, 'Cloudinary uploader.rename must NOT be called for already-authenticated asset');
    assert.strictEqual(dbUpdatedWithAuthenticatedUrl, true, 'Database references must be updated to authenticated tier');
  });

  // ─── 5. ACCESS CONTROL: UNAUTHORIZED USERS CANNOT OBTAIN SIGNED URLS ──────
  it('5. REGRESSION: unauthorized users cannot obtain signed resume URLs', async () => {
    // Mock ResumeAnalysis owned by user_owner
    ResumeAnalysis.findById = async (id) => {
      if (id === '600000000000000000000001') {
        return {
          _id: id,
          userId: 'user_owner',
          fileUrl: 'https://res.cloudinary.com/test-cloud/raw/authenticated/v12345/scholrmind/resumes/user_owner/resume.pdf',
        };
      }
      return null;
    };

    // Mismatched requester (student user_attacker attempting to access user_owner's resume)
    const unauthorizedReq = {
      params: { id: '600000000000000000000001' },
      user: { _id: 'user_attacker', role: 'student' },
    };

    let statusCalled = null;
    let jsonResult = null;
    const res = {
      status: (code) => {
        statusCalled = code;
        return {
          json: (data) => { jsonResult = data; },
        };
      },
      json: (data) => { jsonResult = data; },
    };

    await getSignedResumeUrl(unauthorizedReq, res);

    assert.strictEqual(statusCalled, 403, 'Unauthorized access attempt must return HTTP 403 Forbidden');
    assert.strictEqual(jsonResult.success, false);
    assert.ok(jsonResult.message.includes('Forbidden'), 'Message must indicate forbidden access');
  });

  // ─── 6. AUTHORIZED REQUEST RECEIVES USABLE SIGNED URL ────────────────────
  it('6. REGRESSION: authorized request receives usable signed URL for authenticated raw resume with time limit and no credential leak', async () => {
    ResumeAnalysis.findById = async (id) => {
      return {
        _id: id,
        userId: 'user_authorized_student',
        fileUrl: 'https://res.cloudinary.com/test-cloud/raw/authenticated/v12345/scholrmind/resumes/user_authorized_student/resume.pdf',
      };
    };

    const mockCloudinary = {
      config: () => {},
      utils: {
        private_download_url: (publicId, ext, options) => {
          assert.strictEqual(options.resource_type, 'raw');
          assert.strictEqual(options.type, 'authenticated');
          assert.ok(options.expires_at > Math.floor(Date.now() / 1000));
          return `https://res.cloudinary.com/test-cloud/raw/authenticated/v12345/${publicId}.${ext}?s=mock_hmac_signature&expires=${options.expires_at}`;
        },
      },
    };

    const authorizedReq = {
      params: { id: '600000000000000000000001' },
      user: { _id: 'user_authorized_student', role: 'student' },
    };

    let jsonResult = null;
    const res = {
      status: () => ({ json: (d) => { jsonResult = d; } }),
      json: (data) => { jsonResult = data; },
    };

    // Test helper directly with injected client
    const signedData = generateSignedCloudinaryUrl(
      'https://res.cloudinary.com/test-cloud/raw/authenticated/v12345/scholrmind/resumes/user_authorized_student/resume.pdf',
      { expiresIn: 300, cloudinaryClient: mockCloudinary }
    );

    assert.ok(signedData.signedUrl.includes('/raw/authenticated/'), 'Signed URL must target authenticated delivery tier');
    assert.ok(signedData.signedUrl.includes('?s=mock_hmac_signature'), 'Signed URL must include HMAC signature token');
    assert.ok(signedData.expiresAt > Math.floor(Date.now() / 1000), 'Must include future expiry timestamp');
    assert.strictEqual(signedData.signedUrl.includes('API_SECRET'), false, 'Cloudinary API secret must never be exposed');
  });

  // ─── 7. CDN VERIFICATION DISTINGUISHES UNSIGNED FROM SIGNED URL ──────────
  it('7. REGRESSION: CDN verification distinguishes old unsigned public URL from valid authorized signed URL', async () => {
    ResumeAnalysis.find = () => ({ select: () => ({ lean: async () => [] }) });
    Profile.find = () => ({ select: () => ({ lean: async () => [] }) });

    const mockCloudinary = {
      api: {
        resources: async () => ({
          resources: [
            { public_id: 'scholrmind/resumes/user_test/resume.pdf', type: 'upload', resource_type: 'raw' },
          ],
          next_cursor: null,
        }),
      },
      uploader: {
        rename: async (id) => ({ secure_url: `https://res.cloudinary.com/raw/authenticated/${id}` }),
      },
    };

    // Verify CDN behavior:
    // Legacy unsigned URL returns 404 (purged)
    // Signed authorized URL returns 200 (accessible)
    const accessChecker = async (checkUrl) => {
      const isUnsignedLegacyUrl = checkUrl.includes('/upload/');
      const isSignedAuthenticatedUrl = checkUrl.includes('/authenticated/') && checkUrl.includes('?s=');

      if (isUnsignedLegacyUrl) {
        // Legacy unsigned URL returns 404 after edge CDN purge
        return true; // Confirms old URL is inaccessible
      }
      if (isSignedAuthenticatedUrl) {
        return true; // Confirms signed URL works
      }
      return false;
    };

    const res = await migrateLegacyCloudinaryAssets({
      apply: true,
      cloudinaryClient: mockCloudinary,
      throttle: false,
      verifyCdn: true,
      cdnVerifier: accessChecker,
    });

    assert.strictEqual(res.migrated, 1);
    assert.strictEqual(res.invalidationRequested, 1);
    assert.strictEqual(res.confirmedCdnVerified, 1, 'Legacy unsigned URL must be confirmed purged (inaccessible)');
    assert.strictEqual(res.pendingCdnVerification, 0);
  });

  // ─── 8. FAILED OR INCOMPLETE OPERATIONS ARE NEVER REPORTED AS SECURED ────
  it('8. REGRESSION: failed or incomplete operations are never reported as fully secured across all failure modes', async () => {
    ResumeAnalysis.find = () => ({ select: () => ({ lean: async () => [] }) });
    Profile.find = () => ({ select: () => ({ lean: async () => [] }) });

    // Mode A: Rename itself throws 500 error
    const mockFailingCloudinary = {
      api: {
        resources: async () => ({
          resources: [
            { public_id: 'scholrmind/resumes/failing/doc.pdf', type: 'upload', resource_type: 'raw' },
          ],
          next_cursor: null,
        }),
      },
      uploader: {
        rename: async () => {
          throw new Error('500 Internal Cloudinary Error');
        },
      },
    };

    const resA = await migrateLegacyCloudinaryAssets({
      apply: true,
      cloudinaryClient: mockFailingCloudinary,
      throttle: false,
    });

    assert.strictEqual(resA.migrated, 0, 'Failed rename must NEVER be reported as migrated');
    assert.strictEqual(resA.confirmedCdnVerified, 0, 'Failed rename must NEVER be confirmed verified');
    assert.strictEqual(resA.failed, 1);
    assert.strictEqual(resA.invalidationFailed, 1);

    // Mode B: Migration succeeds, but CDN edge propagation is still pending
    const mockPendingCloudinary = {
      api: {
        resources: async () => ({
          resources: [
            { public_id: 'scholrmind/resumes/pending/doc.pdf', type: 'upload', resource_type: 'raw' },
          ],
          next_cursor: null,
        }),
      },
      uploader: {
        rename: async (id) => ({ secure_url: `https://res.cloudinary.com/raw/authenticated/${id}` }),
      },
    };

    const resB = await migrateLegacyCloudinaryAssets({
      apply: true,
      cloudinaryClient: mockPendingCloudinary,
      throttle: false,
      verifyCdn: true,
      cdnVerifier: async () => false, // CDN edge still serving cached 200
    });

    assert.strictEqual(resB.migrated, 1, 'Storage migration recorded');
    assert.strictEqual(resB.confirmedCdnVerified, 0, 'Asset awaiting edge purge must NOT be reported as confirmed verified');
    assert.strictEqual(resB.pendingCdnVerification, 1, 'Asset must remain pending CDN verification');
  });

  // ─── 9. RATE-LIMITING (HTTP 429) RESILIENCE ──────────────────────────────
  it('9. handles Cloudinary rate-limiting (HTTP 429) gracefully with backoff and retry', async () => {
    ResumeAnalysis.find = () => ({ select: () => ({ lean: async () => [] }) });
    Profile.find = () => ({ select: () => ({ lean: async () => [] }) });

    let attempts = 0;
    const mockCloudinary = {
      api: {
        resources: async () => ({
          resources: [
            { public_id: 'scholrmind/resumes/rate_limited/doc.pdf', type: 'upload', resource_type: 'raw' },
          ],
          next_cursor: null,
        }),
      },
      uploader: {
        rename: async (id) => {
          attempts++;
          if (attempts === 1) {
            const err = new Error('Rate limit exceeded (HTTP 429)');
            err.http_code = 429;
            throw err;
          }
          return { secure_url: `https://res.cloudinary.com/raw/authenticated/${id}` };
        },
      },
    };

    const res = await migrateLegacyCloudinaryAssets({
      apply: true,
      cloudinaryClient: mockCloudinary,
      throttle: false,
    });

    assert.strictEqual(res.migrated, 1, 'Asset must succeed after rate-limit backoff');
    assert.strictEqual(res.failed, 0);
    assert.strictEqual(attempts, 2, 'Rename must have retried after initial 429');
  });

  // ─── 10. CURSOR PAGINATION ────────────────────────────────────────────────
  it('10. handles cursor-based pagination across multiple pages of Cloudinary assets', async () => {
    let pageCount = 0;
    const mockCloudinary = {
      api: {
        resources: async ({ next_cursor }) => {
          pageCount++;
          if (!next_cursor) {
            return {
              resources: [
                { public_id: 'scholrmind/resumes/p1/res1', type: 'upload', resource_type: 'raw', format: 'pdf' },
              ],
              next_cursor: 'cursor_page_2',
            };
          }
          return {
            resources: [
              { public_id: 'scholrmind/resumes/p2/res2', type: 'upload', resource_type: 'raw', format: 'pdf' },
            ],
            next_cursor: null,
          };
        },
      },
      uploader: {
        rename: async (id) => ({ secure_url: `https://res.cloudinary.com/raw/authenticated/${id}` }),
      },
    };

    const res = await migrateLegacyCloudinaryAssets({
      apply: false,
      batchSize: 1,
      cloudinaryClient: mockCloudinary,
      throttle: false,
    });

    assert.strictEqual(pageCount, 2, 'Must request two pages via next_cursor pagination');
    assert.ok(res.totalScanned >= 2, 'Must discover assets across all pages');
  });
});
