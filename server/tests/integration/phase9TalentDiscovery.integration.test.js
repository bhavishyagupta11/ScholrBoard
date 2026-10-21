/**
 * phase9TalentDiscovery.integration.test.js
 *
 * ScholrBoard V13 Phase 9 Integration Test Suite:
 * MongoDB integration tests against dedicated test database (scholrboard_test)
 * validating Talent Discovery query filtering by coverageMin, confidence, freshness,
 * eligibilityStatus, sorting by coverage, projection of developerScoreMeta and
 * placementReadinessMeta, and rejection of composite sort.
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Profile from '../../models/Profile.js';
import User from '../../models/User.js';
import { getTalentDiscovery } from '../../controllers/talentDiscoveryController.js';
import { validateIntegrationTestDatabaseUri } from '../helpers/testDatabaseGuard.js';

dotenv.config();
process.env.NODE_ENV = 'test';

const testUri = process.env.MONGODB_URI_TEST;
validateIntegrationTestDatabaseUri(testUri);

let adminUser = null;
let userA = null;
let userB = null;
let userC = null;
let profileA = null;
let profileB = null;
let profileC = null;
let facultyUser = null;
let facultyNoDept = null;
let inactiveFaculty = null;
let inactiveAdmin = null;
let demotedAdmin = null;

// Mock Express response helper
function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    }
  };
  return res;
}

before(async () => {
  await mongoose.connect(testUri, { serverSelectionTimeoutMS: 15000 });

  // Create Admin
  adminUser = await User.create({
    name: 'Phase 9 Admin',
    email: `phase9_admin_${Date.now()}@scholrboard.test`,
    password: 'Password123!',
    role: 'admin',
    department: 'Administration',
    isActive: true
  });

  // Create Faculty User (CSE)
  facultyUser = await User.create({
    name: 'Phase 9 Faculty CSE',
    email: `phase9_faculty_${Date.now()}@scholrboard.test`,
    password: 'Password123!',
    role: 'faculty',
    department: 'CSE',
    isActive: true
  });

  // Create Inactive Faculty User (CSE)
  inactiveFaculty = await User.create({
    name: 'Phase 9 Inactive Faculty',
    email: `phase9_faculty_inactive_${Date.now()}@scholrboard.test`,
    password: 'Password123!',
    role: 'faculty',
    department: 'CSE',
    isActive: false
  });

  // Create Inactive Admin User
  inactiveAdmin = await User.create({
    name: 'Phase 9 Inactive Admin',
    email: `phase9_admin_inactive_${Date.now()}@scholrboard.test`,
    password: 'Password123!',
    role: 'admin',
    department: 'Administration',
    isActive: false
  });

  // Create Demoted Admin User (role in DB demoted to student)
  demotedAdmin = await User.create({
    name: 'Phase 9 Demoted Admin',
    email: `phase9_admin_demoted_${Date.now()}@scholrboard.test`,
    password: 'Password123!',
    role: 'student',
    department: 'CSE',
    isActive: true
  });

  // Create Faculty User with missing department (simulating unconfigured/legacy record)
  const facultyNoDeptId = new mongoose.Types.ObjectId();
  await User.collection.insertOne({
    _id: facultyNoDeptId,
    name: 'Phase 9 Faculty No Dept',
    email: `phase9_faculty_nodept_${Date.now()}@scholrboard.test`,
    password: 'Password123!',
    role: 'faculty',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  });
  facultyNoDept = await User.findById(facultyNoDeptId);

  // Create 3 Software Engineering Students
  userA = await User.create({
    name: 'Candidate High Coverage',
    email: `cand_a_${Date.now()}@scholrboard.test`,
    password: 'Password123!',
    role: 'student',
    department: 'CSE',
    semester: 7,
    isActive: true
  });

  profileA = await Profile.create({
    userId: userA._id,
    developerScore: 88,
    placementReadinessScore: 82,
    gpa: 8.9,
    developerScoreMeta: {
      score: 88,
      coverage: 95,
      confidence: 'High',
      freshness: 'Fresh',
      calculatedAt: new Date()
    },
    placementReadinessMeta: {
      score: 82,
      coverage: 92,
      confidence: 'High',
      freshness: 'Fresh',
      eligibilityStatus: {
        status: 'ELIGIBLE',
        isEligible: true,
        reasons: ['backlogs=0 ✓', 'attendance=85% ✓']
      },
      calculatedAt: new Date()
    }
  });

  userB = await User.create({
    name: 'Candidate Low Coverage',
    email: `cand_b_${Date.now()}@scholrboard.test`,
    password: 'Password123!',
    role: 'student',
    department: 'IT',
    semester: 7,
    isActive: true
  });

  profileB = await Profile.create({
    userId: userB._id,
    developerScore: 75,
    placementReadinessScore: 68,
    gpa: 7.5,
    developerScoreMeta: {
      score: 75,
      coverage: 32, // < 40 (Low coverage)
      confidence: 'Low',
      freshness: 'Aging',
      calculatedAt: new Date()
    },
    placementReadinessMeta: {
      score: 68,
      coverage: 40,
      confidence: 'Low',
      freshness: 'Aging',
      eligibilityStatus: {
        status: 'UNKNOWN',
        isEligible: null,
        reasons: ['Attendance data not available. Eligibility cannot be determined.']
      },
      calculatedAt: new Date()
    }
  });

  userC = await User.create({
    name: 'Candidate Ineligible',
    email: `cand_c_${Date.now()}@scholrboard.test`,
    password: 'Password123!',
    role: 'student',
    department: 'CSE',
    semester: 5,
    isActive: true
  });

  profileC = await Profile.create({
    userId: userC._id,
    developerScore: 62,
    placementReadinessScore: 45,
    gpa: 6.8,
    developerScoreMeta: {
      score: 62,
      coverage: 65,
      confidence: 'Medium',
      freshness: 'Stale',
      calculatedAt: new Date()
    },
    placementReadinessMeta: {
      score: 45,
      coverage: 60,
      confidence: 'Medium',
      freshness: 'Stale',
      eligibilityStatus: {
        status: 'INELIGIBLE',
        isEligible: false,
        reasons: ['1 active backlog (maximum: 0)']
      },
      calculatedAt: new Date()
    }
  });
});

after(async () => {
  const idsToDelete = [userA?._id, userB?._id, userC?._id, adminUser?._id, facultyUser?._id, facultyNoDept?._id, inactiveFaculty?._id, inactiveAdmin?._id, demotedAdmin?._id].filter(Boolean);
  await Profile.deleteMany({ userId: { $in: idsToDelete } });
  await User.deleteMany({ _id: { $in: idsToDelete } });
  await mongoose.disconnect();
});

test('Phase 9.6 — Talent Discovery Query Filter Integration (Part 24.1)', async (t) => {
  await t.test('Filter by coverageMin >= 50 excludes candidate with coverage 32%', async () => {
    const req = {
      query: { coverageMin: '50' },
      user: { _id: adminUser._id, role: 'admin' }
    };
    const res = createMockRes();
    await getTalentDiscovery(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    
    const userIds = res.body.data.map(d => String(d._id));
    assert.ok(userIds.includes(String(userA._id)), 'Candidate A (cov 95) must be included');
    assert.ok(userIds.includes(String(userC._id)), 'Candidate C (cov 65) must be included');
    assert.ok(!userIds.includes(String(userB._id)), 'Candidate B (cov 32) must be excluded');
  });

  await t.test('Filter by confidence = HIGH returns only high confidence candidate', async () => {
    const req = {
      query: { confidence: 'HIGH' },
      user: { _id: adminUser._id, role: 'admin' }
    };
    const res = createMockRes();
    await getTalentDiscovery(req, res);

    assert.equal(res.statusCode, 200);
    const userIds = res.body.data.map(d => String(d._id));
    assert.ok(userIds.includes(String(userA._id)));
    assert.ok(!userIds.includes(String(userB._id)));
    assert.ok(!userIds.includes(String(userC._id)));
  });

  await t.test('Filter by freshness = FRESH returns only fresh candidates', async () => {
    const req = {
      query: { freshness: 'fresh' },
      user: { _id: adminUser._id, role: 'admin' }
    };
    const res = createMockRes();
    await getTalentDiscovery(req, res);

    assert.equal(res.statusCode, 200);
    const userIds = res.body.data.map(d => String(d._id));
    assert.ok(userIds.includes(String(userA._id)));
    assert.ok(!userIds.includes(String(userC._id)));
  });

  await t.test('Filter by eligibilityStatus = ELIGIBLE returns only eligible candidates', async () => {
    const req = {
      query: { eligibilityStatus: 'ELIGIBLE' },
      user: { _id: adminUser._id, role: 'admin' }
    };
    const res = createMockRes();
    await getTalentDiscovery(req, res);

    assert.equal(res.statusCode, 200);
    const userIds = res.body.data.map(d => String(d._id));
    assert.ok(userIds.includes(String(userA._id)));
    assert.ok(!userIds.includes(String(userB._id)));
    assert.ok(!userIds.includes(String(userC._id)));
  });

  await t.test('Filter by eligibilityStatus = UNKNOWN returns only unknown candidates', async () => {
    const req = {
      query: { eligibilityStatus: 'UNKNOWN' },
      user: { _id: adminUser._id, role: 'admin' }
    };
    const res = createMockRes();
    await getTalentDiscovery(req, res);

    assert.equal(res.statusCode, 200);
    const userIds = res.body.data.map(d => String(d._id));
    assert.ok(!userIds.includes(String(userA._id)));
    assert.ok(userIds.includes(String(userB._id)));
    assert.ok(!userIds.includes(String(userC._id)));
  });
});

test('Phase 9.7 — Talent Discovery Sorting & Whitelist Projection (Part 24.2 & Part 27)', async (t) => {
  await t.test('Sort by coverage descending sorts candidates by developerScoreMeta.coverage', async () => {
    const req = {
      query: { sortBy: 'coverage', sortOrder: 'desc' },
      user: { _id: adminUser._id, role: 'admin' }
    };
    const res = createMockRes();
    await getTalentDiscovery(req, res);

    assert.equal(res.statusCode, 200);
    const testCandidates = res.body.data.filter(d => 
      [String(userA._id), String(userB._id), String(userC._id)].includes(String(d._id))
    );

    assert.equal(testCandidates.length, 3);
    assert.equal(String(testCandidates[0]._id), String(userA._id), 'Candidate A (95%) must be first');
    assert.equal(String(testCandidates[1]._id), String(userC._id), 'Candidate C (65%) must be second');
    assert.equal(String(testCandidates[2]._id), String(userB._id), 'Candidate B (32%) must be third');
  });

  await t.test('Projection includes developerScoreMeta, placementReadinessMeta, and eligibilityStatus', async () => {
    const req = {
      query: { search: 'Candidate High Coverage' },
      user: { _id: adminUser._id, role: 'admin' }
    };
    const res = createMockRes();
    await getTalentDiscovery(req, res);

    assert.equal(res.statusCode, 200);
    const cand = res.body.data.find(d => String(d._id) === String(userA._id));
    assert.ok(cand, 'Candidate A must be returned');

    assert.equal(cand.developerScore, 88);
    assert.equal(cand.placementReadinessScore, 82);

    assert.ok(cand.developerScoreMeta, 'developerScoreMeta must be projected');
    assert.equal(cand.developerScoreMeta.coverage, 95);
    assert.equal(cand.developerScoreMeta.confidence, 'High');
    assert.equal(cand.developerScoreMeta.freshness, 'Fresh');

    assert.ok(cand.placementReadinessMeta, 'placementReadinessMeta must be projected');
    assert.equal(cand.placementReadinessMeta.coverage, 92);
    assert.equal(cand.placementReadinessMeta.confidence, 'High');

    assert.ok(cand.eligibilityStatus, 'eligibilityStatus must be projected');
    assert.equal(cand.eligibilityStatus.status, 'ELIGIBLE');
    assert.equal(cand.eligibilityStatus.isEligible, true);
  });
});

test('Phase 9.8 — Departmental Scoping & Fail-Closed Faculty Authorization (Part 25 & Security Gate)', async (t) => {
  await t.test('1. Authorized faculty account with verified department sees only candidates from that department', async () => {
    const req = {
      query: {},
      user: { _id: facultyUser._id, role: 'faculty', department: 'CSE' }
    };
    const res = createMockRes();
    await getTalentDiscovery(req, res);

    assert.equal(res.statusCode, 200);
    const returnedUserIds = res.body.data.map(d => String(d._id));

    // Must include CSE students
    assert.ok(returnedUserIds.includes(String(userA._id)), 'CSE Student A must be visible to CSE faculty');
    assert.ok(returnedUserIds.includes(String(userC._id)), 'CSE Student C must be visible to CSE faculty');

    // Must NOT include IT student
    assert.ok(!returnedUserIds.includes(String(userB._id)), 'IT Student B must NOT be visible to CSE faculty');
  });

  await t.test('2. Candidates from other departments remain excluded when other filters and sorting options are applied', async () => {
    const req = {
      query: { sortBy: 'developerScore', sortOrder: 'desc', gpaMin: '6.0' },
      user: { _id: facultyUser._id, role: 'faculty', department: 'CSE' }
    };
    const res = createMockRes();
    await getTalentDiscovery(req, res);

    assert.equal(res.statusCode, 200);
    const returnedUserIds = res.body.data.map(d => String(d._id));
    assert.ok(returnedUserIds.includes(String(userA._id)));
    assert.ok(returnedUserIds.includes(String(userC._id)));
    assert.ok(!returnedUserIds.includes(String(userB._id)), 'IT Student B must remain excluded despite global sorting and GPA filters');
  });

  await t.test('3. Faculty request with missing department on req.user resolves department from authoritative DB record', async () => {
    // req.user has _id and role, but department is intentionally omitted from the principal context
    const req = {
      query: {},
      user: { _id: facultyUser._id, role: 'faculty' }
    };
    const res = createMockRes();
    await getTalentDiscovery(req, res);

    assert.equal(res.statusCode, 200);
    const returnedUserIds = res.body.data.map(d => String(d._id));
    assert.ok(returnedUserIds.includes(String(userA._id)), 'CSE Student A must be returned via authoritative DB resolution');
    assert.ok(!returnedUserIds.includes(String(userB._id)), 'IT Student B must NOT be visible');
  });

  await t.test('4. Reproduction of fail-open flaw: Faculty user with missing department in DB fails closed with 403 Forbidden', async () => {
    // Under original code, a faculty user with no department in DB executed an unrestricted query.
    // Under the fail-closed correction, this MUST return HTTP 403 Forbidden.
    const req = {
      query: {},
      user: { _id: facultyNoDept._id, role: 'faculty' }
    };
    const res = createMockRes();
    await getTalentDiscovery(req, res);

    assert.equal(res.statusCode, 403, 'Must fail-closed with 403 Forbidden instead of running unrestricted query');
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Faculty department cannot be verified/i);
  });

  await t.test('5. Client-provided department in req.query cannot override faculty member\'s verified department', async () => {
    // CSE faculty tries to request IT students by passing department=IT in query
    const req = {
      query: { department: 'IT' },
      user: { _id: facultyUser._id, role: 'faculty', department: 'CSE' }
    };
    const res = createMockRes();
    await getTalentDiscovery(req, res);

    assert.equal(res.statusCode, 200);
    const returnedUserIds = res.body.data.map(d => String(d._id));

    // Must still only see CSE students, NEVER IT students
    assert.ok(returnedUserIds.includes(String(userA._id)));
    assert.ok(!returnedUserIds.includes(String(userB._id)), 'Client query param must NOT override verified faculty department');
  });

  await t.test('6. Non-existent faculty record in DB fails closed with 403 Forbidden without granting broad access', async () => {
    const unlistedFacultyId = new mongoose.Types.ObjectId();
    const req = {
      query: {},
      user: { _id: unlistedFacultyId, role: 'faculty' }
    };
    const res = createMockRes();
    await getTalentDiscovery(req, res);

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /User account not found|Faculty department cannot be verified/i);
  });

  await t.test('7. Authorized administrator retains full access across all software engineering departments (CSE and IT)', async () => {
    const req = {
      query: {},
      user: { _id: adminUser._id, role: 'admin' }
    };
    const res = createMockRes();
    await getTalentDiscovery(req, res);

    assert.equal(res.statusCode, 200);
    const returnedUserIds = res.body.data.map(d => String(d._id));
    assert.ok(returnedUserIds.includes(String(userA._id)), 'Admin must see CSE Student A');
    assert.ok(returnedUserIds.includes(String(userB._id)), 'Admin must see IT Student B');
    assert.ok(returnedUserIds.includes(String(userC._id)), 'Admin must see CSE Student C');
  });

  await t.test('8. Authorized administrator can filter by department (IT)', async () => {
    const req = {
      query: { department: 'IT' },
      user: { _id: adminUser._id, role: 'admin' }
    };
    const res = createMockRes();
    await getTalentDiscovery(req, res);

    assert.equal(res.statusCode, 200);
    const returnedUserIds = res.body.data.map(d => String(d._id));
    assert.ok(returnedUserIds.includes(String(userB._id)), 'Admin filtered on IT must see IT Student B');
    assert.ok(!returnedUserIds.includes(String(userA._id)), 'Admin filtered on IT must not see CSE Student A');
  });

  await t.test('9. Unauthenticated and unsupported roles (student, recruiter) are denied by controller with 401/403', async () => {
    // Unauthenticated
    const unauthRes = createMockRes();
    await getTalentDiscovery({ query: {} }, unauthRes);
    assert.equal(unauthRes.statusCode, 401);

    // Student
    const studentRes = createMockRes();
    await getTalentDiscovery({ query: {}, user: { _id: userA._id, role: 'student' } }, studentRes);
    assert.equal(studentRes.statusCode, 403);

    // Recruiter (unauthorized role in context with student user in DB)
    const recruiterRes = createMockRes();
    await getTalentDiscovery({ query: {}, user: { _id: userA._id, role: 'recruiter' } }, recruiterRes);
    assert.equal(recruiterRes.statusCode, 403);
    assert.match(recruiterRes.body.message, /insufficient permissions/i);

    // Malformed ID format
    const malformedRes = createMockRes();
    await getTalentDiscovery({ query: {}, user: { _id: 'recruiter_99', role: 'recruiter' } }, malformedRes);
    assert.equal(malformedRes.statusCode, 403);
    assert.match(malformedRes.body.message, /Invalid user identity/i);
  });

  await t.test('10. Faculty with stale department in auth context is restricted to authoritative DB department', async () => {
    // facultyUser DB department is 'CSE'. Context provides stale department 'IT'.
    const req = {
      query: {},
      user: { _id: facultyUser._id, role: 'faculty', department: 'IT' }
    };
    const res = createMockRes();
    await getTalentDiscovery(req, res);

    assert.equal(res.statusCode, 200);
    const returnedUserIds = res.body.data.map(d => String(d._id));
    assert.ok(returnedUserIds.includes(String(userA._id)), 'CSE Student A must be returned');
    assert.ok(returnedUserIds.includes(String(userC._id)), 'CSE Student C must be returned');
    assert.ok(!returnedUserIds.includes(String(userB._id)), 'IT Student B must NOT be returned despite stale IT context claim');
  });

  await t.test('11. Deactivated faculty account in DB cannot search candidates and fails closed with 403 Forbidden', async () => {
    const req = {
      query: {},
      user: { _id: inactiveFaculty._id, role: 'faculty', department: 'CSE' }
    };
    const res = createMockRes();
    await getTalentDiscovery(req, res);

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Account is inactive/i);
  });

  await t.test('12. Authoritative-user lookup failure fails closed safely with 503 and never falls back to unrestricted access', async () => {
    // Mock User.findById to simulate database connection/network error during lookup
    const origFindById = User.findById;
    User.findById = () => {
      throw new Error('MongoNetworkTimeoutException: connection pool exhausted');
    };

    try {
      const req = {
        query: {},
        user: { _id: facultyUser._id, role: 'faculty' }
      };
      const res = createMockRes();
      await getTalentDiscovery(req, res);

      assert.equal(res.statusCode, 503);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /Service unavailable: Unable to verify authoritative user record/i);
      assert.equal(res.body.message.includes('MongoNetworkTimeoutException'), false, 'Must not leak database error details');
    } finally {
      User.findById = origFindById;
    }
  });

  await t.test('13. Faculty member cannot obtain broader access by manipulating query parameters or supplying stale claims', async () => {
    // Faculty user passes stale role='admin' in auth context and department='IT' in query
    const req = {
      query: { department: 'IT' },
      user: { _id: facultyUser._id, role: 'admin', department: 'IT' }
    };
    const res = createMockRes();
    await getTalentDiscovery(req, res);

    // Because authoritative DB record has role: 'faculty' and department: 'CSE',
    // the search must be restricted strictly to CSE and never grant IT access
    assert.equal(res.statusCode, 200);
    const returnedUserIds = res.body.data.map(d => String(d._id));
    assert.ok(returnedUserIds.includes(String(userA._id)), 'CSE Student A must be returned');
    assert.ok(!returnedUserIds.includes(String(userB._id)), 'IT Student B must NOT be accessible despite spoofed admin role and IT query');
  });

  await t.test('14. Database-backed administrator whose account is deactivated in DB fails closed with 403 Forbidden', async () => {
    const req = {
      query: {},
      user: { _id: inactiveAdmin._id, role: 'admin' } // Stale JWT context claims active admin
    };
    const res = createMockRes();
    await getTalentDiscovery(req, res);

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Account is inactive/i);
  });

  await t.test('15. Database-backed administrator whose role was demoted in DB fails closed with 403 Forbidden', async () => {
    const req = {
      query: {},
      user: { _id: demotedAdmin._id, role: 'admin' } // Stale JWT context claims admin
    };
    const res = createMockRes();
    await getTalentDiscovery(req, res);

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /insufficient permissions/i);
  });

  await t.test('16. MongoDB is unavailable before controller runs returns 503 Service Unavailable', async () => {
    const origReadyState = mongoose.connection.readyState;
    Object.defineProperty(mongoose.connection, 'readyState', { value: 0, configurable: true, writable: true });

    try {
      const req = {
        query: {},
        user: { _id: adminUser._id, role: 'admin' }
      };
      const res = createMockRes();
      await getTalentDiscovery(req, res);

      assert.equal(res.statusCode, 503);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /Service unavailable: Database connection required/i);
    } finally {
      Object.defineProperty(mongoose.connection, 'readyState', { value: origReadyState, configurable: true, writable: true });
    }
  });
});
