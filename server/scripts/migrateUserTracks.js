/**
 * migrateUserTracks.js
 * 
 * 1. Re-map any legacy department_coordinator users to role: 'faculty' and facultyLevel: 'coordinator'.
 * 2. Use getTrackCodeForDepartment() to re-assign every student to either software_engineering or core_engineering.
 * 3. Handle missing/invalid departments by falling back to core_engineering.
 */
import '../config/env.js';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Track from '../models/Track.js';
import { resolveTrackForDepartment } from '../utils/trackResolver.js';

const migrate = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI_TEST || process.env.MONGODB_URI;
    console.log(`📡 Connecting to MongoDB: ${mongoUri}`);
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // 1. Re-map legacy department_coordinator users
    // We use User.collection.updateMany to bypass mongoose validation since the enum is strictly removed
    const coordinatorUpdateResult = await User.collection.updateMany(
      { role: 'department_coordinator' },
      { $set: { role: 'faculty', facultyLevel: 'coordinator' } }
    );
    console.log(`✅ Converted ${coordinatorUpdateResult.modifiedCount} department_coordinators to faculty (coordinator).`);

    // Fetch the 2 valid tracks
    const swTrack = await Track.findOne({ code: 'software_engineering' });
    const coreTrack = await Track.findOne({ code: 'core_engineering' });

    if (!swTrack || !coreTrack) {
      console.error('❌ Missing core engineering or software engineering tracks! Please run seedTracks.js first.');
      process.exit(1);
    }

    // 2 & 3. Re-assign every student and faculty to valid tracks
    const users = await User.find({ role: { $in: ['student', 'faculty'] } });
    console.log(`📊 Found ${users.length} total users to check.`);

    let updatedCount = 0;

    for (const user of users) {
      const resolvedTrackId = await resolveTrackForDepartment(user.department);
      if (resolvedTrackId && String(user.trackId) !== String(resolvedTrackId)) {
        await User.collection.updateOne(
          { _id: user._id },
          { $set: { trackId: resolvedTrackId } }
        );
        updatedCount++;
      }
    }

    console.log(`✅ Processed ${users.length} users.`);
    console.log(`  - ${updatedCount} records were updated to valid tracks.`);
    console.log('🎉 Migration complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

migrate();
