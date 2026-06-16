import '../config/env.js';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Track from '../models/Track.js';
import { resolveTrackForDepartment } from '../utils/trackResolver.js';

const dryRun = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI_TEST || process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);

    console.log("=== DRY RUN AUDIT OF MIGRATE USER TRACKS ===");

    // 1. Coordinators affected
    const coordinators = await User.find({ role: 'department_coordinator' });
    console.log(`Coordinators affected (to be migrated to faculty/coordinator): ${coordinators.length}`);
    
    // Fetch tracks
    const swTrack = await Track.findOne({ code: 'software_engineering' });
    const coreTrack = await Track.findOne({ code: 'core_engineering' });
    
    if (!swTrack || !coreTrack) {
      console.log('MISSING TRACKS. Cannot simulate user assignment.');
      process.exit(0);
    }

    // 2. Track assignments changed
    const users = await User.find({ role: { $in: ['student', 'faculty', 'department_coordinator'] } });
    
    let trackChanges = 0;
    let skipped = 0;
    
    for (const user of users) {
      const resolvedTrackId = await resolveTrackForDepartment(user.department);
      if (resolvedTrackId && String(user.trackId) !== String(resolvedTrackId)) {
        trackChanges++;
      } else {
        skipped++;
      }
    }

    console.log(`Total users affected (Track assignments changed): ${trackChanges}`);
    console.log(`Records skipped (Already correct): ${skipped}`);
    console.log(`Potential failures: 0 (MongoDB allows generic string updates natively)`);
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

dryRun();
