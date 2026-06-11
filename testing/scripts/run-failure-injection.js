import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../server/.env') });

const { default: mongoose } = await import('../../server/node_modules/mongoose/index.js');
const { default: Profile } = await import('../../server/models/Profile.js');
const { acquireSyncLock, releaseSyncLock } = await import('../../server/services/syncLockService.js');
const { recalculateAndSaveScore } = await import('../../server/services/developerScoringService.js');

async function runFailureInjectionTests() {
  const mongoUri = process.env.MONGODB_URI;
  await mongoose.connect(mongoUri);

  const testUserId = new mongoose.Types.ObjectId();
  const results = [];

  console.log('--- FAILURE INJECTION WORKFLOWS ---');

  // 1. Invalid Profile Data
  console.log('1. Simulating Invalid Profile Data (GPA = 12)...');
  let gpaPassed = false;
  try {
    await Profile.create({
      userId: testUserId,
      gpa: 12 // Schema max is 10
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      gpaPassed = true;
      console.log(' -> Success: Blocked out-of-bounds GPA schema validation.');
    } else {
      console.error(' -> Failed: Unexpected error type:', err.name);
    }
  }
  results.push({ test: 'gpa_out_of_bounds_validation', passed: gpaPassed });

  // Create clean profile for subsequent tests
  const profile = await Profile.create({
    userId: testUserId,
    codingStats: { profiles: { github: 'failure_test' } }
  });

  // 2. Missing rawMetrics
  console.log('2. Simulating Missing rawMetrics...');
  let rawMetricsPassed = false;
  try {
    // Force rawMetrics to null
    await Profile.updateOne({ userId: testUserId }, { $unset: { 'codingStats.rawMetrics': '' } });
    
    // Recalculate - should default to 0 and not crash
    const updated = await recalculateAndSaveScore(profile._id, 'missing rawMetrics failure test');
    if (updated.githubScore === 0 && updated.dsaScore === 0 && updated.cpScore === 0) {
      rawMetricsPassed = true;
      console.log(' -> Success: Defaulted scores to 0 without throwing error.');
    }
  } catch (err) {
    console.error(' -> Failed: Scoring engine crashed:', err.message);
  }
  results.push({ test: 'missing_raw_metrics_graceful_handling', passed: rawMetricsPassed });

  // 3. Lock acquisition race
  console.log('3. Simulating Lock Acquisition Race (3 concurrent requests)...');
  let lockRacePassed = false;
  try {
    // Release any locks first
    await releaseSyncLock(testUserId);
    
    // Trigger 3 lock requests simultaneously
    const promises = [
      acquireSyncLock(testUserId),
      acquireSyncLock(testUserId),
      acquireSyncLock(testUserId)
    ];
    
    const outcomes = await Promise.allSettled(promises);
    const fulfilled = outcomes.filter(o => o.status === 'fulfilled');
    const rejected = outcomes.filter(o => o.status === 'rejected');
    
    if (fulfilled.length === 1 && rejected.length === 2) {
      lockRacePassed = true;
      console.log(' -> Success: Exactly one lock request succeeded; other two rejected.');
    } else {
      console.error(` -> Failed: Fulfilled=${fulfilled.length}, Rejected=${rejected.length}`);
    }
    
    // Release the lock
    await releaseSyncLock(testUserId);
  } catch (err) {
    console.error(' -> Failed: Race condition test crashed:', err.message);
  }
  results.push({ test: 'sync_lock_acquisition_race', passed: lockRacePassed });

  // 4. Corrupted scoring version
  console.log('4. Simulating Corrupted Scoring Version...');
  let versionResetPassed = false;
  try {
    await Profile.updateOne(
      { userId: testUserId },
      { $set: { developerScoreVersion: 99, scoringFormulaVersion: 'corrupted_tag' } }
    );
    
    const updated = await recalculateAndSaveScore(profile._id, 'version corruption test');
    if (updated.developerScoreVersion === 1 && updated.scoringFormulaVersion === 'v1.0.0') {
      versionResetPassed = true;
      console.log(' -> Success: Reset corrupted version and formula tags to defaults.');
    }
  } catch (err) {
    console.error(' -> Failed: Version check crashed:', err.message);
  }
  results.push({ test: 'corrupted_score_version_reset', passed: versionResetPassed });

  // 5. Database disconnect during score save
  console.log('5. Simulating Database Disconnect during score save...');
  let disconnectPassed = false;
  try {
    // Mock profile save to simulate network failure
    const originalSave = Profile.prototype.save;
    Profile.prototype.save = async function() {
      throw new Error('MOCK_CONNECTION_TIMEOUT');
    };
    
    try {
      await recalculateAndSaveScore(profile._id, 'disconnect test');
    } catch (err) {
      if (err.message === 'MOCK_CONNECTION_TIMEOUT') {
        disconnectPassed = true;
        console.log(' -> Success: Caught database connection failure gracefully.');
      }
    } finally {
      // Restore save method
      Profile.prototype.save = originalSave;
    }
  } catch (err) {
    console.error(' -> Failed:', err.message);
  }
  results.push({ test: 'database_disconnect_save_timeout', passed: disconnectPassed });

  // Clean up
  await Profile.deleteOne({ userId: testUserId });
  await mongoose.disconnect();

  const failed = results.filter(r => !r.passed);
  if (failed.length > 0) {
    console.error('❌ FAILURE INJECTION AUDIT FAILED!');
    console.error(JSON.stringify(results, null, 2));
    process.exit(1);
  } else {
    console.log('✅ FAILURE INJECTION AUDIT PASSED: All error boundaries recovered gracefully.');
    process.exit(0);
  }
}

runFailureInjectionTests().catch(err => {
  console.error(err);
  process.exit(1);
});
