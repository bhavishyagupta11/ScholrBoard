// File: server/scripts/provisionAccounts.js
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Profile from '../models/Profile.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const ADMIN_EMAIL = 'admin@scholrboard.com';
const FACULTY_EMAIL = 'faculty@scholrboard.com';

async function provision() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('CRITICAL: MONGODB_URI is not defined in environment variables.');
    process.exit(1);
  }

  console.log('Connecting to database...');
  await mongoose.connect(mongoUri);
  console.log('Connected successfully.');

  // 1. Provision Admin Account
  let admin = await User.findOne({ email: ADMIN_EMAIL });
  if (admin) {
    console.log(`[-] Admin account with email ${ADMIN_EMAIL} already exists.`);
  } else {
    // Password will be hashed automatically by the pre-save hook
    admin = await User.create({
    email: 'bhavishya.admin@gmail.com',
    password: 'BhavishyaAdmin@2026',
    name: 'Bhavishya Gupta',
    role: 'admin',
    verified: true,
    isActive: true
    });
    // Initialize profile
    await Profile.create({ userId: admin._id });
    console.log('[+] Admin account provisioned successfully.');
  }

  // 2. Provision Faculty Account
  let faculty = await User.findOne({ email: FACULTY_EMAIL });
  if (faculty) {
    console.log(`[-] Faculty account with email ${FACULTY_EMAIL} already exists.`);
  } else {
    faculty = await User.create({
      email: 'bhavishya.faculty@gmail.com',
      password: 'BhavishyaFaculty@2026',
      name: 'Bhavishya Gupta',
      role: 'faculty',
      facultyId: 'FAC-001',
      department: 'CSE',
      verified: true,
      isActive: true
    });
    // Initialize profile
    await Profile.create({ userId: faculty._id });
    console.log('[+] Faculty account provisioned successfully.');
  }

  await mongoose.disconnect();
  console.log('Database disconnected.');
}

provision().catch(err => {
  console.error('CRITICAL: Provisioning failed with error:', err);
  process.exit(1);
});