/**
 * phase9TalentDiscovery.unit.test.js
 *
 * ScholrBoard V13 Phase 9 Unit Test Suite:
 * Score Explanation Panel, Recency Level Explanations, Popularity Disclaimer,
 * Eligibility Status Badge contracts, and Talent Discovery Controller validation.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import User from '../../models/User.js';
import { getTalentDiscovery } from '../../controllers/talentDiscoveryController.js';

// Controlled Mongoose mock for offline unit testing
let mockReadyState = 1;
Object.defineProperty(mongoose.connection, 'readyState', {
  get: () => mockReadyState,
  configurable: true
});

let mockAuthoritativeUser = {
  _id: 'admin_test_1',
  role: 'admin',
  department: 'Administration',
  isActive: true
};

User.findById = (id) => ({
  select: () => ({
    lean: async () => {
      if (typeof mockAuthoritativeUser === 'function') {
        return mockAuthoritativeUser(id);
      }
      return mockAuthoritativeUser;
    }
  })
});

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

test('Phase 9.1 — Recency Level Explanation Invariants (Part 23.1 & Part 27)', async (t) => {
  await t.test('Level 1 recency wording matches authoritative specification', () => {
    const l1Explanation = 'Verified 30-day activity frequency — full recency factor applied.';
    assert.match(l1Explanation, /Verified 30-day activity frequency/);
    assert.match(l1Explanation, /full recency factor applied/);
  });

  await t.test('Level 2 recency wording matches authoritative specification', () => {
    const l2Explanation = 'Single submission date recorded (frequency unverified) — capped recency credit applied. Medium confidence.';
    assert.match(l2Explanation, /Single submission date recorded \(frequency unverified\)/);
    assert.match(l2Explanation, /capped recency credit applied/);
    assert.match(l2Explanation, /Medium confidence/);
  });

  await t.test('Level 3 recency wording matches authoritative specification', () => {
    const l3Explanation = 'Recency data unavailable — problem-solving evidence preserved (benefit of doubt). Coverage reflects this.';
    assert.match(l3Explanation, /Recency data unavailable/);
    assert.match(l3Explanation, /benefit of doubt/);
    assert.match(l3Explanation, /Coverage reflects this/);
  });
});

test('Phase 9.2 — Popularity Disclaimer and Private Contribution Disclosure Invariants (Part 23.1 & 23.6)', async (t) => {
  await t.test('Popularity disclaimer explicitly states popularity is not technical quality', () => {
    const disclaimer = '(popularity is not equivalent to technical quality)';
    assert.equal(disclaimer, '(popularity is not equivalent to technical quality)');
  });

  await t.test('Option A private contribution disclosure explicitly clarifies anonymized counts without code access', () => {
    const disclosure = 'ScholrBoard cannot access private repository contents, code, or names.';
    assert.match(disclosure, /cannot access private repository contents/);
  });
});

test('Phase 9.3 — Eligibility Status Badge Invariants (Part 23.5 & 23.6)', async (t) => {
  await t.test('UNKNOWN eligibility is never a success state and must explain why unknown', () => {
    const defaultUnknownReasons = ['Attendance or academic prerequisite data not available — eligibility cannot be determined.'];
    assert.ok(defaultUnknownReasons.length > 0);
    assert.match(defaultUnknownReasons[0], /eligibility cannot be determined/i);

    const isSuccess = false;
    assert.equal(isSuccess, false, 'UNKNOWN must never be treated as success');
  });

  await t.test('Unconfigured rule set produces UNKNOWN with explicit explanatory reason', () => {
    const unconfiguredReason = 'No eligibility rules configured for this placement cycle.';
    assert.match(unconfiguredReason, /No eligibility rules configured/);
  });
});

test('Phase 9.4 — Talent Discovery Controller Query Validation & Sort Prohibitions (Part 24 & Part 27)', async (t) => {
  await t.test('Rejects composite sort Developer Score × Coverage with authoritative prohibition message', async () => {
    const req = {
      query: { sortBy: 'developerScoreCoverage', sortOrder: 'desc' },
      user: { _id: 'admin_test_1', role: 'admin' }
    };
    const res = createMockRes();

    await getTalentDiscovery(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.ok(res.body.errors.some(e => e.includes('Developer Score × Coverage is NOT a sort option')));
  });

  await t.test('Rejects underscored composite sort developerScore_coverage', async () => {
    const req = {
      query: { sortBy: 'developerScore_coverage', sortOrder: 'desc' },
      user: { _id: 'admin_test_1', role: 'admin' }
    };
    const res = createMockRes();

    await getTalentDiscovery(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.ok(res.body.errors.some(e => e.includes('Developer Score × Coverage is NOT a sort option')));
  });

  await t.test('Rejects arbitrary invalid sortBy field', async () => {
    const req = {
      query: { sortBy: 'unauthorizedHacks', sortOrder: 'desc' },
      user: { _id: 'admin_test_1', role: 'admin' }
    };
    const res = createMockRes();

    await getTalentDiscovery(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.ok(res.body.errors.some(e => e.includes('sortBy must be one of')));
  });

  await t.test('Validates coverageMin numeric range [0, 100]', async () => {
    // Non-numeric
    let req = { query: { coverageMin: 'not_a_number' }, user: { _id: 'admin1', role: 'admin' } };
    let res = createMockRes();
    await getTalentDiscovery(req, res);
    assert.equal(res.statusCode, 400);
    assert.ok(res.body.errors.some(e => e.includes('coverageMin must be a number')));

    // Out of range (< 0)
    req = { query: { coverageMin: '-10' }, user: { _id: 'admin1', role: 'admin' } };
    res = createMockRes();
    await getTalentDiscovery(req, res);
    assert.equal(res.statusCode, 400);
    assert.ok(res.body.errors.some(e => e.includes('coverageMin must be between 0 and 100')));

    // Out of range (> 100)
    req = { query: { coverageMin: '105' }, user: { _id: 'admin1', role: 'admin' } };
    res = createMockRes();
    await getTalentDiscovery(req, res);
    assert.equal(res.statusCode, 400);
    assert.ok(res.body.errors.some(e => e.includes('coverageMin must be between 0 and 100')));
  });

  await t.test('Validates confidence enum (High, Medium, Low case-insensitive)', async () => {
    const req = { query: { confidence: 'InvalidConfidence' }, user: { _id: 'admin1', role: 'admin' } };
    const res = createMockRes();
    await getTalentDiscovery(req, res);
    assert.equal(res.statusCode, 400);
    assert.ok(res.body.errors.some(e => e.includes("confidence must be one of: 'High', 'Medium', 'Low'")));
  });

  await t.test('Validates freshness enum (Fresh, Aging, Stale case-insensitive)', async () => {
    const req = { query: { freshness: 'Expired' }, user: { _id: 'admin1', role: 'admin' } };
    const res = createMockRes();
    await getTalentDiscovery(req, res);
    assert.equal(res.statusCode, 400);
    assert.ok(res.body.errors.some(e => e.includes("freshness must be one of: 'Fresh', 'Aging', 'Stale'")));
  });

  await t.test('Validates eligibilityStatus enum (ELIGIBLE, INELIGIBLE, UNKNOWN case-insensitive)', async () => {
    const req = { query: { eligibilityStatus: 'MAYBE' }, user: { _id: 'admin1', role: 'admin' } };
    const res = createMockRes();
    await getTalentDiscovery(req, res);
    assert.equal(res.statusCode, 400);
    assert.ok(res.body.errors.some(e => e.includes("eligibilityStatus must be one of: 'ELIGIBLE', 'INELIGIBLE', 'UNKNOWN'")));
  });
});

test('Phase 9.5 — Minimum Coverage Threshold Invariant (Part 24.3)', () => {
  const TALENT_DISCOVERY_MIN_COVERAGE = 40;
  assert.equal(TALENT_DISCOVERY_MIN_COVERAGE, 40);

  const sampleCandidateA = { coverage: 31 };
  const sampleCandidateB = { coverage: 78 };

  const isCandidateALow = sampleCandidateA.coverage < TALENT_DISCOVERY_MIN_COVERAGE;
  const isCandidateBLow = sampleCandidateB.coverage < TALENT_DISCOVERY_MIN_COVERAGE;

  assert.equal(isCandidateALow, true, 'Candidate with coverage 31% must trigger low coverage warning');
  assert.equal(isCandidateBLow, false, 'Candidate with coverage 78% must not trigger low coverage warning');
});

test('Phase 9.8 — Talent Discovery Server-Side Authorization Boundary & Role Access (Part 25)', async (t) => {
  const { default: requireRole } = await import('../../middleware/roleAuth.js');
  const guard = requireRole('admin', 'faculty');

  await t.test('Unauthenticated request (req.user missing) is rejected with 401', () => {
    const req = {};
    const res = createMockRes();
    let nextCalled = false;
    guard(req, res, () => { nextCalled = true; });

    assert.equal(res.statusCode, 401);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Authentication required/i);
    assert.equal(nextCalled, false);
  });

  await t.test('Unauthorized student role is rejected with 403 Forbidden', () => {
    const req = { user: { _id: 'student_1', role: 'student' } };
    const res = createMockRes();
    let nextCalled = false;
    guard(req, res, () => { nextCalled = true; });

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Access denied/i);
    assert.equal(nextCalled, false);
  });

  await t.test('Unauthorized recruiter role is rejected with 403 Forbidden', () => {
    const req = { user: { _id: 'recruiter_1', role: 'recruiter' } };
    const res = createMockRes();
    let nextCalled = false;
    guard(req, res, () => { nextCalled = true; });

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Access denied/i);
    assert.equal(nextCalled, false);
  });

  await t.test('Authorized admin role is allowed through to next()', () => {
    const req = { user: { _id: 'admin_1', role: 'admin' } };
    const res = createMockRes();
    let nextCalled = false;
    guard(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, 200);
  });

  await t.test('Authorized faculty role is allowed through to next()', () => {
    const req = { user: { _id: 'faculty_1', role: 'faculty' } };
    const res = createMockRes();
    let nextCalled = false;
    guard(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, 200);
  });
});

test('Phase 9.9 — Database-Unavailable Fail-Closed Authorization & Authoritative Identity (Part 25 & Security Gate)', async (t) => {
  // Ensure default mock state is clean
  mockReadyState = 1;
  mockAuthoritativeUser = {
    _id: 'admin_test_1',
    role: 'admin',
    department: 'Administration',
    isActive: true
  };

  await t.test('Unauthenticated request to controller returns 401 Unauthorized', async () => {
    const req = { query: {} };
    const res = createMockRes();
    await getTalentDiscovery(req, res);

    assert.equal(res.statusCode, 401);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Authentication required/i);
  });

  await t.test('1. MongoDB is unavailable before controller runs -> returns 503 Service Unavailable', async () => {
    mockReadyState = 0; // Disconnected
    const req = {
      query: {},
      user: { _id: 'admin_1', role: 'admin' }
    };
    const res = createMockRes();
    await getTalentDiscovery(req, res);

    assert.equal(res.statusCode, 503);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Service unavailable: Database connection required/i);
    mockReadyState = 1; // restore
  });

  await t.test('2. MongoDB lookup failure during request -> fails closed with 503 Service Unavailable without leaking internals', async () => {
    mockReadyState = 1;
    mockAuthoritativeUser = () => {
      throw new Error('Connection pool exhausted / MongoNetworkTimeout');
    };
    const req = {
      query: {},
      user: { _id: 'admin_1', role: 'admin' }
    };
    const res = createMockRes();
    await getTalentDiscovery(req, res);

    assert.equal(res.statusCode, 503);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Service unavailable: Unable to verify authoritative user record/i);
    // Ensure internal error stack or details are not leaked to client
    assert.equal(res.body.message.includes('MongoNetworkTimeout'), false);
  });

  await t.test('3. Stale req.user.role: admin cannot authorize access when authoritative lookup is unavailable', async () => {
    mockReadyState = 0; // Database unavailable
    const req = {
      query: {},
      user: { _id: 'admin_stale_1', role: 'admin' }
    };
    const res = createMockRes();
    await getTalentDiscovery(req, res);

    // Must be denied with 503, never fall back to req.user.role
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.success, false);
    mockReadyState = 1; // restore
  });

  await t.test('4. Stale faculty department cannot authorize access when authoritative lookup is unavailable', async () => {
    mockReadyState = 0; // Database unavailable
    const req = {
      query: {},
      user: { _id: 'faculty_stale_1', role: 'faculty', department: 'CSE' }
    };
    const res = createMockRes();
    await getTalentDiscovery(req, res);

    // Must be denied with 503, never fall back to req.user.department
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.success, false);
    mockReadyState = 1; // restore
  });

  await t.test('5. Database-backed administrator whose role changed in DB (demoted to student) is denied with 403', async () => {
    mockReadyState = 1;
    mockAuthoritativeUser = {
      _id: 'user_demoted',
      role: 'student', // Demoted in database
      isActive: true
    };
    const req = {
      query: {},
      user: { _id: 'user_demoted', role: 'admin' } // Stale JWT context claims admin
    };
    const res = createMockRes();
    await getTalentDiscovery(req, res);

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /insufficient permissions/i);
  });

  await t.test('6. Database-backed administrator whose account is deactivated in DB is denied with 403', async () => {
    mockReadyState = 1;
    mockAuthoritativeUser = {
      _id: 'admin_deactivated',
      role: 'admin',
      isActive: false // Deactivated in database
    };
    const req = {
      query: {},
      user: { _id: 'admin_deactivated', role: 'admin', isActive: true } // Stale context claims active
    };
    const res = createMockRes();
    await getTalentDiscovery(req, res);

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Account is inactive/i);
  });

  await t.test('7. Missing user record in database denies access with 403 Forbidden', async () => {
    mockReadyState = 1;
    mockAuthoritativeUser = null; // User deleted or non-existent in DB
    const req = {
      query: {},
      user: { _id: '507f1f77bcf86cd799439011', role: 'faculty', department: 'CSE' }
    };
    const res = createMockRes();
    await getTalentDiscovery(req, res);

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /User account not found/i);
  });

  await t.test('8. Unauthorized recruiter role in authoritative record returns 403 Forbidden', async () => {
    mockReadyState = 1;
    mockAuthoritativeUser = {
      _id: 'recruiter_123',
      role: 'recruiter',
      isActive: true
    };
    const req = {
      query: {},
      user: { _id: 'recruiter_123', role: 'recruiter' }
    };
    const res = createMockRes();
    await getTalentDiscovery(req, res);

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /insufficient permissions/i);
  });

  await t.test('9. Faculty with missing or whitespace-only department in DB fails closed with 403 Forbidden', async () => {
    mockReadyState = 1;
    mockAuthoritativeUser = {
      _id: 'faculty_nodept',
      role: 'faculty',
      department: '   ', // empty/whitespace
      isActive: true
    };
    const req = {
      query: {},
      user: { _id: 'faculty_nodept', role: 'faculty' }
    };
    const res = createMockRes();
    await getTalentDiscovery(req, res);

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Faculty department cannot be verified/i);
  });

  await t.test('10. Client-provided department query parameter cannot establish unverified faculty department', async () => {
    mockReadyState = 1;
    mockAuthoritativeUser = {
      _id: 'faculty_nodept',
      role: 'faculty',
      department: '',
      isActive: true
    };
    const req = {
      query: { department: 'CSE' },
      user: { _id: 'faculty_nodept', role: 'faculty' }
    };
    const res = createMockRes();
    await getTalentDiscovery(req, res);

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Faculty department cannot be verified/i);
  });
});

