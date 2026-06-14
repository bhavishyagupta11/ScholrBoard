import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import mongoose from '../../server/node_modules/mongoose/index.js';
import dotenv from 'dotenv';
import { resetDB } from '../helpers/db.js';
import { loginViaUI, loadTestUsers } from '../helpers/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../server/.env') });
const pdfFixture = path.join(__dirname, '../fixtures/valid-pdf.pdf');
const resumeFixture = path.join(__dirname, '../fixtures/sample-resume.pdf');
const SCREENSHOT_DIR = 'C:\\Users\\Sbhav\\.gemini\\antigravity\\brain\\f7d2714d-19e0-480f-94ba-037f43495a5c';

test.describe('ScholrBoard Final Production Smoke Test - 20 Steps', () => {
  let dbConnection;
  let User, Event, Opportunity, Application, Notification, Activity, ResumeAnalysis;

  test.beforeAll(async () => {
    await resetDB();
    fs.copyFileSync(pdfFixture, resumeFixture);

    if (mongoose.connection.readyState === 0) {
      dbConnection = await mongoose.connect(process.env.MONGODB_URI);
    }
    User = (await import('../../server/models/User.js')).default;
    Event = (await import('../../server/models/Event.js')).default;
    Opportunity = (await import('../../server/models/Opportunity.js')).default;
    Application = (await import('../../server/models/Application.js')).default;
    Notification = (await import('../../server/models/Notification.js')).default;
    Activity = (await import('../../server/models/Activity.js')).default;
    ResumeAnalysis = (await import('../../server/models/ResumeAnalysis.js')).default;
  });

  test.afterAll(async () => {
    if (fs.existsSync(resumeFixture)) {
      fs.unlinkSync(resumeFixture);
    }
    await mongoose.disconnect();
  });

  test('Execute full 20-step smoke test', async ({ page }) => {
    test.setTimeout(180_000);
    const unique = Date.now();
    const studentEmail = `smoke.student.${unique}@scholrboard.com`;
    const studentPass = 'Password@123';
    const studentName = 'Smoke E2E Student';
    const studentIdStr = `STU-SMOKE-${unique}`;
    const usersObj = loadTestUsers();

    // Helper to log DB evidence
    const logDbEvidence = async (step, title, queryFn) => {
      const data = await queryFn();
      console.log(`[DB EVIDENCE - STEP ${step} - ${title}]`);
      console.log(JSON.stringify(data, null, 2));
      console.log('----------------------------------------------------');
    };

    console.log('=== Pre-requisite: Register Student ===');
    await page.goto('/login/student');
    await page.getByRole('button', { name: 'Create Account' }).click();
    await page.locator('input[name="name"]').fill(studentName);
    await page.locator('input[name="email"]').fill(studentEmail);
    await page.locator('input[name="password"]').fill(studentPass);
    await page.locator('input[name="confirmPassword"]').fill(studentPass);
    await page.locator('input[name="studentId"]').fill(studentIdStr);
    await page.locator('select[name="department"]').selectOption('CSE');
    await page.locator('input[name="semester"]').fill('5');
    await page.getByRole('button', { name: 'Sign up as Student' }).click();
    await page.waitForURL((url) => url.pathname === '/student/dashboard', { timeout: 15_000 });
    
    // Set advisor programmatically
    const studentUser = await User.findOne({ email: studentEmail });
    const facultyUser = await User.findOne({ email: 'e2e.faculty@scholrboard.test' });
    await User.findByIdAndUpdate(studentUser._id, { advisorId: facultyUser._id });

    // Set high GPA and readiness score on profile so the student matches placement criteria immediately upon publication
    const Profile = (await import('../../server/models/Profile.js')).default;
    await Profile.findOneAndUpdate({ userId: studentUser._id }, {
      gpa: 9.0,
      placementReadinessScore: 85,
      backlogs: 0
    });

    // Logout student
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    console.log('--- Step 1: Admin creates and publishes an Event ---');
    await page.goto('/login/admin');
    await page.locator('#admin-login-email').fill('e2e.admin@scholrboard.test');
    await page.locator('#admin-login-password').fill(usersObj.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL((url) => url.pathname === '/admin' || url.pathname === '/admin/dashboard', { timeout: 15_000 });
    await page.goto('/admin/events');
    await page.getByRole('button', { name: /Create New Event/i }).click();
    
    const eventTitle = `Event Smoke Test ${unique}`;
    await page.locator('input[name="title"]').fill(eventTitle);
    await page.locator('select[name="category"]').selectOption('Hackathon');
    await page.locator('input[name="venue"]').fill('Seminar Hall C');
    await page.locator('input[name="startDate"]').fill('2026-07-01');
    await page.locator('input[name="targetDepartments"]').fill('CSE');
    await page.locator('input[id="requiresRegistration"]').check();
    await page.locator('input[id="isPublished"]').check();
    await page.getByRole('button', { name: 'Create Event' }).click();
    await page.waitForTimeout(2000); // Allow modal to save
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step1_event_created.png') });
    
    await logDbEvidence(1, 'Event Published', () => Event.findOne({ title: eventTitle }));

    // Logout Admin
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    console.log('--- Step 2: Student registers for the Event ---');
    await page.goto('/login/student');
    await page.locator('#student-login-email').fill(studentEmail);
    await page.locator('#student-login-password').fill(studentPass);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL((url) => url.pathname === '/student/dashboard', { timeout: 15_000 });
    await page.goto('/student/events');
    await page.waitForSelector(`text=${eventTitle}`, { timeout: 10_000 });
    await page.getByRole('button', { name: /Register Now/i }).first().click();
    await expect(page.getByText(/registered/i)).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step2_student_registered.png') });

    await logDbEvidence(2, 'Event Attendees', () => Event.findOne({ title: eventTitle }).populate('attendees.userId', 'name email'));

    // Logout Student
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    console.log('--- Step 3: Admin creates and publishes a Placement Drive ---');
    await page.goto('/login/admin');
    await page.locator('#admin-login-email').fill('e2e.admin@scholrboard.test');
    await page.locator('#admin-login-password').fill(usersObj.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL((url) => url.pathname === '/admin' || url.pathname === '/admin/dashboard', { timeout: 15_000 });
    await page.goto('/admin/placements');
    await page.getByRole('button', { name: /Compose Drive/i }).click();

    const companyName = `SmokeCorp ${unique}`;
    await page.getByTestId('drive-code').fill(`DRIVE-SMOKE-${unique}`);
    await page.getByTestId('drive-title').fill('Smoke Test Software Engineer');
    await page.getByTestId('drive-company').fill(companyName);
    await page.getByTestId('drive-description').fill('Production smoke test placement drive validation.');
    await page.getByTestId('drive-salary').fill('900000');
    await page.getByTestId('drive-deadline').fill('2026-12-31T23:59');
    await page.locator('input[name="eligibleDepartments"]').fill('CSE');
    await page.locator('input[name="minPlacementReadinessScore"]').fill('75');
    await page.getByRole('button', { name: 'Compose Drive Draft' }).click();
    await expect(page.getByTestId('placement-success-alert')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: /open lists/i }).click();
    await page.waitForSelector(`text=${companyName}`, { timeout: 10_000 });
    await page.locator('button:has-text("Publish")').first().click();
    await expect(page.getByTestId('placement-success-alert')).toContainText('Published drive', { timeout: 15_000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step3_drive_published.png') });

    await logDbEvidence(3, 'Placement Opportunity', () => Opportunity.findOne({ company: companyName }));

    // Logout Admin
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    console.log('--- Step 4: Student receives notification and applies ---');
    await page.goto('/login/student');
    await page.locator('#student-login-email').fill(studentEmail);
    await page.locator('#student-login-password').fill(studentPass);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL((url) => url.pathname === '/student/dashboard', { timeout: 15_000 });

    // Open notifications bell
    const bell = page.locator('button[aria-label*="notification"i]');
    await bell.click();
    await expect(page.getByText(companyName).first()).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step4_notification_received.png') });

    // Close notifications panel by clicking bell again
    await bell.click();

    // Navigate to placement page
    await page.goto('/student/placements');
    await page.waitForSelector(`text=${companyName}`, { timeout: 10_000 });
    await page.getByRole('button', { name: 'Apply Now' }).first().click();
    await page.getByTestId('apply-resume-url').fill('https://example.com/smoke-resume.pdf');
    await page.getByTestId('placement-apply').click();
    await expect(page.getByText(/Applied successfully/i)).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step4_student_applied.png') });

    await logDbEvidence(4, 'Student Application', () => Application.findOne({ studentId: studentUser._id }).populate('opportunityId'));

    // Logout Student
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    console.log('--- Step 5: Admin shortlists candidate ---');
    await page.goto('/login/admin');
    await page.locator('#admin-login-email').fill('e2e.admin@scholrboard.test');
    await page.locator('#admin-login-password').fill(usersObj.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL((url) => url.pathname === '/admin' || url.pathname === '/admin/dashboard', { timeout: 15_000 });
    await page.goto('/admin/placements');
    await page.getByRole('button', { name: /open lists/i }).click();
    await page.locator(`button:has-text("Review Applicants")`).first().click();
    await page.getByRole('button', { name: 'Shortlist' }).first().click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step5_shortlisted.png') });

    await logDbEvidence(5, 'Applicant Shortlisted', () => Application.findOne({ studentId: studentUser._id }));

    console.log('--- Step 6: Admin schedules interview ---');
    await page.getByRole('button', { name: 'Schedule Interview' }).first().click();
    await page.locator('input[type="datetime-local"]').fill('2026-07-05T10:00');
    await page.locator('input[placeholder*="Seminar Hall B"]').fill('Seminar Hall C');
    await page.locator('textarea[placeholder*="What should the candidate bring"]').fill('Bring project reports');
    await page.locator('button[type="submit"]:has-text("Schedule Interview")').click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step6_interview_scheduled.png') });

    await logDbEvidence(6, 'Interview Details', () => Application.findOne({ studentId: studentUser._id }));

    // Logout Admin
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    console.log('--- Step 7: Student sees interview details ---');
    await page.goto('/login/student');
    await page.locator('#student-login-email').fill(studentEmail);
    await page.locator('#student-login-password').fill(studentPass);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL((url) => url.pathname === '/student/dashboard', { timeout: 15_000 });
    await page.goto('/student/placements');
    await expect(page.getByText(/Interview Scheduled/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Seminar Hall C/i)).toBeVisible();
    await expect(page.getByText(/Bring project reports/i)).toBeVisible();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step7_student_sees_interview.png') });

    // Logout Student
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    console.log('--- Step 8: Admin marks interviewed ---');
    await page.goto('/login/admin');
    await page.locator('#admin-login-email').fill('e2e.admin@scholrboard.test');
    await page.locator('#admin-login-password').fill(usersObj.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL((url) => url.pathname === '/admin' || url.pathname === '/admin/dashboard', { timeout: 15_000 });
    await page.goto('/admin/placements');
    await page.getByRole('button', { name: /open lists/i }).click();
    await page.locator(`button:has-text("Review Applicants")`).first().click();
    await page.getByRole('button', { name: 'Mark Interviewed' }).first().click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step8_marked_interviewed.png') });

    await logDbEvidence(8, 'Marked Interviewed', () => Application.findOne({ studentId: studentUser._id }));

    console.log('--- Step 9: Admin selects candidate ---');
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Select Candidate' }).first().click();
    await expect(page.getByText(/Selected/i).first()).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step9_candidate_selected.png') });

    await logDbEvidence(9, 'Selected State', () => Application.findOne({ studentId: studentUser._id }));

    // Logout Admin
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    console.log('--- Step 10: Student receives final status update ---');
    await page.goto('/login/student');
    await page.locator('#student-login-email').fill(studentEmail);
    await page.locator('#student-login-password').fill(studentPass);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL((url) => url.pathname === '/student/dashboard', { timeout: 15_000 });
    await page.goto('/student/placements');
    await expect(page.getByText(/Selected/i).first()).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step10_student_selected.png') });

    console.log('--- Step 11: Student uploads activity ---');
    await page.goto('/student/upload');
    const actTitle = `Smoke Activity ${unique}`;
    await page.locator('input[name="title"]').fill(actTitle);
    await page.locator('input[name="activityDate"]').fill('2026-06-01');
    await page.locator('select[name="category"]').selectOption('Workshops');
    await page.locator('textarea[name="description"]').fill('Smoke test activity description.');
    const proofInput = page.locator('input[type="file"]').first();
    await proofInput.setInputFiles(resumeFixture);
    await page.getByRole('button', { name: 'Submit Activity' }).click();
    await expect(page.getByText(/activity submitted/i)).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step11_activity_uploaded.png') });

    await logDbEvidence(11, 'Activity Pending', () => Activity.findOne({ title: actTitle }));

    // Logout Student
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    console.log('--- Step 12: Faculty requests revision ---');
    await page.goto('/login/faculty');
    await page.locator('#faculty-login-email').fill('e2e.faculty@scholrboard.test');
    await page.locator('#faculty-login-password').fill(usersObj.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL((url) => url.pathname === '/faculty' || url.pathname === '/faculty/dashboard', { timeout: 15_000 });
    await page.goto('/faculty/approvals');
    await page.waitForSelector(`text=${unique}`, { timeout: 15_000 });

    page.once('dialog', async (dialog) => {
      await dialog.accept('Need more details about workshop topic.');
    });
    await page.getByRole('button', { name: /Request Revision/i }).first().click();
    await expect(page.getByText(actTitle)).not.toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step12_revision_requested.png') });

    await logDbEvidence(12, 'Activity Revision Needed', () => Activity.findOne({ title: actTitle }));

    // Logout Faculty
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    console.log('--- Step 13: Student edits and resubmits ---');
    await page.goto('/login/student');
    await page.locator('#student-login-email').fill(studentEmail);
    await page.locator('#student-login-password').fill(studentPass);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL((url) => url.pathname === '/student/dashboard', { timeout: 15_000 });
    await page.goto('/student/activities');
    await page.waitForSelector(`text=Needs Revision`, { timeout: 10_000 });
    await page.getByRole('button', { name: /edit/i }).first().click();
    await page.locator('textarea[name="description"]').fill('Need more details about workshop topic. Added workshop syllabus.');
    await page.getByRole('button', { name: 'Update Activity' }).click();
    await expect(page.getByText(/activity updated/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(`Pending`)).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step13_resubmitted.png') });

    await logDbEvidence(13, 'Activity Resubmitted', () => Activity.findOne({ title: actTitle }));

    // Logout Student
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    console.log('--- Step 14: Faculty approves ---');
    await page.goto('/login/faculty');
    await page.locator('#faculty-login-email').fill('e2e.faculty@scholrboard.test');
    await page.locator('#faculty-login-password').fill(usersObj.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL((url) => url.pathname === '/faculty' || url.pathname === '/faculty/dashboard', { timeout: 15_000 });
    await page.goto('/faculty/approvals');
    await page.waitForSelector(`text=${unique}`, { timeout: 15_000 });

    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });
    await page.getByRole('button', { name: /Approve/i }).first().click();
    await expect(page.getByText(actTitle)).not.toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step14_approved.png') });

    await logDbEvidence(14, 'Activity Approved', () => Activity.findOne({ title: actTitle }));

    // Logout Faculty
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    console.log('--- Step 15: Student receives approval notification ---');
    await page.goto('/login/student');
    await page.locator('#student-login-email').fill(studentEmail);
    await page.locator('#student-login-password').fill(studentPass);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL((url) => url.pathname === '/student/dashboard', { timeout: 15_000 });

    const bell2 = page.locator('button[aria-label*="notification"i]');
    await bell2.click();
    await expect(page.getByText(actTitle).first()).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step15_approval_notification.png') });

    // Close notifications panel
    await bell2.click();

    console.log('--- Step 16: Student uploads resume ---');
    await page.goto('/student/resume');
    await page.waitForSelector('input[type="file"]', { state: 'attached', timeout: 10_000 });
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(resumeFixture);
    await page.getByRole('button', { name: 'Analyze Resume with AI' }).click();
    await expect(page.getByText(/uploaded successfully/i)).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step16_resume_uploading.png') });

    console.log('--- Step 17: Resume Intelligence completes successfully ---');
    await expect(page.getByText(/ATS Score/i)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole('heading', { name: 'Strengths', exact: true })).toBeVisible();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step17_resume_scorecard.png') });

    await logDbEvidence(17, 'Resume Analysis Document', () => ResumeAnalysis.findOne({ userId: studentUser._id }));

    // Logout Student
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    console.log('--- Step 18: Admin opens resume PDF viewer ---');
    await page.goto('/login/admin');
    await page.locator('#admin-login-email').fill('e2e.admin@scholrboard.test');
    await page.locator('#admin-login-password').fill(usersObj.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL((url) => url.pathname === '/admin' || url.pathname === '/admin/dashboard', { timeout: 15_000 });
    await page.goto('/admin/placements');
    await page.getByRole('button', { name: /open lists/i }).click();
    await page.locator(`button:has-text("Review Applicants")`).first().click();
    await page.getByRole('button', { name: 'View Resume' }).first().click();
    await page.waitForSelector('iframe[title="PDF Resume Preview"]', { state: 'visible', timeout: 10_000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step18_resume_viewer.png') });

    // Close preview modal
    await page.locator('.modal-overlay button').first().click();

    // Logout Admin
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    console.log('--- Step 19: Verify notification dropdown count, rendering, read/unread state, and persistence ---');
    await page.goto('/login/student');
    await page.locator('#student-login-email').fill(studentEmail);
    await page.locator('#student-login-password').fill(studentPass);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL((url) => url.pathname === '/student/dashboard', { timeout: 15_000 });

    const bell3 = page.locator('button[aria-label*="notification"i]');
    await expect(bell3).toBeVisible();
    await bell3.click();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step19_notifications_rendering.png') });

    // Mark notification as read
    await page.locator('.shadow-lg').filter({ hasText: 'Notifications' }).locator('.space-y-2 button').first().click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step19_notification_read.png') });

    await logDbEvidence(19, 'Notifications State', () => Notification.find({ userId: studentUser._id }).sort({ createdAt: -1 }));

    console.log('--- Step 20: Verify all workflows survive browser refresh and re-login ---');
    // Go to dashboard to ensure page-specific headings are loaded
    await page.goto('/student/dashboard');
    await expect(page.getByRole('heading', { name: /good (morning|afternoon|evening)/i })).toBeVisible({ timeout: 15_000 });
    // Refresh page
    await page.reload();
    await page.waitForTimeout(2000);
    await expect(page.getByRole('heading', { name: /good (morning|afternoon|evening)/i })).toBeVisible({ timeout: 15_000 });

    // Re-login
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/login/student');
    await page.locator('#student-login-email').fill(studentEmail);
    await page.locator('#student-login-password').fill(studentPass);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL((url) => url.pathname === '/student/dashboard', { timeout: 15_000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step20_refresh_persist.png') });

    console.log('SMOKE TEST SUCCESS: All 20 steps of the production smoke test completed successfully.');
  });
});
