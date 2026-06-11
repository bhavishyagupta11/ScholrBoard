/**
 * Phase 4.3.1 Benchmark — Optimized Talent Discovery
 *
 * Tests the Profile-first aggregation pipeline at four dataset sizes:
 *   10k, 25k, 50k, 100k
 *
 * For each size it measures:
 *   Query 1 — Default sort by developerScore (bare index scan)
 *   Query 2 — Complex filter (GPA ≥ 7.5, devScore ≥ 50, skill: react)
 *   Query 3 — Keyword search ("Student 5")
 *   Explain  — IXSCAN vs COLLSCAN detection on Query 1
 *
 * Run with:
 *   node server/scripts/benchmarkTalentDiscovery.js
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const { default: mongoose } = await import('../node_modules/mongoose/index.js');
const { default: User }    = await import('../models/User.js');
const { default: Profile } = await import('../models/Profile.js');
const { default: ResumeAnalysis } = await import('../models/ResumeAnalysis.js');

const DEPARTMENTS  = ['Computer Science', 'Information Technology', 'Electronics', 'Mechanical'];
const SKILLS_POOL  = ['react', 'node', 'mongodb', 'typescript', 'python', 'aws', 'docker', 'kubernetes', 'django', 'express'];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function randomSkills() {
  const n = Math.floor(Math.random() * 4) + 2;
  return [...SKILLS_POOL].sort(() => 0.5 - Math.random()).slice(0, n);
}

// ── Seed ──────────────────────────────────────────────────────────────────────

async function seedBenchmarkData(size) {
  // Remove any previous run of this size
  const stale = await User.find({ email: new RegExp(`_${size}@scholrboard\\.com$`) }).select('_id');
  const staleIds = stale.map(u => u._id);
  await User.deleteMany({ _id: { $in: staleIds } });
  await Profile.deleteMany({ userId: { $in: staleIds } });
  await ResumeAnalysis.deleteMany({ userId: { $in: staleIds } });

  console.log(`  Seeding ${size} users…`);

  const BATCH = 2000;   // insert in batches to avoid driver memory spikes
  const allUserIds = [];

  for (let offset = 0; offset < size; offset += BATCH) {
    const batchSize = Math.min(BATCH, size - offset);
    const userBatch    = [];
    const profileBatch = [];
    const resumeBatch  = [];

    for (let i = 0; i < batchSize; i++) {
      const idx    = offset + i;
      const userId = new mongoose.Types.ObjectId();
      const dept   = pick(DEPARTMENTS);
      const sem    = Math.floor(Math.random() * 8) + 1;

      userBatch.push({
        _id: userId,
        name: `Benchmark Student ${idx}`,
        email: `benchmark_student_${idx}_${size}@scholrboard.com`,
        password: 'password123',
        role: 'student',
        department: dept,
        semester: sem,
        isActive: true,
        verified: true
      });

      profileBatch.push({
        userId,
        gpa:                    Number((Math.random() * 4 + 6).toFixed(2)),
        developerScore:         Math.floor(Math.random() * 91) + 10,
        githubScore:            Math.floor(Math.random() * 91) + 10,
        dsaScore:               Math.floor(Math.random() * 91) + 10,
        cpScore:                Math.floor(Math.random() * 91) + 10,
        placementReadinessScore:Math.floor(Math.random() * 91) + 10,
        achievementPoints:      Math.floor(Math.random() * 50),
        backlogs:               Math.floor(Math.random() * 3),
        skills:                 randomSkills(),
        codingStats: {
          profiles: {
            github:     `gh_student_${idx}`,
            leetcode:   `lc_student_${idx}`,
            codeforces: `cf_student_${idx}`
          }
        }
      });

      if (Math.random() > 0.3) {
        resumeBatch.push({
          userId,
          fileUrl:        'https://cloudinary.com/dummy-resume.pdf',
          fileName:       'resume.pdf',
          overallScore:   Math.floor(Math.random() * 50) + 50,
          atsScore:       Math.floor(Math.random() * 50) + 50,
          analysisStatus: 'completed',
          isCurrent:      true
        });
      }

      allUserIds.push(userId);
    }

    await User.insertMany(userBatch);
    await Profile.insertMany(profileBatch);
    if (resumeBatch.length > 0) await ResumeAnalysis.insertMany(resumeBatch);
  }

  console.log(`  Seeded ${allUserIds.length} records.`);
  return allUserIds;
}

async function cleanBenchmarkData(userIds, size) {
  console.log(`  Cleaning up ${size} benchmark records…`);
  await User.deleteMany({ email: new RegExp(`_${size}@scholrboard\\.com$`) });
  await Profile.deleteMany({ userId: { $in: userIds } });
  await ResumeAnalysis.deleteMany({ userId: { $in: userIds } });
  console.log(`  Cleanup done.`);
}

// ── Pipeline builders ──────────────────────────────────────────────────────────

/** OPTIMISED: starts from Profile so $sort hits the compound index first */
function buildOptimisedSortPipeline() {
  return [
    { $match: {} },                          // all profiles
    { $sort: { developerScore: -1 } },       // INDEX SCAN on { developerScore:-1, gpa:-1 }
    { $skip: 0 },
    { $limit: 20 },
    { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: false } },
    { $match: { 'user.role': 'student', 'user.isActive': true } },
    {
      $lookup: {
        from: 'resumeanalyses',
        let: { uid: '$userId' },
        pipeline: [
          { $match: { $expr: { $and: [{ $eq: ['$userId', '$$uid'] }, { $eq: ['$isCurrent', true] }] } } }
        ],
        as: 'resumeAnalysis'
      }
    },
    { $unwind: { path: '$resumeAnalysis', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: '$user._id', name: '$user.name',
        developerScore: { $ifNull: ['$developerScore', 0] },
        gpa: { $ifNull: ['$gpa', 0] }
      }
    }
  ];
}

