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
const certFixture = path.join(__dirname, '../fixtures/sample-certificate.txt');
const pdfFixture = path.join(__dirname, '../fixtures/valid-pdf.pdf');
const resumeFixture = path.join(__dirname, '../fixtures/sample-resume.pdf');

test.describe('Phase 4.5.4B E2E Mandatory 22-Step Workflow Verification', () => {
  test.beforeAll(async () => {
    await resetDB();
    fs.copyFileSync(pdfFixture, resumeFixture);
  });

  test.afterAll(async () => {
    if (fs.existsSync(resumeFixture)) {
      fs.unlinkSync(resumeFixture);
    }
  });

  test('Execute complete 22-step workflow', async ({ page }) => {
    const unique = Date.now();
    const studentEmail = `e2e.flow.${unique}@scholrboard.com`;
    const studentPass = 'Password@123';
    const studentName = 'E2E Flow Student';
    const studentIdStr = `STU-FLOW-${unique}`;

    console.log('--- Step 1: Student registers ---');
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
    await expect(page.getByRole('heading', { name: /good (morning|afternoon|evening)/i })).toBeVisible();

    console.log('--- Step 2: Student uploads resume ---');
    await page.goto('/student/resume');
    await page.waitForSelector('input[type="file"]', { state: 'attached', timeout: 10_000 });
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(resumeFixture);
    await page.getByRole('button', { name: 'Analyze Resume with AI' }).click();
    await expect(page.getByText(/uploaded successfully/i)).toBeVisible({ timeout: 15_000 });

    console.log('--- Step 3 & 4: Resume analysis completes & intelligence generated ---');
    await expect(page.getByText(/ATS Score/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: 'Strengths', exact: true })).toBeVisible();

    console.log('--- Step 5: Student uploads activity proof ---');
    await page.goto('/student/upload');
    await page.locator('input[name="title"]').fill(`E2E Activity Title ${unique}`);
    await page.locator('input[name="activityDate"]').fill('2026-06-01');
    await page.locator('select[name="category"]').selectOption('Workshops');
    await page.locator('textarea[name="description"]').fill('E2E activity description for validation.');
    const proofInput = page.locator('input[type="file"]').first();
    await proofInput.setInputFiles(resumeFixture);
    await page.getByRole('button', { name: 'Submit Activity' }).click();
    await expect(page.getByText(/activity submitted/i)).toBeVisible({ timeout: 15_000 });

    // Logout student
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    console.log('--- Step 6 & 7: Faculty reviews activity & requests revision ---');
    const usersObj = loadTestUsers();
    // Assign advisorId programmatically to our registered student so faculty can see their approvals
    const dbUri = process.env.MONGODB_URI_TEST;
    if (!dbUri) {
      throw new Error('CRITICAL SAFETY ERROR: MONGODB_URI_TEST is not defined in environment variables.');
    }
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(dbUri);
    }
    const dbName = mongoose.connection.db.databaseName;
    if (dbName !== 'scholrboard_test') {
      await mongoose.disconnect();
      throw new Error(`CRITICAL SAFETY ERROR: E2E testing is only allowed on the test database "scholrboard_test". Currently connected to: "${dbName}". Execution aborted!`);
    }
    const User = (await import('../../server/models/User.js')).default;
    const Activity = (await import('../../server/models/Activity.js')).default;
    const studentUser = await User.findOne({ email: studentEmail });
    const facultyUser = await User.findOne({ email: 'e2e.faculty@scholrboard.test' });
    await User.findByIdAndUpdate(studentUser._id, { advisorId: facultyUser._id });
    await mongoose.disconnect();

    // Log in faculty via UI
    await page.goto('/login/faculty');
    await page.locator('#faculty-login-email').fill('e2e.faculty@scholrboard.test');
    await page.locator('#faculty-login-password').fill(usersObj.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL((url) => url.pathname === '/faculty' || url.pathname === '/faculty/dashboard', { timeout: 15_000 });

    // Review activities page
    await page.goto('/faculty/approvals');
    await page.waitForSelector(`text=${unique}`, { timeout: 15_000 });

    // Click request revision
    page.once('dialog', async (dialog) => {
      await dialog.accept('Please update description to be longer');
    });
    await page.getByRole('button', { name: /Request Revision/i }).first().click();
    await expect(page.getByText(`E2E Activity Title ${unique}`)).not.toBeVisible({ timeout: 15_000 });

    // Logout faculty
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    console.log('--- Step 8 & 9: Student updates submission & returns to Pending ---');
    await page.goto('/login/student');
    await page.locator('#student-login-email').fill(studentEmail);
    await page.locator('#student-login-password').fill(studentPass);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL((url) => url.pathname === '/student/dashboard', { timeout: 15_000 });

    await page.goto('/student/activities');
    await page.waitForSelector(`text=Needs Revision`, { timeout: 10_000 });
    // Click edit/update activity
    await page.getByRole('button', { name: /edit/i }).first().click();
    await page.locator('textarea[name="description"]').fill('E2E activity description has been fully updated.');
    await page.getByRole('button', { name: 'Update Activity' }).click();
    await expect(page.getByText(/activity updated/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(`Pending`)).toBeVisible({ timeout: 10_000 });

    // Logout student
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    console.log('--- Step 10: Faculty approves activity ---');
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
    await expect(page.getByText(`E2E Activity Title ${unique}`)).not.toBeVisible({ timeout: 15_000 });

    // Logout faculty
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    console.log('--- Step 11: Admin publishes announcement ---');
    await page.goto('/login/admin');
    await page.locator('#admin-login-email').fill('e2e.admin@scholrboard.test');
    await page.locator('#admin-login-password').fill(usersObj.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL((url) => url.pathname === '/admin' || url.pathname === '/admin/dashboard', { timeout: 15_000 });

    await page.goto('/admin/announcements');
    const annTitle = `E2E Announcement Title ${unique}`;
    await page.getByTestId('announcement-title').fill(annTitle);
    await page.getByTestId('announcement-content').fill('This is a mandatory E2E announcement message targeting CSE.');
    await page.locator('select[name="department"]').selectOption('CSE');
    await page.getByTestId('announcement-submit').click();
    await expect(page.getByTestId('announcement-success-alert')).toBeVisible({ timeout: 15_000 });

    console.log('--- Step 13: Admin publishes event ---');
    await page.goto('/admin/events');
    await page.getByRole('button', { name: /Create New Event/i }).click();
    const eventTitle = `E2E Event Title ${unique}`;
    await page.locator('input[name="title"]').fill(eventTitle);
    await page.locator('select[name="category"]').selectOption('Hackathon');
    await page.locator('input[name="venue"]').fill('E2E Main Hall');
    await page.locator('input[name="startDate"]').fill('2026-07-01');
    await page.locator('input[name="targetDepartments"]').fill('CSE');
    await page.locator('input[id="requiresRegistration"]').check();
    await page.locator('input[id="isPublished"]').check();
    await page.getByRole('button', { name: 'Create Event' }).click();
    await page.waitForTimeout(2000); // Wait for modal to close and save

    console.log('--- Step 15: Admin publishes placement drive ---');
    await page.goto('/admin/placements');
    await page.getByRole('button', { name: /Compose Drive/i }).click();
    const companyName = `E2E SelectCorp ${unique}`;
    await page.getByTestId('drive-code').fill(`DRIVE-E2E-${unique}`);
    await page.getByTestId('drive-title').fill('E2E Software Engineer');
    await page.getByTestId('drive-company').fill(companyName);
    await page.getByTestId('drive-description').fill('Engineering career drive validation E2E.');
    await page.getByTestId('drive-salary').fill('800000');
    await page.getByTestId('drive-deadline').fill('2026-12-31T23:59');
    await page.locator('input[name="eligibleDepartments"]').fill('CSE');
    await page.locator('input[name="minPlacementReadinessScore"]').fill('75');
    await page.getByRole('button', { name: 'Compose Drive Draft' }).click();
    await expect(page.getByTestId('placement-success-alert')).toBeVisible({ timeout: 15_000 });

    // Publish drive from list
    await page.getByRole('button', { name: /open lists/i }).click();
    await page.waitForSelector(`text=${companyName}`, { timeout: 10_000 });
    await page.locator('button:has-text("Publish")').first().click();
    await expect(page.getByTestId('placement-success-alert')).toContainText('Published drive', { timeout: 15_000 });

    // Logout admin
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    console.log('--- Step 12, 14, 16, 17: Student receives notifications, registers event, applies to placement ---');
    await page.goto('/login/student');
    await page.locator('#student-login-email').fill(studentEmail);
    await page.locator('#student-login-password').fill(studentPass);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL((url) => url.pathname === '/student/dashboard', { timeout: 15_000 });

    // Verify notifications received (Bell count increments)
    const notificationBell = page.locator('button[aria-label*="notification"i]');
    await expect(notificationBell).toBeVisible();
    await notificationBell.click();
    await expect(page.getByText(annTitle).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(companyName).first()).toBeVisible({ timeout: 10_000 });

    // Register event
    await page.goto('/student/events');
    await page.waitForSelector(`text=${eventTitle}`, { timeout: 10_000 });
    await page.getByRole('button', { name: /Register Now/i }).first().click();
    await expect(page.getByText(/registered/i)).toBeVisible({ timeout: 15_000 });

    // Apply to placement
    await page.goto('/student/placements');
    await page.waitForSelector(`text=${companyName}`, { timeout: 10_000 });
    await page.getByRole('button', { name: 'Apply Now' }).first().click();
    await page.getByTestId('apply-resume-url').fill('https://example.com/mock-resume-flow.pdf');
    await page.getByTestId('placement-apply').click();
    await expect(page.getByText(/Applied successfully/i)).toBeVisible({ timeout: 15_000 });

    // Logout student
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    console.log('--- Step 18: Admin schedules interview ---');
    await page.goto('/login/admin');
    await page.locator('#admin-login-email').fill('e2e.admin@scholrboard.test');
    await page.locator('#admin-login-password').fill(usersObj.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL((url) => url.pathname === '/admin' || url.pathname === '/admin/dashboard', { timeout: 15_000 });

    await page.goto('/admin/placements');
    await page.getByRole('button', { name: /open lists/i }).click();
    await page.locator(`button:has-text("Review Applicants")`).first().click();

    // Schedule interview
    await page.getByRole('button', { name: 'Shortlist' }).first().click();
    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: 'Schedule Interview' }).first().click();
    await page.locator('input[type="datetime-local"]').fill('2026-07-05T10:00');
    await page.locator('input[placeholder*="Seminar Hall B"]').fill('Main Auditorium Room 101');
    await page.locator('textarea[placeholder*="What should the candidate bring"]').fill('Bring printed resume and ID card.');
    await page.locator('button[type="submit"]:has-text("Schedule Interview")').click();
    await page.waitForTimeout(2000);

    // Logout admin
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    console.log('--- Step 19: Student receives interview notification ---');
    await page.goto('/login/student');
    await page.locator('#student-login-email').fill(studentEmail);
    await page.locator('#student-login-password').fill(studentPass);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL((url) => url.pathname === '/student/dashboard', { timeout: 15_000 });

    // Verify interview schedule details are visible
    await page.goto('/student/placements');
    await expect(page.getByText(/Interview Scheduled/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Main Auditorium Room 101/i)).toBeVisible();

    // Logout student
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    console.log('--- Step 20, 21: Admin marks interviewed & selects candidate ---');
    await page.goto('/login/admin');
    await page.locator('#admin-login-email').fill('e2e.admin@scholrboard.test');
    await page.locator('#admin-login-password').fill(usersObj.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL((url) => url.pathname === '/admin' || url.pathname === '/admin/dashboard', { timeout: 15_000 });

    await page.goto('/admin/placements');
    await page.getByRole('button', { name: /open lists/i }).click();
    await page.locator(`button:has-text("Review Applicants")`).first().click();

    // Click Mark Interviewed
    await page.getByRole('button', { name: 'Mark Interviewed' }).first().click();
    await page.waitForTimeout(1000);

    // Click Select Candidate
    page.once('dialog', dialog => dialog.accept()); // handle confirm dialog
    await page.getByRole('button', { name: 'Select Candidate' }).first().click();
    await expect(page.getByText(/Selected/i).first()).toBeVisible({ timeout: 15_000 });

    // Logout admin
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    console.log('--- Step 22: Student receives selection notification ---');
    await page.goto('/login/student');
    await page.locator('#student-login-email').fill(studentEmail);
    await page.locator('#student-login-password').fill(studentPass);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL((url) => url.pathname === '/student/dashboard', { timeout: 15_000 });

    // Verify selection badge
    await page.goto('/student/placements');
    await expect(page.getByText(/Selected/i).first()).toBeVisible({ timeout: 10_000 });

    console.log('SUCCESS: All 22 steps of the mandatory workflow completed successfully.');
  });
});
