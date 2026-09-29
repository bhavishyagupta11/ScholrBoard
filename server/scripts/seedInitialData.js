/**
 * seedInitialData.js — Idempotent database seeder for ScholrBoard
 *
 * Seeds:
 *   1. Engineering tracks (Software Engineering and Core Engineering)
 *   2. Demo role accounts (student, faculty, coordinator, admin) with profiles
 *
 * Usage:
 *   node scripts/seedInitialData.js
 */
import '../config/env.js';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Profile from '../models/Profile.js';
import Track from '../models/Track.js';

const TRACKS = [
  {
    name: 'Software Engineering Track',
    code: 'software_engineering',
    slug: 'software_engineering',
    dashboardType: 'engineering',
    description: 'CSE, IT, AI, AIML, AIDS, Data Science, Cyber Security, Cloud Computing, Computer Engineering, Software Engineering.',
    icon: '💻',
    color: '#3b82f6',
    enableCodingModule: true,
    enableDeveloperScore: true,
    enableTalentDiscovery: true,
    enableInternships: true,
    enableResearch: false,
    enablePlacements: true,
    enableActivities: true,
    enableCertifications: true,
    enableProjects: true,
  },
  {
    name: 'Core Engineering Track',
    code: 'core_engineering',
    slug: 'core_engineering',
    dashboardType: 'core_engineering',
    description: 'ECE, EEE, EE, Mechanical, Civil, Chemical, Biotech, Production, Automobile, Aerospace, Instrumentation, Metallurgy.',
    icon: '⚙️',
    color: '#10b981',
    enableCodingModule: false,
    enableDeveloperScore: false,
    enableTalentDiscovery: false,
    enableInternships: true,
    enableResearch: false,
    enablePlacements: true,
    enableActivities: true,
    enableCertifications: true,
    enableProjects: true,
  }
];

const DEFAULT_PASSWORD = 'TestPass123!';

const USERS = [
  {
    email: 'admin@scholrboard.com',
    password: DEFAULT_PASSWORD,
    name: 'ScholrBoard Administrator',
    role: 'admin',
    verified: true,
    isActive: true,
  },
  {
    email: 'faculty@scholrboard.com',
    password: DEFAULT_PASSWORD,
    name: 'Dr. Ramesh Kumar (Faculty Advisor)',
    role: 'faculty',
    facultyLevel: 'faculty',
    facultyId: 'FAC-CSE-001',
    department: 'CSE',
    verified: true,
    isActive: true,
  },
  {
    email: 'coordinator@scholrboard.com',
    password: DEFAULT_PASSWORD,
    name: 'Prof. Anita Verma (Coordinator)',
    role: 'faculty',
    facultyLevel: 'coordinator',
    facultyId: 'FAC-CSE-002',
    department: 'CSE',
    verified: true,
    isActive: true,
  },
  {
    email: 'student@scholrboard.com',
    password: DEFAULT_PASSWORD,
    name: 'Bhavishya Gupta (Student)',
    role: 'student',
    studentId: 'STU-2026-001',
    department: 'CSE',
    semester: 6,
    verified: true,
    isActive: true,
    profileData: {
      gpa: 8.85,
      attendanceOverall: 92,
      backlogs: 0,
      developerScore: 84,
      githubScore: 82,
      dsaScore: 86,
      cpScore: 80,
      achievementPoints: 65,
      placementReadinessScore: 88,
      skills: ['react', 'node', 'mongodb', 'docker', 'express', 'python'],
      codingStats: {
        profiles: {
          github: 'bhavishyagupta11',
          leetcode: 'bhavishyagupta11',
          codeforces: 'bhavishya11'
        },
        leetcodeProblemsSolved: 320,
        leetcodeContestRating: 1680,
        githubRepos: 24,
        githubFollowers: 18,
        codeforcesRating: 1450,
      }
    }
  }
];

const seed = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI is not set in environment.');
    }

    console.log(`[SEED] Connecting to MongoDB: ${mongoUri.replace(/:[^:@]+@/, ':****@')}`);
    await mongoose.connect(mongoUri);
    console.log('[SEED] Connected successfully.');

    // 1. Seed Tracks
    console.log('[SEED] Seeding Engineering Tracks...');
    for (const track of TRACKS) {
      await Track.findOneAndUpdate(
        { slug: track.slug },
        { $set: track },
        { upsert: true, new: true }
      );
      console.log(`  ✓ Track ready: ${track.name}`);
    }

    // 2. Seed Users & Profiles
    console.log('[SEED] Seeding Demo User Accounts...');
    for (const userData of USERS) {
      const { profileData, ...userFields } = userData;

      let user = await User.findOne({ email: userFields.email });
      if (user) {
        Object.assign(user, userFields);
        user.password = DEFAULT_PASSWORD; // re-hash password through pre-save hook
        await user.save();
        console.log(`  ✓ Updated account: ${user.email} (${user.role})`);
      } else {
        user = await User.create(userFields);
        console.log(`  ✓ Created account: ${user.email} (${user.role})`);
      }

      // Upsert profile
      const defaultProfile = {
        userId: user._id,
        bio: `${user.name} - ScholrBoard ${user.role} profile.`,
        ...(profileData || {})
      };

      await Profile.findOneAndUpdate(
        { userId: user._id },
        { $set: defaultProfile },
        { upsert: true, new: true }
      );
      console.log(`  ✓ Profile ready for: ${user.email}`);
    }

    console.log('\n[SEED] Initial database seeding completed successfully!');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('[SEED ERROR]', err);
    process.exit(1);
  }
};

seed();
