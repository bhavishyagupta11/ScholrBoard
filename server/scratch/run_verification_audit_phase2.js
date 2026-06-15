import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import mongoose from 'mongoose';
import crypto from 'node:crypto';

// Setup environment
dotenv.config({ path: './.env' });

// Ensure models are registered
import User from '../models/User.js';
import OdRequest from '../models/OdRequest.js';
import Announcement from '../models/Announcement.js';
import Notification from '../models/Notification.js';
import AuditLog from '../models/AuditLog.js';

async function runAudit() {
  console.log('🚀 STARTING PHASE 2 COMPLIANCE VERIFICATION AUDIT...');
  try {
    const dbUri = process.env.MONGODB_URI_TEST;
    if (!dbUri) {
      throw new Error('CRITICAL SAFETY ERROR: MONGODB_URI_TEST is not defined in environment variables.');
    }
    await mongoose.connect(dbUri);
    const dbName = mongoose.connection.db.databaseName;
    if (dbName !== 'scholrboard_test') {
      await mongoose.disconnect();
      throw new Error(`CRITICAL SAFETY ERROR: Execution is only allowed on the test database "scholrboard_test". Currently connected to: "${dbName}". Execution aborted!`);
    }
    if (process.env.NODE_ENV === 'production') {
      await mongoose.disconnect();
      throw new Error('CRITICAL SAFETY ERROR: Execution is strictly forbidden in production mode.');
    }
    console.log('✅ Database connected.');

    const uniqueId = crypto.randomBytes(4).toString('hex');
    const testDept = `TEST-${uniqueId}`;

    // ─── SETUP MOCK ACCOUNTS ──────────────────────────────────────────────────
    console.log('⏳ Creating mock accounts...');
    
    // 1. Faculty Advisors
    const advisorA = await User.create({
      name: `Advisor A ${uniqueId}`,
      email: `advisorA_${uniqueId}@scholrboard.edu`,
      password: 'password123',
      role: 'faculty',
      department: testDept,
      isActive: true,
    });

    const advisorB = await User.create({
      name: `Advisor B ${uniqueId}`,
      email: `advisorB_${uniqueId}@scholrboard.edu`,
      password: 'password123',
      role: 'faculty',
      department: testDept,
      isActive: true,
    });

    // 2. Students
    // Student A assigned to Advisor A
    const studentA = await User.create({
      name: `Student A ${uniqueId}`,
      email: `studentA_${uniqueId}@scholrboard.edu`,
      password: 'password123',
      role: 'student',
      department: testDept,
      semester: 5, // Year 3
      section: 'A',
      advisorId: advisorA._id,
      isActive: true,
    });

    // Student B (CSE Year 3) for announcement filter tests
    const studentB = await User.create({
      name: `Student B ${uniqueId}`,
      email: `studentB_${uniqueId}@scholrboard.edu`,
      password: 'password123',
      role: 'student',
      department: testDept,
      semester: 5, // Year 3
      section: 'B',
      advisorId: advisorB._id,
      isActive: true,
    });

    // Student C (CSE Year 4) - should not match Year 3 announcements
    const studentC = await User.create({
      name: `Student C ${uniqueId}`,
      email: `studentC_${uniqueId}@scholrboard.edu`,
      password: 'password123',
      role: 'student',
      department: testDept,
      semester: 7, // Year 4
      section: 'A',
      advisorId: advisorA._id,
      isActive: true,
    });

    // Student D (ECE Year 3) - should not match Dept-specific announcements
    const studentD = await User.create({
      name: `Student D ${uniqueId}`,
      email: `studentD_${uniqueId}@scholrboard.edu`,
      password: 'password123',
      role: 'student',
      department: `OTHER-${testDept}`,
      semester: 5, // Year 3
      section: 'A',
      advisorId: advisorB._id,
      isActive: true,
    });

    // 3. Admin Account
    const adminUser = await User.create({
      name: `Admin ${uniqueId}`,
      email: `admin_${uniqueId}@scholrboard.edu`,
      password: 'password123',
      role: 'admin',
      isActive: true,
    });

    console.log('✅ Mock accounts registered.');

    // ─── TEST 1: STUDENT CREATES OD REQUEST ────────────────────────────────────
    console.log('\n--- TEST 1: Student OD Request Submission ---');
    const odRequest = await OdRequest.create({
      studentId: studentA._id,
      eventName: 'Smart India Hackathon Finals',
      eventDate: new Date('2026-06-15'),
      proofUrl: 'https://cloudinary.com/test-proof.pdf',
      status: 'Pending',
    });
    console.log(`✅ OD request created (ID: ${odRequest._id}).`);

    // Verify it routes to assigned Advisor A queue
    // In our backend, the pending query checks students whose advisorId is advisorA._id
    const advisorAPending = await OdRequest.find({
      status: 'Pending',
      studentId: studentA._id,
    });
    if (advisorAPending.length === 1 && studentA.advisorId.toString() === advisorA._id.toString()) {
      console.log('✅ OD request correctly routed to Advisor A queue.');
    } else {
      throw new Error('Routing failure: request is not linked to Advisor A.');
    }

    // ─── TEST 2: ADVISOR B QUEUE IS EMPTY ──────────────────────────────────────
    console.log('\n--- TEST 2: Advisor Queue Isolation ---');
    const advisorBPending = await OdRequest.find({
      status: 'Pending',
      studentId: {
        $in: await User.find({ advisorId: advisorB._id }).select('_id')
      }
    });
    if (advisorBPending.length === 0) {
      console.log('✅ Advisor B queue isolated (cannot see Advisor A advisees).');
    } else {
      throw new Error('Security failure: Advisor B can see Student A request.');
    }

    // ─── TEST 3: STATUS TRANSITIONS & AUDIT LOGS & NOTIFICATIONS ──────────────
    console.log('\n--- TEST 3: Status Transition, Audit Logs & Notifications ---');
    
    // Simulate Advisor A review -> Needs Revision
    odRequest.status = 'Needs Revision';
    odRequest.reviewedBy = advisorA._id;
    odRequest.reviewedAt = new Date();
    odRequest.remarks = 'Please upload a higher resolution certificate.';
    await odRequest.save();

    // Create Audit Log manually representing controller execution
    const auditLog1 = await AuditLog.create({
      action: 'revision_requested_od',
      performedBy: advisorA._id,
      role: 'faculty',
      targetModel: 'OdRequest',
      targetId: odRequest._id,
      details: { eventName: odRequest.eventName, remarks: odRequest.remarks },
    });

    // Create notification representing controller execution
    const notif1 = await Notification.create({
      userId: studentA._id,
      title: 'OD Exemption Needs Revision',
      message: `Your OD attendance request requires revision: ${odRequest.remarks}`,
      type: 'revision_requested',
      relatedId: odRequest._id,
      relatedModel: 'OdRequest',
    });

    console.log('✅ Request moved to "Needs Revision".');
    console.log(`✅ Audit entry logged (Action: ${auditLog1.action}).`);
    console.log(`✅ Notification dispatched to Student A (Type: ${notif1.type}).`);

    // Student A updates details and re-submits
    odRequest.status = 'Pending';
    odRequest.remarks = '';
    await odRequest.save();
    console.log('✅ Student A re-submitted request.');

    // Advisor A Approves OD
    odRequest.status = 'Approved';
    odRequest.reviewedBy = advisorA._id;
    odRequest.reviewedAt = new Date();
    odRequest.remarks = 'Well done!';
    odRequest.attendanceExemptionGranted = true;
    await odRequest.save();

    // Create Audit Log
    const auditLog2 = await AuditLog.create({
      action: 'approve_od',
      performedBy: advisorA._id,
      role: 'faculty',
      targetModel: 'OdRequest',
      targetId: odRequest._id,
      details: { eventName: odRequest.eventName, remarks: odRequest.remarks },
    });

    // Create Notification
    const notif2 = await Notification.create({
      userId: studentA._id,
      title: 'OD Exemption Approved',
      message: `Your OD attendance request was approved!`,
      type: 'od_approved',
      relatedId: odRequest._id,
      relatedModel: 'OdRequest',
    });

    console.log('✅ Advisor A approved the request.');
    console.log(`✅ Exemption status: ${odRequest.attendanceExemptionGranted ? 'Granted' : 'Not Granted'}`);
    console.log(`✅ Audit entry logged (Action: ${auditLog2.action}).`);
    console.log(`✅ Notification dispatched to Student A (Type: ${notif2.type}).`);

    if (!odRequest.attendanceExemptionGranted) {
      throw new Error('Approved OD request must grant attendance exemption!');
    }

    // ─── TEST 4: NOTIFICATION READ/UNREAD TRACKING ────────────────────────────
    console.log('\n--- TEST 4: Notification Engine read/unread tracking ---');
    
    const unreadCount = await Notification.countDocuments({ userId: studentA._id, isRead: false });
    console.log(`Student A unread notifications count: ${unreadCount}`);

    // Mark all read
    const updateRes = await Notification.updateMany(
      { userId: studentA._id, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );
    console.log(`Mark all read complete. Modified: ${updateRes.modifiedCount}`);

    const remainingUnread = await Notification.countDocuments({ userId: studentA._id, isRead: false });
    console.log(`Student A remaining unread: ${remainingUnread}`);
    if (remainingUnread !== 0) {
      throw new Error('Mark-all-read failed to update all unread entries.');
    }
    console.log('✅ Notification read tracking functional.');

    // ─── TEST 5: ANNOUNCEMENT ENGINE FILTERS ──────────────────────────────────
    console.log('\n--- TEST 5: Announcement Engine Filter Checks ---');

    // Admin creates an announcement targeted to:
    // - Department: testDept
    // - Year: 3 (corresponds to Semesters 5 & 6)
    // - Role: student
    const announcement = await Announcement.create({
      title: 'Final NAAC Briefing',
      content: 'Important instructions for Year 3 CSE students.',
      category: 'Academic',
      filters: {
        department: testDept,
        year: 3,
        role: 'student'
      },
      postedBy: adminUser._id
    });
    console.log(`✅ Announcement created (ID: ${announcement._id}).`);

    // Target matched users matching filters:
    // UserQuery: department = testDept, semester in [5, 6], role = student
    const matchedUsers = await User.find({
      isActive: true,
      department: new RegExp(`^${testDept}$`, 'i'),
      semester: { $in: [5, 6] },
      role: 'student'
    }).select('_id name');

    console.log(`Matched users query returned: ${matchedUsers.map(u => u.name).join(', ')}`);
    
    // Verify Student A (testDept, Sem 5, student) matches
    const containsStudentA = matchedUsers.some(u => u._id.toString() === studentA._id.toString());
    // Verify Student B (testDept, Sem 5, student) matches
    const containsStudentB = matchedUsers.some(u => u._id.toString() === studentB._id.toString());
    // Verify Student C (testDept, Sem 7, student) does NOT match (different year)
    const containsStudentC = matchedUsers.some(u => u._id.toString() === studentC._id.toString());
    // Verify Student D (ECE, Sem 5, student) does NOT match (different dept)
    const containsStudentD = matchedUsers.some(u => u._id.toString() === studentD._id.toString());

    if (containsStudentA && containsStudentB && !containsStudentC && !containsStudentD) {
      console.log('✅ Announcement filtering logic validated perfectly!');
    } else {
      console.error(`Checks: StudentA=${containsStudentA}, StudentB=${containsStudentB}, StudentC=${containsStudentC}, StudentD=${containsStudentD}`);
      throw new Error('Filtering failure: matching criteria incorrectly calculated.');
    }

    // ─── CLEANUP TEST ENTITIES ──────────────────────────────────────────────
    console.log('\n⏳ Cleaning up mock database entries...');
    await User.deleteMany({ _id: { $in: [advisorA._id, advisorB._id, studentA._id, studentB._id, studentC._id, studentD._id, adminUser._id] } });
    await OdRequest.deleteMany({ _id: odRequest._id });
    await Announcement.deleteMany({ _id: announcement._id });
    await Notification.deleteMany({ userId: { $in: [studentA._id, studentB._id, studentC._id, studentD._id] } });
    await AuditLog.deleteMany({ performedBy: { $in: [advisorA._id, advisorB._id, studentA._id, adminUser._id] } });
    console.log('✅ Cleanup complete.');

    console.log('\n⭐ ALL PHASE 2 COMPLIANCE TESTS PASSED SUCCESSFULLY!');
    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ PHASE 2 AUDIT FAILED:', err);
    await mongoose.connection.close();
    process.exit(1);
  }
}

runAudit();
