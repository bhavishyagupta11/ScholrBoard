import fs from 'fs';
import { execSync } from 'child_process';
import '../config/env.js';
import mongoose from 'mongoose';
import Track from '../models/Track.js';
import User from '../models/User.js';

async function runProductionMigration() {
  const actualUri = process.env.MONGODB_URI;
  
  if (!actualUri || !actualUri.includes('mongodb+srv')) {
    console.error('CRITICAL ERROR: Failed to parse production MONGODB_URI from .env');
    process.exit(1);
  }
  
  console.log(`📡 Connecting to production DB: ${actualUri}`);
  await mongoose.connect(actualUri);
  console.log('✅ Connected to MongoDB Production Target');

  console.log('\n--- 3. CREATING BACKUP ---');
  const tracksBackup = await Track.find({});
  const usersBackup = await User.find({}, '_id department trackId role facultyLevel');
  fs.writeFileSync('./tracks_prod_backup.json', JSON.stringify(tracksBackup, null, 2));
  fs.writeFileSync('./users_prod_backup.json', JSON.stringify(usersBackup, null, 2));
  console.log('✅ Backups created (tracks_prod_backup.json, users_prod_backup.json)');

  console.log('\n--- 4. RUNNING MIGRATION SCRIPTS ---');
  // Pass the exact production URI to the child processes
  const env = { ...process.env, MONGODB_URI: actualUri };
  
  console.log('Executing seedTracks.js...');
  execSync('node scripts/seedTracks.js', { stdio: 'inherit', env });
  
  console.log('Executing migrateUserTracks.js...');
  execSync('node scripts/migrateUserTracks.js', { stdio: 'inherit', env });

  console.log('\n--- 5. POST-MIGRATION EVIDENCE ---');
  const finalTracks = await Track.find({}).select('name code slug dashboardType -_id');
  console.log('\nTrack Collection:');
  console.log(JSON.stringify(finalTracks, null, 2));

  const total = await User.countDocuments({ role: 'student' });
  const withTrack = await User.countDocuments({ role: 'student', trackId: { $ne: null } });
  
  const softTrack = await Track.findOne({ code: 'software_engineering' });
  const coreTrack = await Track.findOne({ code: 'core_engineering' });
  
  const softCount = softTrack ? await User.countDocuments({ role: 'student', trackId: softTrack._id }) : 0;
  const coreCount = coreTrack ? await User.countDocuments({ role: 'student', trackId: coreTrack._id }) : 0;
  
  console.log(`\nTotal Students: ${total}`);
  console.log(`Students with TrackId: ${withTrack}`);
  console.log(`Software Engineering Count: ${softCount}`);
  console.log(`Core Engineering Count: ${coreCount}`);

  process.exit(0);
}

runProductionMigration();
