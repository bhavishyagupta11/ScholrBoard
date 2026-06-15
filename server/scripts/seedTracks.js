/**
 * seedTracks.js — Seeds the 6 career tracks into the database.
 *
 * Usage:
 *   node scripts/seedTracks.js
 *
 * Safe to run multiple times — uses upsert (won't duplicate).
 * Does NOT affect any existing data (users, activities, etc.)
 */
import '../config/env.js';
import mongoose from 'mongoose';
import Track from '../models/Track.js';

const TRACKS = [
  {
    name: 'Engineering',
    slug: 'engineering',
    description: 'Computer Science, IT, ECE, EEE, Mechanical, Civil, and related engineering disciplines.',
    icon: '⚙️',
    color: '#3b82f6',
  },
  {
    name: 'Management',
    slug: 'management',
    description: 'Business Administration, MBA, Finance, Marketing, HR, and management disciplines.',
    icon: '📊',
    color: '#8b5cf6',
  },
  {
    name: 'Medical',
    slug: 'medical',
    description: 'MBBS, BDS, Nursing, Pharmacy, Physiotherapy, and healthcare disciplines.',
    icon: '🏥',
    color: '#10b981',
  },
  {
    name: 'Commerce',
    slug: 'commerce',
    description: 'B.Com, Accountancy, Economics, CA, CMA, and commerce disciplines.',
    icon: '💰',
    color: '#f59e0b',
  },
  {
    name: 'Arts',
    slug: 'arts',
    description: 'Literature, History, Sociology, Psychology, Fine Arts, and humanities disciplines.',
    icon: '🎨',
    color: '#ec4899',
  },
  {
    name: 'Law',
    slug: 'law',
    description: 'LLB, LLM, Cyber Law, Corporate Law, and legal disciplines.',
    icon: '⚖️',
    color: '#6366f1',
  },
];

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    let created = 0;
    let skipped = 0;

    for (const track of TRACKS) {
      const result = await Track.findOneAndUpdate(
        { slug: track.slug },
        { $setOnInsert: track },
        { upsert: true, new: false }
      );

      if (result === null) {
        console.log(`  ✅ Seeded: ${track.name}`);
        created++;
      } else {
        console.log(`  ⏭️  Skipped (already exists): ${track.name}`);
        skipped++;
      }
    }

    console.log(`\n📊 Seed complete: ${created} created, ${skipped} already existed`);
    console.log('ℹ️  Career tracks are UI personalization only — no authorization impact.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  }
};

seed();
