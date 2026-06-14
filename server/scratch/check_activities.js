import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

import mongoose from 'mongoose';
import Activity from '../models/Activity.js';
import Announcement from '../models/Announcement.js';
import Placement from '../models/Placement.js';
import Notification from '../models/Notification.js';

async function runQueries() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('MONGODB_URI not defined.');
    process.exit(1);
  }
  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('Connected.');

  // 1. Activities
  const activities = await Activity.find({});
  console.log(`\n--- ACTIVITIES (Total: ${activities.length}) ---`);
  activities.slice(0, 10).forEach((act) => {
    console.log(`Activity: ID=${act._id}, Title="${act.title}", Status="${act.status}", ProofUrl="${act.proofUrl}", isArchived=${act.isArchived}`);
  });

  // 2. Announcements
  const announcements = await Announcement.find({});
  console.log(`\n--- ANNOUNCEMENTS (Total: ${announcements.length}) ---`);
  announcements.slice(0, 10).forEach((ann) => {
    console.log(`Announcement: ID=${ann._id}, Title="${ann.title}", TargetAudience="${ann.targetAudience}", isPublished=${ann.isPublished}`);
  });

  // 3. Placements
  const placements = await Placement.find({});
  console.log(`\n--- PLACEMENTS (Total: ${placements.length}) ---`);
  placements.slice(0, 10).forEach((p) => {
    console.log(`Placement: ID=${p._id}, Company="${p.company}", Title="${p.title}", Status="${p.status}"`);
  });

  // 4. Notifications
  const notifications = await Notification.find({});
  console.log(`\n--- NOTIFICATIONS (Total: ${notifications.length}) ---`);
  notifications.slice(0, 10).forEach((n) => {
    console.log(`Notification: ID=${n._id}, Title="${n.title}", User="${n.userId}", Type="${n.type}"`);
  });

  await mongoose.disconnect();
}

runQueries().catch(err => {
  console.error(err);
  process.exit(1);
});
