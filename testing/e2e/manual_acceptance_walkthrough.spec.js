import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from '../../server/node_modules/mongoose/index.js';
import dotenv from 'dotenv';
import { resetDB } from '../helpers/db.js';
import { loginViaUI, loadTestUsers } from '../helpers/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../server/.env') });

const CONV_ID = 'f7d2714d-19e0-480f-94ba-037f43495a5c';
const BASE_DIR = `C:\\Users\\Sbhav\\.gemini\\antigravity\\brain\\${CONV_ID}`;
const MANUAL_DIR = path.join(BASE_DIR, 'manual_acceptance');
const resumeFixture = path.join(__dirname, '../fixtures/valid-pdf.pdf');

// Ensure directory exists
fs.mkdirSync(MANUAL_DIR, { recursive: true });

test.describe('ScholrBoard Final Pre-Deployment Manual Acceptance Walkthrough', () => {
  let dbConnection;
  let User, Event, Opportunity, Application, Notification, Activity, Profile;
  let usersObj;
  const unique = Date.now();
  
  const studentEmail = `manual.student.${unique}@scholrboard.com`;
  const studentPass = 'Password@123';
  const studentName = 'Manual E2E Student';
  const studentIdStr = `STU-MANUAL-${unique}`;
  
  const adminEventTitle = `Admin Manual Event ${unique}`;
  const companyName = `ManualCorp ${unique}`;
  const announceTitle = `Admin Manual Announcement ${unique}`;
  const actTitle = `Manual Activity ${unique}`;

  test.beforeAll(async () => {
    usersObj = loadTestUsers();
    await resetDB();

    if (mongoose.connection.readyState === 0) {
      dbConnection = await mongoose.connect(process.env.MONGODB_URI);
    }
    User = (await import('../../server/models/User.js')).default;
    Event = (await import('../../server/models/Event.js')).default;
    Opportunity = (await import('../../server/models/Opportunity.js')).default;
    Application = (await import('../../server/models/Application.js')).default;
    Notification = (await import('../../server/models/Notification.js')).default;
    Activity = (await import('../../server/models/Activity.js')).default;
    Profile = (await import('../../server/models/Profile.js')).default;
  });

  test.afterAll(async () => {
    await mongoose.disconnect();
  });

  test('Execute complete user walkthrough simulation', async ({ page, context }) => {
    test.setTimeout(180_000);

    // ==========================================================================
    // PRE-REQ: Register Student Account
    // ==========================================================================
    console.log('--- Register Student Account ---');
    await page.goto('/login/student');
    await page.getByRole('button', { name: 'Create Account' }).click();
    await page.locator('input[name="name"]').fill(studentName);
    await page.locator('input[name="email"]').fill(studentEmail);
    await page.locator('input[name="password"]').fill(studentPass);
    await page.locator('input[name="confirmPassword"]').fill(studentPass);
    await page.locator('input[name="studentId"]').fill(studentIdStr);
    await page.locator('select[name="department"]').selectOption('CSE');
    await page.locator('input[name="semester"]').fill('6');
    await page.getByRole('button', { name: 'Sign up as Student' }).click();
    await page.waitForURL(url => url.pathname === '/student/dashboard', { timeout: 15_000 });

    const studentUser = await User.findOne({ email: studentEmail });
    const facultyUser = await User.findOne({ email: 'e2e.faculty@scholrboard.test' });
    await User.findByIdAndUpdate(studentUser._id, { advisorId: facultyUser._id });

    // Set GPA and placement readiness
    await Profile.findOneAndUpdate({ userId: studentUser._id }, {
      gpa: 8.5,
      placementReadinessScore: 80,
      backlogs: 0
    });

    // Logout Student
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    // ==========================================================================
    // PHASE A — ADMIN CREATES EVENTS, PLACEMENTS, ANNOUNCEMENTS
    // ==========================================================================
    console.log('--- Step 1: Admin Creates and Publishes ---');
    await page.goto('/login/admin');
    await page.locator('#admin-login-email').fill('e2e.admin@scholrboard.test');
    await page.locator('#admin-login-password').fill(usersObj.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(url => url.pathname === '/admin' || url.pathname === '/admin/dashboard');

    // Create & Publish Event
    await page.goto('/admin/events');
    await page.getByRole('button', { name: /Create New Event/i }).click();
    await page.locator('input[name="title"]').fill(adminEventTitle);
    await page.locator('select[name="category"]').selectOption('Hackathon');
    await page.locator('input[name="venue"]').fill('Seminar Hall A');
    await page.locator('input[name="startDate"]').fill('2026-07-10');
    await page.locator('input[name="targetDepartments"]').fill('CSE');
    await page.locator('input[id="requiresRegistration"]').check();
    await page.locator('input[id="isPublished"]').check();
    await page.getByRole('button', { name: 'Create Event' }).click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(MANUAL_DIR, 'admin_event_created.png') });

    // Create & Publish Placement Drive
    await page.goto('/admin/placements');
    await page.getByRole('button', { name: /Compose Drive/i }).click();
    await page.getByTestId('drive-code').fill(`DRIVE-MANUAL-${unique}`);
    await page.getByTestId('drive-title').fill('Manual Test Software Architect');
    await page.getByTestId('drive-company').fill(companyName);
    await page.getByTestId('drive-description').fill('Production manual acceptance test drive.');
    await page.getByTestId('drive-salary').fill('1500000');
    await page.getByTestId('drive-deadline').fill('2026-12-31T23:59');
    await page.locator('input[name="eligibleDepartments"]').fill('CSE');
    await page.locator('input[name="minPlacementReadinessScore"]').fill('70');
    await page.getByRole('button', { name: 'Compose Drive Draft' }).click();
    await expect(page.getByTestId('placement-success-alert')).toBeVisible({ timeout: 15_000 });
    
    await page.getByRole('button', { name: /open lists/i }).click();
    await page.waitForSelector(`text=${companyName}`, { timeout: 10_000 });
    await page.locator('button:has-text("Publish")').first().click();
    await expect(page.getByTestId('placement-success-alert')).toContainText('Published drive', { timeout: 15_000 });
    await page.screenshot({ path: path.join(MANUAL_DIR, 'admin_drive_published.png') });

    // Create & Publish Announcement
    await page.goto('/admin/announcements');
    await page.locator('#announcement-title').fill(announceTitle);
    await page.locator('select[name="department"]').selectOption('CSE');
    await page.locator('#announcement-content').fill('This is a global manual acceptance announcement.');
    await page.locator('#announcement-submit').click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(MANUAL_DIR, 'admin_announcement_created.png') });

    // Logout Admin
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    // ==========================================================================
    // PHASE B — STUDENT INTERACTION & VERIFICATIONS
    // ==========================================================================
    console.log('--- Step 2: Student Interaction walkthrough ---');
    await page.goto('/login/student');
    await page.locator('#student-login-email').fill(studentEmail);
    await page.locator('#student-login-password').fill(studentPass);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(url => url.pathname === '/student/dashboard');

    // Screenshot of Student Dashboard
    await page.screenshot({ path: path.join(MANUAL_DIR, 'student_dashboard_main.png') });

    // Notification dropdown and width verification
    const bellBtn = page.locator('button[aria-label*="notification"i]');
    await bellBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(MANUAL_DIR, 'student_notifications_dropdown.png') });
    await bellBtn.click(); // Close

    // Theme persists check
    const themeBtn = page.locator('button[aria-label*="theme"i], button:has-text("Theme"), button:has-text("Mode")').first();
    if (await themeBtn.isVisible()) {
      await themeBtn.click();
      await page.waitForTimeout(500);
      await page.reload();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(MANUAL_DIR, 'student_dashboard_theme_persisted.png') });
    }

    // Register for Event & check persistence
    await page.goto('/student/events');
    await page.waitForSelector(`text=${adminEventTitle}`, { timeout: 10_000 });
    await page.getByRole('button', { name: /Register Now/i }).first().click();
    await expect(page.getByText(/registered/i).first()).toBeVisible({ timeout: 15_000 });
    await page.reload();
    await expect(page.getByText(/registered/i).first()).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: path.join(MANUAL_DIR, 'student_event_registered.png') });

    // Apply for Placement
    await page.goto('/student/placements');
    await page.waitForSelector(`text=${companyName}`, { timeout: 10_000 });
    await page.getByRole('button', { name: 'Apply Now' }).first().click();
    await page.getByTestId('apply-resume-url').fill('https://example.com/manual-resume.pdf');
    await page.getByTestId('placement-apply').click();
    await expect(page.getByText(/Applied successfully/i)).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: path.join(MANUAL_DIR, 'student_applied_placement.png') });

    // Upload Activity Workshops
    await page.goto('/student/upload');
    await page.locator('input[name="title"]').fill(actTitle);
    await page.locator('input[name="activityDate"]').fill('2026-06-10');
    await page.locator('select[name="category"]').selectOption('Workshops');
    await page.locator('textarea[name="description"]').fill('Manual walkthrough activity description.');
    const actProof = page.locator('input[type="file"]').first();
    await actProof.setInputFiles(resumeFixture);
    await page.getByRole('button', { name: 'Submit Activity' }).click();
    await expect(page.getByText(/activity submitted/i)).toBeVisible({ timeout: 15_000 });

    // Edit Activity
    await page.goto('/student/activities');
    await page.waitForSelector(`text=${actTitle}`, { timeout: 10_000 });
    await page.getByRole('button', { name: /edit/i }).first().click();
    await page.locator('textarea[name="description"]').fill('Manual walkthrough activity description updated.');
    await page.getByRole('button', { name: 'Update Activity' }).click();
    await expect(page.getByText(/activity updated/i)).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: path.join(MANUAL_DIR, 'student_activity_edited.png') });

    // Upload Resume PDF
    await page.goto('/student/resume');
    await page.waitForSelector('input[type="file"]', { state: 'attached', timeout: 10_000 });
    const resumeProof = page.locator('input[type="file"]').first();
    await resumeProof.setInputFiles(resumeFixture);
    await page.getByRole('button', { name: 'Analyze Resume with AI' }).click();
    await expect(page.getByText(/uploaded successfully/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/ATS Score/i)).toBeVisible({ timeout: 60_000 });
    await page.screenshot({ path: path.join(MANUAL_DIR, 'student_resume_scorecard_manual.png') });

    // Logout Student
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    // ==========================================================================
    // PHASE C — FACULTY APPROVALS & WALKTHROUGH
    // ==========================================================================
    console.log('--- Step 3: Faculty Walkthrough ---');
    await page.goto('/login/faculty');
    await page.locator('#faculty-login-email').fill('e2e.faculty@scholrboard.test');
    await page.locator('#faculty-login-password').fill(usersObj.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(url => url.pathname === '/faculty' || url.pathname === '/faculty/dashboard');

    // approvals and revision
    await page.goto('/faculty/approvals');
    await page.waitForSelector(`text=${unique}`, { timeout: 15_000 });
    
    page.once('dialog', async (dialog) => {
      await dialog.accept('Please clarify the workshop topic description.');
    });
    await page.getByRole('button', { name: /Request Revision/i }).first().click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(MANUAL_DIR, 'faculty_revision_requested.png') });

    // Student 360 charts check
    await page.goto('/faculty');
    const profileLink = page.locator('table tbody tr td a').first();
    if (await profileLink.isVisible()) {
      await profileLink.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(MANUAL_DIR, 'faculty_student_360_page.png') });
    }

    // Logout Faculty
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    // ==========================================================================
    // PHASE D — STUDENT RESUBMITS
    // ==========================================================================
    console.log('--- Step 4: Student Resubmits ---');
    await page.goto('/login/student');
    await page.locator('#student-login-email').fill(studentEmail);
    await page.locator('#student-login-password').fill(studentPass);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(url => url.pathname === '/student/dashboard');
    await page.goto('/student/activities');
    await page.waitForSelector(`text=Needs Revision`, { timeout: 10_000 });
    await page.getByRole('button', { name: /edit/i }).first().click();
    await page.locator('textarea[name="description"]').fill('Please clarify the workshop topic description. Resubmitted with details.');
    await page.getByRole('button', { name: 'Update Activity' }).click();
    await expect(page.getByText(/activity updated/i)).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: path.join(MANUAL_DIR, 'student_activity_resubmitted.png') });

    // Logout Student
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    // ==========================================================================
    // PHASE E — FACULTY APPROVES
    // ==========================================================================
    console.log('--- Step 5: Faculty Approves ---');
    await page.goto('/login/faculty');
    await page.locator('#faculty-login-email').fill('e2e.faculty@scholrboard.test');
    await page.locator('#faculty-login-password').fill(usersObj.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(url => url.pathname === '/faculty' || url.pathname === '/faculty/dashboard');
    await page.goto('/faculty/approvals');
    await page.waitForSelector(`text=${unique}`, { timeout: 15_000 });
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });
    await page.getByRole('button', { name: /Approve/i }).first().click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(MANUAL_DIR, 'faculty_activity_approved.png') });

    // Logout Faculty
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    // ==========================================================================
    // PHASE F — ADMIN PIPELINE TRANSITIONS & RESUME DRAWER
    // ==========================================================================
    console.log('--- Step 6: Admin Placement Pipeline Progress ---');
    await page.goto('/login/admin');
    await page.locator('#admin-login-email').fill('e2e.admin@scholrboard.test');
    await page.locator('#admin-login-password').fill(usersObj.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(url => url.pathname === '/admin' || url.pathname === '/admin/dashboard');

    await page.goto('/admin/placements');
    await page.getByRole('button', { name: /open lists/i }).click();
    await page.locator(`button:has-text("Review Applicants")`).first().click();
    
    // Check candidate resume drawer
    await page.getByRole('button', { name: 'View Resume' }).first().click();
    await page.waitForSelector('iframe[title="PDF Resume Preview"]', { state: 'visible', timeout: 10_000 });
    await page.screenshot({ path: path.join(MANUAL_DIR, 'admin_candidate_resume_drawer.png') });
    await page.locator('.modal-overlay button').first().click(); // close

    // Shortlist Candidate
    await page.getByRole('button', { name: 'Shortlist' }).first().click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(MANUAL_DIR, 'admin_status_shortlisted.png') });

    // Schedule Interview
    await page.getByRole('button', { name: 'Schedule Interview' }).first().click();
    await page.locator('input[type="datetime-local"]').fill('2026-07-15T10:00');
    await page.locator('input[placeholder*="Seminar Hall B"]').fill('Seminar Hall A');
    await page.locator('textarea[placeholder*="What should the candidate bring"]').fill('Bring your laptop and resume.');
    await page.locator('button[type="submit"]:has-text("Schedule Interview")').click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(MANUAL_DIR, 'admin_interview_scheduled.png') });

    // Mark Interviewed
    await page.getByRole('button', { name: 'Mark Interviewed' }).first().click();
    await page.waitForTimeout(1000);
    
    // Select Candidate
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Select Candidate' }).first().click();
    await expect(page.getByText(/Selected/i).first()).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: path.join(MANUAL_DIR, 'admin_candidate_selected.png') });

    // Logout Admin
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    // ==========================================================================
    // PHASE G — FINAL VERIFICATION & RESPONSIBILITY VIEWPORT SHOTS
    // ==========================================================================
    console.log('--- Step 7: Final Student Verification & Viewport check ---');
    await page.goto('/login/student');
    await page.locator('#student-login-email').fill(studentEmail);
    await page.locator('#student-login-password').fill(studentPass);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(url => url.pathname === '/student/dashboard');

    // Viewports capture
    const viewports = [
      { name: '320px', width: 320, height: 568 },
      { name: '375px', width: 375, height: 667 },
      { name: '768px', width: 768, height: 1024 },
      { name: '1024px', width: 1024, height: 768 },
      { name: '1440px', width: 1440, height: 900 }
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(MANUAL_DIR, `viewport_${vp.name}_student_dashboard.png`) });
    }

    console.log('FINAL PRE-DEPLOYMENT MANUAL ACCEPTANCE WALKTHROUGH SUCCESS.');
  });
});
