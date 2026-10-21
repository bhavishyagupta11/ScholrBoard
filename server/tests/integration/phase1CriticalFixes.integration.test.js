import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Profile from '../../models/Profile.js';
import User from '../../models/User.js';
import GpaScaleAuditLog from '../../models/GpaScaleAuditLog.js';
import { updateGpaScale } from '../../controllers/profileController.js';
import { validateIntegrationTestDatabaseUri } from '../helpers/testDatabaseGuard.js';

dotenv.config();
process.env.NODE_ENV = 'test';

const testUri = process.env.MONGODB_URI_TEST;
validateIntegrationTestDatabaseUri(testUri);

let studentUser = null;
let adminUser = null;
let testProfile = null;

before(async () => {
  await mongoose.connect(testUri, { serverSelectionTimeoutMS: 15000 });

  // Create isolated student user and profile
  studentUser = await User.create({
    name: 'Test Student For GPA Scale',
    email: `test.student.${Date.now()}@scholrboard.test`,
    password: 'Password123!',
    role: 'student',
  });

  adminUser = await User.create({
    name: 'Test Admin For GPA Scale',
    email: `test.admin.${Date.now()}@scholrboard.test`,
    password: 'Password123!',
    role: 'admin',
  });

  testProfile = await Profile.create({
    userId: studentUser._id,
    bio: 'Test Student Profile for GPA Scale Integration',
    gpaScale: 10.0,
  });
});

after(async () => {
  if (studentUser) {
    await Profile.collection.deleteMany({ userId: studentUser._id });
    await GpaScaleAuditLog.collection.deleteMany({ userId: studentUser._id });
    await User.collection.deleteOne({ _id: studentUser._id });
  }
  if (adminUser) {
    await User.collection.deleteOne({ _id: adminUser._id });
  }
  await mongoose.disconnect();
});

test('Integration: Admin updates student gpaScale with complete audit logging', async () => {
  let statusCode = 200;
  let jsonResponse = null;

  const mockReq = {
    params: { userId: studentUser._id.toString() },
    body: { gpaScale: 4.0, reason: 'Transferred to US 4.0 GPA program' },
    user: adminUser,
  };

  const mockRes = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      jsonResponse = data;
      return this;
    },
  };

  await updateGpaScale(mockReq, mockRes);

  assert.equal(statusCode, 200);
  assert.equal(jsonResponse.success, true);
  assert.equal(jsonResponse.gpaScale, 4.0);
  assert.equal(jsonResponse.oldValue, 10.0);

  // Verify in MongoDB
  const updatedProfile = await Profile.findOne({ userId: studentUser._id });
  assert.equal(updatedProfile.gpaScale, 4.0);

  // Verify GpaScaleAuditLog entry
  const auditLogs = await GpaScaleAuditLog.find({ userId: studentUser._id });
  assert.equal(auditLogs.length, 1);
  assert.equal(auditLogs[0].field, 'gpaScale');
  assert.equal(auditLogs[0].oldValue, 10.0);
  assert.equal(auditLogs[0].newValue, 4.0);
  assert.equal(String(auditLogs[0].changedBy), String(adminUser._id));
  assert.equal(auditLogs[0].reason, 'Transferred to US 4.0 GPA program');
});

test('Integration: updateGpaScale rejects invalid scales with 400 Bad Request', async () => {
  const invalidScales = [0, -1, 15, 'not-a-number', null];

  for (const invalidScale of invalidScales) {
    let statusCode = 200;
    let jsonResponse = null;

    const mockReq = {
      params: { userId: studentUser._id.toString() },
      body: { gpaScale: invalidScale, reason: 'Invalid update attempt' },
      user: adminUser,
    };

    const mockRes = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        jsonResponse = data;
        return this;
      },
    };

    await updateGpaScale(mockReq, mockRes);

    assert.equal(statusCode, 400);
    assert.equal(jsonResponse.success, false);
    assert.match(jsonResponse.message, /Invalid gpaScale/);
  }

  // Ensure audit log count remains 1 (no new invalid log entries)
  const auditLogs = await GpaScaleAuditLog.find({ userId: studentUser._id });
  assert.equal(auditLogs.length, 1);
});
