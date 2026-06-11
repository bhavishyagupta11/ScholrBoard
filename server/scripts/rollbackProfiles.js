import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const { default: mongoose } = await import('../node_modules/mongoose/index.js');
const { default: Profile } = await import('../models/Profile.js');

async function runRollback() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('CRITICAL: MONGODB_URI is not defined in environment variables.');
    process.exit(1);
  }

  console.log('Connecting to MongoDB for rollback...');
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 30000 });
  console.log('MongoDB connected successfully.');

  console.log('Resetting scoring-related fields on Profiles...');
  
  // Update all profiles, removing scores, versions, breakdowns, and audit metadata
  // While explicitly preserving rawMetrics
  const result = await Profile.updateMany(
    {},
    {
      $unset: {
        githubScore: '',
        dsaScore: '',
        cpScore: '',
        developerScoreVersion: '',
        scoringFormulaVersion: '',
        lastScoreCalculatedAt: '',
        lastScoreCalculationReason: '',
        scoreBreakdown: '',
      },
      $set: {
        developerScore: 0, // Reset developerScore to initial default
      }
    }
  );

  console.log(`Rollback completed.`);
  console.log(` - Matched: ${result.matchedCount}`);
  console.log(` - Modified: ${result.modifiedCount}`);

  await mongoose.disconnect();
  console.log('MongoDB disconnected.');
}

runRollback().catch((err) => {
  console.error('Rollback failed with error:', err);
  process.exit(1);
});