function buildOptimisedFilterPipeline() {
  return [
    { $match: { $and: [{ gpa: { $gte: 7.5 } }, { developerScore: { $gte: 50 } }, { skills: { $all: [/react/i] } }] } },
    { $sort: { developerScore: -1 } },
    { $skip: 0 },
    { $limit: 20 },
    { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: false } },
    { $match: { 'user.role': 'student', 'user.isActive': true } },
    {
      $lookup: {
        from: 'resumeanalyses',
        let: { uid: '$userId' },
        pipeline: [
          { $match: { $expr: { $and: [{ $eq: ['$userId', '$$uid'] }, { $eq: ['$isCurrent', true] }] } } }
        ],
        as: 'resumeAnalysis'
      }
    },
    { $unwind: { path: '$resumeAnalysis', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: '$user._id', name: '$user.name',
        developerScore: { $ifNull: ['$developerScore', 0] },
        gpa: { $ifNull: ['$gpa', 0] },
        skills: { $ifNull: ['$skills', []] }
      }
    }
  ];
}

function buildOptimisedSearchPipeline() {
  // Text search must happen after $lookup User since name/email live on User
  return [
    { $match: {} },
    { $sort: { developerScore: -1 } },
    { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: false } },
    {
      $match: {
        $and: [
          { 'user.role': 'student' },
          { 'user.isActive': true },
          {
            $or: [
              { 'user.name': /Student 5/i },
              { 'user.email': /Student 5/i },
              { skills: /Student 5/i }
            ]
          }
        ]
      }
    },
    { $skip: 0 },
    { $limit: 20 },
    {
      $project: {
        _id: '$user._id', name: '$user.name',
        developerScore: { $ifNull: ['$developerScore', 0] },
        gpa: { $ifNull: ['$gpa', 0] }
      }
    }
  ];
}

/** LEGACY: User-first (for comparison) */
function buildLegacySortPipeline() {
  return [
    { $match: { role: 'student', isActive: true } },
    { $lookup: { from: 'profiles', localField: '_id', foreignField: 'userId', as: 'profile' } },
    { $unwind: { path: '$profile', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'resumeanalyses',
        let: { userId: '$_id' },
        pipeline: [
          { $match: { $expr: { $and: [{ $eq: ['$userId', '$$userId'] }, { $eq: ['$isCurrent', true] }] } } }
        ],
        as: 'resumeAnalysis'
      }
    },
    { $unwind: { path: '$resumeAnalysis', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 1, name: 1,
        developerScore: { $ifNull: ['$profile.developerScore', 0] },
        gpa: { $ifNull: ['$profile.gpa', 0] }
      }
    },
    { $sort: { developerScore: -1 } },
    { $skip: 0 },
    { $limit: 20 }
  ];
}

// ── Explain helper ─────────────────────────────────────────────────────────────

function detectScanType(explainDoc) {
  const str = JSON.stringify(explainDoc);
  if (str.includes('IXSCAN')) return 'IXSCAN';
  if (str.includes('COLLSCAN')) return 'COLLSCAN';
  return 'UNKNOWN';
}

// ── Single-size benchmark ──────────────────────────────────────────────────────

