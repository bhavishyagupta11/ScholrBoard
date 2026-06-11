import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const { default: mongoose } = await import('../node_modules/mongoose/index.js');
const { default: Profile } = await import('../models/Profile.js');
const { recalculateAndSaveScore } = await import('../services/developerScoringService.js');

async function runMigrationV2() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('CRITICAL: MONGODB_URI is not defined in environment variables.');
    process.exit(1);
  }

  console.log('Connecting to MongoDB for V2 scoring migration...');
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 30000 });
  console.log('MongoDB connected successfully.');

  const profiles = await Profile.find({});
  console.log(`Found ${profiles.length} profiles to check for V2 recalculation.`);

  let migratedCount = 0;
  let skippedCount = 0;

  for (const profile of profiles) {
    const hasHandles = !!(profile.codingStats?.profiles?.github || profile.codingStats?.profiles?.leetcode || profile.codingStats?.profiles?.codeforces);
    const needsRecalc = profile.developerScoreVersion !== 2 || profile.scoringFormulaVersion !== 'v2.0.0';

    if (hasHandles && needsRecalc) {
      await recalculateAndSaveScore(profile._id, 'Scoring model upgrade v2.0.0');
      console.log(`Recalculated scores to V2 for Profile: ${profile._id} (User: ${profile.userId})`);
      migratedCount++;
    } else {
      skippedCount++;
    }
  }

  console.log(`\nScoring V2 Migration completed.`);
  console.log(` - Recalculated profiles: ${migratedCount}`);
  console.log(` - Skipped / Already V2: ${skippedCount}`);

  await mongoose.disconnect();
  console.log('MongoDB disconnected.');
}

runMigrationV2().catch((err) => {
  console.error('Scoring V2 Migration failed:', err);
  process.exit(1);
});
