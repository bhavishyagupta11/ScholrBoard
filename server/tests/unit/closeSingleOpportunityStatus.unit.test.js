import test from 'node:test';
import assert from 'node:assert/strict';
import Opportunity from '../../models/Opportunity.js';
import {
  DEFAULT_TCS_OPPORTUNITY_ID,
  parseSingleCloseArgs,
  closeSingleOpportunityStatus,
} from '../../scripts/closeSingleOpportunityStatus.js';

const fixedNow = new Date('2026-11-26T06:35:00.000Z');

test('Single Opportunity Cleanup: CLI parser enforces dry-run default and exact confirm-id', () => {
  assert.deepEqual(parseSingleCloseArgs([]), {
    targetId: DEFAULT_TCS_OPPORTUNITY_ID,
    confirmId: null,
    apply: false,
    dryRun: true,
  });

  assert.throws(
    () => parseSingleCloseArgs(['--apply']),
    /explicit confirmation.*--confirm-id=6a2f7834b2a1ae4fc554ad9f/i
  );

  assert.throws(
    () => parseSingleCloseArgs(['--apply', '--confirm-id=000000000000000000000000']),
    /explicit confirmation/i
  );

  assert.throws(
    () => parseSingleCloseArgs(['--apply', '--dry-run', `--confirm-id=${DEFAULT_TCS_OPPORTUNITY_ID}`]),
    /Conflicting flags/i
  );

  assert.deepEqual(
    parseSingleCloseArgs(['--apply', `--confirm-id=${DEFAULT_TCS_OPPORTUNITY_ID}`]),
    {
      targetId: DEFAULT_TCS_OPPORTUNITY_ID,
      confirmId: DEFAULT_TCS_OPPORTUNITY_ID,
      apply: true,
      dryRun: false,
    }
  );
});

test('Single Opportunity Cleanup: dry-run previews exact 1-record status diff without mutating', async () => {
  let updateCalled = false;
  const mockDoc = {
    _id: DEFAULT_TCS_OPPORTUNITY_ID,
    driveCode: 'NQT INDIA',
    company: 'TCS NQT',
    title: 'NINJA',
    type: 'Full-time',
    salaryPackage: 13,
    eligibility: { minCGPA: 6, eligibleDepartments: ['CSE'] },
    postedBy: 'admin_user_id',
    deadline: new Date('2026-07-09T20:00:00.000Z'),
    status: 'Published',
    createdAt: new Date('2026-06-15T03:57:40.653Z'),
    updatedAt: new Date('2026-06-15T03:58:21.084Z'),
  };

  const mockOppModel = {
    schema: Opportunity.schema,
    findById: async (id) => (id === DEFAULT_TCS_OPPORTUNITY_ID ? mockDoc : null),
    updateOne: async () => {
      updateCalled = true;
      return { matchedCount: 1, modifiedCount: 1 };
    },
  };
  const mockAppModel = {
    countDocuments: async () => 1,
  };

  const res = await closeSingleOpportunityStatus({
    targetId: DEFAULT_TCS_OPPORTUNITY_ID,
    apply: false,
    now: fixedNow,
    OpportunityModel: mockOppModel,
    ApplicationModel: mockAppModel,
    logger: { log() {} },
  });

  assert.equal(updateCalled, false);
  assert.equal(res.dryRun, true);
  assert.equal(res.affectedRecords, 1);
  assert.equal(res.modifiedCount, 0);
  assert.equal(res.before.status, 'Published');
  assert.equal(res.after.status, 'Closed');
  assert.equal(res.before.linkedApplicationsCount, 1);
  assert.equal(res.after.deadline, mockDoc.deadline.toISOString());
});

test('Single Opportunity Cleanup: apply updates only status via idempotent filter and rejects active drives', async () => {
  let capturedFilter = null;
  let capturedUpdate = null;
  let currentStatus = 'Published';

  const mockOppModel = {
    schema: Opportunity.schema,
    findById: async () => ({
      _id: DEFAULT_TCS_OPPORTUNITY_ID,
      driveCode: 'NQT INDIA',
      company: 'TCS NQT',
      title: 'NINJA',
      type: 'Full-time',
      deadline: new Date('2026-07-09T20:00:00.000Z'),
      status: currentStatus,
      postedBy: 'admin_user_id',
      createdAt: new Date('2026-06-15T03:57:40.653Z'),
      updatedAt: new Date('2026-06-15T03:58:21.084Z'),
    }),
    updateOne: async (filter, update) => {
      capturedFilter = filter;
      capturedUpdate = update;
      if (currentStatus === filter.status) {
        currentStatus = update.$set.status;
        return { matchedCount: 1, modifiedCount: 1 };
      }
      return { matchedCount: 0, modifiedCount: 0 };
    },
  };
  const mockAppModel = { countDocuments: async () => 1 };

  const applied = await closeSingleOpportunityStatus({
    targetId: DEFAULT_TCS_OPPORTUNITY_ID,
    apply: true,
    confirmId: DEFAULT_TCS_OPPORTUNITY_ID,
    now: fixedNow,
    OpportunityModel: mockOppModel,
    ApplicationModel: mockAppModel,
    logger: { log() {} },
  });

  assert.equal(applied.dryRun, false);
  assert.equal(applied.modifiedCount, 1);
  assert.equal(applied.after.status, 'Closed');
  assert.deepEqual(capturedFilter, { _id: DEFAULT_TCS_OPPORTUNITY_ID, status: 'Published' });
  assert.deepEqual(capturedUpdate, { $set: { status: 'Closed' } });

  // Second run is strictly idempotent (0 modifications)
  const rerun = await closeSingleOpportunityStatus({
    targetId: DEFAULT_TCS_OPPORTUNITY_ID,
    apply: true,
    confirmId: DEFAULT_TCS_OPPORTUNITY_ID,
    now: fixedNow,
    OpportunityModel: mockOppModel,
    ApplicationModel: mockAppModel,
    logger: { log() {} },
  });
  assert.equal(rerun.alreadyClosed, true);
  assert.equal(rerun.affectedRecords, 0);
  assert.equal(rerun.modifiedCount, 0);

  // Unexpired drive refused
  const openOppModel = {
    schema: Opportunity.schema,
    findById: async () => ({
      _id: DEFAULT_TCS_OPPORTUNITY_ID,
      driveCode: 'OPEN-1',
      company: 'Acme',
      title: 'SDE',
      deadline: new Date('2026-12-31T18:29:59.999Z'),
      status: 'Published',
    }),
  };
  await assert.rejects(
    () => closeSingleOpportunityStatus({
      targetId: DEFAULT_TCS_OPPORTUNITY_ID,
      apply: false,
      now: fixedNow,
      OpportunityModel: openOppModel,
      ApplicationModel: mockAppModel,
      logger: { log() {} },
    }),
    /deadline is not verified expired/i
  );
});
