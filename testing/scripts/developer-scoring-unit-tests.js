import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../server/.env') });

const { default: mongoose } = await import('../../server/node_modules/mongoose/index.js');
const { default: Profile } = await import('../../server/models/Profile.js');
const { 
  calculateGithubScore, 
  calculateDsaScore, 
  calculateCpScore, 
  calculateUnifiedScore, 
  recalculateAndSaveScore 
} = await import('../../server/services/developerScoringService.js');
const { acquireSyncLock, releaseSyncLock } = await import('../../server/services/syncLockService.js');

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

// ─── TEST 1: GitHub Score formula regression ─────────────────────────────────
test('GitHub scoring formula regression', () => {
  const metrics = {
    publicRepos: 10,
    followers: 2,
    stars: 10,
    forks: 4,
    topics: ['react', 'node']
  };

  const score = calculateGithubScore(metrics);
  // Expected:
  // Repo Points: min(100, 10 * 5) = 50. Weighted (20%): 10
  // Star Points: min(100, (ln(11)/ln(1.5)) * 10) = min(100, 59.13) = 59.13. Weighted (40%): 23.65
  // Fork Points: min(100, (ln(5)/ln(1.5)) * 15) = min(100, 59.54) = 59.54. Weighted (20%): 11.91
  // Follower Points: min(100, 2 * 5) = 10. Weighted (10%): 1
  // Quality Points: matchingTopics.length * 20 = 2 * 20 = 40. Weighted (10%): 4
  // Total: 10 + 23.65 + 11.91 + 1 + 4 = 50.56 -> round to 51
  if (score !== 51) {
    throw new Error(`Expected GitHub score to be 51, got ${score}`);
  }
});

// ─── TEST 2: LeetCode Score formula regression ───────────────────────────────
test('LeetCode / DSA scoring formula regression', () => {
  const metrics = {
    totalSolved: 120,
    easySolved: 50,
    mediumSolved: 50,
    hardSolved: 20,
    contestRating: 1500
  };

  const score = calculateDsaScore(metrics);
  // Expected (v2.0.0):
  // Easy Points: min(100, (50/100)*100) = 50. Weighted (20%): 10
  // Med+Hard Points: min(100, ((50*1 + 20*2.5)/150)*100) = min(100, (100/150)*100) = 66.67. Weighted (30%): 20
  // Contest Points: min(100, ((1500-1000)/1000)*100) = 50. Weighted (50%): 25
  // Total: 10 + 20 + 25 = 55
  if (score !== 55) {
    throw new Error(`Expected DSA score to be 55, got ${score}`);
  }
});

// ─── TEST 3: Codeforces CP Score formula regression ──────────────────────────
test('Codeforces CP scoring formula regression', () => {
  const metrics = {
    rating: 1400
  };

  const score = calculateCpScore(metrics);
  // Expected:
  // Points: min(100, ((1400-800)/1200)*100) = 50
  if (score !== 50) {
    throw new Error(`Expected CP score to be 50, got ${score}`);
  }
});

// ─── TEST 4: Dynamic normalization for single platform ──────────────────────
test('Normalization logic: Single platform connected', () => {
  const mockProfile = {
    githubScore: 0,
    dsaScore: 80,
    cpScore: 0,
    achievementPoints: 0,
    placementReadinessScore: 0,
    codingStats: {
      profiles: {
        leetcode: 'test_leetcode'
      }
    }
  };

  const { score, breakdown } = calculateUnifiedScore(mockProfile);
  // Expected base: (80 * 0.35) / 0.35 = 80
  // Bonuses: 0
  // Unified Score: 80
  if (score !== 80) {
    throw new Error(`Expected normalized score to be 80, got ${score}`);
  }
  if (breakdown.githubWeight !== 0 || breakdown.dsaWeight !== 0.35 || breakdown.cpWeight !== 0) {
    throw new Error(`Expected weights: DSA=0.35, GitHub=0, CP=0. Got ${JSON.stringify(breakdown)}`);
  }
});

// ─── TEST 5: Dynamic normalization for multiple platforms ───────────────────
test('Normalization logic: Multiple platforms connected', () => {
  const mockProfile = {
    githubScore: 60,
    dsaScore: 80,
    cpScore: 0,
    achievementPoints: 0,
    placementReadinessScore: 0,
    codingStats: {
      profiles: {
        github: 'test_github',
        leetcode: 'test_leetcode'
      }
    }
  };

  const { score } = calculateUnifiedScore(mockProfile);
  // Expected base: (60 * 0.30 + 80 * 0.35) / (0.30 + 0.35) = (18 + 28) / 0.65 = 46 / 0.65 = 70.76 -> round to 71
  if (score !== 71) {
    throw new Error(`Expected normalized score to be 71, got ${score}`);
  }
});

// ─── TEST 6: Missing platform handles returning zero ────────────────────────
test('Missing platform handles returns zero score cleanly without NaN', () => {
  const mockProfile = {
    githubScore: 80,
    dsaScore: 90,
    cpScore: 70,
    achievementPoints: 0,
    placementReadinessScore: 0,
    codingStats: {
      profiles: {}
    }
  };

  const { score } = calculateUnifiedScore(mockProfile);
  if (score !== 0) {
    throw new Error(`Expected score to be 0 for no profiles linked, got ${score}`);
  }
});

