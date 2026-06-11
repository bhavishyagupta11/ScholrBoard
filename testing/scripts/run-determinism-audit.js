import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../server/.env') });

const { default: mongoose } = await import('../../server/node_modules/mongoose/index.js');
const { default: Profile } = await import('../../server/models/Profile.js');
const { recalculateAndSaveScore } = await import('../../server/services/developerScoringService.js');

async function runAudit() {
  const mongoUri = process.env.MONGODB_URI;
  await mongoose.connect(mongoUri);

  const testUserId = new mongoose.Types.ObjectId();

  // 1. Create a test profile
  const profile = await Profile.create({
    userId: testUserId,
    achievementPoints: 35,
    placementReadinessScore: 78,
    codingStats: {
      profiles: { github: 'audit_github', leetcode: 'audit_leetcode', codeforces: 'cf_audit' },
      rawMetrics: {
        github: { publicRepos: 15, followers: 12, stars: 22, forks: 8, topics: ['react', 'node', 'docker'] },
        leetcode: { totalSolved: 250, easySolved: 100, mediumSolved: 110, hardSolved: 40, contestRating: 1680 },
        codeforces: { rating: 1520, maxRating: 1600 }
      }
    }
  });

  console.log('Test Profile created. Running first calculation...');
  const res1 = await recalculateAndSaveScore(profile._id, 'determinism audit run 1');

  console.log('Running second calculation...');
  const res2 = await recalculateAndSaveScore(profile._id, 'determinism audit run 2');

  const driftFields = [];

  // Compare values
  if (res1.githubScore !== res2.githubScore) driftFields.push(`githubScore: ${res1.githubScore} -> ${res2.githubScore}`);
  if (res1.dsaScore !== res2.dsaScore) driftFields.push(`dsaScore: ${res1.dsaScore} -> ${res2.dsaScore}`);
  if (res1.cpScore !== res2.cpScore) driftFields.push(`cpScore: ${res1.cpScore} -> ${res2.cpScore}`);
  if (res1.developerScore !== res2.developerScore) driftFields.push(`developerScore: ${res1.developerScore} -> ${res2.developerScore}`);

  const b1 = res1.scoreBreakdown.toObject();
  const b2 = res2.scoreBreakdown.toObject();
  
  if (b1.githubWeight !== b2.githubWeight) driftFields.push(`breakdown.githubWeight: ${b1.githubWeight} -> ${b2.githubWeight}`);
  if (b1.dsaWeight !== b2.dsaWeight) driftFields.push(`breakdown.dsaWeight: ${b1.dsaWeight} -> ${b2.dsaWeight}`);
  if (b1.cpWeight !== b2.cpWeight) driftFields.push(`breakdown.cpWeight: ${b1.cpWeight} -> ${b2.cpWeight}`);
  if (b1.achievementBonus !== b2.achievementBonus) driftFields.push(`breakdown.achievementBonus: ${b1.achievementBonus} -> ${b2.achievementBonus}`);
  if (b1.readinessBonus !== b2.readinessBonus) driftFields.push(`breakdown.readinessBonus: ${b1.readinessBonus} -> ${b2.readinessBonus}`);

  await Profile.deleteOne({ _id: profile._id });
  await mongoose.disconnect();

  if (driftFields.length > 0) {
    console.error('❌ DRIFT DISCOVERED!');
    console.error(driftFields.join('\n'));
    process.exit(1);
  } else {
    console.log('✅ AUDIT PASSED: Scoring is 100% deterministic. No drift detected.');
    process.exit(0);
  }
}

runAudit().catch(err => {
  console.error(err);
  process.exit(1);
});
