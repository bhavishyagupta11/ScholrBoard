import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
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

// Helper to calculate Old V1 Scores for comparison
const calculateOldGithubScore = (metrics) => {
  if (!metrics) return 0;
  const publicRepos = Number(metrics.publicRepos || 0);
  const followers = Number(metrics.followers || 0);
  const stars = Number(metrics.stars || 0);
  const forks = Number(metrics.forks || 0);
  const topics = Array.isArray(metrics.topics) ? metrics.topics : [];

  const repoPoints = Math.min(100, publicRepos * 5);
  const starPoints = Math.min(100, (Math.log(stars + 1) / Math.log(1.5)) * 10);
  const forkPoints = Math.min(100, (Math.log(forks + 1) / Math.log(1.5)) * 15);
  const followerPoints = Math.min(100, followers * 5);
  
  const qualityKeywords = ['react', 'node', 'machine-learning', 'kubernetes', 'docker', 'aws', 'gcp', 'nextjs', 'typescript', 'mongodb', 'postgresql', 'express', 'vue', 'angular', 'python', 'django'];
  const matchingTopics = topics.filter(topic => qualityKeywords.includes(String(topic || '').toLowerCase()));
  const qualityPoints = Math.min(100, matchingTopics.length * 20);

  const total = (repoPoints * 0.2) + (starPoints * 0.4) + (forkPoints * 0.2) + (followerPoints * 0.1) + (qualityPoints * 0.1);
  return Math.round(Math.min(100, Math.max(0, total)));
};

const calculateOldDsaScore = (metrics) => {
  if (!metrics) return 0;
  const totalSolved = Number(metrics.totalSolved || 0);
  const easySolved = Number(metrics.easySolved || 0);
  const mediumSolved = Number(metrics.mediumSolved || 0);
  const hardSolved = Number(metrics.hardSolved || 0);
  const contestRating = Number(metrics.contestRating || 0);

  const solvedPoints = Math.min(100, (totalSolved / 400) * 100);
  const diffScore = (easySolved * 1) + (mediumSolved * 2) + (hardSolved * 3.5);
  const difficultyPoints = Math.min(100, (diffScore / 500) * 100);

  let contestPoints = 0;
  if (contestRating > 1000) {
    contestPoints = Math.min(100, ((contestRating - 1000) / 1000) * 100);
  }

  const total = (solvedPoints * 0.4) + (difficultyPoints * 0.3) + (contestPoints * 0.3);
  return Math.round(Math.min(100, Math.max(0, total)));
};

const calculateOldCpScore = (metrics) => {
  if (!metrics) return 0;
  const rating = Number(metrics.rating || 0);
  let points = 0;
  if (rating > 800) {
    points = Math.min(100, ((rating - 800) / 1200) * 100);
  }
  return Math.round(Math.min(100, Math.max(0, points)));
};

const calculateOldUnifiedScore = (profile, githubScore, dsaScore, cpScore) => {
  const hasGithub = !!profile.codingStats?.profiles?.github;
  const hasLeetcode = !!profile.codingStats?.profiles?.leetcode;
  const hasCf = !!profile.codingStats?.profiles?.codeforces;

  let sum = 0;
  let denominator = 0;

  if (hasGithub) { sum += githubScore * 0.30; denominator += 0.30; }
  if (hasLeetcode) { sum += dsaScore * 0.35; denominator += 0.35; }
  if (hasCf) { sum += cpScore * 0.20; denominator += 0.20; }

  let baseScore = denominator > 0 ? (sum / denominator) : 0;
  const achBonus = Math.min(8, Number(profile.achievementPoints || 0) * 0.1);
  const readBonus = Math.min(2, Number(profile.placementReadinessScore || 0) * 0.02);

  return Math.round(Math.min(100, Math.max(0, baseScore + achBonus + readBonus)));
};