// ─── TEST 7: Sync lock acquire, release, concurrency and timeout expiry ─────
test('Sync Lock management logic', async () => {
  const testUserId = new mongoose.Types.ObjectId();
  
  // Create test Profile document
  const profile = await Profile.create({
    userId: testUserId,
    codingStats: {
      isSyncing: false,
      syncStartedAt: null,
      profiles: { github: 'lock_test' }
    }
  });

  try {
    // 1. Acquire Lock
    const lockedProfile = await acquireSyncLock(testUserId);
    if (!lockedProfile.codingStats.isSyncing || !lockedProfile.codingStats.syncStartedAt) {
      throw new Error('Lock should be set to true and syncStartedAt populated');
    }

    // 2. Concurrency block check
    let blocked = false;
    try {
      await acquireSyncLock(testUserId);
    } catch {
      blocked = true;
    }
    if (!blocked) {
      throw new Error('Expected concurrent sync lock request to fail');
    }

    // 3. Expiry check (Older than 10 minutes)
    const elevenMinsAgo = new Date(Date.now() - 11 * 60 * 1000);
    await Profile.updateOne(
      { userId: testUserId },
      { $set: { 'codingStats.syncStartedAt': elevenMinsAgo } }
    );
    const reclaimedProfile = await acquireSyncLock(testUserId);
    if (!reclaimedProfile.codingStats.isSyncing || reclaimedProfile.codingStats.syncStartedAt.getTime() === elevenMinsAgo.getTime()) {
      throw new Error('Lock should be reclaimed and syncStartedAt updated to now');
    }

    // 4. Release Lock
    const unlockedProfile = await releaseSyncLock(testUserId);
    if (unlockedProfile.codingStats.isSyncing || unlockedProfile.codingStats.syncStartedAt !== null) {
      throw new Error('Lock should be released and syncStartedAt set to null');
    }

  } finally {
    // Clean up
    await Profile.deleteOne({ userId: testUserId });
  }
});

// ─── TEST 8: Recalculate score and save ──────────────────────────────────────
test('Version upgrades and score calculations database saving', async () => {
  const testUserId = new mongoose.Types.ObjectId();
  
  const profile = await Profile.create({
    userId: testUserId,
    achievementPoints: 20, // Should add 2 bonus points
    placementReadinessScore: 50, // Should add 1 bonus point
    developerScoreVersion: 0,
    codingStats: {
      profiles: { github: 'score_test', leetcode: 'score_test' },
      rawMetrics: {
        github: { publicRepos: 10, effectiveRepositoryCount: 10, followers: 2, stars: 10, forks: 4, topics: ['react', 'node'] }, // GithubScore: 51
        leetcode: { totalSolved: 120, easySolved: 50, mediumSolved: 50, hardSolved: 20, contestRating: 1500 } // DsaScore: 55
      }
    }
  });

  try {
    const updated = await recalculateAndSaveScore(profile._id, 'unit test execution');

    // Expected subscores
    if (updated.githubScore !== 51 || updated.dsaScore !== 55 || updated.cpScore !== 0) {
      throw new Error(`Subscores calculated incorrectly. Github: ${updated.githubScore}, DSA: ${updated.dsaScore}`);
    }

    // Expected Unified (v2.0.0): (51 * 0.3 + 55 * 0.35) / 0.65 = (15.3 + 19.25) / 0.65 = 34.55 / 0.65 = 53.15
    // Plus Academic Bonus: 20 * 0.1 = 2
    // Plus Readiness Bonus: 50 * 0.02 = 1
    // Expected Unified Score = 53.15 + 2 + 1 = 56.15 -> round to 56
    if (updated.developerScore !== 56) {
      throw new Error(`Expected unified score to be 56, got ${updated.developerScore}`);
    }

    // Expected breakdown details
    if (updated.scoreBreakdown.githubWeight !== 0.3 || updated.scoreBreakdown.dsaWeight !== 0.35 || updated.scoreBreakdown.achievementBonus !== 2 || updated.scoreBreakdown.readinessBonus !== 1) {
      throw new Error(`Breakdown saved incorrectly: ${JSON.stringify(updated.scoreBreakdown)}`);
    }

    // Expected version updates (v2.0.0)
    if (updated.developerScoreVersion !== 2 || updated.scoringFormulaVersion !== 'v2.0.0') {
      throw new Error(`Expected version 2, formula v2.0.0. Got version ${updated.developerScoreVersion}, formula ${updated.scoringFormulaVersion}`);
    }

    // Expected audit logs
    if (updated.lastScoreCalculationReason !== 'unit test execution' || !updated.lastScoreCalculatedAt) {
      throw new Error('Audit logs not saved correctly');
    }

  } finally {
    await Profile.deleteOne({ userId: testUserId });
  }
});

// ─── RUNNER ──────────────────────────────────────────────────────────────────
async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('CRITICAL: MONGODB_URI is not defined in environment variables.');
    process.exit(1);
  }

  console.log('Connecting to MongoDB for testing...');
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 30000 });
  console.log('MongoDB connected.');

  console.log(`Running ${tests.length} developer scoring unit tests...\n`);
  
  let failed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log(` ✅ PASS: ${t.name}`);
    } catch (err) {
      console.error(` ❌ FAIL: ${t.name}`);
      console.error(`    -> ${err.message}`);
      failed++;
    }
  }

  await mongoose.disconnect();
  console.log('\nTesting completed.');
  
  if (failed > 0) {
    console.log(`\nResult: FAILED (${failed} test(s) failed).`);
    process.exit(1);
  } else {
    console.log('\nResult: ALL TESTS PASSED.');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
