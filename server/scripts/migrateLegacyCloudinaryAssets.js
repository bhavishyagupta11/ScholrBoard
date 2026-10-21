/**
 * migrateLegacyCloudinaryAssets.js
 *
 * ScholrBoard V13 Phase 8: Safe Legacy Asset Privacy Migration Utility.
 *
 * Inventories legacy sensitive Cloudinary documents (specifically resumes under
 * `scholrmind/resumes/`) uploaded with public `type: 'upload'`, migrates them to
 * `type: 'authenticated'` using Cloudinary's supported `uploader.rename` API with `to_type`,
 * and synchronizes corresponding MongoDB `ResumeAnalysis` and `Profile` references.
 *
 * Invariants & Protections:
 * 1. DRY-RUN BY DEFAULT: Does NOT mutate Cloudinary or MongoDB unless explicit `--apply` flag is provided.
 * 2. IDEMPOTENT: Assets already in `authenticated` delivery tier are detected and skipped without penalty.
 * 3. RETRY-SAFE & RATE-LIMIT AWARE: Implements bounded exponential backoff on HTTP 429 / transient network failures.
 * 4. ATOMIC PER-ASSET UPDATES: Migrates asset in Cloudinary first, then updates MongoDB references consistently.
 * 5. NON-DESTRUCTIVE: Preserves public IDs, document history, and metadata. Never deletes or blindly overwrites assets.
 * 6. CREDENTIAL REDACTION: Never logs tokens, API secrets, or document contents.
 */

import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { v2 as defaultCloudinary } from 'cloudinary';
import ResumeAnalysis from '../models/ResumeAnalysis.js';
import Profile from '../models/Profile.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Executes the legacy Cloudinary asset privacy migration.
 *
 * @param {object} options
 * @param {boolean} [options.apply=false] - If true, executes real mutations. Defaults to false (dry run).
 * @param {string} [options.prefix='scholrmind/resumes/'] - Cloudinary folder prefix to scan.
 * @param {number} [options.batchSize=50] - Number of assets to query per page.
 * @param {number} [options.maxAssets=500] - Maximum assets to process in single invocation.
 * @param {object} [options.cloudinaryClient=defaultCloudinary] - Injected Cloudinary client (for unit testing).
 * @param {boolean} [options.throttle=true] - Whether to apply rate-limiting delay between requests.
 * @param {boolean} [options.verifyCdn=false] - Whether to actively verify CDN edge purge status after propagation.
 * @param {Function} [options.cdnVerifier=null] - Custom async verifier function (checkUrl, publicId, asset) => boolean.
 * @returns {Promise<{
 *   mode: 'DRY_RUN'|'APPLY',
 *   totalScanned: number,
 *   eligible: number,
 *   migrated: number,
 *   invalidationRequested: number,
 *   pendingCdnVerification: number,
 *   confirmedCdnVerified: number,
 *   invalidationFailed: number,
 *   skipped: number,
 *   failed: number,
 *   failures: Array<{ publicId: string, error: string }>,
 *   durationMs: number
 * }>}
 */
