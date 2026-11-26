/**
 * reconcileOpportunityDeadlines.js
 *
 * Scans the Opportunity collection for drives where status is 'Published'
 * and checks deadline validity using the strict shared deadline policy.
 *
 * Default mode is strictly READ-ONLY dry-run. Mutations occur ONLY when `--apply`
 * is explicitly provided (and never when combined with `--dry-run`).
 *
 * Usage:
 *   node server/scripts/reconcileOpportunityDeadlines.js             # Dry-run mode (default)
 *   node server/scripts/reconcileOpportunityDeadlines.js --dry-run   # Explicit dry-run
 *   node server/scripts/reconcileOpportunityDeadlines.js --apply     # Execute updates to 'Closed'
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Opportunity from '../models/Opportunity.js';
import { evaluateOpportunityDeadline } from '../utils/opportunityDeadline.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const parseReconcileArgs = (argv = []) => {
  const hasApply = argv.includes('--apply');
  const hasDryRun = argv.includes('--dry-run');
  const hasExecute = argv.includes('--execute');

  if (hasExecute) {
    throw new Error('Deprecated flag --execute is disabled; use --apply explicitly to mutate records.');
  }
  if (hasApply && hasDryRun) {
    throw new Error('Conflicting flags: --apply and --dry-run cannot be used together.');
  }

  return {
    apply: hasApply && !hasDryRun,
    dryRun: !hasApply || hasDryRun,
  };
};

export const redactMongoUriTarget = (mongoUri = '') => {
  if (!mongoUri) return 'unconfigured';
  return String(mongoUri).replace(/\/\/([^:@/]+):([^@/]+)@/, '//[REDACTED]:[REDACTED]@');
};

/**
 * Pure/composable reconciliation runner.
 * Only transitions Published opportunities with a verified EXPIRED deadline (`isExpired === true`).
 * Records with missing/unparseable deadlines are surfaced as `unverified` and left unmutated.
 */
export const reconcileOpportunityDeadlines = async ({
  apply = false,
  now = new Date(),
  OpportunityModel = Opportunity,
  logger = console,
} = {}) => {
  const mode = apply ? 'APPLY' : 'DRY-RUN';
  const refDate = now instanceof Date ? now : new Date(now);
  logger.log(
    `[reconcileOpportunityDeadlines] Mode: ${mode} (${apply ? 'closing verified expired drives' : 'read-only, no changes will be committed'})`
  );
  logger.log(`[reconcileOpportunityDeadlines] Reference time (now): ${refDate.toISOString()}`);

  const publishedDrives = await OpportunityModel.find({ status: 'Published' }).sort({ deadline: 1 });
  logger.log(`[reconcileOpportunityDeadlines] Total 'Published' drives found: ${publishedDrives.length}`);

  const expiredDrives = [];
  const unverifiedDrives = [];
  const openDrives = [];

  for (const op of publishedDrives) {
    const evalResult = evaluateOpportunityDeadline(op, refDate);
    if (evalResult.isExpired) {
      expiredDrives.push({ op, evalResult });
    } else if (!evalResult.isDeadlineVerified) {
      unverifiedDrives.push({ op, evalResult });
    } else {
      openDrives.push({ op, evalResult });
    }
  }

  logger.log(
    `[reconcileOpportunityDeadlines] Verified expired: ${expiredDrives.length} | Unverified deadline: ${unverifiedDrives.length} | Open: ${openDrives.length}`
  );

  for (const { op, evalResult } of expiredDrives) {
    const deadlineMs = evalResult.deadlineDate.getTime();
    const daysAgo = ((refDate.getTime() - deadlineMs) / (1000 * 60 * 60 * 24)).toFixed(1);
    logger.log(`  • [EXPIRED] [${op.driveCode || 'NO-CODE'}] ${op.company} - ${op.title} (deadline=${evalResult.deadlineDate.toISOString()}, ${daysAgo}d ago)`);
  }
  for (const { op, evalResult } of unverifiedDrives) {
    logger.log(`  • [UNVERIFIED] [${op.driveCode || 'NO-CODE'}] ${op.company} - ${op.title} (reason=${evalResult.reason})`);
  }

  let modifiedCount = 0;
  if (apply && expiredDrives.length > 0) {
    const expiredIds = expiredDrives.map(({ op }) => op._id);
    const res = await OpportunityModel.updateMany(
      { _id: { $in: expiredIds }, status: 'Published' },
      { $set: { status: 'Closed' } }
    );
    modifiedCount = res?.modifiedCount ?? 0;
    logger.log(`[reconcileOpportunityDeadlines] Update completed. Modified count: ${modifiedCount}`);
  } else if (!apply && expiredDrives.length > 0) {
    logger.log(`[reconcileOpportunityDeadlines] Dry-run completed. Re-run with --apply to close ${expiredDrives.length} verified expired drive(s).`);
  }

  return {
    mode,
    dryRun: !apply,
    referenceTime: refDate.toISOString(),
    totalPublished: publishedDrives.length,
    expiredCount: expiredDrives.length,
    unverifiedCount: unverifiedDrives.length,
    openCount: openDrives.length,
    expiredIds: expiredDrives.map(({ op }) => String(op._id)),
    unverifiedIds: unverifiedDrives.map(({ op }) => String(op._id)),
    modifiedCount,
  };
};

export const loadReconcileEnv = (envPathOverride = null) => {
  if (envPathOverride) {
    dotenv.config({ path: envPathOverride });
    return;
  }
  // Load server/.env first (consistent with server/config/env.js) before any repo-root fallback
  dotenv.config({ path: path.resolve(__dirname, '../.env') });
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });
};

async function runCli() {
  loadReconcileEnv();

  const { apply } = parseReconcileArgs(process.argv.slice(2));
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI is not configured; refusing to silently target fallback/test database.');
  }

  console.log(`[reconcileOpportunityDeadlines] Target URI: ${redactMongoUriTarget(mongoUri)}`);
  await mongoose.connect(mongoUri, { autoIndex: apply, autoCreate: apply });
  try {
    await reconcileOpportunityDeadlines({ apply, now: new Date(), OpportunityModel: Opportunity });
  } finally {
    await mongoose.disconnect();
    console.log('[reconcileOpportunityDeadlines] Disconnected from MongoDB. Done.');
  }
}

const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);

if (isDirectExecution) {
  runCli().catch((err) => {
    console.error('[reconcileOpportunityDeadlines] Fatal error:', err.message);
    process.exit(1);
  });
}
