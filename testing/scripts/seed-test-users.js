process.env.NODE_ENV = 'test';
import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import jwt from 'jsonwebtoken';
import { resetDB } from '../helpers/db.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../server/.env') });

const API_URL = process.env.E2E_API_URL || 'http://localhost:5000/api';
const DEPT = process.env.E2E_TEST_DEPT || 'CSE-E2E';
const PASSWORD = process.env.E2E_TEST_PASSWORD || 'TestPass123!';

const USERS = {
  student: {
    email: 'e2e.student@scholrboard.test',
    name: 'E2E Test Student',
    role: 'student',
    studentId: 'E2E-STU-001',
    department: DEPT,
    semester: 6,
  },
  faculty: {
    email: 'e2e.faculty@scholrboard.test',
    name: 'E2E Test Faculty',
    role: 'faculty',
    facultyId: 'E2E-FAC-001',
    department: DEPT,
  },
  coordinator: {
    email: 'e2e.coordinator@scholrboard.test',
    name: 'E2E Test Coordinator',
    role: 'faculty',
    facultyId: 'E2E-FAC-002',
    department: DEPT,
    facultyLevel: 'coordinator',
  },
  admin: {
    email: 'e2e.admin@scholrboard.test',
    name: 'E2E Test Admin',
    role: 'admin',
  },
};

async function upsertUser(userData) {
  const { default: User } = await import('../../server/models/User.js');
  const { default: Profile } = await import('../../server/models/Profile.js');

  let user = await User.findOne({ email: userData.email });

  if (user) {
    user.name = userData.name;
    user.role = userData.role;
    user.facultyLevel = userData.facultyLevel || 'faculty';
    user.department = userData.department || user.department;
    user.studentId = userData.studentId || user.studentId;
    user.facultyId = userData.facultyId || user.facultyId;
    user.semester = userData.semester || user.semester;
    user.isActive = true;
    user.password = PASSWORD;
    await user.save();
  } else {
    user = await User.create({
      ...userData,
      password: PASSWORD,
      isActive: true,
      verified: true,
    });
  }

  if (user.role === 'student') {
    await Profile.findOneAndUpdate(
      { userId: user._id },
      {
        $set: {
          gpa: 8.5,
          backlogs: 0,
          placementReadinessScore: 85,
          developerScore: 80,
          achievementPoints: 50,
          resumeUrl: 'https://example.com/e2e-resume.pdf',
        },
      },
      { upsert: true }
    );
  }

  return user;
}

function generateToken(user) {
  const payload = {
    _id:        user._id.toString(),
    email:      user.email,
    name:       user.name,
    role:       user.role,
    facultyLevel: user.facultyLevel || 'faculty',
    department: user.department || null,
    studentId:  user.studentId || null,
    facultyId:  user.facultyId || null,
    semester:   user.semester  || null,
    verified:   user.verified,
  };
  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });
  return { token };
}

async function main() {
  if (!process.env.MONGODB_URI_TEST || !process.env.JWT_SECRET) {
    throw new Error('MONGODB_URI_TEST and JWT_SECRET must be set in server/.env');
  }

  // Clean dynamic collections before seeding
  await resetDB();

  // Import mongoose from server so model imports share the same singleton
  const { default: mongoose } = await import('../../server/node_modules/mongoose/index.js');
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI_TEST, { serverSelectionTimeoutMS: 60000, connectTimeoutMS: 60000 });
  }

  const dbName = mongoose.connection.db.databaseName;
  if (dbName !== 'scholrboard_test') {
    await mongoose.disconnect();
    throw new Error(`CRITICAL SAFETY ERROR: Seeding test users is only allowed on the test database "scholrboard_test". Connected to: "${dbName}". Aborted!`);
  }
  console.log('MongoDB connected.');

  const student = await upsertUser(USERS.student);
  const faculty = await upsertUser(USERS.faculty);
  const coordinator = await upsertUser(USERS.coordinator);
  const admin = await upsertUser(USERS.admin);

  await mongoose.model('User').updateOne(
    { _id: student._id },
    { $set: { advisorId: faculty._id } }
  );

  const tokens = {
    student: generateToken(student),
    faculty: generateToken(faculty),
    coordinator: generateToken(coordinator),
    admin: generateToken(admin),
  };

  const output = {
    password: PASSWORD,
    department: DEPT,
    users: {
      student: { ...USERS.student, _id: student._id.toString(), token: tokens.student.token },
      faculty: { ...USERS.faculty, _id: faculty._id.toString(), token: tokens.faculty.token },
      coordinator: { ...USERS.coordinator, _id: coordinator._id.toString(), token: tokens.coordinator.token },
      admin: { ...USERS.admin, _id: admin._id.toString(), token: tokens.admin.token },
    },
  };

  const outPath = path.join(__dirname, '../.test-users.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`Test users seeded → ${outPath}`);

  const { default: mg } = await import('../../server/node_modules/mongoose/index.js');
  await mg.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