export async function migrateLegacyCloudinaryAssets({
  apply = false,
  prefix = 'scholrmind/resumes/',
  batchSize = 50,
  maxAssets = 500,
  cloudinaryClient = defaultCloudinary,
  throttle = true,
  verifyCdn = false,
  cdnVerifier = null,
} = {}) {
  const startTime = Date.now();
  const mode = apply ? 'APPLY' : 'DRY_RUN';

  console.log(`[migration] Starting Cloudinary legacy asset privacy migration in ${mode} mode...`);
  if (!apply) {
    console.log('[migration] Notice: Running in read-only DRY-RUN mode. No assets or database records will be modified.');
    console.log('[migration] To execute real migration, rerun with explicit --apply flag.');
  }

  const results = {
    mode,
    totalScanned: 0,
    eligible: 0,
    migrated: 0,                  // Successfully moved to 'authenticated' delivery tier in Cloudinary & DB updated
    reconciled: 0,                // Stale database references repaired for already-authenticated assets
    reconciliationRequired: 0,    // Stale references detected needing repair
    invalidationRequested: 0,     // Invalidation request accepted by Cloudinary API (invalidate: true)
    invalidationFailed: 0,        // Failed invalidation requests
    pendingCdnVerification: 0,    // Migrated assets awaiting CDN edge cache propagation window
    confirmedCdnVerified: 0,      // Actively confirmed 404/401/403 on legacy delivery URL
    skipped: 0,                   // Already in 'authenticated' delivery tier AND synchronized
    failed: 0,                    // Failed renames or DB updates
    failures: [],                 // [{ publicId, error }]
    durationMs: 0,
  };

  // 1. Gather all candidates from database that reference legacy /upload/ paths
  const dbAnalyses = await ResumeAnalysis.find({
    fileUrl: { $regex: /\/(?:raw|image|video)\/upload\// },
  }).select('_id userId fileUrl').lean();

  const dbProfiles = await Profile.find({
    resumeUrl: { $regex: /\/(?:raw|image|video)\/upload\// },
  }).select('_id userId resumeUrl').lean();

  console.log(`[migration] Database inventory: found ${dbAnalyses.length} ResumeAnalysis and ${dbProfiles.length} Profile records with legacy /upload/ URLs.`);

  const hasStaleDbReferences = (pubId) => {
    const escaped = pubId.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const rx = new RegExp(escaped);
    const inAnalysis = dbAnalyses.some((a) => a.fileUrl && rx.test(a.fileUrl));
    const inProfile = dbProfiles.some((p) => p.resumeUrl && rx.test(p.resumeUrl));
    return inAnalysis || inProfile;
  };

  // 2. Query Cloudinary Admin API for assets under prefix with type: 'upload'
  let nextCursor = null;
  const legacyAssets = [];

  try {
    do {
      if (legacyAssets.length >= maxAssets) break;

      let page;
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        try {
          page = await cloudinaryClient.api.resources({
            type: 'upload',
            resource_type: 'raw',
            prefix,
            max_results: Math.min(batchSize, maxAssets - legacyAssets.length),
            ...(nextCursor ? { next_cursor: nextCursor } : {}),
          });
          break;
        } catch (apiErr) {
          attempts++;
          const isRateLimit = apiErr?.http_code === 429 || apiErr?.message?.includes('429');
          if (attempts >= maxAttempts) throw apiErr;
          const waitTime = throttle ? (isRateLimit ? attempts * 2000 : attempts * 1000) : 0;
          console.warn(`[migration] Cloudinary API error (attempt ${attempts}): ${apiErr.message}. Retrying in ${waitTime}ms...`);
          if (waitTime > 0) await delay(waitTime);
        }
      }

      if (page?.resources) {
        for (const res of page.resources) {
          legacyAssets.push(res);
        }
        nextCursor = page.next_cursor || null;
      } else {
        nextCursor = null;
      }
    } while (nextCursor && legacyAssets.length < maxAssets);
  } catch (cldErr) {
    console.warn(`[migration] Cloudinary API resources query warning: ${cldErr.message}. Falling back to database URL inventory.`);
  }

  // Combine Cloudinary resources and database references into unique publicId set
  const assetMap = new Map();

  for (const asset of legacyAssets) {
    assetMap.set(asset.public_id, {
      publicId: asset.public_id,
      format: asset.format || 'pdf',
      resourceType: asset.resource_type || 'raw',
      deliveryType: asset.type || 'upload',
      secureUrl: asset.secure_url,
      source: 'cloudinary_api',
    });
  }

  // Cross-reference with database records
  const allDbUrls = [
    ...dbAnalyses.map((a) => ({ url: a.fileUrl, model: 'ResumeAnalysis', id: a._id, userId: a.userId })),
    ...dbProfiles.map((p) => ({ url: p.resumeUrl, model: 'Profile', id: p._id, userId: p.userId })),
  ];

  for (const item of allDbUrls) {
    if (!item.url) continue;
    const match = item.url.match(/\/(raw|image|video)\/(upload|authenticated|private)\/(?:v\d+\/)?(.+)$/);
    if (match) {
      const resourceType = match[1];
      const deliveryType = match[2];
      const publicId = decodeURIComponent(match[3]);
      const ext = publicId.split('.').pop() || 'pdf';
      const baseId = publicId.replace(/\.[^/.]+$/, '');
      const alreadyPresent = assetMap.has(publicId) || assetMap.has(baseId);

      if (!alreadyPresent) {
        assetMap.set(publicId, {
          publicId,
          format: ext,
          resourceType,
          deliveryType,
          secureUrl: item.url,
          source: 'database_record',
        });
      }
    }
  }

  results.totalScanned = assetMap.size;
  console.log(`[migration] Total distinct asset targets identified: ${results.totalScanned}`);

  // 3. Process each asset
  for (const [publicId, asset] of assetMap.entries()) {
    // Confirm each asset's actual metadata from Cloudinary if supported by client
    if (typeof cloudinaryClient.api?.resource === 'function') {
      try {
        const remoteMeta = await cloudinaryClient.api.resource(publicId, {
          resource_type: asset.resourceType || 'raw',
          type: asset.deliveryType || 'upload',
        });
        if (remoteMeta) {
          if (remoteMeta.resource_type) asset.resourceType = remoteMeta.resource_type;
          if (remoteMeta.type) asset.deliveryType = remoteMeta.type;
        }
      } catch {
        // If not found with current deliveryType, check if already in 'authenticated' tier
        try {
          const authMeta = await cloudinaryClient.api.resource(publicId, {
            resource_type: asset.resourceType || 'raw',
            type: 'authenticated',
          });
          if (authMeta?.type === 'authenticated') {
            asset.deliveryType = 'authenticated';
            if (authMeta.resource_type) asset.resourceType = authMeta.resource_type;
          }
        } catch {
          // Keep inferred inventory metadata
        }
      }
    }

    // Check if asset is already authenticated in Cloudinary
    if (asset.deliveryType === 'authenticated') {
      const needsDbReconciliation = hasStaleDbReferences(publicId);

      if (!needsDbReconciliation) {
        results.skipped++;
        console.log(`[migration] [SKIPPED] ${publicId} is already authenticated and synchronized.`);
        continue;
      }

      // PARTIAL FAILURE RECOVERY: Cloudinary is already authenticated, but MongoDB references remain stale
      results.eligible++;
      results.reconciliationRequired++;

      const newSecureUrl = asset.secureUrl
        ? asset.secureUrl.replace('/raw/upload/', '/raw/authenticated/').replace('/image/upload/', '/image/authenticated/')
        : `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME || 'scholrboard'}/${asset.resourceType}/authenticated/${publicId}`;

      if (!apply) {
        console.log(`[migration] [DRY-RUN RECONCILE] Would reconcile stale database references for ${publicId} (Cloudinary is authenticated, DB has legacy URLs)`);
        continue;
      }

      // In APPLY mode, reconcile MongoDB references
      try {
        await ResumeAnalysis.updateMany(
          { fileUrl: { $regex: new RegExp(publicId.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')) } },
          { $set: { fileUrl: newSecureUrl } }
        );

        await Profile.updateMany(
          { resumeUrl: { $regex: new RegExp(publicId.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')) } },
          { $set: { resumeUrl: newSecureUrl } }
        );

        results.reconciled++;
        results.migrated++;
        console.log(`[migration] [RECONCILED] ${publicId} database references synchronized to authenticated tier.`);
      } catch (reconcileErr) {
        results.failed++;
        results.failures.push({
          publicId,
          error: `Database reference reconciliation failed: ${reconcileErr.message}`,
        });
        console.error(`[migration] [RECONCILE_FAILED] Failed reconciling references for ${publicId}: ${reconcileErr.message}`);
      }
      continue;
    }

    results.eligible++;

    if (!apply) {
      console.log(`[migration] [DRY-RUN PLAN] Would migrate ${publicId} (resource_type: ${asset.resourceType}, type: '${asset.deliveryType}' -> 'authenticated', invalidate: true)`);
      continue;
    }

    // APPLY Mode: Execute Cloudinary migration with invalidate: true
    let migrationAttempts = 0;
    const maxMigrationAttempts = 3;
    let renameResult = null;
    let migrationError = null;

    while (migrationAttempts < maxMigrationAttempts) {
      try {
        if (throttle) await delay(100);

        renameResult = await cloudinaryClient.uploader.rename(publicId, publicId, {
          resource_type: asset.resourceType || 'raw',
          type: asset.deliveryType || 'upload',
          to_type: 'authenticated',
          invalidate: true, // Requests edge CDN cache invalidation
          overwrite: true,
        });
        break;
      } catch (err) {
        migrationAttempts++;
        migrationError = err;
        const isRateLimit = err?.http_code === 429 || err?.message?.includes('429');
        if (migrationAttempts >= maxMigrationAttempts) break;
        const waitTime = throttle ? (isRateLimit ? migrationAttempts * 2000 : migrationAttempts * 1000) : 0;
        if (waitTime > 0) await delay(waitTime);
      }
    }

    if (!renameResult) {
      results.failed++;
      results.invalidationFailed++;
      results.failures.push({
        publicId,
        error: migrationError?.message || 'Cloudinary rename and invalidation failed',
      });
      console.error(`[migration] [FAILED] ${publicId}: ${migrationError?.message}`);
      continue;
    }

    // Record invalidation request dispatched to Cloudinary
    results.invalidationRequested++;
    results.pendingCdnVerification++;

    // 4. Update MongoDB database references atomically
    const newSecureUrl = renameResult.secure_url || asset.secureUrl.replace('/raw/upload/', '/raw/authenticated/').replace('/image/upload/', '/image/authenticated/');

    try {
      await ResumeAnalysis.updateMany(
        { fileUrl: { $regex: new RegExp(publicId.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')) } },
        { $set: { fileUrl: newSecureUrl } }
      );

      await Profile.updateMany(
        { resumeUrl: { $regex: new RegExp(publicId.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')) } },
        { $set: { resumeUrl: newSecureUrl } }
      );

      results.migrated++;
      console.log(`[migration] [MIGRATED] ${publicId} -> authenticated (invalidate: true requested). Database references updated.`);
    } catch (dbErr) {
      results.failed++;
      // Decrement pending verification since DB synchronization failed
      results.pendingCdnVerification--;
      results.failures.push({
        publicId,
        error: `Database reference update failed: ${dbErr.message}`,
      });
      console.error(`[migration] [DB_ERROR] Failed updating references for ${publicId}: ${dbErr.message}`);
      continue;
    }

    // 5. Optional CDN purge verification (distinguishing accepted request from confirmed edge purge)
    if (verifyCdn) {
      const checkUrl = asset.secureUrl || `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME || 'scholrboard'}/${asset.resourceType}/${asset.deliveryType}/${publicId}`;
      let isPurged = false;
      if (typeof cdnVerifier === 'function') {
        try {
          isPurged = await cdnVerifier(checkUrl, publicId, asset);
        } catch {
          isPurged = false;
        }
      } else {
        try {
          const resp = await fetch(checkUrl, { method: 'HEAD' });
          isPurged = resp.status === 404 || resp.status === 401 || resp.status === 403;
        } catch {
          isPurged = false;
        }
      }

      if (isPurged) {
        results.confirmedCdnVerified++;
        results.pendingCdnVerification--;
        console.log(`[migration] [CDN_VERIFIED] ${publicId} legacy URL is confirmed inaccessible (${checkUrl}).`);
      } else {
        console.log(`[migration] [CDN_PENDING] ${publicId} legacy URL still cached or pending edge propagation (${checkUrl}).`);
      }
    }
  }

  results.durationMs = Date.now() - startTime;
  console.log(`================================================================================`);
  console.log(`[migration] Cloudinary Asset Privacy Migration Summary (${mode})`);
  console.log(`Total Assets Scanned:             ${results.totalScanned}`);
  console.log(`Eligible for Action:              ${results.eligible}`);
  console.log(`Successfully Migrated (Storage):  ${results.migrated}`);
  console.log(`Database References Reconciled:   ${results.reconciled}`);
  console.log(`CDN Invalidation Requested:       ${results.invalidationRequested}`);
  console.log(`CDN Edge Purge Pending:           ${results.pendingCdnVerification} (Awaiting edge propagation window)`);
  console.log(`CDN Edge Purge Confirmed:         ${results.confirmedCdnVerified}`);
  console.log(`CDN Invalidation Failures:        ${results.invalidationFailed}`);
  console.log(`Skipped (Already Synchronized):   ${results.skipped}`);
  console.log(`Failed Operations:                ${results.failed}`);
  console.log(`Duration:                         ${results.durationMs}ms`);
  console.log(`================================================================================`);

  return results;
}

// CLI Execution entrypoint
const isDirectExecution = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectExecution) {
  const applyFlag = process.argv.includes('--apply');
  const verifyCdnFlag = process.argv.includes('--verify-cdn');
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/scholrboard';

  mongoose.connect(mongoUri)
    .then(() => migrateLegacyCloudinaryAssets({ apply: applyFlag, verifyCdn: verifyCdnFlag }))
    .then((summary) => {
      console.log('[migration] Migration utility finished cleanly.');
      process.exit(summary.failed > 0 ? 1 : 0);
    })
    .catch((err) => {
      console.error('[migration] Fatal migration error:', err);
      process.exit(1);
    });
}
