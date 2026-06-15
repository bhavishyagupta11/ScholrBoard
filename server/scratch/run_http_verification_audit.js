import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import mongoose from 'mongoose';
import crypto from 'node:crypto';

// Setup environment variables
dotenv.config({ path: './.env' });

// Ensure models are registered
import User from '../models/User.js';
import OdRequest from '../models/OdRequest.js';
import Announcement from '../models/Announcement.js';
import Notification from '../models/Notification.js';
import AuditLog from '../models/AuditLog.js';

const BASE_URL = 'http://localhost:5000/api';

async function runHttpAudit() {
  console.log('# PHASE 2 INTEGRATION VERIFICATION AUDIT');
  console.log('Connecting to database...');
  
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
  
  console.log('✅ Connected to MongoDB.\n');

  const uniqueId = crypto.randomBytes(3).toString('hex');
  const testDept = `CS-AUDIT-${uniqueId}`;

  // Test credentials
  const usersSetup = {
    advisorA: {
      name: `Advisor A ${uniqueId}`,
      email: `advA_${uniqueId}@scholrboard.edu`,
      password: 'password123',
      role: 'faculty',
      facultyId: `FAC-A-${uniqueId}`,
      department: testDept,
    },
    advisorB: {
      name: `Advisor B ${uniqueId}`,
      email: `advB_${uniqueId}@scholrboard.edu`,
      password: 'password123',
      role: 'faculty',
      facultyId: `FAC-B-${uniqueId}`,
      department: testDept,
    },
    studentA: {
      name: `Student A ${uniqueId}`,
      email: `studA_${uniqueId}@scholrboard.edu`,
      password: 'password123',
      role: 'student',
      studentId: `STUD-A-${uniqueId}`,
      department: testDept,
      semester: 5, // Year 3
    },
    studentB: {
      name: `Student B ${uniqueId}`,
      email: `studB_${uniqueId}@scholrboard.edu`,
      password: 'password123',
      role: 'student',
      studentId: `STUD-B-${uniqueId}`,
      department: testDept,
      semester: 5, // Year 3
    },
    studentC: {
      name: `Student C ${uniqueId}`,
      email: `studC_${uniqueId}@scholrboard.edu`,
      password: 'password123',
      role: 'student',
      studentId: `STUD-C-${uniqueId}`,
      department: testDept,
      semester: 7, // Year 4
    },
    studentD: {
      name: `Student D ${uniqueId}`,
      email: `studD_${uniqueId}@scholrboard.edu`,
      password: 'password123',
      role: 'student',
      studentId: `STUD-D-${uniqueId}`,
      department: `ECE-AUDIT-${uniqueId}`,
      semester: 5, // Year 3
    },
    admin: {
      name: `Admin ${uniqueId}`,
      email: `admin_${uniqueId}@scholrboard.edu`,
      password: 'password123',
      role: 'admin',
    }
  };

  const tokens = {};
  const ids = {};

  try {
    // ─── STEP 1: REGISTER & LOGIN TEST USERS ──────────────────────────────────
    console.log('## 1. Creating and Authenticating Mock Users');
    for (const [key, details] of Object.entries(usersSetup)) {
      // Register via DB directly to ensure quick setup
      const user = await User.create(details);
      ids[key] = user._id;

      // Authenticate via login endpoint to get real JWT tokens
      const loginRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: details.email, password: details.password }),
      });
      const data = await loginRes.json();
      if (!data.token) {
        throw new Error(`Failed to login for ${details.email}: ${JSON.stringify(data)}`);
      }
      tokens[key] = data.token;
      console.log(`Registered & Logged in ${key} (${details.role}) -> Token acquired.`);
    }

    // ─── STEP 2: ADMIN ASSIGNS ADVISOR A TO STUDENT A ──────────────────────────
    console.log('\n## 2. Admin Assigns Advisor A to Student A');
    const assignBody = { studentIds: [ids.studentA], advisorId: ids.advisorA };
    
    console.log(`API REQUEST: PUT /api/users/assign-advisor`);
    console.log(`Headers: Authorization: Bearer <AdminToken>`);
    console.log(`Body: ${JSON.stringify(assignBody, null, 2)}`);

    const assignRes = await fetch(`${BASE_URL}/users/assign-advisor`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokens.admin}`
      },
      body: JSON.stringify(assignBody),
    });
    const assignData = await assignRes.json();
    console.log(`API RESPONSE [${assignRes.status}]: ${JSON.stringify(assignData, null, 2)}`);

    // Verify DB Assignment
    const checkStud = await User.findById(ids.studentA);
    console.log(`DB Verification: Student advisorId set to: ${checkStud.advisorId} (Advisor A id: ${ids.advisorA})`);


    // ─── STEP 3: STUDENT CREATES OD REQUEST ────────────────────────────────────
    console.log('\n## 3. Student Creates OD Request');
    const odBody = {
      eventName: 'Smart India Hackathon Finals 2026',
      eventDate: '2026-06-15',
      proofUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg'
    };

    console.log(`API REQUEST: POST /api/od/request`);
    console.log(`Headers: Authorization: Bearer <StudentAToken>`);
    console.log(`Body: ${JSON.stringify(odBody, null, 2)}`);

    const odCreateRes = await fetch(`${BASE_URL}/od/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokens.studentA}`
      },
      body: JSON.stringify(odBody),
    });
    const odCreateData = await odCreateRes.json();
    console.log(`API RESPONSE [${odCreateRes.status}]: ${JSON.stringify(odCreateData, null, 2)}`);

    const odId = odCreateData.odRequest._id;


    // ─── STEP 4: ADVISOR ISOLATION CHECKS ──────────────────────────────────────
    console.log('\n## 4. Advisor Queue Isolation Verification');
    
    // Faculty B reviews Student A request (expected: 403 Forbidden)
    const reviewBodyB = { status: 'Approved', remarks: 'Advisor B review' };
    console.log(`API REQUEST (Advisor B attempting to review Student A OD): PUT /api/od/review/${odId}`);
    console.log(`Headers: Authorization: Bearer <AdvisorBToken>`);
    console.log(`Body: ${JSON.stringify(reviewBodyB, null, 2)}`);

    const reviewResB = await fetch(`${BASE_URL}/od/review/${odId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokens.advisorB}`
      },
      body: JSON.stringify(reviewBodyB),
    });
    const reviewDataB = await reviewResB.json();
    console.log(`API RESPONSE [${reviewResB.status}]: ${JSON.stringify(reviewDataB, null, 2)}`);

    if (reviewResB.status === 403) {
      console.log('✅ Advisor Isolation Working: Faculty B was blocked (403 Forbidden).');
    } else {
      throw new Error(`Advisor Isolation Failure: Advisor B returned status ${reviewResB.status}`);
    }


    // ─── STEP 5: REVISION REQUESTED WORKFLOW ───────────────────────────────────
    console.log('\n## 5. Faculty Advisor A Requests Revision');
    const revisionBody = { status: 'Needs Revision', remarks: 'Please upload a higher-quality certificate proof.' };

    console.log(`API REQUEST: PUT /api/od/review/${odId}`);
    console.log(`Headers: Authorization: Bearer <AdvisorAToken>`);
    console.log(`Body: ${JSON.stringify(revisionBody, null, 2)}`);

    const revisionRes = await fetch(`${BASE_URL}/od/review/${odId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokens.advisorA}`
      },
      body: JSON.stringify(revisionBody),
    });
    const revisionData = await revisionRes.json();
    console.log(`API RESPONSE [${revisionRes.status}]: ${JSON.stringify(revisionData, null, 2)}`);

    // Verify DB State after Revision request
    const odAfterRevision = await OdRequest.findById(odId);
    console.log(`DB Verification after Revision Request:`);
    console.log(` - status: "${odAfterRevision.status}"`);
    console.log(` - remarks: "${odAfterRevision.remarks}"`);
    console.log(` - reviewedBy: ${odAfterRevision.reviewedBy}`);
    console.log(` - attendanceExemptionGranted: ${odAfterRevision.attendanceExemptionGranted}`);

    // Verify Revision Audit Log
    const revLog = await AuditLog.findOne({ targetId: odId, action: 'revision_requested_od' });
    console.log(`Audit Log check: ${revLog ? 'Found' : 'Not Found'}`);
    if (revLog) {
      console.log(` - action: "${revLog.action}"`);
      console.log(` - performedBy: ${revLog.performedBy}`);
      console.log(` - details: ${JSON.stringify(revLog.details)}`);
    }

    // Verify Notification Creation
    const revNotif = await Notification.findOne({ relatedId: odId, type: 'revision_requested' });
    console.log(`Notification check: ${revNotif ? 'Found' : 'Not Found'}`);
    if (revNotif) {
      console.log(` - userId: ${revNotif.userId}`);
      console.log(` - title: "${revNotif.title}"`);
      console.log(` - message: "${revNotif.message}"`);
      console.log(` - isRead: ${revNotif.isRead}`);
    }


    // ─── STEP 6: STUDENT UPDATES & RESUBMITS OD REQUEST ──────────────────────
    console.log('\n## 6. Student A Updates and Resubmits OD Request');
    const updateBody = {
      eventName: 'Smart India Hackathon Finals 2026 (Revised)',
      eventDate: '2026-06-16'
    };

    console.log(`API REQUEST: PUT /api/od/request/${odId}`);
    console.log(`Headers: Authorization: Bearer <StudentAToken>`);
    console.log(`Body: ${JSON.stringify(updateBody, null, 2)}`);

    const updateRes = await fetch(`${BASE_URL}/od/request/${odId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokens.studentA}`
      },
      body: JSON.stringify(updateBody),
    });
    const updateData = await updateRes.json();
    console.log(`API RESPONSE [${updateRes.status}]: ${JSON.stringify(updateData, null, 2)}`);

    const odAfterUpdate = await OdRequest.findById(odId);
    console.log(`DB Verification after Resubmission:`);
    console.log(` - status: "${odAfterUpdate.status}" (Expected: "Pending")`);
    console.log(` - eventName: "${odAfterUpdate.eventName}"`);
    console.log(` - remarks: ${odAfterUpdate.remarks} (Expected: null)`);


    // ─── STEP 7: FACULTY ADVISOR A APPROVES REQUEST ────────────────────────────
    console.log('\n## 7. Faculty Advisor A Approves Resubmitted OD Request');
    const approveBody = { status: 'Approved', remarks: 'Excellent work, request approved!' };

    console.log(`API REQUEST: PUT /api/od/review/${odId}`);
    console.log(`Headers: Authorization: Bearer <AdvisorAToken>`);
    console.log(`Body: ${JSON.stringify(approveBody, null, 2)}`);

    const approveRes = await fetch(`${BASE_URL}/od/review/${odId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokens.advisorA}`
      },
      body: JSON.stringify(approveBody),
    });
    const approveData = await approveRes.json();
    console.log(`API RESPONSE [${approveRes.status}]: ${JSON.stringify(approveData, null, 2)}`);

    // Verify DB state after Approval (Exemption check)
    const odAfterApproval = await OdRequest.findById(odId);
    console.log(`DB Verification after Approval:`);
    console.log(` - status: "${odAfterApproval.status}" (Expected: "Approved")`);
    console.log(` - attendanceExemptionGranted: ${odAfterApproval.attendanceExemptionGranted} (Expected: true)`);

    // Verify Approval Audit Log
    const appLog = await AuditLog.findOne({ targetId: odId, action: 'approve_od' });
    console.log(`Audit Log check: ${appLog ? 'Found' : 'Not Found'}`);
    if (appLog) {
      console.log(` - action: "${appLog.action}"`);
      console.log(` - details: ${JSON.stringify(appLog.details)}`);
    }

    // Verify Notification Creation
    const appNotif = await Notification.findOne({ relatedId: odId, type: 'od_approved' });
    console.log(`Notification check: ${appNotif ? 'Found' : 'Not Found'}`);
    if (appNotif) {
      console.log(` - userId: ${appNotif.userId}`);
      console.log(` - type: "${appNotif.type}"`);
    }


    // ─── STEP 8: CENTRALIZED NOTIFICATION ENGINE CHECKS ────────────────────────
    console.log('\n## 8. Centralized Notification Engine Checks');

    // 1. Get Unread Count / List
    console.log(`API REQUEST: GET /api/notifications`);
    console.log(`Headers: Authorization: Bearer <StudentAToken>`);
    
    const getNotifRes = await fetch(`${BASE_URL}/notifications`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokens.studentA}` },
    });
    const getNotifData = await getNotifRes.json();
    console.log(`API RESPONSE [${getNotifRes.status}]:`);
    console.log(` - unreadCount: ${getNotifData.unreadCount}`);
    console.log(` - notifications list count: ${getNotifData.notifications.length}`);
    const notificationToMark = getNotifData.notifications[0];

    // 2. Mark specific notification as read
    console.log(`\nAPI REQUEST: PUT /api/notifications/${notificationToMark._id}/read`);
    console.log(`Headers: Authorization: Bearer <StudentAToken>`);

    const readRes = await fetch(`${BASE_URL}/notifications/${notificationToMark._id}/read`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${tokens.studentA}` },
    });
    const readData = await readRes.json();
    console.log(`API RESPONSE [${readRes.status}]: ${JSON.stringify(readData, null, 2)}`);

    // 3. Mark all read
    console.log(`\nAPI REQUEST: PUT /api/notifications/read-all`);
    console.log(`Headers: Authorization: Bearer <StudentAToken>`);

    const readAllRes = await fetch(`${BASE_URL}/notifications/read-all`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${tokens.studentA}` },
    });
    const readAllData = await readAllRes.json();
    console.log(`API RESPONSE [${readAllRes.status}]: ${JSON.stringify(readAllData, null, 2)}`);


    // ─── STEP 9: ANNOUNCEMENT ENGINE COMPOSITION & FILTERS ─────────────────────
    console.log('\n## 9. Announcement Engine Composition & Filters');
    
    // Admin creates notice: Target dept CSE (testDept), Year 3 (semesters 5, 6), Role: student
    const announceBody = {
      title: 'Phase 2 Audit Briefing',
      content: 'Important documentation checklist for the upcoming college accreditation audit.',
      category: 'Academic',
      filters: {
        department: testDept,
        year: 3,
        role: 'student'
      }
    };

    console.log(`API REQUEST: POST /api/announcements`);
    console.log(`Headers: Authorization: Bearer <AdminToken>`);
    console.log(`Body: ${JSON.stringify(announceBody, null, 2)}`);

    const announceRes = await fetch(`${BASE_URL}/announcements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokens.admin}`
      },
      body: JSON.stringify(announceBody),
    });
    const announceData = await announceRes.json();
    console.log(`API RESPONSE [${announceRes.status}]: ${JSON.stringify(announceData, null, 2)}`);

    const annId = announceData.announcement._id;

    // Verify Notification Distributions in DB
    console.log(`\nDB Verifications for Announcement Notification Targets:`);

    const notifStudentA = await Notification.findOne({ relatedId: annId, userId: ids.studentA });
    const notifStudentB = await Notification.findOne({ relatedId: annId, userId: ids.studentB });
    const notifStudentC = await Notification.findOne({ relatedId: annId, userId: ids.studentC });
    const notifStudentD = await Notification.findOne({ relatedId: annId, userId: ids.studentD });

    console.log(` - Student A (Target Dept, Target Year): ${notifStudentA ? '✅ Received Notification' : '❌ Not Received'}`);
    console.log(` - Student B (Target Dept, Target Year): ${notifStudentB ? '✅ Received Notification' : '❌ Not Received'}`);
    console.log(` - Student C (Target Dept, Year 4): ${notifStudentC ? '❌ Received (FAILED)' : '✅ Filter Blocked'}`);
    console.log(` - Student D (ECE, Target Year): ${notifStudentD ? '❌ Received (FAILED)' : '✅ Filter Blocked'}`);

    if (notifStudentA && notifStudentB && !notifStudentC && !notifStudentD) {
      console.log('✅ Filter checks successful: notifications only reached targeted users.');
    } else {
      throw new Error('Filter checks failed: incorrect distribution logic.');
    }

    // Verify student dashboard feed endpoint retrieves the announcement
    console.log(`\nAPI REQUEST (Student A fetching dashboard feed): GET /api/announcements/my`);
    console.log(`Headers: Authorization: Bearer <StudentAToken>`);
    
    const feedRes = await fetch(`${BASE_URL}/announcements/my`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokens.studentA}` },
    });
    const feedData = await feedRes.json();
    console.log(`API RESPONSE [${feedRes.status}]:`);
    console.log(` - total items in feed: ${feedData.announcements.length}`);
    console.log(` - contains targeting announcement: ${feedData.announcements.some(a => a._id === annId)}`);


    // ─── CLEANUP ──────────────────────────────────────────────────────────────
    console.log('\n⏳ Cleaning up mock DB entities...');
    await User.deleteMany({ _id: { $in: Object.values(ids) } });
    await OdRequest.deleteMany({ _id: odId });
    await Announcement.deleteMany({ _id: annId });
    await Notification.deleteMany({ userId: { $in: Object.values(ids) } });
    await AuditLog.deleteMany({ performedBy: { $in: Object.values(ids) } });
    console.log('✅ Cleanup complete.');

  } catch (error) {
    console.error('\n❌ HTTP AUDIT CONTEXT ERROR:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDisconnected from MongoDB.');
  }
}

runHttpAudit();
