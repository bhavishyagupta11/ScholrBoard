import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../server/.env') });

export async function resetDB() {
  // Hard safety guard 1: Verify NODE_ENV is not production
  if (process.env.NODE_ENV === 'production') {
    throw new Error('CRITICAL SAFETY ERROR: Database reset is strictly forbidden in production mode (NODE_ENV=production).');
  }

  const dbUri = process.env.MONGODB_URI_TEST;
  if (!dbUri) {
    throw new Error('CRITICAL SAFETY ERROR: MONGODB_URI_TEST is not defined in the environment variables.');
  }

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(dbUri);
  }

  const dbName = mongoose.connection.db.databaseName;

  // Hard safety guard 2: Verify the database name is exactly 'scholrboard_test'
  if (dbName !== 'scholrboard_test') {
    await mongoose.disconnect();
    throw new Error(`CRITICAL SAFETY ERROR: Destructive operations are only allowed on the test database "scholrboard_test". Currently connected to database: "${dbName}". Execution aborted!`);
  }

  const collections = [
    'activities',
    'applications',
    'opportunities',
    'scholarships',
    'announcements',
    'notifications',
    'odrequests',
    'auditlogs',
    'aichathistories',
    'learningprogresses',
    'analytics',
    'resumeanalyses',
    'events'
  ];

  console.log('Clearing E2E test database collections...');
  for (const name of collections) {
    try {
      await mongoose.connection.db.collection(name).deleteMany({});
      console.log(`  - Cleared collection: ${name}`);
    } catch (e) {
      console.log(`  - Collection ${name} could not be cleared (may not exist yet)`);
    }
  }
  await mongoose.disconnect();
}
