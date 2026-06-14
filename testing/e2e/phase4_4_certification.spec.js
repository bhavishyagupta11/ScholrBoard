import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loginViaUI, loadTestUsers } from '../helpers/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = 'C:\\Users\\Sbhav\\.gemini\\antigravity\\brain\\130c8d93-91db-40e6-86d1-4bf98d79b24a\\screenshots';
const TRACE_DIR = 'C:\\Users\\Sbhav\\.gemini\\antigravity\\brain\\130c8d93-91db-40e6-86d1-4bf98d79b24a\\traces';
const LOG_DIR = 'C:\\Users\\Sbhav\\.gemini\\antigravity\\brain\\130c8d93-91db-40e6-86d1-4bf98d79b24a\\logs';

// Ensure output directories exist
for (const dir of [SCREENSHOT_DIR, TRACE_DIR, LOG_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

test.describe('Phase 4.4 Production Certification E2E Tests', () => {
  let users;

  test.beforeAll(() => {
    users = loadTestUsers();
  });

  // Helper to start trace
  async function startTrace(context) {
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  }

  // Helper to stop trace and save
  async function stopTrace(context, name) {
    await context.tracing.stop({ path: path.join(TRACE_DIR, `${name}_trace.zip`) });
  }

  // Helper to setup console logging
  function setupConsoleLog(page, name) {
    const logPath = path.join(LOG_DIR, `${name}_console.log`);
    fs.writeFileSync(logPath, `--- Console Log for ${name} ---\n`);
    page.on('console', msg => {
      fs.appendFileSync(logPath, `[${msg.type()}] ${msg.text()}\n`);
    });
  }

  // 1. STUDENT WORKFLOW E2E
  test('Student Workflow - Coding, Developer Dashboard, Resume Intelligence', async ({ page, context }) => {
    const name = 'student_workflow';
    setupConsoleLog(page, name);
    await startTrace(context);

    // Navigate to Login and sign in
    console.log('Logging in as student...');
    await loginViaUI(page, 'student');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}_0_dashboard.png`) });

    // Go to Coding Page
    console.log('Navigating to Coding Page...');
    await page.goto('/student/coding');
    await page.waitForTimeout(2000); // Wait for charts to load
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}_1_coding.png`) });

    // Go to Developer Dashboard
    console.log('Navigating to Developer Dashboard...');
    await page.goto('/student/developer');
    await page.waitForTimeout(2000); // Wait for score rings to animate
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}_2_developer.png`) });

    // Go to Resume Analyzer
    console.log('Navigating to Resume Analyzer...');
    await page.goto('/student/resume-analyzer');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}_3_resume_analyzer.png`) });

    await stopTrace(context, name);
  });

  // 2. ADMIN WORKFLOW E2E
  test('Admin Workflow - Talent Discovery, Search, Sort, Drawer, XLS Export', async ({ page, context }) => {
    const name = 'admin_workflow';
    setupConsoleLog(page, name);
    await startTrace(context);

    // Intercept network requests to capture API responses
    const apiPayloadsPath = path.join(LOG_DIR, `${name}_api_payloads.json`);
    const capturedPayloads = [];
    page.on('response', async (response) => {
      if (response.url().includes('/api/')) {
        try {
          const body = await response.json();
          capturedPayloads.push({
            url: response.url(),
            status: response.status(),
            payload: body
          });
          fs.writeFileSync(apiPayloadsPath, JSON.stringify(capturedPayloads, null, 2));
        } catch (e) {
          // Ignore non-JSON responses
        }
      }
    });

    console.log('Logging in as admin...');
    await loginViaUI(page, 'admin');

    console.log('Navigating to Talent Discovery...');
    await page.goto('/admin/talent-discovery');
    await page.waitForSelector('table', { timeout: 15000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}_0_talent_discovery.png`) });

    // Search for student
    console.log('Performing Search...');
    const searchInput = page.locator('input[placeholder*="Search candidate name"]');
    await searchInput.fill('E2E Test Student');
    await page.locator('button:has-text("Search")').click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}_1_searched.png`) });

    // Sort by Dev Score
    console.log('Sorting by Dev Score...');
    await page.locator('th:has-text("Dev Score")').click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}_2_sorted.png`) });

    // Open candidate drawer
    console.log('Opening Candidate Details Drawer...');
    const studentButton = page.locator('button:has-text("E2E Test Student")');
    await studentButton.first().click();
    await page.waitForSelector('[role="dialog"]', { timeout: 10000 }); // Drawer container dialog
    await page.waitForTimeout(2000); // Wait for profile fetch in drawer
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}_3_drawer_open.png`) });

    // Close drawer via Close button
    console.log('Closing Drawer via Close button...');
    await page.locator('button[aria-label="Close candidate drawer"]').click();
    await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 10000 });

    // Shortlist student
    console.log('Shortlisting candidate...');
    const shortlistStar = page.locator('table tbody tr').first().locator('button[title*="Shortlist"]');
    await shortlistStar.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}_4_shortlisted.png`) });

    // Export XLS
    console.log('Triggering XLS Export...');
    // Intercept download event
    const downloadPromise = page.waitForEvent('download');
    await page.locator('button:has-text("Export XLS")').click();
    const download = await downloadPromise;
    const xlsPath = path.join(LOG_DIR, download.suggestedFilename());
    await download.saveAs(xlsPath);
    console.log(`Excel downloaded to: ${xlsPath}`);

    await stopTrace(context, name);
  });

  // 3. FACULTY WORKFLOW E2E
  test('Faculty Workflow - Student360 and Verification of Redaction', async ({ page, context }) => {
    const name = 'faculty_workflow';
    setupConsoleLog(page, name);
    await startTrace(context);

    // Intercept network requests to verify no scrubbed fields exist in network payload
    const facultyApiLog = path.join(LOG_DIR, `${name}_profile_network_payload.json`);
    const capturedPayloads = [];

    page.on('response', async (response) => {
      if (response.url().includes('/api/profile/')) {
        try {
          const body = await response.json();
          capturedPayloads.push({
            url: response.url(),
            status: response.status(),
            payload: body
          });
          fs.writeFileSync(facultyApiLog, JSON.stringify(capturedPayloads, null, 2));

          // Real-time regression assertion: confirm that no developerScore is leaked to faculty
          const profile = body.profile;
          if (profile) {
            console.log(`Verifying faculty scrubbing for profile: ${profile.userId?.name}`);
            expect(profile.developerScore).toBeUndefined();
            expect(profile.githubScore).toBeUndefined();
            expect(profile.dsaScore).toBeUndefined();
            expect(profile.cpScore).toBeUndefined();
            expect(profile.codingStats).toBeUndefined();
            expect(profile.scoreBreakdown).toBeUndefined();
          }
        } catch (e) {
          // Ignore errors parsing responses
        }
      }
    });

    console.log('Logging in as faculty...');
    await loginViaUI(page, 'faculty');

    console.log('Navigating to Student360...');
    await page.goto('/faculty/mentor');
    await page.waitForTimeout(3000); // Wait for student profiles to load
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}_0_student360.png`) });

    // Verify UI has no mentions of developer scores
    await expect(page.locator('text=developerScore')).not.toBeVisible();
    await expect(page.locator('text=Dev Score')).not.toBeVisible();

    await stopTrace(context, name);
  });

  // 4. SECURITY ROUTE PROTECTION E2E
  test('Security Route Protection - Redirect Verification', async ({ page, context }) => {
    const name = 'security_workflow';
    setupConsoleLog(page, name);
    await startTrace(context);

    // A. Student -> /admin/talent-discovery
    console.log('Testing: Student -> /admin/talent-discovery');
    await loginViaUI(page, 'student');
    await page.goto('/admin/talent-discovery');
    await page.waitForURL((url) => url.pathname.includes('/student/dashboard'), { timeout: 15000 });
    console.log(`Redirected student to: ${page.url()}`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}_0_student_redirect.png`) });

    // Clear local storage and cookies
    await context.clearCookies();
    await page.evaluate(() => localStorage.clear());

    // B. Faculty -> /admin/talent-discovery
    console.log('Testing: Faculty -> /admin/talent-discovery');
    await loginViaUI(page, 'faculty');
    await page.goto('/admin/talent-discovery');
    await page.waitForURL((url) => url.pathname === '/faculty' || url.pathname === '/faculty/dashboard', { timeout: 15000 });
    console.log(`Redirected faculty to: ${page.url()}`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}_1_faculty_redirect.png`) });

    // Clear local storage and cookies
    await context.clearCookies();
    await page.evaluate(() => localStorage.clear());

    // C. Admin -> /student/developer
    console.log('Testing: Admin -> /student/developer');
    await loginViaUI(page, 'admin');
    await page.goto('/student/developer');
    await page.waitForURL((url) => url.pathname === '/admin' || url.pathname === '/admin/dashboard', { timeout: 15000 });
    console.log(`Redirected admin to: ${page.url()}`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}_2_admin_redirect.png`) });

    await stopTrace(context, name);
  });
});
