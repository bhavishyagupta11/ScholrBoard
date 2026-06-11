import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../server/.env') });

const { default: mongoose } = await import('../../server/node_modules/mongoose/index.js');
const { default: Profile } = await import('../../server/models/Profile.js');
const { acquireSyncLock, releaseSyncLock } = await import('../../server/services/syncLockService.js');

async function runLockAudit() {
  const mongoUri = process.env.MONGODB_URI;
  await mongoose.connect(mongoUri);

  const testUserId = new mongoose.Types.ObjectId();
  const profile = await Profile.create({
    userId: testUserId,
    codingStats: {
      profiles: { github: 'lock_audit' }
    }
  });

  const nowMs = Date.now();
  const results = [];

  // Case 1: Lock set 5 minutes ago (Active / Valid lock -> should block)
  console.log('Case 1: Simulating active lock set 5 minutes ago...');
  await Profile.updateOne(
    { userId: testUserId },
    { 
      $set: { 
        'codingStats.isSyncing': true, 
        'codingStats.syncStartedAt': new Date(nowMs - 5 * 60 * 1000) 
      } 
    }
  );

  let case1Passed = false;
  try {
    await acquireSyncLock(testUserId);
  } catch (err) {
    if (err.message.includes('Sync operation is already in progress')) {
      case1Passed = true;
      console.log(' -> Correctly blocked concurrent sync request.');
    } else {
      console.error(' -> Unexpected error:', err.message);
    }
  }
  results.push({ test: '5_min_ago_active_block', expected: 'block', passed: case1Passed });

  // Case 2: Lock set 15 minutes ago (Expired lock -> should reclaim)
  console.log('Case 2: Simulating expired lock set 15 minutes ago...');
  await Profile.updateOne(
    { userId: testUserId },
    { 
      $set: { 
        'codingStats.isSyncing': true, 
        'codingStats.syncStartedAt': new Date(nowMs - 15 * 60 * 1000) 
      } 
    }
  );

  let case2Passed = false;
  try {
    const locked = await acquireSyncLock(testUserId);
    if (locked.codingStats.isSyncing && locked.codingStats.syncStartedAt.getTime() > nowMs - 1000) {
      case2Passed = true;
      console.log(' -> Successfully reclaimed expired lock.');
    }
    await releaseSyncLock(testUserId);
  } catch (err) {
    console.error(' -> Failed to reclaim lock:', err.message);
  }
  results.push({ test: '15_min_ago_expired_reclaim', expected: 'reclaim', passed: case2Passed });

  // Case 3: Lock set 30 minutes ago (Expired lock -> should reclaim)
  console.log('Case 3: Simulating expired lock set 30 minutes ago...');
  await Profile.updateOne(
    { userId: testUserId },
    { 
      $set: { 
        'codingStats.isSyncing': true, 
        'codingStats.syncStartedAt': new Date(nowMs - 30 * 60 * 1000) 
      } 
    }
  );

  let case3Passed = false;
  try {
    const locked = await acquireSyncLock(testUserId);
    if (locked.codingStats.isSyncing && locked.codingStats.syncStartedAt.getTime() > nowMs - 1000) {
      case3Passed = true;
      console.log(' -> Successfully reclaimed expired lock.');
    }
    await releaseSyncLock(testUserId);
  } catch (err) {
    console.error(' -> Failed to reclaim lock:', err.message);
  }
  results.push({ test: '30_min_ago_expired_reclaim', expected: 'reclaim', passed: case3Passed });

  // Case 4: Lock set 1 hour ago (Expired lock -> should reclaim)
  console.log('Case 4: Simulating expired lock set 1 hour ago...');
  await Profile.updateOne(
    { userId: testUserId },
    { 
      $set: { 
        'codingStats.isSyncing': true, 
        'codingStats.syncStartedAt': new Date(nowMs - 60 * 60 * 1000) 
      } 
    }
  );

  let case4Passed = false;
  try {
    const locked = await acquireSyncLock(testUserId);
    if (locked.codingStats.isSyncing && locked.codingStats.syncStartedAt.getTime() > nowMs - 1000) {
      case4Passed = true;
      console.log(' -> Successfully reclaimed expired lock.');
    }
    await releaseSyncLock(testUserId);
  } catch (err) {
    console.error(' -> Failed to reclaim lock:', err.message);
  }
  results.push({ test: '1_hour_ago_expired_reclaim', expected: 'reclaim', passed: case4Passed });

  // Clean up
  await Profile.deleteOne({ _id: profile._id });
  await mongoose.disconnect();

  const failed = results.filter(r => !r.passed);
  if (failed.length > 0) {
    console.error('❌ LOCK AUDIT FAILED!');
    console.error(JSON.stringify(results, null, 2));
    process.exit(1);
  } else {
    console.log('✅ LOCK AUDIT PASSED: Sync concurrency lock and timeout reclamation function flawlessly.');
    process.exit(0);
  }
}

runLockAudit().catch(err => {
  console.error(err);
  process.exit(1);
});
