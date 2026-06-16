import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USERS_FILE = path.join(__dirname, '../.test-users.json');
const ARTIFACTS_DIR = 'C:/Users/Sbhav/.gemini/antigravity/brain/bcefe643-c735-4a32-90fd-bb51a5913fd8';

function loadTestUsers() {
  if (!fs.existsSync(USERS_FILE)) {
    throw new Error('Test users not seeded. Run npm run seed first.');
  }
  return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
}

async function capture() {
  const data = loadTestUsers();
  const password = data.password;
  const baseUrl = 'http://localhost:5173';

  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });

  const capturePage = async (role, email, targetPath, screenshotName) => {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 }
    });
    const page = await context.newPage();

    console.log(`Logging in as ${role} (${email})...`);
    // Login flow
    const loginRole = role === 'coordinator' ? 'faculty' : role;
    await page.goto(`${baseUrl}/login/${loginRole}`);
    await page.waitForSelector(`#${loginRole}-login-email`, { timeout: 10000 });
    await page.locator(`#${loginRole}-login-email`).fill(email);
    await page.locator(`#${loginRole}-login-password`).fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Wait for redirect
    const expectedPath = role === 'student' ? '/student/dashboard' : (role === 'admin' ? '/admin' : '/faculty');
    await page.waitForURL(url => url.pathname.startsWith(expectedPath), { timeout: 15000 });
    console.log(`Logged in successfully. Navigating to ${targetPath}...`);

    // Go to target page
    await page.goto(`${baseUrl}${targetPath}`);
    await page.waitForTimeout(3000); // Wait for API calls & layout rendering

    // Capture screenshot
    const screenshotPath = path.join(ARTIFACTS_DIR, screenshotName);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`Saved screenshot to: ${screenshotPath}`);

    await context.close();
  };

  try {
    // 1. Student Support Page
    await capturePage(
      'student',
      data.users.student.email,
      '/student/support',
      'student_support.png'
    );

    // 2. Faculty Support Page
    await capturePage(
      'faculty',
      data.users.faculty.email,
      '/faculty/support',
      'faculty_support.png'
    );

    // 3. Admin Support Page
    await capturePage(
      'admin',
      data.users.admin.email,
      '/admin/support',
      'admin_support.png'
    );

    // 4. Coordinator Dashboard Page
    await capturePage(
      'coordinator',
      data.users.coordinator.email,
      '/faculty/dashboard',
      'coordinator_dashboard.png'
    );

  } catch (error) {
    console.error('Error during capture:', error);
  } finally {
    await browser.close();
    console.log('Browser closed.');
  }
}

capture();
