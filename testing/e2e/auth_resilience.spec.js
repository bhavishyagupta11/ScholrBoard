import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loginViaUI, loadTestUsers } from '../helpers/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONV_ID = 'f7d2714d-19e0-480f-94ba-037f43495a5c';
const BASE_DIR = `C:\\Users\\Sbhav\\.gemini\\antigravity\\brain\\${CONV_ID}`;
const SCREENSHOT_DIR = path.join(BASE_DIR, 'screenshots');
const TRACE_DIR = path.join(BASE_DIR, 'traces');
const LOG_DIR = path.join(BASE_DIR, 'logs');

// Ensure directories exist
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
fs.mkdirSync(TRACE_DIR, { recursive: true });
fs.mkdirSync(LOG_DIR, { recursive: true });

test.describe('Authentication Resilience & Hardening E2E Tests', () => {
  let users;

  test.beforeAll(() => {
    users = loadTestUsers();
  });

  const roles = ['student', 'faculty', 'admin'];

  for (const role of roles) {
    test.describe(`Role: ${role}`, () => {
      
      test(`Scenario 1: Normal and Hard Refresh for ${role}`, async ({ page, context }) => {
        const caseName = `refresh_resilience_${role}`;
        await context.tracing.start({ screenshots: true, snapshots: true, sources: true });

        // Console logger
        const logPath = path.join(LOG_DIR, `${caseName}_console.log`);
        fs.writeFileSync(logPath, `--- Console Log for ${caseName} ---\n`);
        page.on('console', msg => {
          fs.appendFileSync(logPath, `[${new Date().toISOString()}] [${msg.type()}] ${msg.text()}\n`);
        });

        console.log(`[E2E] Logging in as ${role}...`);
        await loginViaUI(page, role);

        const expectedPath = role === 'student' ? '/student/dashboard' : `/${role}`;
        await page.waitForURL(url => url.pathname.startsWith(expectedPath));

        // Normal Reload
        console.log('[E2E] Performing normal reload...');
        await page.reload();
        await page.waitForURL(url => url.pathname.startsWith(expectedPath));
        await expect(page.locator('#resilient-mode-banner')).toBeHidden();
        console.log('[E2E] Normal reload completed, user remains authenticated.');

        // Hard Reload
        console.log('[E2E] Performing hard reload...');
        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForURL(url => url.pathname.startsWith(expectedPath));
        await expect(page.locator('#resilient-mode-banner')).toBeHidden();
        console.log('[E2E] Hard reload completed, user remains authenticated.');

        await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${caseName}_success.png`) });
        await context.tracing.stop({ path: path.join(TRACE_DIR, `${caseName}_trace.zip`) });
      });

      test(`Scenario 2: Rapid Refresh Spam (10x) for ${role}`, async ({ page, context }) => {
        const caseName = `refresh_spam_${role}`;
        await context.tracing.start({ screenshots: true, snapshots: true, sources: true });

        const logPath = path.join(LOG_DIR, `${caseName}_console.log`);
        fs.writeFileSync(logPath, `--- Console Log for ${caseName} ---\n`);
        page.on('console', msg => {
          fs.appendFileSync(logPath, `[${new Date().toISOString()}] [${msg.type()}] ${msg.text()}\n`);
        });

        await loginViaUI(page, role);
        const expectedPath = role === 'student' ? '/student/dashboard' : `/${role}`;
        await page.waitForURL(url => url.pathname.startsWith(expectedPath));

        console.log('[E2E] Spamming reload 10 times rapidly...');
        for (let i = 0; i < 9; i++) {
          page.reload().catch(() => {}); // Do not await, let it abort
          await page.waitForTimeout(50);
        }
        
        // Wait and perform the 10th reload properly
        await page.waitForTimeout(500);
        await page.reload({ waitUntil: 'load' });
        await page.waitForURL(url => url.pathname.startsWith(expectedPath));
        await expect(page.locator('#resilient-mode-banner')).toBeHidden();
        console.log('[E2E] Refresh spam survived. Session remains intact.');

        await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${caseName}_success.png`) });
        await context.tracing.stop({ path: path.join(TRACE_DIR, `${caseName}_trace.zip`) });
      });

      test(`Scenario 3: Offline Mode & Recovery for ${role}`, async ({ page, context }) => {
        const caseName = `offline_fallback_${role}`;
        await context.tracing.start({ screenshots: true, snapshots: true, sources: true });

        const logPath = path.join(LOG_DIR, `${caseName}_console.log`);
        fs.writeFileSync(logPath, `--- Console Log for ${caseName} ---\n`);
        page.on('console', msg => {
          fs.appendFileSync(logPath, `[${new Date().toISOString()}] [${msg.type()}] ${msg.text()}\n`);
        });

        await loginViaUI(page, role);
        const expectedPath = role === 'student' ? '/student/dashboard' : `/${role}`;
        await page.waitForURL(url => url.pathname.startsWith(expectedPath));

        console.log('[E2E] Going offline (simulated)...');
        await page.evaluate(() => {
          Object.defineProperty(navigator, 'onLine', {
            configurable: true,
            get: () => false
          });
          window.dispatchEvent(new Event('offline'));
        });

        // Wait to let online/offline handlers react
        await page.waitForTimeout(1000);

        // Verify resilient banner is visible
        console.log('[E2E] Verifying resilient mode banner presence...');
        const banner = page.locator('#resilient-mode-banner');
        await expect(banner).toBeVisible({ timeout: 10000 });
        
        // Take screenshot of resilient mode
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${caseName}_offline_active.png`) });

        console.log('[E2E] Going back online (simulated)...');
        await page.evaluate(() => {
          Object.defineProperty(navigator, 'onLine', {
            configurable: true,
            get: () => true
          });
          window.dispatchEvent(new Event('online'));
        });

        // Wait for banner to auto-hide
        console.log('[E2E] Verifying auto-hide of resilient banner...');
        await expect(banner).toBeHidden({ timeout: 15000 });

        await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${caseName}_recovery_success.png`) });
        await context.tracing.stop({ path: path.join(TRACE_DIR, `${caseName}_trace.zip`) });
      });

      test(`Scenario 4: Backend 503 & Outage Recovery for ${role}`, async ({ page, context }) => {
        const caseName = `backend_outage_${role}`;
        await context.tracing.start({ screenshots: true, snapshots: true, sources: true });

        const logPath = path.join(LOG_DIR, `${caseName}_console.log`);
        fs.writeFileSync(logPath, `--- Console Log for ${caseName} ---\n`);
        page.on('console', msg => {
          fs.appendFileSync(logPath, `[${new Date().toISOString()}] [${msg.type()}] ${msg.text()}\n`);
        });

        await loginViaUI(page, role);
        const expectedPath = role === 'student' ? '/student/dashboard' : `/${role}`;
        await page.waitForURL(url => url.pathname.startsWith(expectedPath));

        console.log('[E2E] Simulating backend outage (HTTP 503 for auth/me)...');
        await page.route('**/api/auth/me', route => {
          route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ success: false, message: 'Service Temporarily Unavailable' })
          });
        });

        console.log('[E2E] Reloading page during backend outage...');
        await page.reload();

        // Verify resilient banner is visible
        console.log('[E2E] Verifying resilient mode banner presence...');
        const banner = page.locator('#resilient-mode-banner');
        await expect(banner).toBeVisible({ timeout: 10000 });
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${caseName}_503_active.png`) });

        // Unroute and allow recovery
        console.log('[E2E] Restoring backend connectivity (unrouting)...');
        await page.unroute('**/api/auth/me');

        // Wait for banner to auto-hide
        console.log('[E2E] Verifying auto-hide after backend recovery...');
        await expect(banner).toBeHidden({ timeout: 15000 });

        await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${caseName}_recovery_success.png`) });
        await context.tracing.stop({ path: path.join(TRACE_DIR, `${caseName}_trace.zip`) });
      });
    });
  }

  test.describe('Scenario 5: Multi-Tab Authentication Synchronization', () => {
    test('Tab A logout clears Tab B; Tab A refresh preserves Tab B', async ({ context }) => {
      const caseName = 'multitab_sync';
      
      const pageA = await context.newPage();
      const pageB = await context.newPage();

      // Console logs for Tab B
      const logPath = path.join(LOG_DIR, `${caseName}_pageB_console.log`);
      fs.writeFileSync(logPath, `--- Console Log for Page B ---\n`);
      pageB.on('console', msg => {
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] [${msg.type()}] ${msg.text()}\n`);
      });

      console.log('[E2E Multi-Tab] Logging in on Tab A...');
      await loginViaUI(pageA, 'student');
      await pageA.waitForURL(url => url.pathname.startsWith('/student/dashboard'));

      console.log('[E2E Multi-Tab] Opening Tab B and navigating...');
      await pageB.goto('/student/dashboard');
      await pageB.waitForURL(url => url.pathname.startsWith('/student/dashboard'));

      // Verify page B is authenticated
      await expect(pageB.locator('body')).toContainText('Dashboard');

      // Scenario B: Tab A refresh -> Tab B remains authenticated
      console.log('[E2E Multi-Tab] Refreshing Tab A...');
      await pageA.reload();
      await pageA.waitForURL(url => url.pathname.startsWith('/student/dashboard'));
      
      // Wait to ensure Tab B was not logged out
      await pageB.waitForTimeout(2000);
      await expect(pageB.url()).toContain('/student/dashboard');
      console.log('[E2E Multi-Tab] Tab B remains authenticated after Tab A refresh.');

      // Scenario A: Tab A logout -> Tab B immediately becomes unauthenticated
      console.log('[E2E Multi-Tab] Clicking logout on Tab A...');
      const logoutBtnA = pageA.locator('button:has-text("Logout"), button:has-text("Log out")').first();
      await logoutBtnA.click();
      await pageA.waitForURL(url => url.pathname.includes('/login') || url.pathname === '/' || url.pathname === '/landing');

      console.log('[E2E Multi-Tab] Waiting for Tab B to sync and logout...');
      // Since it listens for storage event, Tab B should automatically redirect or clear state.
      // Wait for Tab B url to reflect login/landing page redirect
      await pageB.waitForURL(url => url.pathname.includes('/login') || url.pathname === '/' || url.pathname === '/landing', { timeout: 10000 });
      console.log('[E2E Multi-Tab] Tab B successfully synced logout and redirected.');
    });
  });
});
