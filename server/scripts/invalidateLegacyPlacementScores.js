/**
 * invalidateLegacyPlacementScores.js
 *
 * ScholrBoard V13 Part 22.1 & Part 15.4: Legacy Placement Score Invalidation Migration.
 * Identifies legacy placementReadiness scores that do not have verifiable v2 metadata,
 * preserves the original arbitrary value in `placementReadinessLegacy`, and sets `placementReadinessScore = null`.
 *
 * Invariants:
 * - Idempotent: Subsequent runs encounter 0 unmigrated profiles.
 * - Resumable: Cursor-based pagination (`_id: { $gt: lastId }`).
 * - Auditable: Sets markedLegacyAt timestamp and reason 'pre-v2-no-formula'.
 * - Preserves Developer Score, platform sync data, and unrelated Profile fields.
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import mongoose from 'mongoose';
import Profile from '../models/Profile.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

/**
 * Runs cursor-batched legacy placement score invalidation.
 *
 * @param {Object} options
 * @param {number} [options.batchSize=100]
 * @param {string|mongoose.Types.ObjectId} [options.resumeFromId=null]
 * @param {Date} [options.now=new Date()]
 * @returns {Promise<{ totalScanned: number, totalInvalidated: number, idempotent: boolean }>}
 */
export async function invalidateLegacyPlacementScores({
  batchSize = 100,
  resumeFromId = null,
  now = new Date(),
} = {}) {
  let lastId = resumeFromId;
  let totalScanned = 0;
  let totalInvalidated = 0;

  while (true) {
    const filter = {
      placementReadinessScore: { $ne: null },
      $or: [
        { 'placementReadinessLegacy.markedLegacyAt': null },
        { 'placementReadinessLegacy.markedLegacyAt': { $exists: false } },
      ],
      ...(lastId ? { _id: { $gt: lastId } } : {}),
    };

    const batch = await Profile.find(filter)
      .sort({ _id: 1 })
      .limit(batchSize)
      .select('_id placementReadinessScore placementReadinessLegacy');

    if (!batch || batch.length === 0) {
      break;
    }

    totalScanned += batch.length;

    const bulkOps = batch.map(p => ({
      updateOne: {
        filter: {
          _id: p._id,
          $or: [
            { 'placementReadinessLegacy.markedLegacyAt': null },
            { 'placementReadinessLegacy.markedLegacyAt': { $exists: false } },
          ],
        },
        update: {
          $set: {
            'placementReadinessLegacy.score': p.placementReadinessScore,
            'placementReadinessLegacy.markedLegacyAt': now,
            'placementReadinessLegacy.reason': 'pre-v2-no-formula',
            placementReadinessScore: null,
            'placementReadinessMeta.score': null,
            'placementReadinessMeta.placementMethodologyVersion': null,
          },
        },
      },
    }));

    const result = await Profile.bulkWrite(bulkOps, { ordered: false });
    totalInvalidated += (result.modifiedCount ?? batch.length);

    lastId = batch[batch.length - 1]._id;
  }

  return {
    totalScanned,
    totalInvalidated,
    idempotent: true,
  };
}

// CLI direct execution
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('[FATAL] MONGODB_URI is required to run invalidateLegacyPlacementScores');
    process.exit(1);
  }

  console.log('[Migration] Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('[Migration] Connected. Running legacy placement score invalidation...');

  const result = await invalidateLegacyPlacementScores();
  console.log(`[Migration] Completed: Scanned ${result.totalScanned}, Invalidated ${result.totalInvalidated}`);

  await mongoose.disconnect();
  console.log('[Migration] Disconnected cleanly.');
}

export default {
  invalidateLegacyPlacementScores,
};
