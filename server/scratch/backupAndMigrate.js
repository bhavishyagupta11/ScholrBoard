import '../config/env.js';
import mongoose from 'mongoose';
import fs from 'fs';
import Track from '../models/Track.js';
import User from '../models/User.js';
import { execSync } from 'child_process';

async function performMigration() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('=== BEFORE MIGRATION ===');
  const initialTracks = await Track.find({});
  const initialStudents = await User.countDocuments({ role: 'student' });
  const studentsWithTrack = await User.countDocuments({ role: 'student', trackId: { $ne: null } });
  
  console.log(`Tracks count: ${initialTracks.length}`);
  console.log(`Total Students: ${initialStudents}`);
  console.log(`Students with Track: ${studentsWithTrack}`);

  console.log('\n=== BACKING UP TRACKS ===');
  fs.writeFileSync('./scratch/tracks_backup.json', JSON.stringify(initialTracks, null, 2));
  console.log('Backed up to scratch/tracks_backup.json');

  console.log('\n=== RUNNING SEED TRACKS ===');
  execSync('node scripts/seedTracks.js', { stdio: 'inherit' });

  console.log('\n=== RUNNING USER TRACK MIGRATION ===');
  execSync('node scripts/migrateUserTracks.js', { stdio: 'inherit' });

  console.log('\n=== AFTER MIGRATION ===');
  const finalTracks = await Track.find({});
  const softTrack = await Track.findOne({ code: 'software_engineering' });
  const coreTrack = await Track.findOne({ code: 'core_engineering' });
  
  const softCount = softTrack ? await User.countDocuments({ role: 'student', trackId: softTrack._id }) : 0;
  const coreCount = coreTrack ? await User.countDocuments({ role: 'student', trackId: coreTrack._id }) : 0;
  const missingCount = await User.countDocuments({ role: 'student', trackId: null });

  console.log(`Tracks count: ${finalTracks.length}`);
  console.log(`Software Engineering Users: ${softCount}`);
  console.log(`Core Engineering Users: ${coreCount}`);
  console.log(`Skipped Users (No track assigned): ${missingCount}`);

  process.exit(0);
}

performMigration().catch(console.error);
