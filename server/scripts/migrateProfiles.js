import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

// Import mongoose and models using server's local path
const { default: mongoose } = await import('../node_modules/mongoose/index.js');
const { default: Profile } = await import('../models/Profile.js');
const { recalculateAndSaveScore } = await import('../services/developerScoringService.js');

async function runMigration() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('CRITICAL: MONGODB_URI is not defined in environment variables.');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 30000 });
  console.log('MongoDB connected successfully.');

  // Ensure indexes are built
  console.log('Building database indexes on Profiles...');
  await Profile.createIndexes();
  console.log('Indexes built successfully.');

  // Find all profiles
  const profiles = await Profile.find({});
  console.log(`Found ${profiles.length} profiles to verify/migrate.`);

  let migratedCount = 0;
  let skippedCount = 0;

  for (const profile of profiles) {
    let modified = false;

    // Initialize rawMetrics structure if missing
    if (!profile.codingStats.rawMetrics) {
      profile.codingStats.rawMetrics = { github: {}, leetcode: {}, codeforces: {} };
      modified = true;
    }

    const raw = profile.codingStats.rawMetrics;
    const stats = profile.codingStats;

    // Idempotent migration mapping: GitHub Metrics
    if (stats.githubRepos && raw.github.publicRepos !== stats.githubRepos) {
      raw.github.publicRepos = stats.githubRepos;
      modified = true;
    }
    if (stats.githubFollowers && raw.github.followers !== stats.githubFollowers) {
      raw.github.followers = stats.githubFollowers;
      modified = true;
    }
    // Set fallback contribution details if parsed details are not populated
    const details = stats.platformDetails?.get?.('github') || {};
    const stars = Number(details.stars || 0);
    const forks = Number(details.forks || 0);
    if (stars && raw.github.stars !== stars) {
      raw.github.stars = stars;
      modified = true;
    }
    if (forks && raw.github.forks !== forks) {
      raw.github.forks = forks;
      modified = true;
    }

    // Idempotent migration mapping: LeetCode Metrics
    if (stats.leetcodeProblemsSolved && raw.leetcode.totalSolved !== stats.leetcodeProblemsSolved) {
      raw.leetcode.totalSolved = stats.leetcodeProblemsSolved;
      modified = true;
    }
    if (stats.leetcodeContestRating && raw.leetcode.contestRating !== stats.leetcodeContestRating) {
      raw.leetcode.contestRating = stats.leetcodeContestRating;
      modified = true;
    }

    // Idempotent migration mapping: Codeforces Metrics
    if (stats.codeforcesRating && raw.codeforces.rating !== stats.codeforcesRating) {
      raw.codeforces.rating = stats.codeforcesRating;
      modified = true;
    }
    if (stats.codeforcesMaxRating && raw.codeforces.maxRating !== stats.codeforcesMaxRating) {
      raw.codeforces.maxRating = stats.codeforcesMaxRating;
      modified = true;
    }
    if (stats.codeforcesRank && raw.codeforces.rank !== stats.codeforcesRank) {
      raw.codeforces.rank = stats.codeforcesRank;
      modified = true;
    }

    // Recalculate and save score if rawMetrics exist or scores are uncalculated
    const hasHandles = !!(stats.profiles?.github || stats.profiles?.leetcode || stats.profiles?.codeforces);
    const needsScoreRecalculation = !profile.lastScoreCalculatedAt || profile.developerScoreVersion !== 1;

    if (modified || (hasHandles && needsScoreRecalculation)) {
      await profile.save();
      // Recalculate scores using the scoring service
      await recalculateAndSaveScore(profile._id, 'schema migration');
      console.log(`Migrated/Calculated scores for Profile: ${profile._id} (User: ${profile.userId})`);
      migratedCount++;
    } else {
      skippedCount++;
    }
  }

  console.log(`\nMigration completed.`);
  console.log(` - Migrated/Updated: ${migratedCount}`);
  console.log(` - Already up to date: ${skippedCount}`);

  await mongoose.disconnect();
  console.log('MongoDB disconnected.');
}

runMigration().catch((err) => {
  console.error('Migration failed with error:', err);
  process.exit(1);
});
