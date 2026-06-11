import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../server/.env') });

export async function resetDB() {
  // Hard safety guard
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Database reset is only allowed in test mode');
  }

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI);
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
    'resumeanalyses'
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