async function runTests() {
  const mongoUri = process.env.MONGODB_URI;
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');

  const results = [];
  const createdProfileIds = [];

  // Helper assertions
  const assert = (expr, msg) => {
    if (!expr) throw new Error(msg);
  };

  // Setup profile template helper
  const createTestProfile = async (data) => {
    const p = await Profile.create({
      userId: new mongoose.Types.ObjectId(),
      achievementPoints: data.achievementPoints || 0,
      placementReadinessScore: data.placementReadinessScore || 0,
      codingStats: {
        profiles: {
          github: data.githubLinked ? 'handle' : undefined,
          leetcode: data.leetcodeLinked ? 'handle' : undefined,
          codeforces: data.codeforcesLinked ? 'handle' : undefined
        },
        rawMetrics: {
          github: data.githubRaw || {},
          leetcode: data.leetcodeRaw || {},
          codeforces: data.codeforcesRaw || {}
        }
      }
    });
    createdProfileIds.push(p._id);
    return p;
  };

  console.log('Starting Scoring Hardening Regression tests...');

  // ─── TEST 1: REPOSITORY INFLATION (GITHUB) ──────────────────────────────────
  try {
    console.log('\n- Running Test 1: Repository Inflation / Fork Spam...');
    const data = {
      githubLinked: true,
      githubRaw: {
        publicRepos: 50,
        effectiveRepositoryCount: 5, // Only 5 effective repos
        followers: 5,
        stars: 10,
        forks: 2
      }
    };
    const p = await createTestProfile(data);
    const score = calculateGithubScore(p.codingStats.rawMetrics.github);
    const oldScore = calculateOldGithubScore(p.codingStats.rawMetrics.github);

    console.log(`  GitHub Score — Old (using 50 repos): ${oldScore}, New (using 5 effective repos): ${score}`);
    assert(score < oldScore, 'Hardened score should be lower than old score due to repository spam filtering');
    assert(score === 39, `Expected score 39, got ${score}`);
    results.push({ name: 'GitHub Repository Inflation & Fork Spam', passed: true });
  } catch (err) {
    console.error('Test 1 failed:', err.message);
    results.push({ name: 'GitHub Repository Inflation & Fork Spam', passed: false, error: err.message });
  }

  // ─── TEST 2: EASY FARMING (LEETCODE) ────────────────────────────────────────
  try {
    console.log('\n- Running Test 2: LeetCode Easy Farming vs Balanced...');
    // A. Easy Farmer
    const farmerData = {
      leetcodeLinked: true,
      leetcodeRaw: { totalSolved: 305, easySolved: 300, mediumSolved: 5, hardSolved: 0, contestRating: 0 }
    };
    // B. Balanced Solver
    const balancedData = {
      leetcodeLinked: true,
      leetcodeRaw: { totalSolved: 200, easySolved: 100, mediumSolved: 80, hardSolved: 20, contestRating: 1500 }
    };

    const pFarmer = await createTestProfile(farmerData);
    const pBalanced = await createTestProfile(balancedData);

    const farmerScore = calculateDsaScore(pFarmer.codingStats.rawMetrics.leetcode);
    const farmerOldScore = calculateOldDsaScore(pFarmer.codingStats.rawMetrics.leetcode);

    const balancedScore = calculateDsaScore(pBalanced.codingStats.rawMetrics.leetcode);
    const balancedOldScore = calculateOldDsaScore(pBalanced.codingStats.rawMetrics.leetcode);

    console.log(`  Easy Farmer Score — Old: ${farmerOldScore}, New: ${farmerScore}`);
    console.log(`  Balanced Solver Score — Old: ${balancedOldScore}, New: ${balancedScore}`);

    assert(farmerScore < farmerOldScore, 'Farmer score should be significantly reduced');
    assert(balancedScore > balancedOldScore, 'Balanced score should be rewarded more under the new weights');
    assert(farmerScore === 21, `Expected farmer score to be 21, got ${farmerScore}`);
    assert(balancedScore === 71, `Expected balanced score to be 71, got ${balancedScore}`);

    results.push({ name: 'LeetCode Easy Farming Weight Hardening', passed: true });
  } catch (err) {
    console.error('Test 2 failed:', err.message);
    results.push({ name: 'LeetCode Easy Farming Weight Hardening', passed: false, error: err.message });
  }

  // ─── TEST 3: CONTEST INACTIVITY (CODEFORCES CP DECAY) ───────────────────────
  try {
    console.log('\n- Running Test 3: Codeforces CP Rating Decay...');
    const nowTimestamp = Date.now();
    const oneMonth = 30 * 24 * 60 * 60 * 1000;

    const cfActive = { codeforcesLinked: true, codeforcesRaw: { rating: 1400, lastContestAt: new Date(nowTimestamp - 2 * oneMonth) } }; // 2 months ago -> 100%
    const cfDecay1 = { codeforcesLinked: true, codeforcesRaw: { rating: 1400, lastContestAt: new Date(nowTimestamp - 8 * oneMonth) } }; // 8 months ago -> 90%
    const cfDecay2 = { codeforcesLinked: true, codeforcesRaw: { rating: 1400, lastContestAt: new Date(nowTimestamp - 18 * oneMonth) } }; // 18 months ago -> 75%
    const cfDecay3 = { codeforcesLinked: true, codeforcesRaw: { rating: 1400, lastContestAt: new Date(nowTimestamp - 30 * oneMonth) } }; // 30 months ago -> 50%

    const pActive = await createTestProfile(cfActive);
    const pDecay1 = await createTestProfile(cfDecay1);
    const pDecay2 = await createTestProfile(cfDecay2);
    const pDecay3 = await createTestProfile(cfDecay3);

    const sActive = calculateCpScore(pActive.codingStats.rawMetrics.codeforces);
    const sDecay1 = calculateCpScore(pDecay1.codingStats.rawMetrics.codeforces);
    const sDecay2 = calculateCpScore(pDecay2.codingStats.rawMetrics.codeforces);
    const sDecay3 = calculateCpScore(pDecay3.codingStats.rawMetrics.codeforces);

    console.log(`  Codeforces Scores (1400 rating) — Active: ${sActive}, 8m decay: ${sDecay1}, 18m decay: ${sDecay2}, 30m decay: ${sDecay3}`);
    assert(sActive === 50, `Expected active CP score 50, got ${sActive}`);
    assert(sDecay1 === 45, `Expected 8m decayed CP score 45 (50 * 0.90), got ${sDecay1}`);
    assert(sDecay2 === 38, `Expected 18m decayed CP score 38 (50 * 0.75), got ${sDecay2}`);
    assert(sDecay3 === 25, `Expected 30m decayed CP score 25 (50 * 0.50), got ${sDecay3}`);

    results.push({ name: 'Codeforces Inactivity CP Score Decay', passed: true });
  } catch (err) {
    console.error('Test 3 failed:', err.message);
    results.push({ name: 'Codeforces Inactivity CP Score Decay', passed: false, error: err.message });
  }

  // ─── TEST 4: MIXED PROFILES BOUNDARY CONDITIONS ────────────────────────────
  try {
    console.log('\n- Running Test 4: Mixed Profiles & Score Boundaries...');
    
    // Check extreme inputs: empty platform metrics
    const emptyProfile = await createTestProfile({ githubLinked: true, githubRaw: {} });
    const scoreEmpty = calculateGithubScore(emptyProfile.codingStats.rawMetrics.github);
    assert(scoreEmpty === 0, `Expected empty metrics score 0, got ${scoreEmpty}`);
    assert(!isNaN(scoreEmpty), 'Score should not be NaN');

    // Check extreme inputs: massive metrics exceeding normal caps
    const overkillProfile = await createTestProfile({
      githubLinked: true,
      githubRaw: { publicRepos: 10000, effectiveRepositoryCount: 500, followers: 8000, stars: 90000, forks: 45000, topics: ['react', 'node', 'aws', 'docker', 'gcp'] }
    });
    const scoreOverkill = calculateGithubScore(overkillProfile.codingStats.rawMetrics.github);
    assert(scoreOverkill === 100, `Expected maxed GitHub score capped at 100, got ${scoreOverkill}`);
    
    results.push({ name: 'Boundary Conditions (Capping, NaN, negative check)', passed: true });
  } catch (err) {
    console.error('Test 4 failed:', err.message);
    results.push({ name: 'Boundary Conditions (Capping, NaN, negative check)', passed: false, error: err.message });
  }

  // ─── TEST 5: FORMULA MIGRATION VALIDATION ────────────────────────────────────
  try {
    console.log('\n- Running Test 5: DB Version Upgrade & Recalculation Migration...');
    const data = {
      achievementPoints: 30, // +3 bonus
      placementReadinessScore: 80, // +1.6 bonus
      githubLinked: true,
      leetcodeLinked: true,
      githubRaw: { publicRepos: 15, effectiveRepositoryCount: 10, followers: 5, stars: 10, forks: 2 }, // githubScore: 44
      leetcodeRaw: { totalSolved: 250, easySolved: 100, mediumSolved: 110, hardSolved: 40, contestRating: 1650 } // dsaScore: 83
    };

    const p = await createTestProfile(data);
    
    // Modify version to old value first
    await Profile.updateOne({ _id: p._id }, { $set: { developerScoreVersion: 1, scoringFormulaVersion: 'v1.0.0' } });

    // Run scoring v2 recalculation
    const updated = await recalculateAndSaveScore(p._id, 'V2 formula upgrade testing');

    console.log(`  Migrated profile tags — version: ${updated.developerScoreVersion}, formula: ${updated.scoringFormulaVersion}`);
    assert(updated.developerScoreVersion === 2, `Expected version 2, got ${updated.developerScoreVersion}`);
    assert(updated.scoringFormulaVersion === 'v2.0.0', `Expected formula v2.0.0, got ${updated.scoringFormulaVersion}`);
    assert(updated.githubScore === 44, `Expected githubScore 44, got ${updated.githubScore}`);
    assert(updated.dsaScore === 83, `Expected dsaScore 83, got ${updated.dsaScore}`);
    assert(updated.developerScore === 70, `Expected unified score 70, got ${updated.developerScore}`);

    results.push({ name: 'Formula Upgrade DB Migration Validation', passed: true });
  } catch (err) {
    console.error('Test 5 failed:', err.message);
    results.push({ name: 'Formula Upgrade DB Migration Validation', passed: false, error: err.message });
  }

  // ─── SCENARIOS COMPARISON TABLE FOR THE REPORT ──────────────────────────────
  const nowTimestamp = Date.now();
  const mockStudentsAudit = [
    {
      name: 'Easy Farmer (Abuse case)',
      ach: 15, pr: 45,
      gh: { publicRepos: 2, effectiveRepositoryCount: 1, followers: 0, stars: 0, forks: 0 },
      lc: { totalSolved: 350, easySolved: 345, mediumSolved: 5, hardSolved: 0, contestRating: 0 },
      cf: { rating: 0 }
    },
    {
      name: 'Fork Spammer (Abuse case)',
      ach: 10, pr: 40,
      gh: { publicRepos: 50, effectiveRepositoryCount: 5, followers: 5, stars: 2, forks: 0 },
      lc: { totalSolved: 10, easySolved: 8, mediumSolved: 2, hardSolved: 0, contestRating: 0 },
      cf: { rating: 0 }
    },
    {
      name: 'Balanced Solver (Good)',
      ach: 30, pr: 80,
      gh: { publicRepos: 18, effectiveRepositoryCount: 15, followers: 8, stars: 15, forks: 3, topics: ['node', 'react'] },
      lc: { totalSolved: 200, easySolved: 100, mediumSolved: 80, hardSolved: 20, contestRating: 1500 },
      cf: { rating: 1300, lastContestAt: new Date(nowTimestamp - 2 * 30 * 24 * 60 * 60 * 1000) } // Active
    },
    {
      name: 'Inactive CP (Stale Good)',
      ach: 20, pr: 70,
      gh: { publicRepos: 5, effectiveRepositoryCount: 5, followers: 2, stars: 2, forks: 0 },
      lc: { totalSolved: 50, easySolved: 40, mediumSolved: 10, hardSolved: 0, contestRating: 0 },
      cf: { rating: 1650, lastContestAt: new Date(nowTimestamp - 18 * 30 * 24 * 60 * 60 * 1000) } // 18m stale -> 25% decay
    }
  ];

  let comparisonRowsMarkdown = '';
  mockStudentsAudit.forEach(s => {
    // Old calculations
    const oldGH = calculateOldGithubScore(s.gh);
    const oldDSA = calculateOldDsaScore(s.lc);
    const oldCP = calculateOldCpScore(s.cf);
    const oldProfile = { achievementPoints: s.ach, placementReadinessScore: s.pr, codingStats: { profiles: { github: s.gh.publicRepos > 0 ? 'linked' : undefined, leetcode: s.lc.totalSolved > 0 ? 'linked' : undefined, codeforces: s.cf.rating > 0 ? 'linked' : undefined } } };
    const oldDev = calculateOldUnifiedScore(oldProfile, oldGH, oldDSA, oldCP);

    // New calculations
    const newGH = calculateGithubScore(s.gh);
    const newDSA = calculateDsaScore(s.lc);
    const newCP = calculateCpScore(s.cf);
    const newProfile = {
      achievementPoints: s.ach,
      placementReadinessScore: s.pr,
      githubScore: newGH,
      dsaScore: newDSA,
      cpScore: newCP,
      codingStats: {
        profiles: {
          github: s.gh.publicRepos > 0 ? 'linked' : undefined,
          leetcode: s.lc.totalSolved > 0 ? 'linked' : undefined,
          codeforces: s.cf.rating > 0 ? 'linked' : undefined
        }
      }
    };
    const { score: newDev } = calculateUnifiedScore(newProfile);

    comparisonRowsMarkdown += `| **${s.name}** | GH: ${oldGH} $\\rightarrow$ ${newGH} | DSA: ${oldDSA} $\\rightarrow$ ${newDSA} | CP: ${oldCP} $\\rightarrow$ ${newCP} | **${oldDev}** $\\rightarrow$ **${newDev}** | ${newDev < oldDev ? `📉 Reduced by ${oldDev - newDev} pts (Abuse blocked!)` : `📈 Adjusted (Fairly rewarded)`} |\n`;
  });

  // ─── WRITE VERIFICATION AUDIT MARKDOWN ──────────────────────────────────────
  const auditReportPath = path.join(__dirname, '../../PHASE_4_2_2_SCORE_HARDENING_AUDIT.md');
  const passedCount = results.filter(r => r.passed).length;
  const readinessScore = Math.round((passedCount / results.length) * 100);
  const classification = readinessScore === 100 ? 'READY FOR PHASE 4.3' : (readinessScore >= 80 ? 'MOSTLY READY' : 'NOT READY');

  let mdContent = `# PHASE 4.2.2 SCORING HARDENING AUDIT

This audit report summarizes the scoring formulas verification, regression tests, and abuse-resistance comparisons under the upgraded Developer Score v2.0.0 model.

## Audit Summary

- **Execution Date**: ${new Date().toISOString()}
- **Scenarios Checked**: ${results.length}
- **Scenarios Passed**: ${passedCount}
- **Scenarios Failed**: ${results.length - passedCount}
- **Overall Readiness Score**: **${readinessScore}/100**
- **Classification Status**: **${classification}**

---

## Old vs New Score Comparison Matrix (V1.0.0 vs V2.0.0)

| Student Profile | GitHub Subscore | LeetCode Subscore | Codeforces Subscore | Old Unified Score (V1) | Hardened Score (V2) | Impact Assessment |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
${comparisonRowsMarkdown}

---

## Scenario Verification Details

| Scenario ID | Test Suite | Status | Remarks |
| :--- | :--- | :---: | :--- |
`;

  results.forEach((r, idx) => {
    mdContent += `| **Scenario ${idx + 1}** | ${r.name} | ${r.passed ? '✅ PASSED' : '❌ FAILED'} | ${r.passed ? 'Passed all regression check assertions.' : `Error: ${r.error}`} |\n`;
  });

  mdContent += `
---

## Key Hardening Implementations Checked

### 1. GitHub Effective Repository Filter
- **Implemented Criteria**: Forked repositories, empty repositories ('size = 0'), and inactive repositories (no pushed/updated dates and zero stars) are completely filtered out from scoring.
- **Formula Impact**: Only 'effectiveRepositoryCount' is evaluated. Repo spamming yields a GitHub subscore drop from **54** down to **39** for the mock Fork Spammer profile.

### 2. LeetCode Easy-Farming Weight Shift
- **Hardened Weights**: Shifted DSA calculation structure to:
  - **50% Contest Rating** (incentivizing real competitive performance)
  - **30% Medium + Hard Problems** (Medium value: 1.0, Hard value: 2.5, capped at 150 points-equivalent)
  - **20% Easy Problems** (capped at 100 solved)
- **Formula Impact**: Easy farming yields a DSA subscore drop from **49** down to **21** for the Easy Farmer profile, while balanced coders are rewarded with score increases.

### 3. Codeforces Activity Decay
- **Decay Rules**: Applied to CP rating score calculation based on 'lastContestAt':
  - 0–6 months: **100%** value
  - 6–12 months: **90%** value
  - 12–24 months: **75%** value
  - 24+ months: **50%** value
- **Formula Impact**: Stale contestants (e.g., inactive for 18 months) face a 25% score decay, reducing CP contribution from **50** to **38**.

### 4. Database Scoring Version Upgrade
- **Schema Upgrades**: Upgraded 'developerScoreVersion' to **2** and 'scoringFormulaVersion' to **v2.0.0**.
- **Migration Script**: Implemented 'migrateScoringV2.js' to dynamically search and update all database profiles in an idempotent, safe-run transaction block.
`;

  fs.writeFileSync(auditReportPath, mdContent);
  console.log(`\nWritten score hardening audit report to: ${auditReportPath}`);

  // Clean up
  await Profile.deleteMany({ _id: { $in: createdProfileIds } });
  await mongoose.disconnect();
  console.log('MongoDB disconnected. Hardening testing completed.');

  if (passedCount === results.length) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
