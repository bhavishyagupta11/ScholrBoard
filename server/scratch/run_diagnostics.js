import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Profile from '../models/Profile.js';
import Activity from '../models/Activity.js';
import Announcement from '../models/Announcement.js';
import Event from '../models/Event.js';
import Opportunity from '../models/Opportunity.js';
import Application from '../models/Application.js';
import Notification from '../models/Notification.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

dotenv.config();

const BASE_URL = 'http://localhost:5000/api';

// Helper to make fetch requests
async function apiRequest(endpoint, method, body, token) {
  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try {
    return { status: res.status, ok: res.ok, data: JSON.parse(text) };
  } catch {
    return { status: res.status, ok: res.ok, error: text };
  }
}

async function runDiagnostics() {
  await mongoose.connect(process.env.MONGODB_URI_TEST);
  const dbName = mongoose.connection.db.databaseName;
  if (dbName !== 'scholrboard_test') {
    await mongoose.disconnect();
    throw new Error('CRITICAL SAFETY ERROR: Execution is only allowed on the test database "scholrboard_test". Currently connected to: "' + dbName + '". Execution aborted!');
  }

  console.log('Connected to Database.');

  // Let's delete previous diagnostic test data to ensure fresh runs
  const diagUsers = await User.find({ email: /diagnostics\..*@scholrboard\.com/ });
  const diagUserIds = diagUsers.map(u => u._id);
  await User.deleteMany({ email: /diagnostics\..*@scholrboard\.com/ });
  
  const activeUsers = await User.find({});
  const activeUserIds = activeUsers.map(u => u._id);
  await Profile.deleteMany({
    $or: [
      { userId: { $in: diagUserIds } },
      { userId: { $nin: activeUserIds } }
    ]
  });

  await Activity.deleteMany({ title: /Diagnostics/ });
  await Announcement.deleteMany({ title: /Diagnostics/ });
  await Event.deleteMany({ title: /Diagnostics/ });
  await Opportunity.deleteMany({ title: /Diagnostics/ });
  await Notification.deleteMany({ title: /Diagnostics/ });

  console.log('\n--- STEP 1: LOG IN AND ACQUIRE TOKENS ---');
  // Admin Login
  const adminRes = await apiRequest('/auth/login', 'POST', {
    email: 'bhavishya.admin@gmail.com',
    password: 'BhavishyaAdmin@2026',
    role: 'admin',
  });
  console.log('Admin Login Response:', adminRes.status, adminRes.data?.success ? 'SUCCESS' : 'FAILED');
  const adminToken = adminRes.data?.token;

  // Faculty Login
  const facultyRes = await apiRequest('/auth/login', 'POST', {
    email: 'bhavishya.faculty@gmail.com',
    password: 'BhavishyaFaculty@2026',
    role: 'faculty',
  });
  console.log('Faculty Login Response:', facultyRes.status, facultyRes.data?.success ? 'SUCCESS' : 'FAILED');
  const facultyToken = facultyRes.data?.token;
  const facultyUser = await User.findOne({ email: 'bhavishya.faculty@gmail.com' });

  // Register Student A with department "Computer Science" (Dropdown choice)
  const studentARes = await apiRequest('/auth/register', 'POST', {
    email: 'diagnostics.student.cs@scholrboard.com',
    password: 'DiagStudent@2026',
    name: 'Diagnostics Student CS',
    role: 'student',
    studentId: 'STU-DIAG-CS',
    department: 'CSE',
    semester: 5,
  });
  console.log('Student A (Computer Science) Register Response:', studentARes.status, studentARes.data?.success ? 'SUCCESS' : 'FAILED');
  const studentAToken = studentARes.data?.token;
  const studentAUser = await User.findOne({ email: 'diagnostics.student.cs@scholrboard.com' });

  // Register Student B with department "CSE" (Abbreviated choice)
  const studentBRes = await apiRequest('/auth/register', 'POST', {
    email: 'diagnostics.student.cse@scholrboard.com',
    password: 'DiagStudent@2026',
    name: 'Diagnostics Student CSE',
    role: 'student',
    studentId: 'STU-DIAG-CSE',
    department: 'CSE',
    semester: 5,
  });
  console.log('Student B (CSE) Register Response:', studentBRes.status, studentBRes.data?.success ? 'SUCCESS' : 'FAILED');
  const studentBToken = studentBRes.data?.token;
  const studentBUser = await User.findOne({ email: 'diagnostics.student.cse@scholrboard.com' });

  // Set advisorId for both students to point to our Faculty Advisor
  await User.findByIdAndUpdate(studentAUser._id, { advisorId: facultyUser._id });
  await User.findByIdAndUpdate(studentBUser._id, { advisorId: facultyUser._id });
  console.log('Assigned Faculty advisorId to both students.');

  // Update profile records
  await Profile.findOneAndUpdate({ userId: studentAUser._id }, { $set: { gpa: 8.5, placementReadinessScore: 80 } });
  await Profile.findOneAndUpdate({ userId: studentBUser._id }, { $set: { gpa: 8.5, placementReadinessScore: 80 } });
  console.log('Updated profiles with GPA and Placement Readiness Score.');


  console.log('\n--- STEP 2: ACTIVITY ATTACHMENT UPLOAD & VIEW PREVIEW (ISSUE 2) ---');
  // Student B uploads activity with a Cloudinary proofUrl
  const sampleProofUrl = 'https://res.cloudinary.com/demo/image/upload/sample.jpg';
  const activityCreateRes = await apiRequest('/activities', 'POST', {
    title: 'Diagnostics Hackathon',
    category: 'Technical',
    activityDate: '2026-06-01',
    description: 'Participated in a hackathon.',
    proofUrl: sampleProofUrl,
  }, studentBToken);
  console.log('Create Activity Response:', activityCreateRes.status, activityCreateRes.data);

  // Read MongoDB record
  const dbActivity = await Activity.findOne({ userId: studentBUser._id, title: 'Diagnostics Hackathon' });
  console.log('MongoDB Activity Record:', JSON.stringify(dbActivity, null, 2));

  // Call Faculty Approvals endpoint
  const pendingApprovalsRes = await apiRequest('/activities/pending/all', 'GET', null, facultyToken);
  console.log('Faculty Pending Approvals API Response (Slice):', JSON.stringify(pendingApprovalsRes.data?.activities?.[0], null, 2));


  console.log('\n--- STEP 3: PENDING APPROVALS LIFECYCLE & DISAPPEARING (ISSUE 3) ---');
  // Faculty reviews Student B's activity and requests revision
  const reviewRes = await apiRequest(`/activities/${dbActivity._id}/review`, 'PUT', {
    status: 'Needs Revision',
    reviewComments: 'Please upload a PDF format certificate instead of a JPG image.',
  }, facultyToken);
  console.log('Faculty Request Revision Response:', reviewRes.status, reviewRes.data);

  // Check database status
  const revisedActivity = await Activity.findById(dbActivity._id);
  console.log('Database status after requesting revision:', revisedActivity.status);

  // Try to query it in pending queue
  const pendingAfterRequestRes = await apiRequest('/activities/pending/all', 'GET', null, facultyToken);
  const foundInPending = pendingAfterRequestRes.data?.activities?.some(a => a._id.toString() === dbActivity._id.toString());
  console.log('Is revised activity visible in pending queue?', foundInPending);

  // Student B attempts to edit/update this activity
  console.log('Student B attempts to update this activity (status is Needs Revision)...');
  const updateRes = await apiRequest(`/activities/${dbActivity._id}`, 'PUT', {
    title: 'Diagnostics Hackathon - Updated',
    description: 'Updated hackathon details.',
  }, studentBToken);
  console.log('Student Update Response:', updateRes.status, updateRes.data);


  console.log('\n--- STEP 4: ANNOUNCEMENTS DEPT MISMATCH (ISSUE 4) ---');
  // Admin creates an announcement targeting CSE department
  const annCreateRes = await apiRequest('/announcements', 'POST', {
    title: 'Diagnostics CSE Announcement',
    content: 'Important news for CSE department only.',
    category: 'Academic',
    filters: {
      role: 'student',
      department: 'CSE',
    },
  }, adminToken);
  console.log('Create Announcement Response:', annCreateRes.status, annCreateRes.data);

  // Query announcements as Student A (Computer Science)
  const studentAAnnRes = await apiRequest('/announcements/my', 'GET', null, studentAToken);
  console.log('Student A (Computer Science) Announcements Count:', studentAAnnRes.data?.announcements?.length);
  console.log('Student A Announcements:', JSON.stringify(studentAAnnRes.data?.announcements?.map(a => a.title)));

  // Query announcements as Student B (CSE)
  const studentBAnnRes = await apiRequest('/announcements/my', 'GET', null, studentBToken);
  console.log('Student B (CSE) Announcements Count:', studentBAnnRes.data?.announcements?.length);
  console.log('Student B Announcements:', JSON.stringify(studentBAnnRes.data?.announcements?.map(a => a.title)));


  console.log('\n--- STEP 5: PLACEMENTS DEPT MISMATCH (ISSUE 5) ---');
  // Admin creates a placement drive targeting CSE department
  const opCreateRes = await apiRequest('/opportunities', 'POST', {
    driveCode: 'DIAG-OP-1',
    title: 'Diagnostics Career Drive',
    company: 'Diagnostics Corp',
    type: 'Full-time',
    description: 'Engineering role.',
    deadline: '2026-06-30',
    eligibility: {
      minCGPA: 6.0,
      eligibleDepartments: ['CSE'],
      minSemester: 5,
      passingYear: 2026,
      maxActiveBacklogs: 0,
      minPlacementReadinessScore: 75,
    },
  }, adminToken);
  console.log('Create Placement Drive Response:', opCreateRes.status, opCreateRes.data);
  const createdOpId = opCreateRes.data?.opportunity?._id;

  // Publish placement drive
  const publishRes = await apiRequest(`/opportunities/${createdOpId}/publish`, 'PUT', null, adminToken);
  console.log('Publish Placement Drive Response:', publishRes.status, publishRes.data);

  // Query eligible placement drives as Student A (Computer Science)
  const studentAOpRes = await apiRequest('/opportunities/matching', 'GET', null, studentAToken);
  const studentAEligible = studentAOpRes.data?.opportunities?.find(o => o._id.toString() === createdOpId.toString());
  console.log('Student A (Computer Science) Placement isEligible flag:', studentAEligible?.isEligible);
  console.log('Student A (Computer Science) Placement ineligibilityReason:', studentAEligible?.ineligibilityReason);

  // Query eligible placement drives as Student B (CSE)
  const studentBOpRes = await apiRequest('/opportunities/matching', 'GET', null, studentBToken);
  const studentBEligible = studentBOpRes.data?.opportunities?.find(o => o._id.toString() === createdOpId.toString());
  console.log('Student B (CSE) Placement isEligible flag:', studentBEligible?.isEligible);
  console.log('Student B (CSE) Placement ineligibilityReason:', studentBEligible?.ineligibilityReason);


  console.log('\n--- STEP 6: NOTIFICATION PIPELINE (ISSUE 6) ---');
  // Check notifications created for Student A
  const studentANotifRes = await apiRequest('/notifications', 'GET', null, studentAToken);
  console.log('Student A Notifications:', JSON.stringify(studentANotifRes.data?.notifications?.map(n => ({ title: n.title, type: n.type }))));

  // Check notifications created for Student B
  const studentBNotifRes = await apiRequest('/notifications', 'GET', null, studentBToken);
  console.log('Student B Notifications:', JSON.stringify(studentBNotifRes.data?.notifications?.map(n => ({ title: n.title, type: n.type }))));


  console.log('\n--- STEP 7: EVENT NOTIFICATIONS PIPELINE (ISSUE 6) ---');
  // Create event targeting CSE students in published status
  const eventCreateRes = await apiRequest('/events', 'POST', {
    title: 'Diagnostics CodeFest',
    description: 'A mock coding competition targeting CSE students.',
    category: 'Hackathon',
    startDate: new Date('2026-07-01'),
    endDate: new Date('2026-07-02'),
    startTime: '10:00 AM',
    venue: 'Main Lab 4',
    maxAttendees: 50,
    requiresRegistration: true,
    targetRoles: ['student'],
    targetDepartments: ['CSE'],
    isPublished: true,
  }, adminToken);
  console.log('Create Event Response:', eventCreateRes.status, eventCreateRes.data?.success ? 'SUCCESS' : 'FAILED');

  // Verify notifications for student A (normalized CSE)
  const studentAEventNotifRes = await apiRequest('/notifications', 'GET', null, studentAToken);
  const studentAEventNotif = studentAEventNotifRes.data?.notifications?.filter(n => n.title.includes('CodeFest'));
  console.log('Student A "CodeFest" Notifications Count:', studentAEventNotif?.length);
  console.log('Student A "CodeFest" Notification details:', JSON.stringify(studentAEventNotif?.map(n => ({ title: n.title, message: n.message, type: n.type }))));

  // Verify notifications for student B (CSE)
  const studentBEventNotifRes = await apiRequest('/notifications', 'GET', null, studentBToken);
  const studentBEventNotif = studentBEventNotifRes.data?.notifications?.filter(n => n.title.includes('CodeFest'));
  console.log('Student B "CodeFest" Notifications Count:', studentBEventNotif?.length);
  console.log('Student B "CodeFest" Notification details:', JSON.stringify(studentBEventNotif?.map(n => ({ title: n.title, message: n.message, type: n.type }))));


  // Clean up
  await mongoose.disconnect();
  console.log('\nDiagnostics complete. DB disconnected.');
}

runDiagnostics().catch(console.error);
