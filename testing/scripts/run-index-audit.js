import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../server/.env') });

const { default: mongoose } = await import('../../server/node_modules/mongoose/index.js');
const { default: Profile } = await import('../../server/models/Profile.js');

async function runIndexAudit() {
  const mongoUri = process.env.MONGODB_URI_TEST;
  await mongoose.connect(mongoUri);
  const dbName = mongoose.connection.db.databaseName;
  if (dbName !== 'scholrboard_test') {
    await mongoose.disconnect();
    throw new Error('CRITICAL SAFETY ERROR: Execution is only allowed on the test database "scholrboard_test". Currently connected to: "' + dbName + '". Execution aborted!');
  }


  console.log('Inspecting physical database indexes on Profiles...');
  const indexes = await Profile.collection.getIndexes();
  console.log('Indexes found:', JSON.stringify(indexes, null, 2));

  const requiredIndexKeys = [
    'developerScore_1',
    'githubScore_1',
    'dsaScore_1',
    'cpScore_1',
    'skills_1',
    'gpa_1',
    'developerScore_-1_gpa_-1'
  ];

  const missing = [];
  for (const idx of requiredIndexKeys) {
    if (!indexes[idx]) {
      missing.push(idx);
    }
  }

  if (missing.length > 0) {
    console.error('❌ MISSING INDEXES:', missing);
  } else {
    console.log('✅ All requested physical indexes are present in MongoDB.');
  }

  console.log('\nMeasuring query execution performance via explain()...');
  
  // 1. Sort by developerScore
  const q1Start = performance.now();
  const expl1 = await Profile.find({}).sort({ developerScore: -1 }).explain('executionStats');
  const q1Time = performance.now() - q1Start;
  const plan1 = expl1.queryPlanner?.winningPlan || {};
  console.log(`- Query: Sort by developerScore | Time: ${q1Time.toFixed(2)}ms | Winning Plan Stage: ${plan1.stage || 'COLLSCAN'}`);

  // 2. Sort by GPA
  const q2Start = performance.now();
  const expl2 = await Profile.find({}).sort({ gpa: -1 }).explain('executionStats');
  const q2Time = performance.now() - q2Start;
  const plan2 = expl2.queryPlanner?.winningPlan || {};
  console.log(`- Query: Sort by GPA | Time: ${q2Time.toFixed(2)}ms | Winning Plan Stage: ${plan2.stage || 'COLLSCAN'}`);

  // 3. Skill search
  const q3Start = performance.now();
  const expl3 = await Profile.find({ skills: 'React' }).explain('executionStats');
  const q3Time = performance.now() - q3Start;
  const plan3 = expl3.queryPlanner?.winningPlan || {};
  console.log(`- Query: Filter by skill | Time: ${q3Time.toFixed(2)}ms | Winning Plan Stage: ${plan3.stage || 'COLLSCAN'}`);

  // 4. Combined Score + GPA sort
  const q4Start = performance.now();
  const expl4 = await Profile.find({}).sort({ developerScore: -1, gpa: -1 }).explain('executionStats');
  const q4Time = performance.now() - q4Start;
  const plan4 = expl4.queryPlanner?.winningPlan || {};
  console.log(`- Query: Sort by developerScore + GPA | Time: ${q4Time.toFixed(2)}ms | Winning Plan Stage: ${plan4.stage || 'COLLSCAN'}`);

  await mongoose.disconnect();
  process.exit(missing.length > 0 ? 1 : 0);
}

runIndexAudit().catch(err => {
  console.error(err);
  process.exit(1);
});
