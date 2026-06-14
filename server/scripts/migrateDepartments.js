import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import User from '../models/User.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const deptMap = {
  'computer science': 'CSE',
  'information technology': 'IT',
  'electrical engineering': 'EE',
  'electronics & communication': 'ECE',
  'electronics and communication': 'ECE',
  'mechanical engineering': 'ME',
  'civil engineering': 'CE',
  'chemical engineering': 'CHE',
  'biotechnology': 'BT'
};

async function migrate() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('CRITICAL: MONGODB_URI is not defined in env.');
    process.exit(1);
  }

  console.log('Connecting to database...');
  await mongoose.connect(mongoUri);
  console.log('Connected successfully.');

  const allUsers = await User.find({ role: { $in: ['student', 'faculty'] } });
  console.log(`Total student/faculty users found: ${allUsers.length}`);

  let matchCount = 0;
  let updateCount = 0;

  for (const user of allUsers) {
    const rawDept = user.department;
    if (!rawDept) continue;

    const normalizedKey = rawDept.trim().toLowerCase();
    if (deptMap[normalizedKey]) {
      const newDept = deptMap[normalizedKey];
      matchCount++;
      
      console.log(`[MATCH] User: ${user.email} (${user.role})`);
      console.log(`  Current department: "${rawDept}"`);
      console.log(`  New department:     "${newDept}"`);
      
      // Update User
      await User.findByIdAndUpdate(user._id, { $set: { department: newDept } });
      updateCount++;
    }
  }

  console.log(`\nMigration completed.`);
  console.log(`Matched records: ${matchCount}`);
  console.log(`Updated records: ${updateCount}`);

  await mongoose.disconnect();
  console.log('Database disconnected.');
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
