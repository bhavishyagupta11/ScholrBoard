import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import mongoose from 'mongoose';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const STUDENT_EMAIL = 'e2e.student@scholrboard.test';
const ADMIN_EMAIL = 'e2e.admin@scholrboard.test';
const PASSWORD = 'TestPass123!';
const API_BASE = 'http://localhost:5000/api';

async function setupDatabase() {
  await mongoose.connect(process.env.MONGODB_URI_TEST);
  const dbName = mongoose.connection.db.databaseName;
  if (dbName !== 'scholrboard_test') {
    await mongoose.disconnect();
    throw new Error('CRITICAL SAFETY ERROR: Execution is only allowed on the test database "scholrboard_test". Currently connected to: "' + dbName + '". Execution aborted!');
  }

  console.log('📦 Connected to MongoDB for test prep.');

  const UserSchema = new mongoose.Schema({}, { strict: false });
  const User = mongoose.model('User', UserSchema, 'users');
  const ProfileSchema = new mongoose.Schema({}, { strict: false });
  const Profile = mongoose.model('Profile', ProfileSchema, 'profiles');
  const ResumeAnalysisSchema = new mongoose.Schema({}, { strict: false });
  const ResumeAnalysis = mongoose.model('ResumeAnalysis', ResumeAnalysisSchema, 'resumeanalyses');

  const student = await User.findOne({ email: STUDENT_EMAIL });
  if (!student) {
    throw new Error('Student user not found! Run seed first.');
  }

  // Set student profile handles, reset cooldowns and clear any existing locks
  const profile = await Profile.findOneAndUpdate(
    { userId: student._id },
    {
      $set: {
        'codingStats.profiles.github': 'gaearon',
        'codingStats.profiles.leetcode': 'tourist',
        'codingStats.profiles.codeforces': 'tourist',
        'codingStats.githubLastSyncedAt': null,
        'codingStats.leetcodeLastSyncedAt': null,
        'codingStats.codeforcesLastSyncedAt': null,
        'codingStats.lastSyncedAt': null,
        'codingStats.isSyncing': false,
        'codingStats.syncStartedAt': null,
        'lastSyncStatus': null,
        'consecutiveSyncFailures': 0,
      }
    },
    { new: true, upsert: true }
  );
  console.log('✅ Student profile handles set, cooldowns and locks cleared.');

  // Create a resume analysis if none exists for this student
  const analysisCount = await ResumeAnalysis.countDocuments({ userId: student._id });
  if (analysisCount === 0) {
    await ResumeAnalysis.create({
      userId: student._id,
      fileUrl: 'https://res.cloudinary.com/demo/image/upload/v1580976378/sample.pdf',
      fileName: 'test-resume.pdf',
      fileSize: 102456,
      mimeType: 'application/pdf',
      overallScore: 85,
      atsScore: 78,
      summary: 'Strong engineering resume with solid backend and frontend experience.',
      strengths: ['JavaScript proficiency', 'Database indexing knowledge'],
      improvements: ['Add more metrics in achievement sections'],
      skillsDetected: ['Node.js', 'React', 'MongoDB', 'JavaScript'],
      recommendedRoles: ['Frontend Developer', 'Software Engineer'],
      analysisStatus: 'completed',
      isCurrent: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log('✅ Mock ResumeAnalysis seeded.');
  } else {
    console.log('✅ Existing ResumeAnalysis found, skipping seeding.');
  }

  await mongoose.disconnect();
}

async function callEndpoint(method, pathUrl, token, payload = null) {
  const timestamp = new Date().toISOString();
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  };
  if (payload) {
    options.body = JSON.stringify(payload);
  }

  const response = await fetch(`${API_BASE}${pathUrl}`, options);
  const status = response.status;
  const data = await response.json().catch(() => ({}));

  return {
    method,
    endpoint: pathUrl,
    requestPayload: payload || 'No Payload',
    responsePayload: data,
    statusCode: status,
    timestamp
  };
}

async function runTests() {
  try {
    // 1. Database setup
    await setupDatabase();

    // 2. Obtain tokens by logging in
    console.log('\n🔐 Logging in users to obtain fresh tokens...');
    const studentLogin = await callEndpoint('POST', '/auth/login', null, { email: STUDENT_EMAIL, password: PASSWORD });
    const studentToken = studentLogin.responsePayload.token;
    const studentId = studentLogin.responsePayload.user._id;
    
    const adminLogin = await callEndpoint('POST', '/auth/login', null, { email: ADMIN_EMAIL, password: PASSWORD });
    const adminToken = adminLogin.responsePayload.token;

    if (!studentToken || !adminToken) {
      throw new Error('Login failed, tokens are missing.');
    }
    console.log('✅ Tokens obtained successfully.');

    const results = [];

    // Endpoint 1: POST /api/developer/sync/github
    console.log('\n🚀 Testing: POST /api/developer/sync/github ...');
    const githubResult = await callEndpoint('POST', '/developer/sync/github', studentToken);
    results.push(githubResult);
    
    // Connect, reset, disconnect for LeetCode
    await mongoose.connect(process.env.MONGODB_URI_TEST);
  let dbName = mongoose.connection.db.databaseName;
  if (dbName !== 'scholrboard_test') {
    await mongoose.disconnect();
    throw new Error('CRITICAL SAFETY ERROR: Execution is only allowed on the test database "scholrboard_test". Currently connected to: "' + dbName + '". Execution aborted!');
  }

    await mongoose.model('Profile').updateOne(
      { userId: new mongoose.Types.ObjectId(studentId) },
      { $set: { 
        'codingStats.leetcodeLastSyncedAt': null, 
        'codingStats.lastSyncedAt': null,
        'codingStats.isSyncing': false,
        'codingStats.syncStartedAt': null
      } }
    );
    await mongoose.disconnect();

    // Endpoint 2: POST /api/developer/sync/leetcode
    console.log('🚀 Testing: POST /api/developer/sync/leetcode ...');
    const leetcodeResult = await callEndpoint('POST', '/developer/sync/leetcode', studentToken);
    results.push(leetcodeResult);

    // Connect, reset, disconnect for Codeforces
    await mongoose.connect(process.env.MONGODB_URI_TEST);
  dbName = mongoose.connection.db.databaseName;
  if (dbName !== 'scholrboard_test') {
    await mongoose.disconnect();
    throw new Error('CRITICAL SAFETY ERROR: Execution is only allowed on the test database "scholrboard_test". Currently connected to: "' + dbName + '". Execution aborted!');
  }

    await mongoose.model('Profile').updateOne(
      { userId: new mongoose.Types.ObjectId(studentId) },
      { $set: { 
        'codingStats.codeforcesLastSyncedAt': null, 
        'codingStats.lastSyncedAt': null,
        'codingStats.isSyncing': false,
        'codingStats.syncStartedAt': null
      } }
    );
    await mongoose.disconnect();

    // Endpoint 3: POST /api/developer/sync/codeforces
    console.log('🚀 Testing: POST /api/developer/sync/codeforces ...');
    const codeforcesResult = await callEndpoint('POST', '/developer/sync/codeforces', studentToken);
    results.push(codeforcesResult);

    // Connect, reset, disconnect for All
    await mongoose.connect(process.env.MONGODB_URI_TEST);
  dbName = mongoose.connection.db.databaseName;
  if (dbName !== 'scholrboard_test') {
    await mongoose.disconnect();
    throw new Error('CRITICAL SAFETY ERROR: Execution is only allowed on the test database "scholrboard_test". Currently connected to: "' + dbName + '". Execution aborted!');
  }

    await mongoose.model('Profile').updateOne(
      { userId: new mongoose.Types.ObjectId(studentId) },
      { $set: { 
        'codingStats.githubLastSyncedAt': null,
        'codingStats.leetcodeLastSyncedAt': null,
        'codingStats.codeforcesLastSyncedAt': null,
        'codingStats.lastSyncedAt': null,
        'codingStats.isSyncing': false,
        'codingStats.syncStartedAt': null
      } }
    );
    await mongoose.disconnect();

    // Endpoint 4: POST /api/developer/sync/all
    console.log('🚀 Testing: POST /api/developer/sync/all ...');
    const allResult = await callEndpoint('POST', '/developer/sync/all', studentToken);
    results.push(allResult);

    // Endpoint 5: GET /api/users/talent-discovery
    console.log('🚀 Testing: GET /api/users/talent-discovery ...');
    const talentResult = await callEndpoint('GET', '/users/talent-discovery', adminToken);
    results.push(talentResult);

    // Endpoint 6: GET /api/upload/resume/analyses
    console.log('🚀 Testing: GET /api/upload/resume/analyses ...');
    const resumeResult = await callEndpoint('GET', '/upload/resume/analyses', studentToken);
    results.push(resumeResult);

    // Write to brain artifact folder
    const outputPath = 'C:\\Users\\Sbhav\\.gemini\\antigravity\\brain\\130c8d93-91db-40e6-86d1-4bf98d79b24a\\backend-test-results.json';
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`\n🎉 All tests completed successfully. Results saved to: ${outputPath}`);

  } catch (error) {
    console.error('❌ Test execution failed:', error);
  }
}

runTests();
