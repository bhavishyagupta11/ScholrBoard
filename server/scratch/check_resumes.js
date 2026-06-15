import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Application from '../models/Application.js';
import User from '../models/User.js';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI_TEST);
  const dbName = mongoose.connection.db.databaseName;
  if (dbName !== 'scholrboard_test') {
    await mongoose.disconnect();
    throw new Error('CRITICAL SAFETY ERROR: Execution is only allowed on the test database "scholrboard_test". Currently connected to: "' + dbName + '". Execution aborted!');
  }

  console.log('DB Connected.');

  const apps = await Application.find({}).populate('studentId', 'name email');
  console.log(`Found ${apps.length} applications.`);

  for (const app of apps) {
    console.log(`App ID: ${app._id}`);
    console.log(`Student: ${app.studentId?.name} (${app.studentId?.email})`);
    console.log(`Status: ${app.status}`);
    console.log(`Resume URL: ${app.resumeUrl}`);
    console.log('-------------------------------------------');
  }

  await mongoose.disconnect();
}

run().catch(console.error);