async function runBenchmarkForSize(size) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`BENCHMARK @ ${size.toLocaleString()} STUDENTS`);
  console.log('='.repeat(60));

  const userIds = await seedBenchmarkData(size);
  const memBefore = process.memoryUsage().heapUsed;

  // ── Optimised queries ──────────────────────────────────────────────────────
  const p1 = buildOptimisedSortPipeline();
  const p2 = buildOptimisedFilterPipeline();
  const p3 = buildOptimisedSearchPipeline();

  const t1s = performance.now();
  const r1  = await Profile.aggregate(p1).option({ maxTimeMS: 10000 });
  const t1  = performance.now() - t1s;
  console.log(`[OPT] Q1 Sort by developerScore:              ${t1.toFixed(2)}ms  (returned ${r1.length})`);

  const t2s = performance.now();
  const r2  = await Profile.aggregate(p2).option({ maxTimeMS: 10000 });
  const t2  = performance.now() - t2s;
  console.log(`[OPT] Q2 Complex filter (GPA≥7.5, Score≥50): ${t2.toFixed(2)}ms  (returned ${r2.length})`);

  const t3s = performance.now();
  const r3  = await Profile.aggregate(p3).option({ maxTimeMS: 10000 });
  const t3  = performance.now() - t3s;
  console.log(`[OPT] Q3 Keyword search:                      ${t3.toFixed(2)}ms  (returned ${r3.length})`);

  // ── Legacy comparison (only at 10k to keep runtime sane) ──────────────────
  let legacySortMs = null;
  if (size === 10000) {
    const lp = buildLegacySortPipeline();
    const lts = performance.now();
    await User.aggregate(lp).option({ maxTimeMS: 10000 });
    legacySortMs = Number((performance.now() - lts).toFixed(2));
    console.log(`[LEG] Q1 Sort (User-first legacy):            ${legacySortMs}ms`);
    if (t1 < legacySortMs) {
      const pct = (((legacySortMs - t1) / legacySortMs) * 100).toFixed(1);
      console.log(`      ↳ Optimised is ${pct}% faster than legacy`);
    }
  }

  // ── Explain plan ──────────────────────────────────────────────────────────
  console.log('  Capturing explain plan for Q1…');
  const explainRaw = await Profile.aggregate(p1).explain('queryPlanner');
  const scanType   = detectScanType(explainRaw);
  console.log(`  Scan type detected: ${scanType}`);

  const memAfter  = process.memoryUsage().heapUsed;
  const memDeltaMb = Number(((memAfter - memBefore) / 1024 / 1024).toFixed(2));
  console.log(`  Memory footprint delta: ${memDeltaMb} MB`);

  await cleanBenchmarkData(userIds, size);

  return {
    size,
    optimised: {
      sortLatencyMs:   Number(t1.toFixed(2)),
      filterLatencyMs: Number(t2.toFixed(2)),
      searchLatencyMs: Number(t3.toFixed(2))
    },
    legacy: legacySortMs !== null ? { sortLatencyMs: legacySortMs } : null,
    scanType,
    memoryDeltaMb: memDeltaMb,
    meetsTarget: t1 < 250
  };
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function run() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) { console.error('CRITICAL: MONGODB_URI not set.'); process.exit(1); }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.\n');
  console.log('Phase 4.3.1 — Optimised Talent Discovery Benchmark');
  console.log('Sizes: 10k, 25k, 50k, 100k');
  console.log('Target: Q1 Sort < 250ms at each scale\n');

  const results = [];
  try {
    results.push(await runBenchmarkForSize(10000));
    results.push(await runBenchmarkForSize(25000));
    results.push(await runBenchmarkForSize(50000));
    results.push(await runBenchmarkForSize(100000));
  } finally {
    await mongoose.disconnect();
    console.log('\nDatabase disconnected.');
  }

  console.log('\n' + '='.repeat(60));
  console.log('BENCHMARK SUMMARY');
  console.log('='.repeat(60));
  console.log('Size     | Q1-Sort  | Q2-Filter | Q3-Search | ScanType | MemΔ(MB) | Target<250ms');
  console.log('-'.repeat(90));
  for (const r of results) {
    const size = r.size.toLocaleString().padStart(7);
    const q1   = `${r.optimised.sortLatencyMs}ms`.padStart(8);
    const q2   = `${r.optimised.filterLatencyMs}ms`.padStart(9);
    const q3   = `${r.optimised.searchLatencyMs}ms`.padStart(9);
    const scan = r.scanType.padEnd(8);
    const mem  = `${r.memoryDeltaMb}`.padStart(8);
    const ok   = r.meetsTarget ? '✓ PASS' : '✗ FAIL';
    console.log(`${size} | ${q1} | ${q2} | ${q3} | ${scan} | ${mem} | ${ok}`);
  }

  if (results[0]?.legacy) {
    const leg = results[0].legacy.sortLatencyMs;
    const opt = results[0].optimised.sortLatencyMs;
    const imp = (((leg - opt) / leg) * 100).toFixed(1);
    console.log(`\n10k legacy sort: ${leg}ms → optimised: ${opt}ms  (${imp}% improvement)`);
  }

  console.log('\nFull results (JSON):');
  console.log(JSON.stringify(results, null, 2));
}

run().catch(err => { console.error(err); process.exit(1); });
