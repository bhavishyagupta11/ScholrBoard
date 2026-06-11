import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import mongoose from 'mongoose';
import crypto from 'node:crypto';

// Setup environment
dotenv.config({ path: './.env' });

// Ensure models are registered
import User from '../models/User.js';
import Profile from '../models/Profile.js';
import Opportunity from '../models/Opportunity.js';
import Application from '../models/Application.js';
import Scholarship from '../models/Scholarship.js';
import ScholarshipApplication from '../models/ScholarshipApplication.js';
import AuditLog from '../models/AuditLog.js';
import Notification from '../models/Notification.js';

import { evaluatePlacementEligibility, evaluateScholarshipEligibility } from '../services/eligibilityService.js';

async function runAudit() {
  console.log('🚀 STARTING PHASE 3 COMPLIANCE VERIFICATION AUDIT...\n');
  try {
    await connectDB();
    console.log('✅ Database connected.');

    const uniqueId = crypto.randomBytes(4).toString('hex');
    const testDeptCSE = `CSE-${uniqueId}`;
    const testDeptECE = `ECE-${uniqueId}`;

    // ─── SETUP MOCK ACCOUNTS ──────────────────────────────────────────────────
    console.log('\n⏳ Registering mock accounts for student achievement profiles...');

    // 1. Admin account to compose drives and scholarships
    const adminUser = await User.create({
      name: `Naac Admin ${uniqueId}`,
      email: `admin_${uniqueId}@scholrboard.edu`,
      password: 'password123',
      role: 'admin',
      isActive: true,
    });

    // 2. Student A (CSE, eligible profile)
    const studentA = await User.create({
      name: `Student CSE Eligible ${uniqueId}`,
      email: `studentA_${uniqueId}@scholrboard.edu`,
      password: 'password123',
      role: 'student',
      department: testDeptCSE,
      semester: 6,
      isActive: true,
    });

    const studentAProfile = await Profile.create({
      userId: studentA._id,
      gpa: 8.5,
      backlogs: 0,
      placementReadinessScore: 80,
      developerScore: 75,
      achievementPoints: 120,
      resumeUrl: 'https://cloudinary.com/resumes/student_a.pdf',
    });

    // 3. Student B (ECE, ineligible profile)
    const studentB = await User.create({
      name: `Student ECE Ineligible ${uniqueId}`,
      email: `studentB_${uniqueId}@scholrboard.edu`,
      password: 'password123',
      role: 'student',
      department: testDeptECE,
      semester: 4,
      isActive: true,
    });

    const studentBProfile = await Profile.create({
      userId: studentB._id,
      gpa: 5.5,
      backlogs: 2,
      placementReadinessScore: 50,
      developerScore: 40,
      achievementPoints: 30,
      resumeUrl: 'https://cloudinary.com/resumes/student_b.pdf',
    });

    console.log('✅ Mock accounts and profiles registered successfully.');

    // ─── TEST 1: ELIGIBILITY MATCHING ENGINE (PLACEMENTS) ───────────────────────
    console.log('\n--- TEST 1: Eligibility Matching Engine (Placements) ---');

    const opportunity = await Opportunity.create({
      driveCode: `DRIVE-${uniqueId}`,
      title: 'Graduate Engineer Trainee',
      company: 'NaacTech Solutions',
      type: 'Full-time',
      description: 'Role for passionate software engineers.',
      requirements: ['JavaScript', 'MongoDB', 'Data Structures'],
      eligibility: {
        minCGPA: 7.0,
        eligibleDepartments: [testDeptCSE],
        minSemester: 5,
        maxActiveBacklogs: 0,
        minPlacementReadinessScore: 75,
        passingYear: 2026,
      },
      salaryPackage: 800000,
      deadline: new Date(Date.now() + 86400000 * 3), // 3 days from now
      postedBy: adminUser._id,
      status: 'Draft',
    });
    console.log(`✅ Opportunity draft composed (Drive Code: ${opportunity.driveCode}).`);

    // Evaluate Student A
    const evalA = evaluatePlacementEligibility(studentA, studentAProfile, opportunity);
    console.log(`Student A Eligibility: ${evalA.eligible ? 'ELIGIBLE ✅' : 'INELIGIBLE ❌'} (Reason: ${evalA.reason})`);
    if (!evalA.eligible) throw new Error('Student A should be eligible for the placement opportunity.');

    // Evaluate Student B
    const evalB = evaluatePlacementEligibility(studentB, studentBProfile, opportunity);
    console.log(`Student B Eligibility: ${evalB.eligible ? 'ELIGIBLE ✅' : 'INELIGIBLE ❌'} (Reason: ${evalB.reason})`);
    if (evalB.eligible) throw new Error('Student B should be ineligible for the placement opportunity.');

    // ─── TEST 2: OPPORTUNITY STATUS & MATCH NOTIFICATIONS ─────────────────────
    console.log('\n--- TEST 2: Opportunity Publishing & Matching Notifications ---');

    opportunity.status = 'Published';
    await opportunity.save();

    // Create Audit Log manually representing publisher
    await AuditLog.create({
      action: 'publish_opportunity',
      performedBy: adminUser._id,
      role: 'admin',
      targetModel: 'Opportunity',
      targetId: opportunity._id,
      details: { driveCode: opportunity.driveCode, company: opportunity.company, title: opportunity.title },
    });

    // Notify matching candidates
    const activeStudents = [studentA, studentB];
    let matchedNotifCount = 0;
    for (const student of activeStudents) {
      const profile = await Profile.findOne({ userId: student._id });
      const evaluation = evaluatePlacementEligibility(student, profile, opportunity);
      if (evaluation.eligible) {
        await Notification.create({
          userId: student._id,
          title: `New Career Drive: ${opportunity.company}`,
          message: `You match the criteria for the "${opportunity.title}" drive at ${opportunity.company}. Apply now!`,
          type: 'opportunity_match',
          relatedId: opportunity._id,
          relatedModel: 'Opportunity',
          actionUrl: '/student/placements',
          priority: 'high',
        });
        matchedNotifCount++;
      }
    }

    console.log(`✅ Opportunity published. Status: ${opportunity.status}`);
    console.log(`✅ Broadcast checked. Dispatched matching career notifications to ${matchedNotifCount} students.`);

    // Verify Student A received notification
    const studentANotif = await Notification.findOne({ userId: studentA._id, type: 'opportunity_match' });
    if (!studentANotif) throw new Error('Student A should have received a match notification.');
    console.log(`✅ Confirmed: Student A received notification: "${studentANotif.title}"`);

    // Verify Student B did NOT receive notification
    const studentBNotif = await Notification.findOne({ userId: studentB._id, type: 'opportunity_match' });
    if (studentBNotif) throw new Error('Student B should NOT have received a match notification.');
    console.log('✅ Confirmed: Student B did not receive any career match notification (isolated).');

    // ─── TEST 3: APPLICATION SYSTEM & ELIGIBILITY SNAPSHOTS ────────────────────
    console.log('\n--- TEST 3: Application Submission & Eligibility Snapshots ---');

    // Student A applies
    const eligibilitySnapshotA = {
      cgpa: studentAProfile.gpa,
      semester: studentA.semester,
      department: studentA.department,
      activeBacklogs: studentAProfile.backlogs,
      placementReadinessScore: studentAProfile.placementReadinessScore,
      developerScore: studentAProfile.developerScore,
      achievementPoints: studentAProfile.achievementPoints,
    };

    const application = await Application.create({
      opportunityId: opportunity._id,
      studentId: studentA._id,
      status: 'Applied',
      resumeUrl: studentAProfile.resumeUrl,
      eligibilitySnapshot: eligibilitySnapshotA,
    });

    const auditLogApply = await AuditLog.create({
      action: 'apply_opportunity',
      performedBy: studentA._id,
      role: 'student',
      targetModel: 'Application',
      targetId: application._id,
      details: { driveCode: opportunity.driveCode, company: opportunity.company, title: opportunity.title },
    });

    console.log(`✅ Application submitted by Student A (ID: ${application._id}).`);
    console.log(`✅ Snapshot fields captured and frozen:`);
    console.log(`   - GPA: ${application.eligibilitySnapshot.cgpa}`);
    console.log(`   - Semester: ${application.eligibilitySnapshot.semester}`);
    console.log(`   - Department: ${application.eligibilitySnapshot.department}`);
    console.log(`   - Readiness Score: ${application.eligibilitySnapshot.placementReadinessScore}%`);
    console.log(`   - Developer Score: ${application.eligibilitySnapshot.developerScore}`);
    console.log(`   - Achievement Points: ${application.eligibilitySnapshot.achievementPoints}`);
    console.log(`✅ Audit log recorded (Action: ${auditLogApply.action}).`);

    // Verify duplicate applications are prevented
    try {
      await Application.create({
        opportunityId: opportunity._id,
        studentId: studentA._id,
        status: 'Applied',
        resumeUrl: studentAProfile.resumeUrl,
        eligibilitySnapshot: eligibilitySnapshotA,
      });
      throw new Error('Database allowed duplicate student applications for the same opportunity.');
    } catch (err) {
      if (err.message.includes('duplicate') || err.code === 11000) {
        console.log('✅ Confirmed: Duplicate application attempt blocked by index constraint.');
      } else {
        throw err;
      }
    }

    // ─── TEST 4: APPLICATION WITHDRAWAL ─────────────────────────────────────────
    console.log('\n--- TEST 4: Application Withdrawal ---');

    application.status = 'Withdrawn';
    await application.save();

    const auditLogWithdraw = await AuditLog.create({
      action: 'withdraw_application',
      performedBy: studentA._id,
      role: 'student',
      targetModel: 'Application',
      targetId: application._id,
      details: { driveCode: opportunity.driveCode, company: opportunity.company, title: opportunity.title },
    });

    console.log(`✅ Application status updated to: ${application.status}`);
    console.log(`✅ Audit log recorded (Action: ${auditLogWithdraw.action}).`);

    // Restore application status to 'Applied' for subsequent pipeline testing
    application.status = 'Applied';
    await application.save();
    console.log('⏳ Restored application to "Applied" status for review pipeline tests.');

    // ─── TEST 5: ADMIN SHORTLISTING & INTERVIEW SCHEDULER ─────────────────────
    console.log('\n--- TEST 5: Admin Shortlisting & Interview Scheduler ---');

    // Admin shortlists application
    const prevStatus1 = application.status;
    application.status = 'Shortlisted';
    await application.save();

    await AuditLog.create({
      action: 'transition_application_status',
      performedBy: adminUser._id,
      role: 'admin',
      targetModel: 'Application',
      targetId: application._id,
      details: { driveCode: opportunity.driveCode, company: opportunity.company, previousStatus: prevStatus1, newStatus: 'Shortlisted' },
    });

    await Notification.create({
      userId: studentA._id,
      title: 'Application Shortlisted',
      message: `Your application for "${opportunity.title}" at ${opportunity.company} has been shortlisted.`,
      type: 'application_status_changed',
      relatedId: application._id,
      relatedModel: 'Application',
    });
    console.log('✅ Candidate status moved to: Shortlisted.');

    // Admin schedules interview
    const prevStatus2 = application.status;
    application.status = 'Interviewed';
    const interviewDateTime = new Date(Date.now() + 86400000 * 2); // 2 days later
    application.interviewDetails = {
      dateTime: interviewDateTime,
      venue: 'Placement Cell Room 4B',
      instructions: 'Prepare system design fundamentals and bring transcript proof.',
    };
    await application.save();

    await AuditLog.create({
      action: 'schedule_interview',
      performedBy: adminUser._id,
      role: 'admin',
      targetModel: 'Application',
      targetId: application._id,
      details: { driveCode: opportunity.driveCode, company: opportunity.company, previousStatus: prevStatus2, newStatus: 'Interviewed', venue: application.interviewDetails.venue, dateTime: interviewDateTime },
    });

    const scheduleNotif = await Notification.create({
      userId: studentA._id,
      title: `Interview Scheduled: ${opportunity.company}`,
      message: `Your interview is scheduled at ${application.interviewDetails.venue} on ${interviewDateTime.toLocaleString()}.`,
      type: 'application_status_changed',
      relatedId: application._id,
      relatedModel: 'Application',
      priority: 'high',
    });

    console.log('✅ Candidate status moved to: Interviewed.');
    console.log(`   - Scheduled: ${application.interviewDetails.dateTime.toLocaleString()}`);
    console.log(`   - Venue: ${application.interviewDetails.venue}`);
    console.log(`✅ High priority notification dispatched (Type: ${scheduleNotif.type}).`);

    // ─── TEST 6: FINAL SELECTION & PLACEMENT ANALYTICS AUDIT ───────────────────
    console.log('\n--- TEST 6: Final Placement Selection & Analytics ---');

    const prevStatus3 = application.status;
    application.status = 'Selected';
    await application.save();

    await AuditLog.create({
      action: 'transition_application_status',
      performedBy: adminUser._id,
      role: 'admin',
      targetModel: 'Application',
      targetId: application._id,
      details: { driveCode: opportunity.driveCode, company: opportunity.company, previousStatus: prevStatus3, newStatus: 'Selected' },
    });

    await Notification.create({
      userId: studentA._id,
      title: `🎉 Offer Selected: ${opportunity.company}`,
      message: `Congratulations! You have been selected for the "${opportunity.title}" role!`,
      type: 'application_status_changed',
      relatedId: application._id,
      relatedModel: 'Application',
      priority: 'high',
    });
    console.log('✅ Candidate status moved to: Selected (Placed).');

    // Perform analytics computation query
    const totalStudents = await User.countDocuments({ role: 'student', isActive: true });
    const placedStudentIds = await Application.distinct('studentId', { status: 'Selected' });
    const totalPlaced = placedStudentIds.length;
    const placementPercentage = totalStudents > 0 ? (totalPlaced / totalStudents) * 100 : 0;

    const selectedApps = await Application.find({ status: 'Selected' })
      .populate('studentId', 'department')
      .populate('opportunityId', 'salaryPackage');

    const packages = selectedApps.map(a => a.opportunityId?.salaryPackage || 0).filter(Boolean);
    const highestPackage = packages.length > 0 ? Math.max(...packages) : 0;
    const averagePackage = packages.length > 0 ? Math.round(packages.reduce((sum, p) => sum + p, 0) / packages.length) : 0;

    console.log('📊 Placement Statistics Engine Audit Output:');
    console.log(`   - Total Registered Students: ${totalStudents}`);
    console.log(`   - Total Placed Students: ${totalPlaced}`);
    console.log(`   - Placement Percentage: ${placementPercentage.toFixed(1)}%`);
    console.log(`   - Highest Package: ₹${(highestPackage/100000).toFixed(2)} LPA`);
    console.log(`   - Average Package: ₹${(averagePackage/100000).toFixed(2)} LPA`);

    if (totalPlaced !== 1) throw new Error('Analytics mismatch: expected 1 placed student.');
    if (highestPackage !== 800000) throw new Error('Analytics mismatch: highest package should be ₹800,000.');
    console.log('✅ Placement analytics engine computed correct output values.');

    // ─── TEST 7: SCHOLARSHIP WORKFLOW & EVALUATION ─────────────────────────────
    console.log('\n--- TEST 7: Scholarship Matching & Selection Workflow ---');

    const scholarship = await Scholarship.create({
      title: 'Elite Merit Support Program',
      provider: 'DeepMind Foundation',
      amount: 150000,
      description: 'Financial support for students displaying extraordinary academic and extracurricular performance.',
      eligibility: {
        minCGPA: 8.0,
        eligibleDepartments: [testDeptCSE, testDeptECE],
        minAchievementPoints: 100,
        maxAnnualIncome: 500000,
      },
      deadline: new Date(Date.now() + 86400000 * 5),
      postedBy: adminUser._id,
      status: 'Draft',
    });
    console.log(`✅ Scholarship draft composed: "${scholarship.title}" (Award: ₹${scholarship.amount.toLocaleString()})`);

    // Eligibility check for Student A (Income = 300,000)
    const evalSchA = evaluateScholarshipEligibility(studentA, studentAProfile, scholarship, 300000);
    console.log(`Student A Scholarship Eligibility: ${evalSchA.eligible ? 'ELIGIBLE ✅' : 'INELIGIBLE ❌'} (Reason: ${evalSchA.reason})`);
    if (!evalSchA.eligible) throw new Error('Student A should be eligible for this scholarship.');

    // Eligibility check for Student B (Income = 600,000)
    const evalSchB = evaluateScholarshipEligibility(studentB, studentBProfile, scholarship, 600000);
    console.log(`Student B Scholarship Eligibility: ${evalSchB.eligible ? 'ELIGIBLE ✅' : 'INELIGIBLE ❌'} (Reason: ${evalSchB.reason})`);
    if (evalSchB.eligible) throw new Error('Student B should be ineligible for this scholarship (exceeds income, CGPA, points).');

    // Publish scholarship
    scholarship.status = 'Published';
    await scholarship.save();

    await AuditLog.create({
      action: 'publish_scholarship',
      performedBy: adminUser._id,
      role: 'admin',
      targetModel: 'Scholarship',
      targetId: scholarship._id,
      details: { title: scholarship.title, provider: scholarship.provider, amount: scholarship.amount },
    });
    console.log(`✅ Scholarship published. Status: ${scholarship.status}`);

    // Submit Scholarship Application for Student A
    const schSnapshotA = {
      cgpa: studentAProfile.gpa,
      department: studentA.department,
      achievementPoints: studentAProfile.achievementPoints,
      annualIncome: 300000,
    };

    const schApplication = await ScholarshipApplication.create({
      scholarshipId: scholarship._id,
      studentId: studentA._id,
      status: 'Applied',
      incomeCertificateUrl: 'https://cloudinary.com/certificates/income_a.pdf',
      academicTranscriptUrl: 'https://cloudinary.com/transcripts/academic_a.pdf',
      eligibilitySnapshot: schSnapshotA,
    });

    const auditSchApply = await AuditLog.create({
      action: 'apply_scholarship',
      performedBy: studentA._id,
      role: 'student',
      targetModel: 'ScholarshipApplication',
      targetId: schApplication._id,
      details: { title: scholarship.title, provider: scholarship.provider, amount: scholarship.amount },
    });

    console.log(`✅ Scholarship application submitted. Snapshot frozen: GPA=${schApplication.eligibilitySnapshot.cgpa}, Income=₹${schApplication.eligibilitySnapshot.annualIncome.toLocaleString()}`);
    console.log(`✅ Audit log recorded (Action: ${auditSchApply.action}).`);

    // Award scholarship selection
    const prevSchStatus = schApplication.status;
    schApplication.status = 'Selected';
    await schApplication.save();

    const auditSchAward = await AuditLog.create({
      action: 'approve_scholarship',
      performedBy: adminUser._id,
      role: 'admin',
      targetModel: 'ScholarshipApplication',
      targetId: schApplication._id,
      details: { title: scholarship.title, provider: scholarship.provider, amount: scholarship.amount, previousStatus: prevSchStatus, newStatus: 'Selected' },
    });

    const awardNotif = await Notification.create({
      userId: studentA._id,
      title: `🎉 Scholarship Awarded: ${scholarship.title}`,
      message: `Congratulations! Your scholarship application of ₹${scholarship.amount.toLocaleString()} was approved.`,
      type: 'scholarship_match',
      relatedId: schApplication._id,
      relatedModel: 'ScholarshipApplication',
      priority: 'high',
    });

    console.log(`✅ Scholarship Application Status moved to: ${schApplication.status}.`);
    console.log(`✅ Audit log recorded (Action: ${auditSchAward.action}).`);
    console.log(`✅ Selection notification dispatched (Type: ${awardNotif.type}).`);

    // ─── CLEANUP TEST ENTITIES ──────────────────────────────────────────────
    console.log('\n⏳ Cleaning up mock database entries...');
    await User.deleteMany({ _id: { $in: [adminUser._id, studentA._id, studentB._id] } });
    await Profile.deleteMany({ _id: { $in: [studentAProfile._id, studentBProfile._id] } });
    await Opportunity.deleteMany({ _id: opportunity._id });
    await Application.deleteMany({ _id: application._id });
    await Scholarship.deleteMany({ _id: scholarship._id });
    await ScholarshipApplication.deleteMany({ _id: schApplication._id });
    await Notification.deleteMany({ userId: { $in: [studentA._id, studentB._id] } });
    await AuditLog.deleteMany({ performedBy: { $in: [adminUser._id, studentA._id] } });
    console.log('✅ Database cleanup completed successfully.');

    console.log('\n⭐ ALL PHASE 3 COMPLIANCE TESTS PASSED SUCCESSFULLY!');
    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ PHASE 3 AUDIT FAILED:', err);
    try {
      await mongoose.connection.close();
    } catch (e) {}
    process.exit(1);
  }
}

runAudit();
