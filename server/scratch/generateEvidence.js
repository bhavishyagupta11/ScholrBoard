import '../config/env.js';
import mongoose from 'mongoose';
import Track from '../models/Track.js';
import User from '../models/User.js';
import { getTrackCodeForDepartment } from '../config/trackMapping.js';

async function generateEvidence() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('=== EVIDENCE 1 & 2 ===');
  const tracks = await Track.find({}).select('name code slug dashboardType -_id');
  console.log('db.tracks.find():\n', JSON.stringify(tracks, null, 2));
  
  const usersWithTrack = await User.find({ role: 'student', trackId: { $ne: null } }).countDocuments();
  console.log('db.users.countDocuments({ role: "student", trackId: { $ne: null } }):', usersWithTrack);

  console.log('\n=== EVIDENCE 5 ===');
  const depts = ['CSE', 'IT', 'AIML', 'AIDS', 'AI', 'Data Science', 'Cyber Security', 'ECE', 'EEE', 'Mechanical', 'Civil', 'Chemical'];
  for (const d of depts) {
    console.log(`${d} -> ${getTrackCodeForDepartment(d)}`);
  }

  console.log('\n=== EVIDENCE 8 (Dry Run Migration) ===');
  const students = await User.find({ role: 'student' });
  let skip = 0;
  let soft = 0;
  let core = 0;
  
  for (const s of students) {
    if (!s.department) {
      skip++;
      continue;
    }
    const code = getTrackCodeForDepartment(s.department);
    if (code === 'software_engineering') soft++;
    else if (code === 'core_engineering') core++;
    else skip++;
  }
  console.log(`Total Students: ${students.length}`);
  console.log(`Will be Skipped (No Dept): ${skip}`);
  console.log(`Will receive Software: ${soft}`);
  console.log(`Will receive Core: ${core}`);

  process.exit(0);
}
generateEvidence();
