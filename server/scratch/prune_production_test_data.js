/**
 * prune_production_test_data.js
 * Purges E2E, smoke, manual, and "@scholrboard.test" accounts and their associated records.
 * Safety: Defaults to DRY_RUN = true. Does not execute deletions unless DRY_RUN=false is explicitly set.
 */
import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import readline from 'readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const DRY_RUN = process.env.DRY_RUN !== 'false';

// Register Schemas dynamically
const UserSchema = new mongoose.Schema({}, { strict: false });
const ProfileSchema = new mongoose.Schema({}, { strict: false });
const ActivitySchema = new mongoose.Schema({}, { strict: false });
const ApplicationSchema = new mongoose.Schema({}, { strict: false });
const ScholarshipApplicationSchema = new mongoose.Schema({}, { strict: false });
const NotificationSchema = new mongoose.Schema({}, { strict: false });
const OdRequestSchema = new mongoose.Schema({}, { strict: false });
const LearningProgressSchema = new mongoose.Schema({}, { strict: false });
const AnalyticsSchema = new mongoose.Schema({}, { strict: false });
const AiChatHistorySchema = new mongoose.Schema({}, { strict: false });
const ResumeAnalysisSchema = new mongoose.Schema({}, { strict: false });
const AuditLogSchema = new mongoose.Schema({}, { strict: false });

const User = mongoose.model('User', UserSchema, 'users');
const Profile = mongoose.model('Profile', ProfileSchema, 'profiles');
const Activity = mongoose.model('Activity', ActivitySchema, 'activities');
const Application = mongoose.model('Application', ApplicationSchema, 'applications');
const ScholarshipApplication = mongoose.model('ScholarshipApplication', ScholarshipApplicationSchema, 'scholarshipapplications');
const Notification = mongoose.model('Notification', NotificationSchema, 'notifications');
const OdRequest = mongoose.model('OdRequest', OdRequestSchema, 'odrequests');
const LearningProgress = mongoose.model('LearningProgress', LearningProgressSchema, 'learningprogresses');
const Analytics = mongoose.model('Analytics', AnalyticsSchema, 'analytics');
const AiChatHistory = mongoose.model('AiChatHistory', AiChatHistorySchema, 'aichathistories');
const ResumeAnalysis = mongoose.model('ResumeAnalysis', ResumeAnalysisSchema, 'resumeanalyses');
const AuditLog = mongoose.model('AuditLog', AuditLogSchema, 'auditlogs');

const TEST_EMAIL_PATTERNS = [
  /e2e/i,
  /smoke/i,
  /manual/i,
  /@scholrboard\.test$/i
];

async function confirmExecution(query) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans.trim().toLowerCase() === 'yes');
  }));
}

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI not found in env.');
    process.exit(1);
  }

  console.log(`Connecting to database...`);
  await mongoose.connect(uri);
  const dbName = mongoose.connection.db.databaseName;
  console.log(`Connected to database: "${dbName}"`);

  if (DRY_RUN) {
    console.log('\n🔍 [DRY-RUN MODE] Active. Read-only audit.');
  } else {
    console.log('\n⚠️ [EXECUTION MODE] DANGER: Destructive deletions will be executed.');
    const confirmed = await confirmExecution('Are you sure you want to proceed with pruning? (Type "yes" to confirm): ');
    if (!confirmed) {
      console.log('Aborted by user.');
      await mongoose.disconnect();
      process.exit(0);
    }
  }

  // 1. Identify users matching patterns
  const matchQuery = {
    $or: TEST_EMAIL_PATTERNS.map(pattern => ({ email: pattern }))
  };

  const usersToDelete = await User.find(matchQuery);
  const userIds = usersToDelete.map(u => u._id);

  console.log(`\nFound ${usersToDelete.length} test accounts to delete.`);

  if (userIds.length === 0) {
    console.log('No test accounts found.');
    await mongoose.disconnect();
    return;
  }

  // 2. Count references across all dependent collections
  const counts = {
    profiles: await Profile.countDocuments({ userId: { $in: userIds } }),
    activities: await Activity.countDocuments({ userId: { $in: userIds } }),
    applications: await Application.countDocuments({ studentId: { $in: userIds } }),
    scholarshipApplications: await ScholarshipApplication.countDocuments({ studentId: { $in: userIds } }),
    notifications: await Notification.countDocuments({ userId: { $in: userIds } }),
    odRequests: await OdRequest.countDocuments({ studentId: { $in: userIds } }),
    learningProgress: await LearningProgress.countDocuments({ userId: { $in: userIds } }),
    analytics: await Analytics.countDocuments({ userId: { $in: userIds } }),
    aiChatHistory: await AiChatHistory.countDocuments({ userId: { $in: userIds } }),
    resumeAnalysis: await ResumeAnalysis.countDocuments({ userId: { $in: userIds } }),
    auditLogs: await AuditLog.countDocuments({ performedBy: { $in: userIds } })
  };

  console.log('\nDependent Records Audit:');
  Object.entries(counts).forEach(([coll, count]) => {
    console.log(`  - ${coll}: ${count} records`);
  });

  if (!DRY_RUN) {
    console.log('\nExecuting deletions in strict referential order...');
    
    await Profile.deleteMany({ userId: { $in: userIds } });
    console.log('  - Deleted Profiles.');
    
    await Activity.deleteMany({ userId: { $in: userIds } });
    console.log('  - Deleted Activities.');
    
    await Application.deleteMany({ studentId: { $in: userIds } });
    console.log('  - Deleted Applications.');
    
    await ScholarshipApplication.deleteMany({ studentId: { $in: userIds } });
    console.log('  - Deleted Scholarship Applications.');
    
    await Notification.deleteMany({ userId: { $in: userIds } });
    console.log('  - Deleted Notifications.');
    
    await OdRequest.deleteMany({ studentId: { $in: userIds } });
    console.log('  - Deleted OD Requests.');
    
    await LearningProgress.deleteMany({ userId: { $in: userIds } });
    console.log('  - Deleted Learning Progress.');
    
    await Analytics.deleteMany({ userId: { $in: userIds } });
    console.log('  - Deleted Analytics snapshots.');
    
    await AiChatHistory.deleteMany({ userId: { $in: userIds } });
    console.log('  - Deleted AI Chat Histories.');
    
    await ResumeAnalysis.deleteMany({ userId: { $in: userIds } });
    console.log('  - Deleted Resume Analyses.');
    
    await AuditLog.deleteMany({ performedBy: { $in: userIds } });
    console.log('  - Deleted Audit Logs.');

    // Delete primary users last
    const userDelRes = await User.deleteMany({ _id: { $in: userIds } });
    console.log(`  - Deleted ${userDelRes.deletedCount} User documents.`);

    console.log('\n✅ Data pruning completed successfully.');
  } else {
    console.log('\n🔍 [DRY-RUN] Deletions bypassed. Pruning plan matches referential integrity.');
  }

  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Error running prune:', err);
  process.exit(1);
});
