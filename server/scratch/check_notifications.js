import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Notification from '../models/Notification.js';
import User from '../models/User.js';

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


  const total = await Notification.countDocuments({});
  console.log('Total notifications in DB:', total);

  // Group by type
  const types = await Notification.aggregate([
    { $group: { _id: '$type', count: { $sum: 1 } } }
  ]);
  console.log('\nGroup by type:');
  types.forEach(t => console.log(`- ${t._id}: ${t.count}`));

  // User 6a27d9648435b89ab4f584a9 notifications
  const userId = '6a27d9648435b89ab4f584a9';
  const user = await User.findById(userId);
  if (user) {
    console.log(`\nNotifications for user: ${user.name} (${user.email}, role: ${user.role}, dept: ${user.department})`);
    const list = await Notification.find({ userId }).sort({ createdAt: -1 });
    console.log(`Count: ${list.length}`);
    list.forEach((n, idx) => {
      console.log(`\n[${idx + 1}] Title: "${n.title}"`);
      console.log(`   Message: "${n.message}"`);
      console.log(`   Type: "${n.type}"`);
      console.log(`   IsRead: ${n.isRead}`);
      console.log(`   Action URL: "${n.actionUrl}"`);
      console.log(`   Related ID: ${n.relatedId} (${n.relatedModel})`);
    });
  } else {
    console.log('\nUser 6a27d9648435b89ab4f584a9 not found.');
  }

  await mongoose.disconnect();
}

run().catch(console.error);
