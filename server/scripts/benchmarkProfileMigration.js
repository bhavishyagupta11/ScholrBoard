import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const { default: mongoose } = await import('../node_modules/mongoose/index.js');
const { calculateGithubScore, calculateDsaScore, calculateCpScore, calculateUnifiedScore } = await import('../services/developerScoringService.js');

// Define a temporary schema and model for benchmarking to avoid polluting student profiles
const benchmarkProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  gpa: { type: Number, default: null },
  achievementPoints: { type: Number, default: 0 },
  placementReadinessScore: { type: Number, default: 0 },
  developerScore: { type: Number, default: 0 },
  githubScore: { type: Number, default: 0 },
  dsaScore: { type: Number, default: 0 },
  cpScore: { type: Number, default: 0 },
  developerScoreVersion: { type: Number, default: 1 },
  scoringFormulaVersion: { type: String, default: 'v1.0.0' },
  codingStats: {
    profiles: {
      github: { type: String },
      leetcode: { type: String },
      codeforces: { type: String },
    },
    githubLastSyncedAt: { type: Date, default: null },
    leetcodeLastSyncedAt: { type: Date, default: null },
    codeforcesLastSyncedAt: { type: Date, default: null },
    lastSyncedAt: { type: Date, default: null },
    isSyncing: { type: Boolean, default: false },
    syncStartedAt: { type: Date, default: null },
    rawMetrics: {
      github: {
        publicRepos: { type: Number, default: 0 },
        followers: { type: Number, default: 0 },
        stars: { type: Number, default: 0 },
        forks: { type: Number, default: 0 },
        topics: [{ type: String }],
      },
      leetcode: {
        totalSolved: { type: Number, default: 0 },
        easySolved: { type: Number, default: 0 },
        mediumSolved: { type: Number, default: 0 },
        hardSolved: { type: Number, default: 0 },
        contestRating: { type: Number, default: 0 },
      },
      codeforces: {
        rating: { type: Number, default: 0 },
        maxRating: { type: Number, default: 0 },
      }
    },
    // Legacy fields for migration simulation
    githubRepos: { type: Number },
    githubFollowers: { type: Number },
    leetcodeProblemsSolved: { type: Number },
    leetcodeContestRating: { type: Number },
    codeforcesRating: { type: Number },
    codeforcesMaxRating: { type: Number },
  }
}, { collection: 'profile_benchmarks' });

const BenchmarkProfile = mongoose.model('BenchmarkProfile', benchmarkProfileSchema);

function generateMockProfile(index) {
  return {
    userId: new mongoose.Types.ObjectId(),
    gpa: Number((Math.random() * 4 + 6).toFixed(2)),
    achievementPoints: Math.floor(Math.random() * 80),
    placementReadinessScore: Math.floor(Math.random() * 100),
    codingStats: {
      profiles: {
        github: `user_${index}`,
        leetcode: `user_${index}`,
        codeforces: `user_${index}`
      },
      // Seed legacy metrics to force migration
      githubRepos: Math.floor(Math.random() * 40),
      githubFollowers: Math.floor(Math.random() * 30),
      leetcodeProblemsSolved: Math.floor(Math.random() * 300),
      leetcodeContestRating: Math.floor(Math.random() * 1500) + 900,
      codeforcesRating: Math.floor(Math.random() * 1600) + 600,
      codeforcesMaxRating: Math.floor(Math.random() * 1800) + 700,
    }
  };
}

async function runBenchmark(size) {
  console.log(`\n--- Benchmarking dataset size: ${size} profiles ---`);

  // 1. Seed database
  console.log('Seeding mock dataset...');
  const batch = [];
  for (let i = 0; i < size; i++) {
    batch.push(generateMockProfile(i));
  }
  await BenchmarkProfile.insertMany(batch);
  console.log('Seed completed.');

  // 2. Garbarge Collect if possible to get baseline memory
  if (global.gc) {
    global.gc();
  }
  const memoryBefore = process.memoryUsage().heapUsed;

  // 3. Migrate dataset
  console.log('Running migration...');
  const start = performance.now();
  
  const documents = await BenchmarkProfile.find({});
  let success = 0;
  let failure = 0;

  for (const doc of documents) {
    try {
      // Perform schema mapping
      doc.codingStats.rawMetrics = {
        github: {
          publicRepos: doc.codingStats.githubRepos || 0,
          followers: doc.codingStats.githubFollowers || 0,
          stars: Math.floor(Math.random() * 10),
          forks: Math.floor(Math.random() * 5),
          topics: ['react', 'node']
        },
        leetcode: {
          totalSolved: doc.codingStats.leetcodeProblemsSolved || 0,
          easySolved: Math.floor((doc.codingStats.leetcodeProblemsSolved || 0) * 0.4),
          mediumSolved: Math.floor((doc.codingStats.leetcodeProblemsSolved || 0) * 0.5),
          hardSolved: Math.floor((doc.codingStats.leetcodeProblemsSolved || 0) * 0.1),
          contestRating: doc.codingStats.leetcodeContestRating || 0,
        },
        codeforces: {
          rating: doc.codingStats.codeforcesRating || 0,
          maxRating: doc.codingStats.codeforcesMaxRating || 0,
        }
      };

      // Calculate scores
      doc.githubScore = calculateGithubScore(doc.codingStats.rawMetrics.github);
      doc.dsaScore = calculateDsaScore(doc.codingStats.rawMetrics.leetcode);
      doc.cpScore = calculateCpScore(doc.codingStats.rawMetrics.codeforces);

      const { score, breakdown } = calculateUnifiedScore(doc);
      doc.developerScore = score;
      
      // Update versions and metadata
      doc.developerScoreVersion = 1;
      doc.scoringFormulaVersion = 'v1.0.0';

      await doc.save();
      success++;
    } catch (err) {
      console.error('Migration document error:', err);
      failure++;
    }
  }

  const durationMs = performance.now() - start;
  const memoryAfter = process.memoryUsage().heapUsed;
  const memoryDeltaMb = Number(((memoryAfter - memoryBefore) / 1024 / 1024).toFixed(2));
  const avgTimePerProfileMs = Number((durationMs / size).toFixed(2));

  console.log(`Results for size ${size}:`);
  console.log(` - Execution Time: ${(durationMs / 1000).toFixed(2)}s`);
  console.log(` - Peak Memory Increase: ${memoryDeltaMb} MB`);
  console.log(` - Success Count: ${success}`);
  console.log(` - Failure Count: ${failure}`);
  console.log(` - Avg Profile Process Time: ${avgTimePerProfileMs}ms`);

  // 4. Clean up benchmark documents
  console.log('Cleaning up benchmark collection...');
  await BenchmarkProfile.deleteMany({});
  console.log('Clean up completed.');

  return {
    size,
    durationSeconds: Number((durationMs / 1000).toFixed(2)),
    memoryMb: memoryDeltaMb,
    success,
    failure,
    avgTimePerProfileMs
  };
}

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('MONGODB_URI not set.');
    process.exit(1);
  }

  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 60000 });
  console.log('Connected to MongoDB.');

  const results = [];
  try {
    // Drop collection if it exists
    await BenchmarkProfile.deleteMany({});
    
    results.push(await runBenchmark(100));
    results.push(await runBenchmark(1000));
    results.push(await runBenchmark(5000));
  } finally {
    // Drop collection to restore DB state
    await mongoose.connection.db.dropCollection('profile_benchmarks').catch(() => {});
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }

  console.log('\n=== FINAL BENCHMARK SUMMARY ===');
  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
