/**
 * closeSingleOpportunityStatus.js
 *
 * Targeted, idempotent single-record status cleanup for an expired Opportunity.
 * Strictly read-only DRY-RUN by default. Requires BOTH `--apply` and
 * `--confirm-id=<exact Opportunity ObjectId>` before performing a single-document write.
 *
 * Usage:
 *   node server/scripts/closeSingleOpportunityStatus.js
 *   node server/scripts/closeSingleOpportunityStatus.js --id=6a2f7834b2a1ae4fc554ad9f --apply --confirm-id=6a2f7834b2a1ae4fc554ad9f
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Opportunity from '../models/Opportunity.js';
import Application from '../models/Application.js';
import { evaluateOpportunityDeadline } from '../utils/opportunityDeadline.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DEFAULT_TCS_OPPORTUNITY_ID = '6a2f7834b2a1ae4fc554ad9f';
const OBJECT_ID_HEX_REGEX = /^[a-f0-9]{24}$/i;

export const redactMongoUriTarget = (mongoUri = '') => {
  if (!mongoUri) return 'unconfigured';
  return String(mongoUri).replace(/\/\/([^:@/]+):([^@/]+)@/, '//[REDACTED]:[REDACTED]@');
};

export const parseSingleCloseArgs = (argv = []) => {
  const hasApply = argv.includes('--apply');
  const hasDryRun = argv.includes('--dry-run');
  const idArg = argv.find((a) => a.startsWith('--id='));
  const confirmIdArg = argv.find((a) => a.startsWith('--confirm-id='));

  const targetId = (idArg ? idArg.slice('--id='.length) : DEFAULT_TCS_OPPORTUNITY_ID).trim();
  const confirmId = confirmIdArg ? confirmIdArg.slice('--confirm-id='.length).trim() : null;

  if (!OBJECT_ID_HEX_REGEX.test(targetId)) {
    throw new Error(`Invalid Opportunity ObjectId "${targetId}". Expected 24-char hex ID.`);
  }
  if (hasApply && hasDryRun) {
    throw new Error('Conflicting flags: --apply and --dry-run cannot be used together.');
  }
  if (hasApply && confirmId !== targetId) {
    throw new Error(
      `Refusing write without explicit confirmation: pass --confirm-id=${targetId} alongside --apply.`
    );
  }

  return {
    targetId,
    confirmId,
    apply: hasApply && !hasDryRun,
    dryRun: !hasApply || hasDryRun,
  };
};

const toSafeSnapshot = (doc, linkedApplicationsCount) => ({
  _id: String(doc._id),
  driveCode: doc.driveCode,
  company: doc.company,
  title: doc.title,
  type: doc.type,
  deadline: doc.deadline instanceof Date ? doc.deadline.toISOString() : doc.deadline,
  status: doc.status,
  salaryPackage: doc.salaryPackage,
  eligibility: doc.eligibility,
  hasPostedBy: Boolean(doc.postedBy),
  createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
  updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : doc.updatedAt,
  linkedApplicationsCount,
});

export const closeSingleOpportunityStatus = async ({
  targetId = DEFAULT_TCS_OPPORTUNITY_ID,
  apply = false,
  confirmId = null,
  now = new Date(),
  OpportunityModel = Opportunity,
  ApplicationModel = Application,
  logger = console,
} = {}) => {
  if (!OBJECT_ID_HEX_REGEX.test(targetId)) {
    throw new Error(`Invalid Opportunity ObjectId "${targetId}".`);
  }
  if (apply && confirmId !== targetId) {
    throw new Error(`Explicit confirmId matching targetId (${targetId}) is required when apply=true.`);
  }

  const permittedStatuses = OpportunityModel?.schema?.path?.('status')?.enumValues || ['Draft', 'Published', 'Closed'];
  if (!permittedStatuses.includes('Closed')) {
    throw new Error(`Model schema does not permit 'Closed' status (permitted: ${permittedStatuses.join(', ')}).`);
  }

  const refDate = now instanceof Date ? now : new Date(now);
  const mode = apply ? 'APPLY' : 'DRY-RUN';
  logger.log(`[closeSingleOpportunityStatus] Mode: ${mode} | Target ID: ${targetId}`);

  const doc = await OpportunityModel.findById(targetId);
  if (!doc) {
    throw new Error(`Opportunity "${targetId}" not found.`);
  }

  const linkedApplicationsCount = await ApplicationModel.countDocuments({ opportunityId: doc._id });
  const deadlineEval = evaluateOpportunityDeadline(doc, refDate);
  const before = toSafeSnapshot(doc, linkedApplicationsCount);

  if (doc.status === 'Closed') {
    logger.log(`[closeSingleOpportunityStatus] Idempotent no-op: "${targetId}" is already Closed.`);
    return {
      mode,
      dryRun: !apply,
      targetId,
      permittedStatuses,
      deadlineEval,
      alreadyClosed: true,
      affectedRecords: 0,
      modifiedCount: 0,
      before,
      after: before,
      fieldsToChange: [],
    };
  }

  if (doc.status !== 'Published') {
    throw new Error(`Refusing status transition from "${doc.status}" to "Closed"; expected "Published".`);
  }

  if (!deadlineEval.isDeadlineVerified || !deadlineEval.isExpired) {
    throw new Error(
      `Refusing to close Opportunity "${targetId}": deadline is not verified expired (deadlineStatus=${deadlineEval.deadlineStatus}).`
    );
  }

  const plannedFieldsToChange = [
    { field: 'status', from: 'Published', to: 'Closed' },
    { field: 'updatedAt', from: before.updatedAt, to: '<update timestamp set by Mongoose on write>' },
  ];
  const plannedAfter = {
    ...before,
    status: 'Closed',
    updatedAt: apply ? refDate.toISOString() : '<auto-updated on --apply>',
  };

  if (!apply) {
    logger.log(`[closeSingleOpportunityStatus] DRY-RUN ONLY: 1 record would be updated (Published -> Closed).`);
    logger.log(JSON.stringify({
      affectedRecordsPlanned: 1,
      fieldsToChange: plannedFieldsToChange,
      before,
      afterPreview: plannedAfter,
    }, null, 2));

    return {
      mode,
      dryRun: true,
      targetId,
      permittedStatuses,
      deadlineEval,
      alreadyClosed: false,
      affectedRecords: 1,
      modifiedCount: 0,
      before,
      after: plannedAfter,
      fieldsToChange: plannedFieldsToChange,
    };
  }

  const updateRes = await OpportunityModel.updateOne(
    { _id: doc._id, status: 'Published' },
    { $set: { status: 'Closed' } },
    { runValidators: true }
  );

  if ((updateRes?.matchedCount ?? 0) > 1 || (updateRes?.modifiedCount ?? 0) > 1) {
    throw new Error(`Unexpected multi-record update result: ${JSON.stringify(updateRes)}`);
  }

  const refreshed = await OpportunityModel.findById(targetId);
  const after = toSafeSnapshot(refreshed || { ...doc, status: 'Closed' }, linkedApplicationsCount);
  const modifiedCount = updateRes?.modifiedCount ?? 0;

  logger.log(`[closeSingleOpportunityStatus] Applied update. Modified count: ${modifiedCount}`);
  return {
    mode,
    dryRun: false,
    targetId,
    permittedStatuses,
    deadlineEval,
    alreadyClosed: modifiedCount === 0,
    affectedRecords: modifiedCount,
    modifiedCount,
    before,
    after,
    fieldsToChange: plannedFieldsToChange,
  };
};

async function runCli() {
  dotenv.config({ path: path.resolve(__dirname, '../.env') });

  const { targetId, apply, confirmId } = parseSingleCloseArgs(process.argv.slice(2));
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI is not configured in server/.env; refusing to fall back.');
  }

  console.log(`[closeSingleOpportunityStatus] Target URI: ${redactMongoUriTarget(mongoUri)}`);
  await mongoose.connect(mongoUri, { autoIndex: false, autoCreate: false });
  console.log(`[closeSingleOpportunityStatus] Connected DB: ${mongoose.connection.name}`);

  try {
    await closeSingleOpportunityStatus({ targetId, apply, confirmId, now: new Date() });
  } finally {
    await mongoose.disconnect();
    console.log('[closeSingleOpportunityStatus] Disconnected from MongoDB.');
  }
}

const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);

if (isDirectExecution) {
  runCli().catch((err) => {
    console.error('[closeSingleOpportunityStatus] Error:', err.message);
    process.exit(1);
  });
}
