import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';

import User from '../models/User.js';
import Profile from '../models/Profile.js';
import Event from '../models/Event.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

async function inspect() {
  const uri = process.env.MONGODB_URI;
  console.log('Connecting to:', uri);
  await mongoose.connect(uri);

  const events = await Event.find({});
  console.log('\n--- ALL EVENTS ---');
  for (const e of events) {
    console.log(JSON.stringify({
      id: e._id,
      title: e.title,
      isPublished: e.isPublished,
      isCancelled: e.isCancelled,
      startDate: e.startDate,
      targetRoles: e.targetRoles,
      targetDepartments: e.targetDepartments,
      targetSemesters: e.targetSemesters
    }, null, 2));
  }

  await mongoose.disconnect();
}

inspect().catch(err => {
  console.error(err);
  process.exit(1);
});
