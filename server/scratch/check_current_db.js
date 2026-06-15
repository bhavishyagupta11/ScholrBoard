import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Activity from '../models/Activity.js';
import Announcement from '../models/Announcement.js';
import Event from '../models/Event.js';
import Opportunity from '../models/Opportunity.js';
import Application from '../models/Application.js';
import Notification from '../models/Notification.js';

dotenv.config();

async function run() {
  const uri = process.env.MONGODB_URI_TEST;
  console.log('Connecting to:', uri);
  await mongoose.connect(uri);
  const dbName = mongoose.connection.db.databaseName;
  if (dbName !== 'scholrboard_test') {
    await mongoose.disconnect();
    throw new Error('CRITICAL SAFETY ERROR: Execution is only allowed on the test database "scholrboard_test". Currently connected to: "' + dbName + '". Execution aborted!');
  }


  console.log('\n================ USERS ================');
  const users = await User.find({});
  console.log('Total Users:', users.length);
  users.forEach(u => {
    console.log(`- name: ${u.name}, email: ${u.email}, role: ${u.role}, department: ${u.department}, advisorId: ${u.advisorId}`);
  });

  console.log('\n================ ACTIVITIES ================');
  const activities = await Activity.find({});
  console.log('Total Activities:', activities.length);
  activities.forEach(a => {
    console.log(`- title: ${a.title}, user: ${a.userId}, status: ${a.status}, proofUrl: ${a.proofUrl}, isArchived: ${a.isArchived}`);
  });

  console.log('\n================ ANNOUNCEMENTS ================');
  const announcements = await Announcement.find({});
  console.log('Total Announcements:', announcements.length);
  announcements.forEach(a => {
    console.log(`- title: ${a.title}, postedBy: ${a.postedBy}, category: ${a.category}, filters:`, JSON.stringify(a.filters));
  });

  console.log('\n================ EVENTS ================');
  const events = await Event.find({});
  console.log('Total Events:', events.length);
  events.forEach(e => {
    console.log(`- title: ${e.title}, category: ${e.category}, isPublished: ${e.isPublished}, createdBy: ${e.createdBy}`);
  });

  console.log('\n================ PLACEMENT DRIVES ================');
  const opportunities = await Opportunity.find({});
  console.log('Total Opportunities:', opportunities.length);
  opportunities.forEach(o => {
    console.log(`- company: ${o.company}, title: ${o.title}, status: ${o.status}, eligibility:`, JSON.stringify(o.eligibility));
  });

  console.log('\n================ APPLICATIONS ================');
  const applications = await Application.find({});
  console.log('Total Applications:', applications.length);
  applications.forEach(a => {
    console.log(`- opportunityId: ${a.opportunityId}, status: ${a.status}`);
  });

  console.log('\n================ NOTIFICATIONS ================');
  const notifications = await Notification.find({});
  console.log('Total Notifications:', notifications.length);
  notifications.forEach(n => {
    console.log(`- title: ${n.title}, userId: ${n.userId}, type: ${n.type}, isRead: ${n.isRead}, relatedId: ${n.relatedId}`);
  });

  await mongoose.disconnect();
}

run().catch(console.error);
