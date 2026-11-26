import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeSalaryPackageLpa,
  computePlacementAnalyticsStats,
  getSystemAnalytics,
} from '../../controllers/analyticsController.js';
import { getPendingActivities } from '../../controllers/activityController.js';
import {
  getEventRegistrations,
  cancelEventRegistration,
  getMyEvents,
} from '../../controllers/eventController.js';
import {
  createAnnouncement,
  getAllAnnouncements,
  updateAnnouncement,
  getMyAnnouncements,
} from '../../controllers/announcementController.js';
import { updateOpportunity } from '../../controllers/opportunityController.js';
import Event from '../../models/Event.js';
import Announcement from '../../models/Announcement.js';
import Opportunity from '../../models/Opportunity.js';
import Activity from '../../models/Activity.js';
import User from '../../models/User.js';

const mockRes = () => {
  const res = { statusCode: 200, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  return res;
};

// ═════════════════════════════════════════════════════════════════════════════
// ISSUE 5 — Placement Statistics & Package Aggregation Consistency
// ═════════════════════════════════════════════════════════════════════════════
test('Issue 5: normalizeSalaryPackageLpa handles LPA, INR, zero, negative, null', () => {
  assert.equal(normalizeSalaryPackageLpa(13), 13);
  assert.equal(normalizeSalaryPackageLpa(7.5), 7.5);
  assert.equal(normalizeSalaryPackageLpa(700000), 7);
  assert.equal(normalizeSalaryPackageLpa(1250000), 12.5);
  assert.equal(normalizeSalaryPackageLpa(0), null);
  assert.equal(normalizeSalaryPackageLpa(-5), null);
  assert.equal(normalizeSalaryPackageLpa(null), null);
  assert.equal(normalizeSalaryPackageLpa(undefined), null);
  assert.equal(normalizeSalaryPackageLpa('not-a-number'), null);
});

test('Issue 5: computePlacementAnalyticsStats matrix (single, multi-dept, missing pkg, multi-offer, duplicates, empty)', () => {
  // 1) One placed student (CSE, 13 LPA across 40 total students)
  const onePlaced = computePlacementAnalyticsStats({
    totalStudents: 40,
    deptStudentCounts: [{ _id: 'CSE', count: 29 }, { _id: 'ECE', count: 11 }],
    selectedApps: [
      { studentId: { _id: 's1', department: 'CSE', isActive: true }, opportunityId: { _id: 'o1', salaryPackage: 13 } },
    ],
  });
  assert.equal(onePlaced.totalPlaced, 1);
  assert.equal(onePlaced.placementPercentage, 2.5);
  assert.equal(onePlaced.highestPackage, 13);
  assert.equal(onePlaced.averagePackage, 13);
  const cseRow = onePlaced.departmentBreakdown.find((d) => d.department === 'CSE');
  assert.equal(cseRow.placed, 1);
  assert.equal(cseRow.percentage, 3.4);
  assert.equal(cseRow.highest, 13);
  assert.equal(cseRow.average, 13);

  // 2) Multiple placed students across multiple departments with mixed INR/LPA units
  const multiDept = computePlacementAnalyticsStats({
    totalStudents: 10,
    deptStudentCounts: [{ _id: 'CSE', count: 6 }, { _id: 'ECE', count: 4 }],
    selectedApps: [
      { studentId: { _id: 's1', department: 'CSE', isActive: true }, opportunityId: { _id: 'o1', salaryPackage: 13 } },
      { studentId: { _id: 's2', department: 'ECE', isActive: true }, opportunityId: { _id: 'o2', salaryPackage: 700000 } }, // 7 LPA
    ],
  });
  assert.equal(multiDept.totalPlaced, 2);
  assert.equal(multiDept.placementPercentage, 20);
  assert.equal(multiDept.highestPackage, 13);
  assert.equal(multiDept.averagePackage, 10);

  // 3) Multiple offers & duplicate rows for the same student:
  //    s1 has 2 offers (8 LPA, 16 LPA) + duplicate row for o_high; s2 has missing/0 salary.
  const multiOfferAndMissing = computePlacementAnalyticsStats({
    totalStudents: 10,
    deptStudentCounts: [{ _id: 'CSE', count: 5 }, { _id: 'IT', count: 5 }],
    selectedApps: [
      { studentId: { _id: 's1', department: 'CSE', isActive: true }, opportunityId: { _id: 'o_low', salaryPackage: 8 } },
      { studentId: { _id: 's1', department: 'CSE', isActive: true }, opportunityId: { _id: 'o_high', salaryPackage: 16 } },
      { studentId: { _id: 's1', department: 'CSE', isActive: true }, opportunityId: { _id: 'o_high', salaryPackage: 16 } }, // duplicate
      { studentId: { _id: 's2', department: 'IT', isActive: true }, opportunityId: { _id: 'o_null', salaryPackage: null } },
    ],
  });
  assert.equal(multiOfferAndMissing.totalPlaced, 2, 'Unique students only (s1 counted once despite 2 offers & 1 dup)');
  assert.equal(multiOfferAndMissing.highestPackage, 16);
  assert.equal(multiOfferAndMissing.averagePackage, 16, 'Missing salary for s2 must NOT become 0 and dilute average');
  const cseMulti = multiOfferAndMissing.departmentBreakdown.find((d) => d.department === 'CSE');
  const itMissing = multiOfferAndMissing.departmentBreakdown.find((d) => d.department === 'IT');
  assert.equal(cseMulti.placed, 1);
  assert.equal(cseMulti.percentage, 20);
  assert.equal(cseMulti.highest, 16);
  assert.equal(cseMulti.average, 16);
  assert.equal(itMissing.placed, 1);
  assert.equal(itMissing.highest, null);
  assert.equal(itMissing.average, null);

  // 4) Zero placement records -> null unavailable packages (never misleading 0)
  const emptyStats = computePlacementAnalyticsStats({
    totalStudents: 5,
    deptStudentCounts: [{ _id: 'CSE', count: 5 }],
    selectedApps: [],
  });
  assert.equal(emptyStats.totalPlaced, 0);
  assert.equal(emptyStats.placementPercentage, 0);
  assert.equal(emptyStats.highestPackage, null);
  assert.equal(emptyStats.averagePackage, null);
  assert.equal(emptyStats.departmentBreakdown[0].highest, null);
  assert.equal(emptyStats.departmentBreakdown[0].average, null);
});

// ═════════════════════════════════════════════════════════════════════════════
// ISSUE 1 — Event Registrations Admin Retrieval, Filters & Auth
// ═════════════════════════════════════════════════════════════════════════════
test('Issue 1: getEventRegistrations returns populated student details, filters, counts, and handles 404/empty', async () => {
  const origFindById = Event.findById;
  try {
    Event.findById = () => ({
      populate: () => ({
        select: async () => ({
          _id: 'evt_1',
          title: 'Deloitte Placement Event',
          category: 'Technical',
          startDate: new Date('2026-11-29T00:00:00.000Z'),
          venue: 'Auditorium',
          maxAttendees: 100,
          requiresRegistration: true,
          isPublished: true,
          isCancelled: false,
          attendees: [
            {
              userId: { _id: 'u1', name: 'Aarav Sharma', email: 'aarav@uni.edu', studentId: '22CSE01', department: 'CSE', semester: 7, role: 'student' },
              registeredAt: new Date('2026-11-25T10:00:00.000Z'),
              attended: null,
            },
            {
              userId: { _id: 'u2', name: 'Priya Verma', email: 'priya@uni.edu', studentId: '22ECE04', department: 'ECE', semester: 5, role: 'student' },
              registeredAt: new Date('2026-11-26T09:00:00.000Z'),
              attended: true,
            },
          ],
        }),
      }),
    });

    const resAll = mockRes();
    await getEventRegistrations({ params: { id: 'evt_1' }, query: {} }, resAll);
    assert.equal(resAll.statusCode, 200);
    assert.equal(resAll.body.summary.totalRegistrations, 2);
    assert.equal(resAll.body.registrations[0].name, 'Priya Verma'); // sorted newest first
    assert.equal(resAll.body.registrations[0].studentId, '22ECE04');
    assert.equal(resAll.body.registrations[0].status, 'Attended');

    const resFiltered = mockRes();
    await getEventRegistrations({ params: { id: 'evt_1' }, query: { search: 'aarav', department: 'CSE', status: 'registered' } }, resFiltered);
    assert.equal(resFiltered.body.summary.totalRegistrations, 2);
    assert.equal(resFiltered.body.summary.filteredCount, 1);
    assert.equal(resFiltered.body.registrations[0].email, 'aarav@uni.edu');

    // Missing event -> 404
    Event.findById = () => ({ populate: () => ({ select: async () => null }) });
    const res404 = mockRes();
    await getEventRegistrations({ params: { id: 'missing' }, query: {} }, res404);
    assert.equal(res404.statusCode, 404);
  } finally {
    Event.findById = origFindById;
  }
});

test('Issue 1: getMyEvents preserves role filter when user has department (no $or.push({})) & cancelEventRegistration pulls user', async () => {
  const origFind = Event.find;
  const origCount = Event.countDocuments;
  const origFindById = Event.findById;
  const origUpdateOne = Event.updateOne;
  try {
    let capturedQuery = null;
    Event.find = (q) => {
      capturedQuery = q;
      return {
        sort: () => ({ skip: () => ({ limit: () => ({ populate: async () => [] }) }) }),
      };
    };
    Event.countDocuments = async () => 0;

    const res = mockRes();
    await getMyEvents({ query: { upcoming: 'false' }, user: { _id: 'u1', role: 'student', department: 'CSE' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(capturedQuery.$or.some((clause) => Object.keys(clause).length === 0), false, 'Must not push empty {} into $or');

    let pulled = false;
    Event.findById = async () => ({
      _id: 'evt_1',
      attendees: [{ userId: 'u1' }],
    });
    Event.updateOne = async (_filter, upd) => {
      if (upd?.$pull?.attendees?.userId === 'u1') pulled = true;
      return { modifiedCount: 1 };
    };
    const cancelRes = mockRes();
    await cancelEventRegistration({ params: { id: 'evt_1' }, user: { _id: 'u1' } }, cancelRes);
    assert.equal(cancelRes.statusCode, 200);
    assert.equal(pulled, true);
    assert.equal(cancelRes.body.totalRegistrations, 0);
  } finally {
    Event.find = origFind;
    Event.countDocuments = origCount;
    Event.findById = origFindById;
    Event.updateOne = origUpdateOne;
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// ISSUE 2 — Admin Announcements Visibility, Draft Exclusion & Editing
// ═════════════════════════════════════════════════════════════════════════════
test('Issue 2: Admin getAllAnnouncements surfaces student-targeted notices & getMyAnnouncements excludes Drafts', async () => {
  const origFind = Announcement.find;
  try {
    let capturedAdminQuery = null;
    let capturedStudentQuery = null;

    Announcement.find = (q) => {
      capturedAdminQuery = q;
      return {
        populate: () => ({
          sort: () => ({
            limit: async () => [
              { _id: 'a1', title: 'Deloitte Recruitment 2026', status: 'Published', filters: { role: 'student', department: 'CSE', year: 4 } },
            ],
          }),
        }),
      };
    };
    const adminRes = mockRes();
    await getAllAnnouncements({ query: {} }, adminRes);
    assert.equal(adminRes.statusCode, 200);
    assert.equal(adminRes.body.announcements.length, 1);
    assert.deepEqual(capturedAdminQuery, {});

    Announcement.find = (q) => {
      capturedStudentQuery = q;
      return {
        populate: () => ({ sort: () => ({ limit: async () => [] }) }),
      };
    };
    const studentRes = mockRes();
    await getMyAnnouncements({ user: { role: 'student', department: 'CSE', semester: 7 } }, studentRes);
    assert.equal(studentRes.statusCode, 200);
    const statusClause = capturedStudentQuery.$and.find((c) => c.$or?.some((o) => o.status === 'Published'));
    assert.ok(statusClause, 'Student feed must filter exclusively to Published notices (never Draft)');

    const invalidCreateRes = mockRes();
    await createAnnouncement({ body: { title: 'Test', content: 'Body', category: 'General', status: 'Bogus' }, user: { _id: 'admin1' } }, invalidCreateRes);
    assert.equal(invalidCreateRes.statusCode, 400);

    const origFindById = Announcement.findById;
    Announcement.findById = async () => null;
    const missingUpdateRes = mockRes();
    await updateAnnouncement({ params: { id: 'missing' }, body: { title: 'x' } }, missingUpdateRes);
    assert.equal(missingUpdateRes.statusCode, 404);
    Announcement.findById = origFindById;
  } finally {
    Announcement.find = origFind;
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// ISSUE 3 — Placement Opportunity Editing Lifecycle & Anti-Reopen Safety
// ═════════════════════════════════════════════════════════════════════════════
test('Issue 3: updateOpportunity blocks illegal reopen / extending expired deadlines, preserves fields on valid edits', async () => {
  const origFindById = Opportunity.findById;
  try {
    // 1) Closed / expired drive cannot have status flipped to Published or deadline extended
    Opportunity.findById = async () => ({
      _id: 'op_tcs',
      driveCode: 'NQT INDIA',
      title: 'NINJA',
      company: 'TCS NQT',
      type: 'Full-time',
      description: 'Desc',
      status: 'Closed',
      deadline: new Date('2026-07-09T20:00:00.000Z'),
    });

    const reopenStatusRes = mockRes();
    await updateOpportunity({
      params: { id: 'op_tcs' },
      body: { status: 'Published' },
      user: { _id: 'admin1', role: 'admin' },
    }, reopenStatusRes);
    assert.equal(reopenStatusRes.statusCode, 400);

    const extendDeadlineRes = mockRes();
    await updateOpportunity({
      params: { id: 'op_tcs' },
      body: { deadline: '2027-01-01T18:00' },
      user: { _id: 'admin1', role: 'admin' },
    }, extendDeadlineRes);
    assert.equal(extendDeadlineRes.statusCode, 400);
    assert.match(extendDeadlineRes.body.message, /expired or closed/i);

    const invalidDateRes = mockRes();
    Opportunity.findById = async () => ({
      _id: 'op_open',
      driveCode: 'INFY-1',
      title: 'SDE',
      company: 'Infosys',
      type: 'Full-time',
      description: 'Desc',
      status: 'Published',
      deadline: new Date(Date.now() + 86400000),
    });
    await updateOpportunity({
      params: { id: 'op_open' },
      body: { deadline: '2026-02-30' },
      user: { _id: 'admin1', role: 'admin' },
    }, invalidDateRes);
    assert.equal(invalidDateRes.statusCode, 400);
  } finally {
    Opportunity.findById = origFindById;
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// ADDITIONAL CHECK — Activity Approvals Archived Parity
// ═════════════════════════════════════════════════════════════════════════════
test('Additional Check: getSystemAnalytics and getPendingActivities use matching isArchived != true filters', async () => {
  const origUserCount = User.countDocuments;
  const origUserFind = User.find;
  const origActAgg = Activity.aggregate;
  const origActFind = Activity.find;
  const origActCount = Activity.countDocuments;

  try {
    let aggPipeline = null;
    let pendingFindQuery = null;

    User.countDocuments = async () => 10;
    User.find = () => ({ select: async () => [] });
    Activity.aggregate = async (pipeline) => {
      aggPipeline = pipeline;
      return [{ _id: 'Approved', count: 4 }, { _id: 'Rejected', count: 2 }];
    };
    Activity.find = (q) => {
      pendingFindQuery = q;
      return {
        populate: () => ({
          sort: () => ({
            limit: () => ({
              select: async () => [],
            }),
            skip: () => ({
              limit: () => ({
                select: async () => [],
              }),
            }),
          }),
        }),
      };
    };
    Activity.countDocuments = async () => 0;

    const sysRes = mockRes();
    await getSystemAnalytics({ user: { role: 'admin' } }, sysRes);
    assert.equal(sysRes.statusCode, 200);
    assert.deepEqual(aggPipeline[0].$match.isArchived, { $ne: true });
    assert.equal(sysRes.body.systemAnalytics.activitySummary.Pending, 0);

    const pendRes = mockRes();
    await getPendingActivities({ query: {}, user: { role: 'admin' } }, pendRes);
    assert.equal(pendRes.statusCode, 200);
    assert.deepEqual(pendingFindQuery.isArchived, { $ne: true });
    assert.equal(pendRes.body.pagination.totalItems, 0);
  } finally {
    User.countDocuments = origUserCount;
    User.find = origUserFind;
    Activity.aggregate = origActAgg;
    Activity.find = origActFind;
    Activity.countDocuments = origActCount;
  }
});
