/**
 * Simulates mid-transaction failures to verify rollback behavior.
 * Requires MongoDB replica set (Atlas or local rs0).
 */
import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../server/.env') });

// Use server's mongoose singleton so model imports share the same connection
const { default: mongoose } = await import('../../server/node_modules/mongoose/index.js');

async function countRelated(Activity, AuditLog, Notification, activityId) {
  const [audits, notifs] = await Promise.all([
    AuditLog.countDocuments({ targetId: activityId, targetModel: 'Activity' }),
    Notification.countDocuments({ relatedId: activityId, relatedModel: 'Activity' }),
  ]);
  return { audits, notifs };
}

async function simulateActivityReviewRollback() {
  const { default: Activity } = await import('../../server/models/Activity.js');
  const { default: AuditLog } = await import('../../server/models/AuditLog.js');
  const { default: Notification } = await import('../../server/models/Notification.js');
  const { withTransaction } = await import('../../server/utils/withTransaction.js');

  const activity = await Activity.findOne({ status: 'Pending' });
  if (!activity) {
    console.log('SKIP: No pending activity found for rollback simulation');
    return { skipped: true };
  }

  const beforeStatus = activity.status;
  const beforeCounts = await countRelated(Activity, AuditLog, Notification, activity._id);

  let rolledBack = false;
  try {
    await withTransaction(async (session) => {
      activity.status = 'Approved';
      activity.reviewedAt = new Date();
      await activity.save({ session });

      await AuditLog.create([{
        action: 'approve_activity',
        performedBy: activity.userId,
        role: 'faculty',
        targetModel: 'Activity',
        targetId: activity._id,
        details: { simulated: true },
      }], { session });

      throw new Error('SIMULATED_FAILURE');
    });
  } catch (err) {
    rolledBack = err.message === 'SIMULATED_FAILURE';
  }

  const refreshed = await Activity.findById(activity._id);
  const afterCounts = await countRelated(Activity, AuditLog, Notification, activity._id);

  const passed = refreshed.status === beforeStatus
    && afterCounts.audits === beforeCounts.audits
    && afterCounts.notifs === beforeCounts.notifs;

  return {
    scenario: 'activity_review_rollback',
    rolledBack,
    passed,
    beforeStatus,
    afterStatus: refreshed.status,
    beforeCounts,
    afterCounts,
  };
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI_TEST, { serverSelectionTimeoutMS: 60000, connectTimeoutMS: 60000 });
  const dbName = mongoose.connection.db.databaseName;
  if (dbName !== 'scholrboard_test') {
    await mongoose.disconnect();
    throw new Error('CRITICAL SAFETY ERROR: Execution is only allowed on the test database "scholrboard_test". Currently connected to: "' + dbName + '". Execution aborted!');
  }

  console.log('MongoDB connected for transaction simulation.');

  const results = [];
  try {
    results.push(await simulateActivityReviewRollback());
  } catch (err) {
    if (err.message?.includes('replica set')) {
      console.warn('Transactions require replica set. Simulation skipped.');
      results.push({ skipped: true, reason: 'replica_set_required' });
    } else {
      throw err;
    }
  }

  console.log(JSON.stringify(results, null, 2));
  await mongoose.disconnect();

  const failed = results.some((r) => r.passed === false);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
