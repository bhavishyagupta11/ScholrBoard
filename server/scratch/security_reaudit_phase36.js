import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import '../config/env.js';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import User from '../models/User.js';
import Profile from '../models/Profile.js';
import Activity from '../models/Activity.js';
import Opportunity from '../models/Opportunity.js';
import Application from '../models/Application.js';
import AuditLog from '../models/AuditLog.js';
import Notification from '../models/Notification.js';

const BASE_URL = 'http://localhost:5000/api';
const suffix = crypto.randomBytes(4).toString('hex');
const createdUserIds = [];
const createdActivityIds = [];
const createdOpportunityIds = [];
const createdApplicationIds = [];

const results = [];
const record = (name, passed, evidence) => {
  results.push({ name, passed, evidence });
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}: ${evidence}`);
};

const request = async (path, { method = 'GET', token, body } = {}) => {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
};

const registerStudent = async (label, advisorId = null) => {
  const response = await request('/auth/register', {
    method: 'POST',
    body: {
      name: label,
      email: `${label.replaceAll(' ', '_').toLowerCase()}_${suffix}@scholrboard.edu`,
      password: 'password123',
      role: 'student',
      studentId: `${label.replaceAll(' ', '-').toUpperCase()}-${suffix}`,
      department: `CSE-${suffix}`,
      semester: 6,
    },
  });
  if (response.status !== 201) {
    throw new Error(`Student fixture registration failed with HTTP ${response.status}: ${response.data.message || 'unknown error'}`);
  }
  createdUserIds.push(response.data.user._id);
  if (advisorId) {
    await User.findByIdAndUpdate(response.data.user._id, { advisorId });
  }
  return response.data;
};

const login = async (email, password = 'password123') => {
  const response = await request('/auth/login', { method: 'POST', body: { email, password } });
  return response.data.token;
};

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

  const publicAdmin = await request('/auth/register', {
    method: 'POST',
    body: { name: 'Public Admin', email: `public_admin_${suffix}@test.edu`, password: 'password123', role: 'admin' },
  });
  record('Public admin registration blocked', publicAdmin.status === 403, `HTTP ${publicAdmin.status}`);

  const publicFaculty = await request('/auth/register', {
    method: 'POST',
    body: {
      name: 'Public Faculty',
      email: `public_faculty_${suffix}@test.edu`,
      password: 'password123',
      role: 'faculty',
      facultyId: `PUBLIC-FAC-${suffix}`,
      department: `CSE-${suffix}`,
    },
  });
  record('Public faculty registration blocked', publicFaculty.status === 403, `HTTP ${publicFaculty.status}`);

  const admin = await User.create({
    name: 'Security Reaudit Admin',
    email: `reaudit_admin_${suffix}@scholrboard.edu`,
    password: 'password123',
    role: 'admin',
  });
  createdUserIds.push(admin._id);
  await Profile.create({ userId: admin._id });
  const adminToken = await login(admin.email);

  const facultyResponse = await request('/users/faculty', {
    method: 'POST',
    token: adminToken,
    body: {
      name: 'Security Reaudit Faculty',
      email: `reaudit_faculty_${suffix}@scholrboard.edu`,
      password: 'password123',
      role: 'admin',
      facultyId: `FAC-${suffix}`,
      department: `CSE-${suffix}`,
    },
  });
  record('Admin-only faculty provisioning works', facultyResponse.status === 201 && facultyResponse.data.user.role === 'faculty', `HTTP ${facultyResponse.status}`);
  const facultyId = facultyResponse.data.user._id;
  createdUserIds.push(facultyId);
  const facultyToken = await login(facultyResponse.data.user.email);

  const student = await registerStudent('Security Student', facultyId);
  const studentToken = student.token;
  const otherStudent = await registerStudent('Other Student');

  const auditRoute = await request('/test-audit/run');
  record('Public audit endpoint removed', auditRoute.status === 404, `HTTP ${auditRoute.status}`);

  const facultyAnalytics = await request('/analytics/placements', { token: facultyToken });
  record('Faculty placement analytics blocked', facultyAnalytics.status === 403, `HTTP ${facultyAnalytics.status}`);

  const invalidId = await request('/opportunities/not-an-object-id', { token: adminToken });
  record('Malformed ObjectId handled', invalidId.status === 400, `HTTP ${invalidId.status}`);

  const ownActivity = await Activity.create({
    userId: student.user._id,
    title: 'Assigned student activity',
    category: 'Workshops',
    activityDate: new Date(),
    status: 'Pending',
  });
  const otherActivity = await Activity.create({
    userId: otherStudent.user._id,
    title: 'Unassigned student activity',
    category: 'Workshops',
    activityDate: new Date(),
    status: 'Pending',
  });
  createdActivityIds.push(ownActivity._id, otherActivity._id);

  const assignedReview = await request(`/activities/${ownActivity._id}/review`, {
    method: 'PUT',
    token: facultyToken,
    body: { status: 'Approved' },
  });
  record('Assigned activity review allowed', assignedReview.status === 200, `HTTP ${assignedReview.status}`);

  const unassignedReview = await request(`/activities/${otherActivity._id}/review`, {
    method: 'PUT',
    token: facultyToken,
    body: { status: 'Approved' },
  });
  record('Unassigned activity review blocked', unassignedReview.status === 403, `HTTP ${unassignedReview.status}`);

  const opportunity = await Opportunity.create({
    driveCode: `REAUDIT-${suffix}`,
    title: 'Security Transition Test',
    company: 'ScholrBoard QA',
    type: 'Internship',
    description: 'Transition validation',
    eligibility: { eligibleDepartments: [`CSE-${suffix}`], passingYear: 2026 },
    deadline: new Date(Date.now() + 86400000),
    status: 'Published',
    postedBy: admin._id,
  });
  createdOpportunityIds.push(opportunity._id);
  const application = await Application.create({
    opportunityId: opportunity._id,
    studentId: student.user._id,
    status: 'Applied',
    resumeUrl: 'https://example.com/resume.pdf',
    eligibilitySnapshot: {
      cgpa: 8,
      semester: 6,
      department: `CSE-${suffix}`,
      activeBacklogs: 0,
    },
  });
  createdApplicationIds.push(application._id);

  const illegalSelected = await request(`/applications/${application._id}/status`, {
    method: 'PUT',
    token: adminToken,
    body: { status: 'Selected' },
  });
  record('Applied to Selected blocked', illegalSelected.status === 400, `HTTP ${illegalSelected.status}`);

  const shortlist = await request(`/applications/${application._id}/status`, {
    method: 'PUT',
    token: adminToken,
    body: { status: 'Shortlisted' },
  });
  record('Applied to Shortlisted allowed', shortlist.status === 200, `HTTP ${shortlist.status}`);

  const interview = await request(`/applications/${application._id}/interview`, {
    method: 'PUT',
    token: adminToken,
    body: { dateTime: new Date(Date.now() + 3600000), venue: 'QA Room' },
  });
  record('Shortlisted to Interviewed allowed', interview.status === 200, `HTTP ${interview.status}`);

  const selected = await request(`/applications/${application._id}/status`, {
    method: 'PUT',
    token: adminToken,
    body: { status: 'Selected' },
  });
  record('Interviewed to Selected allowed', selected.status === 200, `HTTP ${selected.status}`);

  const createApplication = async (candidate, status = 'Applied') => {
    const item = await Application.create({
      opportunityId: opportunity._id,
      studentId: candidate.user._id,
      status,
      resumeUrl: 'https://example.com/resume.pdf',
      eligibilitySnapshot: {
        cgpa: 8,
        semester: 6,
        department: `CSE-${suffix}`,
        activeBacklogs: 0,
      },
    });
    createdApplicationIds.push(item._id);
    return item;
  };

  const appliedWithdrawal = await createApplication(otherStudent);
  const appliedWithdrawResult = await request(`/applications/${appliedWithdrawal._id}/withdraw`, {
    method: 'POST',
    token: otherStudent.token,
  });
  record('Applied to Withdrawn allowed', appliedWithdrawResult.status === 200, `HTTP ${appliedWithdrawResult.status}`);

  const shortlistedStudent = await registerStudent('Shortlisted Withdrawal Student');
  const shortlistedWithdrawal = await createApplication(shortlistedStudent);
  await request(`/applications/${shortlistedWithdrawal._id}/status`, {
    method: 'PUT',
    token: adminToken,
    body: { status: 'Shortlisted' },
  });
  const shortlistedWithdrawResult = await request(`/applications/${shortlistedWithdrawal._id}/withdraw`, {
    method: 'POST',
    token: shortlistedStudent.token,
  });
  record('Shortlisted to Withdrawn allowed', shortlistedWithdrawResult.status === 200, `HTTP ${shortlistedWithdrawResult.status}`);

  const interviewedStudent = await registerStudent('Interviewed Withdrawal Student');
  const interviewedWithdrawal = await createApplication(interviewedStudent);
  await request(`/applications/${interviewedWithdrawal._id}/status`, {
    method: 'PUT',
    token: adminToken,
    body: { status: 'Shortlisted' },
  });
  await request(`/applications/${interviewedWithdrawal._id}/interview`, {
    method: 'PUT',
    token: adminToken,
    body: { dateTime: new Date(Date.now() + 3600000), venue: 'QA Room' },
  });
  const interviewedWithdrawResult = await request(`/applications/${interviewedWithdrawal._id}/withdraw`, {
    method: 'POST',
    token: interviewedStudent.token,
  });
  record('Interviewed to Withdrawn allowed', interviewedWithdrawResult.status === 200, `HTTP ${interviewedWithdrawResult.status}`);

  const rejectedStudent = await registerStudent('Rejected Student');
  const rejectedApplication = await createApplication(rejectedStudent);
  await request(`/applications/${rejectedApplication._id}/status`, {
    method: 'PUT',
    token: adminToken,
    body: { status: 'Shortlisted' },
  });
  await request(`/applications/${rejectedApplication._id}/interview`, {
    method: 'PUT',
    token: adminToken,
    body: { dateTime: new Date(Date.now() + 3600000), venue: 'QA Room' },
  });
  const rejectedResult = await request(`/applications/${rejectedApplication._id}/status`, {
    method: 'PUT',
    token: adminToken,
    body: { status: 'Rejected' },
  });
  record('Interviewed to Rejected allowed', rejectedResult.status === 200, `HTTP ${rejectedResult.status}`);

  await User.findByIdAndUpdate(student.user._id, { isActive: false });
  const deactivatedAccess = await request('/profile/me', { token: studentToken });
  record('Deactivated token rejected', deactivatedAccess.status === 401, `HTTP ${deactivatedAccess.status}`);

  const failed = results.filter((result) => !result.passed);
  console.log(`SUMMARY ${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exitCode = 1;
} catch (error) {
  console.error('Security re-audit failed:', error);
  process.exitCode = 1;
} finally {
  await Notification.deleteMany({ userId: { $in: createdUserIds } });
  await AuditLog.deleteMany({ performedBy: { $in: createdUserIds } });
  await Application.deleteMany({ _id: { $in: createdApplicationIds } });
  await Opportunity.deleteMany({ _id: { $in: createdOpportunityIds } });
  await Activity.deleteMany({ _id: { $in: createdActivityIds } });
  await Profile.deleteMany({ userId: { $in: createdUserIds } });
  await User.deleteMany({ _id: { $in: createdUserIds } });
  await mongoose.connection.close();
}
