import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../server/.env') });

const { default: mongoose } = await import('../../server/node_modules/mongoose/index.js');
const { default: User } = await import('../../server/models/User.js');
const { default: Profile } = await import('../../server/models/Profile.js');
const { default: ResumeAnalysis } = await import('../../server/models/ResumeAnalysis.js');
const { default: requireRole } = await import('../../server/middleware/roleAuth.js');
const { getTalentDiscovery } = await import('../../server/controllers/talentDiscoveryController.js');
const { getProfileByUserId, getMyProfile } = await import('../../server/controllers/profileController.js');

// Mock response creator
const createMockRes = () => {
  const res = {
    statusCode: 200,
    headers: {},
    jsonData: null,
    status: function (code) {
      this.statusCode = code;
      return this;
    },
    json: function (data) {
      this.jsonData = data;
      return this;
    }
  };
  return res;
};

const assert = (expr, msg) => {
  if (!expr) throw new Error(msg);
};

async function runTests() {
  const mongoUri = process.env.MONGODB_URI_TEST;
  await mongoose.connect(mongoUri);
  const dbName = mongoose.connection.db.databaseName;
  if (dbName !== 'scholrboard_test') {
    await mongoose.disconnect();
    throw new Error('CRITICAL SAFETY ERROR: Execution is only allowed on the test database "scholrboard_test". Currently connected to: "' + dbName + '". Execution aborted!');
  }

  console.log('Connected to database for testing.');

  // Clean up any stale test accounts from previous runs
  await User.deleteMany({ email: /.*_test_student.*@scholrboard\.com/ });

  const results = [];
  const createdUserIds = [];

  // Helper to register results
  const logResult = (name, passed, error = null) => {
    results.push({ name, passed, ...(error && { error }) });
    console.log(` - [${passed ? '✅ PASSED' : '❌ FAILED'}] ${name}${error ? ` (Error: ${error})` : ''}`);
  };

  console.log('Running Talent Discovery API & Security Tests...');

  // ─── TEST 1: ADMIN ACCESS ALLOWED ──────────────────────────────────────────
  try {
    const adminCheck = requireRole('admin');
    const req = { user: { role: 'admin' } };
    const res = createMockRes();
    let nextCalled = false;
    adminCheck(req, res, () => { nextCalled = true; });

    assert(nextCalled === true, 'Admin should bypass role protection');
    logResult('Security - Admin access allowed', true);
  } catch (err) {
    logResult('Security - Admin access allowed', false, err.message);
  }

  // ─── TEST 2: FACULTY ACCESS BLOCKED ─────────────────────────────────────────
  try {
    const adminCheck = requireRole('admin');
    const req = { user: { role: 'faculty' } };
    const res = createMockRes();
    let nextCalled = false;
    adminCheck(req, res, () => { nextCalled = true; });

    assert(nextCalled === false, 'Faculty should not bypass admin protection');
    assert(res.statusCode === 403, `Expected status 403, got ${res.statusCode}`);
    logResult('Security - Faculty access blocked', true);
  } catch (err) {
    logResult('Security - Faculty access blocked', false, err.message);
  }

  // ─── TEST 3: STUDENT ACCESS BLOCKED ─────────────────────────────────────────
  try {
    const adminCheck = requireRole('admin');
    const req = { user: { role: 'student' } };
    const res = createMockRes();
    let nextCalled = false;
    adminCheck(req, res, () => { nextCalled = true; });

    assert(nextCalled === false, 'Student should not bypass admin protection');
    assert(res.statusCode === 403, `Expected status 403, got ${res.statusCode}`);
    logResult('Security - Student access blocked', true);
  } catch (err) {
    logResult('Security - Student access blocked', false, err.message);
  }

  // ─── TEST 4: INVALID SORT FIELDS REJECTED ────────────────────────────────────
  try {
    const req = {
      user: { role: 'admin', _id: new mongoose.Types.ObjectId() },
      query: { sortBy: 'password' }
    };
    const res = createMockRes();
    await getTalentDiscovery(req, res);

    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    assert(res.jsonData.message === 'Validation failed', 'Should return validation failed');
    assert(res.jsonData.errors.some(e => e.includes('sortBy')), 'Should specify sortBy validation error');
    logResult('Validation - Reject invalid sort fields', true);
  } catch (err) {
    logResult('Validation - Reject invalid sort fields', false, err.message);
  }

  // ─── TEST 5: INVALID SORT ORDER REJECTED ─────────────────────────────────────
  try {
    const req = {
      user: { role: 'admin', _id: new mongoose.Types.ObjectId() },
      query: { sortOrder: 'sideways' }
    };
    const res = createMockRes();
    await getTalentDiscovery(req, res);

    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    assert(res.jsonData.errors.some(e => e.includes('sortOrder')), 'Should specify sortOrder validation error');
    logResult('Validation - Reject invalid sort order', true);
  } catch (err) {
    logResult('Validation - Reject invalid sort order', false, err.message);
  }

  // ─── TEST 6: NON-NUMERIC FILTERS REJECTED ────────────────────────────────────
  try {
    const req = {
      user: { role: 'admin', _id: new mongoose.Types.ObjectId() },
      query: { gpaMin: 'nine point five' }
    };
    const res = createMockRes();
    await getTalentDiscovery(req, res);

    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    assert(res.jsonData.errors.some(e => e.includes('gpaMin must be a number')), 'Should reject non-numeric GPA');
    logResult('Validation - Reject non-numeric filters', true);
  } catch (err) {
    logResult('Validation - Reject non-numeric filters', false, err.message);
  }

  // ─── TEST 7: ARRAY INPUTS REJECTED WHERE SCALARS EXPECTED ────────────────────
  try {
    const req = {
      user: { role: 'admin', _id: new mongoose.Types.ObjectId() },
      query: { year: [1, 2] }
    };
    const res = createMockRes();
    await getTalentDiscovery(req, res);

    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    assert(res.jsonData.errors.some(e => e.includes('year cannot be an array or object')), 'Should reject array input');
    logResult('Validation - Reject array inputs where scalars expected', true);
  } catch (err) {
    logResult('Validation - Reject array inputs where scalars expected', false, err.message);
  }

  // ─── TEST 8: OBJECTS REJECTED (NOSQL INJECTION) ──────────────────────────────
  try {
    const req = {
      user: { role: 'admin', _id: new mongoose.Types.ObjectId() },
      query: { search: { $gt: '' } }
    };
    const res = createMockRes();
    await getTalentDiscovery(req, res);

    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    assert(res.jsonData.errors.some(e => e.includes('search must be a plain string')), 'Should reject object values');
    logResult('Validation - Reject object structures (NoSQL injection block)', true);
  } catch (err) {
    logResult('Validation - Reject object structures (NoSQL injection block)', false, err.message);
  }

  // ─── TEST 9: FACULTY PROFILE SCRUBBING VERIFIED ──────────────────────────────
  try {
    const studentId = new mongoose.Types.ObjectId();
    const facultyId = new mongoose.Types.ObjectId();
    createdUserIds.push(studentId);

    const studentUser = await User.create({
      _id: studentId,
      name: 'Faculty Test Student',
      email: 'faculty_test_student_' + Date.now() + '@scholrboard.com',
      password: 'password123',
      role: 'student',
      department: 'CSE',
      semester: 6,
      isActive: true
    });

    const studentProfile = await Profile.create({
      userId: studentId,
      gpa: 8.5,
      developerScore: 75,
      githubScore: 80,
      dsaScore: 70,
      cpScore: 60,
      codingStats: {
        profiles: { github: 'faculty_test_student' }
      }
    });

    // 1. Test getProfileByUserId for faculty
    const reqGet = {
      user: { role: 'faculty', department: 'CSE' },
      params: { userId: studentId.toString() }
    };
    const resGet = createMockRes();
    await getProfileByUserId(reqGet, resGet);

    assert(resGet.statusCode === 200, `Expected 200, got ${resGet.statusCode}`);
    const scrubbedProfile = resGet.jsonData.profile;
    assert(scrubbedProfile.developerScore === undefined, 'developerScore must be scrubbed');
    assert(scrubbedProfile.githubScore === undefined, 'githubScore must be scrubbed');
    assert(scrubbedProfile.dsaScore === undefined, 'dsaScore must be scrubbed');
    assert(scrubbedProfile.cpScore === undefined, 'cpScore must be scrubbed');
    assert(scrubbedProfile.codingStats === undefined, 'codingStats must be scrubbed');

    // 2. Test getMyProfile for faculty (where faculty requests their own profile)
    const facultyProfile = await Profile.create({
      userId: facultyId,
      developerScore: 99 // mock
    });
    createdUserIds.push(facultyId);

    const reqMe = {
      user: { _id: facultyId, role: 'faculty' }
    };
    const resMe = createMockRes();
    await getMyProfile(reqMe, resMe);

    assert(resMe.statusCode === 200, `Expected 200, got ${resMe.statusCode}`);
    const scrubbedMe = resMe.jsonData.profile;
    assert(scrubbedMe.developerScore === undefined, 'faculty own developerScore must be scrubbed');

    // Clean up
    await Profile.deleteMany({ userId: { $in: [studentId, facultyId] } });
    await User.deleteMany({ _id: { $in: [studentId, facultyId] } });

    logResult('Security - Faculty profile metrics scrubbing', true);
  } catch (err) {
    logResult('Security - Faculty profile metrics scrubbing', false, err.message);
  }

  // ─── TEST 10: SKILL FILTERS WORK ────────────────────────────────────────────
  try {
    const studentId = new mongoose.Types.ObjectId();
    createdUserIds.push(studentId);

    await User.create({
      _id: studentId,
      name: 'Skill Test Student',
      email: 'skill_test_student_' + Date.now() + '@scholrboard.com',
      password: 'password123',
      role: 'student',
      department: 'CSE',
      semester: 6,
      isActive: true
    });

    await Profile.create({
      userId: studentId,
      gpa: 8.5,
      developerScore: 75,
      skills: ['react', 'node', 'mongodb']
    });

    // Case A: Query matches exact skill set
    const reqMatch = {
      user: { role: 'admin', _id: new mongoose.Types.ObjectId() },
      query: { skills: 'react,node' }
    };
    const resMatch = createMockRes();
    await getTalentDiscovery(reqMatch, resMatch);

    assert(resMatch.statusCode === 200, `Expected 200, got ${resMatch.statusCode}`);
    const matchesA = resMatch.jsonData.data.filter(u => u._id.toString() === studentId.toString());
    assert(matchesA.length === 1, 'Should find student with react and node');

    // Case B: Query requires skill student lacks
    const reqMismatch = {
      user: { role: 'admin', _id: new mongoose.Types.ObjectId() },
      query: { skills: 'react,python' }
    };
    const resMismatch = createMockRes();
    await getTalentDiscovery(reqMismatch, resMismatch);

    assert(resMismatch.statusCode === 200, `Expected 200, got ${resMismatch.statusCode}`);
    const matchesB = resMismatch.jsonData.data.filter(u => u._id.toString() === studentId.toString());
    assert(matchesB.length === 0, 'Should not find student missing python');

    // Clean up
    await Profile.deleteOne({ userId: studentId });
    await User.deleteOne({ _id: studentId });

    logResult('Query - Multi-skill search and filter', true);
  } catch (err) {
    logResult('Query - Multi-skill search and filter', false, err.message);
  }

  // ─── TEST 11: RESUME FILTERS WORK ───────────────────────────────────────────
  try {
    const studentId = new mongoose.Types.ObjectId();
    createdUserIds.push(studentId);

    await User.create({
      _id: studentId,
      name: 'Resume Test Student',
      email: 'resume_test_student_' + Date.now() + '@scholrboard.com',
      password: 'password123',
      role: 'student',
      department: 'CSE',
      semester: 6,
      isActive: true
    });

    await Profile.create({
      userId: studentId,
      gpa: 8.5,
      developerScore: 75
    });

    await ResumeAnalysis.create({
      userId: studentId,
      fileUrl: 'https://cloudinary.com/resume.pdf',
      atsScore: 82,
      isCurrent: true,
      analysisStatus: 'completed'
    });

    // Case A: Query fits within ATS min bound
    const reqMatch = {
      user: { role: 'admin', _id: new mongoose.Types.ObjectId() },
      query: { hasResumeAnalysis: 'true', atsScoreMin: 80 }
    };
    const resMatch = createMockRes();
    await getTalentDiscovery(reqMatch, resMatch);

    assert(resMatch.statusCode === 200, `Expected 200, got ${resMatch.statusCode}`);
    const matchesA = resMatch.jsonData.data.filter(u => u._id.toString() === studentId.toString());
    assert(matchesA.length === 1, 'Should match student with ATS score 82');

    // Case B: Query exceeds student's ATS score
    const reqMismatch = {
      user: { role: 'admin', _id: new mongoose.Types.ObjectId() },
      query: { hasResumeAnalysis: 'true', atsScoreMin: 90 }
    };
    const resMismatch = createMockRes();
    await getTalentDiscovery(reqMismatch, resMismatch);

    assert(resMismatch.statusCode === 200, `Expected 200, got ${resMismatch.statusCode}`);
    const matchesB = resMismatch.jsonData.data.filter(u => u._id.toString() === studentId.toString());
    assert(matchesB.length === 0, 'Should not match student since ATS score is lower than 90');

    // Clean up
    await ResumeAnalysis.deleteOne({ userId: studentId });
    await Profile.deleteOne({ userId: studentId });
    await User.deleteOne({ _id: studentId });

    logResult('Query - Resume analysis ATS filtering', true);
  } catch (err) {
    logResult('Query - Resume analysis ATS filtering', false, err.message);
  }

  // ─── FINAL CLEAN UP AND EXIT ───────────────────────────────────────────────
  await mongoose.disconnect();
  console.log('Database disconnected. Testing completed.');

  const failed = results.filter(r => !r.passed);
  if (failed.length > 0) {
    console.error(`\n❌ SECURITY & REGRESSION TESTING FAILED with ${failed.length} errors!`);
    process.exit(1);
  } else {
    console.log('\n✅ ALL SECURITY & REGRESSION TESTING SCENARIOS PASSED SUCCESSFULLY!');
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
