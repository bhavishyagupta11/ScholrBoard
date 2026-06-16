/**
 * seedTracks.js — Seeds the 2 V2.2 engineering tracks into the database.
 *
 * Usage:
 *   node scripts/seedTracks.js
 *
 * Safe to run multiple times — updates if already exists.
 * Does NOT affect any existing user data directly (but track codes change).
 */
import '../config/env.js';
import mongoose from 'mongoose';
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

const seed = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    console.log(`📡 Connecting to MongoDB: ${mongoUri}`);
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    let created = 0;
    let updated = 0;

    for (const track of TRACKS) {
      const existing = await Track.findOne({ slug: track.slug });
      if (existing) {
        // Update track fields
        Object.assign(existing, track);
        await existing.save();
        console.log(`  🔄 Updated: ${track.name}`);
        updated++;
      } else {
        await Track.create(track);
        console.log(`  ✅ Seeded: ${track.name}`);
        created++;
      }
    }

    // Also remove any old tracks that shouldn't exist anymore
    const validCodes = TRACKS.map(t => t.code);
    const deleteRes = await Track.deleteMany({ code: { $nin: validCodes } });
    if (deleteRes.deletedCount > 0) {
       console.log(`  🗑️ Deleted ${deleteRes.deletedCount} deprecated tracks`);
    }

    console.log(`\n📊 Seed complete: ${created} created, ${updated} updated`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  }
};

seed();
