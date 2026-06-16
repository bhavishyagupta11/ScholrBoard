import '../config/env.js';
import mongoose from 'mongoose';
import Track from '../models/Track.js';
import User from '../models/User.js';

async function finalAudit() {
  console.log('MONGODB_URI:', process.env.MONGODB_URI);
  await mongoose.connect(process.env.MONGODB_URI);
  
  console.log('\n--- TRACKS ---');
  const tracks = await Track.find({}).select('name code slug dashboardType -_id');
  console.log(JSON.stringify(tracks, null, 2));

  console.log('\n--- STUDENTS ---');
  const total = await User.countDocuments({ role: 'student' });
  const withTrack = await User.countDocuments({ role: 'student', trackId: { $ne: null } });
  
  const softTrack = await Track.findOne({ code: 'software_engineering' });
  const coreTrack = await Track.findOne({ code: 'core_engineering' });
  
  const softCount = softTrack ? await User.countDocuments({ role: 'student', trackId: softTrack._id }) : 0;
  const coreCount = coreTrack ? await User.countDocuments({ role: 'student', trackId: coreTrack._id }) : 0;
  
  console.log(`Total Students: ${total}`);
  console.log(`Students with TrackId: ${withTrack}`);
  console.log(`Software Engineering Count: ${softCount}`);
  console.log(`Core Engineering Count: ${coreCount}`);

  console.log('\n--- EMAIL SERVICE ---');
  console.log('EMAIL_USER:', process.env.EMAIL_USER ? 'Detected' : 'Missing');
  console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? 'Detected' : 'Missing');
  console.log('ADMIN_CONTACT_EMAIL:', process.env.ADMIN_CONTACT_EMAIL ? 'Detected' : 'Missing');

  process.exit(0);
}

finalAudit();
