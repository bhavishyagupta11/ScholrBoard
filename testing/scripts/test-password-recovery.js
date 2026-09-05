/**
 * test-password-recovery.js
 * Comprehensive automated verification for ScholrBoard password recovery.
 */
import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import '../../server/config/env.js';
import connectDB from '../../server/config/db.js';
import User from '../../server/models/User.js';
import { forgotPassword, resetPassword } from '../../server/controllers/authController.js';

function mockReqRes(body = {}) {
  const req = { body };
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
    },
  };
  return { req, res };
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('   SCHOLRBOARD PASSWORD RECOVERY VERIFICATION SUITE   ');
  console.log('======================================================\n');

  await connectDB();
  console.log(`Connected to MongoDB. readyState: ${mongoose.connection.readyState}\n`);

  const testStudentEmail = `test.student.${Date.now()}@college.edu`;
  const testFacultyEmail = `test.faculty.${Date.now()}@college.edu`;
  const testAdminEmail = `test.admin.${Date.now()}@college.edu`;
  const initialPassword = 'InitialPass123!';

  let testStudent, testFaculty, testAdmin;

  try {
    // -----------------------------------------------------------------
    // TEST GROUP 1: User Schema checks
    // -----------------------------------------------------------------
    console.log('[1] Testing User Schema definitions');
    assert(User.schema.paths.resetPasswordToken !== undefined, 'resetPasswordToken path exists in User schema');
    assert(User.schema.paths.resetPasswordExpires !== undefined, 'resetPasswordExpires path exists in User schema');

    // Create test accounts
    testStudent = await User.create({
      name: 'Test Student Recovery',
      email: testStudentEmail,
      password: initialPassword,
      role: 'student',
      studentId: `STU-REC-${Date.now()}`,
      department: 'CSE',
      semester: 4,
    });

    testFaculty = await User.create({
      name: 'Test Faculty Recovery',
      email: testFacultyEmail,
      password: initialPassword,
      role: 'faculty',
      facultyId: `FAC-REC-${Date.now()}`,
      department: 'CSE',
    });

    testAdmin = await User.create({
      name: 'Test Admin Recovery',
      email: testAdminEmail,
      password: initialPassword,
      role: 'admin',
    });

    // -----------------------------------------------------------------
    // TEST GROUP 2: Anti-Enumeration for non-existent email
    // -----------------------------------------------------------------
    console.log('\n[2] Testing Anti-Enumeration');
    {
      const { req, res } = mockReqRes({
        email: 'doesnotexist999@college.edu',
        portalRole: 'student',
      });
      await forgotPassword(req, res);
      assert(res.statusCode === 200, 'Non-existent email returns status 200');
      assert(res.body.success === true, 'Non-existent email returns success: true');
      assert(
        res.body.message === 'If an account is associated with that email, a password reset link has been sent.',
        'Non-existent email returns generic message'
      );
    }

    // -----------------------------------------------------------------
    // TEST GROUP 3: Student Forgot Password & Reset Flow
    // -----------------------------------------------------------------
    console.log('\n[3] Testing Student Password Recovery Flow');
    let studentRawToken;
    {
      // 3.1 Forgot password request
      const { req, res } = mockReqRes({
        email: testStudentEmail,
        portalRole: 'student',
      });
      await forgotPassword(req, res);
      assert(res.statusCode === 200, 'Student forgot password request returns status 200');
      assert(res.body.success === true, 'Student request returns success: true');
      assert(
        res.body.message === 'If an account is associated with that email, a password reset link has been sent.',
        'Student request returns exact generic anti-enumeration message'
      );

      // Verify token in DB
      const userInDb = await User.findById(testStudent._id).select('+resetPasswordToken +resetPasswordExpires');
      assert(!!userInDb.resetPasswordToken, 'Hashed token stored in database');
      assert(userInDb.resetPasswordToken.length === 64, 'Stored token is a 64-character SHA-256 hex string');
      assert(!!userInDb.resetPasswordExpires, 'Expiration timestamp is stored in database');

      const timeUntilExpiry = (userInDb.resetPasswordExpires.getTime() - Date.now()) / (1000 * 60);
      assert(timeUntilExpiry > 14 && timeUntilExpiry <= 15.1, `Expiration is set to ~15 minutes (${timeUntilExpiry.toFixed(1)}m remaining)`);

      // To test resetPassword, generate matching rawToken by setting a known one
      studentRawToken = crypto.randomBytes(32).toString('hex');
      const testHash = crypto.createHash('sha256').update(studentRawToken).digest('hex');
      userInDb.resetPasswordToken = testHash;
      userInDb.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);
      await userInDb.save();
    }

    {
      // 3.2 Reset password with short password
      const { req, res } = mockReqRes({
        token: studentRawToken,
        password: 'short',
      });
      await resetPassword(req, res);
      assert(res.statusCode === 400, 'Short password (< 8 chars) rejected with 400');
    }

    {
      // 3.3 Reset password with invalid token
      const { req, res } = mockReqRes({
        token: 'invalid_token_12345',
        password: 'ValidNewPassword123!',
      });
      await resetPassword(req, res);
      assert(res.statusCode === 400, 'Invalid token rejected with 400');
      assert(res.body.message.includes('invalid or has expired'), 'Returns safe invalid/expired error message');
    }

    {
      // 3.4 Reset password with valid token
      const newPassword = 'NewStudentPass123!';
      const { req, res } = mockReqRes({
        token: studentRawToken,
        password: newPassword,
      });
      await resetPassword(req, res);
      assert(res.statusCode === 200, 'Valid reset request succeeds with status 200');
      assert(res.body.success === true, 'Response contains success: true');

      // Verify token cleared (Single-Use)
      const updatedUser = await User.findById(testStudent._id).select('+password +resetPasswordToken +resetPasswordExpires');
      assert(updatedUser.resetPasswordToken === null, 'resetPasswordToken is cleared (null) after reset');
      assert(updatedUser.resetPasswordExpires === null, 'resetPasswordExpires is cleared (null) after reset');

      // Verify password changed and hashed with bcrypt
      assert(updatedUser.password !== newPassword, 'New password is not stored in plaintext');
      assert(await updatedUser.comparePassword(newPassword), 'New password verifies correctly via comparePassword');
      assert(!(await updatedUser.comparePassword(initialPassword)), 'Old password no longer verifies');
    }

    {
      // 3.5 Token Replay / Single-Use Protection
      const { req, res } = mockReqRes({
        token: studentRawToken,
        password: 'AnotherPassword123!',
      });
      await resetPassword(req, res);
      assert(res.statusCode === 400, 'Reusing consumed token rejected with 400');
    }

    // -----------------------------------------------------------------
    // TEST GROUP 4: Token Expiration
    // -----------------------------------------------------------------
    console.log('\n[4] Testing Token Expiry Rejection');
    {
      const expiredRawToken = crypto.randomBytes(32).toString('hex');
      const expiredHash = crypto.createHash('sha256').update(expiredRawToken).digest('hex');

      await User.findByIdAndUpdate(testStudent._id, {
        $set: {
          resetPasswordToken: expiredHash,
          resetPasswordExpires: new Date(Date.now() - 5000), // expired 5 seconds ago
        },
      });

      const { req, res } = mockReqRes({
        token: expiredRawToken,
        password: 'AnotherPassword123!',
      });
      await resetPassword(req, res);
      assert(res.statusCode === 400, 'Expired token rejected with 400');
      assert(res.body.message.includes('invalid or has expired'), 'Expired token returns invalid or expired message');
    }

    // -----------------------------------------------------------------
    // TEST GROUP 5: Faculty Password Recovery Flow
    // -----------------------------------------------------------------
    console.log('\n[5] Testing Faculty Password Recovery Flow');
    {
      const { req, res } = mockReqRes({
        email: testFacultyEmail,
        portalRole: 'faculty',
      });
      await forgotPassword(req, res);
      assert(res.statusCode === 200, 'Faculty forgot password request returns status 200');
      assert(res.body.success === true, 'Faculty request returns success: true');

      const facultyRawToken = crypto.randomBytes(32).toString('hex');
      const facultyHash = crypto.createHash('sha256').update(facultyRawToken).digest('hex');

      await User.findByIdAndUpdate(testFaculty._id, {
        $set: {
          resetPasswordToken: facultyHash,
          resetPasswordExpires: new Date(Date.now() + 15 * 60 * 1000),
        },
      });

      const newFacultyPassword = 'NewFacultyPass123!';
      const resetReqRes = mockReqRes({
        token: facultyRawToken,
        password: newFacultyPassword,
      });
      await resetPassword(resetReqRes.req, resetReqRes.res);
      assert(resetReqRes.res.statusCode === 200, 'Faculty password reset succeeds with 200');

      const updatedFaculty = await User.findById(testFaculty._id).select('+password +resetPasswordToken');
      assert(updatedFaculty.resetPasswordToken === null, 'Faculty reset token is cleared');
      assert(await updatedFaculty.comparePassword(newFacultyPassword), 'Faculty new password works');
      assert(!(await updatedFaculty.comparePassword(initialPassword)), 'Faculty old password fails');
    }

    // -----------------------------------------------------------------
    // TEST GROUP 6: Admin Exclusion & Rejection
    // -----------------------------------------------------------------
    console.log('\n[6] Testing Admin Exclusion & Backend Guard');
    {
      // 6.1 Admin portalRole rejected
      const { req, res } = mockReqRes({
        email: testAdminEmail,
        portalRole: 'admin',
      });
      await forgotPassword(req, res);
      assert(res.statusCode === 200, 'Admin request returns generic 200 (Anti-Enumeration)');
      assert(res.body.message.includes('password reset link has been sent'), 'Generic success message shown');

      const adminInDb = await User.findById(testAdmin._id).select('+resetPasswordToken');
      assert(adminInDb.resetPasswordToken === null, 'Admin document has NO resetPasswordToken generated');

      // 6.2 Admin email submitted with portalRole: student
      const req2 = mockReqRes({
        email: testAdminEmail,
        portalRole: 'student',
      });
      await forgotPassword(req2.req, req2.res);
      assert(req2.res.statusCode === 200, 'Admin with student portalRole returns generic 200');

      const adminInDb2 = await User.findById(testAdmin._id).select('+resetPasswordToken');
      assert(adminInDb2.resetPasswordToken === null, 'Admin document still has NO resetPasswordToken generated');

      // 6.3 Even if admin document somehow had a token, resetPassword rejects admin
      const adminRawToken = crypto.randomBytes(32).toString('hex');
      const adminHash = crypto.createHash('sha256').update(adminRawToken).digest('hex');
      await User.findByIdAndUpdate(testAdmin._id, {
        $set: {
          resetPasswordToken: adminHash,
          resetPasswordExpires: new Date(Date.now() + 15 * 60 * 1000),
        },
      });

      const req3 = mockReqRes({
        token: adminRawToken,
        password: 'AttemptAdminPass123!',
      });
      await resetPassword(req3.req, req3.res);
      assert(req3.res.statusCode === 400, 'Admin account explicitly rejected by resetPassword');
      assert(await testAdmin.comparePassword(initialPassword), 'Admin original password remains intact');
    }

    // -----------------------------------------------------------------
    // TEST GROUP 7: Portal-Role Parity & Isolation
    // -----------------------------------------------------------------
    console.log('\n[7] Testing Portal-Role Parity & Isolation');
    {
      // Clear tokens first to guarantee clean initial state
      await User.findByIdAndUpdate(testStudent._id, { $set: { resetPasswordToken: null, resetPasswordExpires: null } });
      await User.findByIdAndUpdate(testFaculty._id, { $set: { resetPasswordToken: null, resetPasswordExpires: null } });

      // Student email through Faculty portal
      const { req, res } = mockReqRes({
        email: testStudentEmail,
        portalRole: 'faculty',
      });
      await forgotPassword(req, res);
      assert(res.statusCode === 200, 'Student on faculty portal returns generic 200');
      const studentDb = await User.findById(testStudent._id).select('+resetPasswordToken');
      assert(studentDb.resetPasswordToken === null, 'No token generated when student uses faculty portal');

      // Faculty email through Student portal
      const req2 = mockReqRes({
        email: testFacultyEmail,
        portalRole: 'student',
      });
      await forgotPassword(req2.req, req2.res);
      assert(req2.res.statusCode === 200, 'Faculty on student portal returns generic 200');
      const facultyDb = await User.findById(testFaculty._id).select('+resetPasswordToken');
      assert(facultyDb.resetPasswordToken === null, 'No token generated when faculty uses student portal');
    }

  } finally {
    // Clean up test records
    if (testStudent) await User.findByIdAndDelete(testStudent._id);
    if (testFaculty) await User.findByIdAndDelete(testFaculty._id);
    if (testAdmin) await User.findByIdAndDelete(testAdmin._id);
    await mongoose.disconnect();
    console.log('\nCleaned up test users and disconnected from MongoDB.');
  }

  console.log('\n------------------------------------------------------');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('------------------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal error running test suite:', err);
  process.exit(1);
});
