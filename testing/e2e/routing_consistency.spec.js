import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loginViaUI, loadTestUsers } from '../helpers/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = 'C:\\Users\\Sbhav\\.gemini\\antigravity\\brain\\130c8d93-91db-40e6-86d1-4bf98d79b24a\\screenshots';
const TRACE_DIR = 'C:\\Users\\Sbhav\\.gemini\\antigravity\\brain\\130c8d93-91db-40e6-86d1-4bf98d79b24a\\traces';
const LOG_DIR = 'C:\\Users\\Sbhav\\.gemini\\antigravity\\brain\\130c8d93-91db-40e6-86d1-4bf98d79b24a\\logs';

test.describe('Phase 4.5 Routing Consistency & Integrity Tests', () => {
  let users;

  test.beforeAll(() => {
    users = loadTestUsers();
  });

  const testCases = {
    student: [
      { path: '/admin', expected: '/student/dashboard' },
      { path: '/admin/dashboard', expected: '/' },
      { path: '/admin/talent-discovery', expected: '/student/dashboard' },
      { path: '/faculty', expected: '/student/dashboard' },
      { path: '/faculty/dashboard', expected: '/' }
    ],
    faculty: [
      { path: '/admin', expected: '/faculty' },
      { path: '/admin/dashboard', expected: '/' },
      { path: '/admin/talent-discovery', expected: '/faculty' },
      { path: '/student', expected: '/faculty' },
      { path: '/student/dashboard', expected: '/faculty' },
      { path: '/student/developer', expected: '/faculty' }
    ],
    admin: [
      { path: '/student', expected: '/admin' },
      { path: '/student/dashboard', expected: '/admin' },
      { path: '/student/developer', expected: '/admin' },
      { path: '/student/resume', expected: '/admin' },
      { path: '/student/resume-analyzer', expected: '/admin' },
      { path: '/faculty', expected: '/admin' },
      { path: '/faculty/dashboard', expected: '/' }
    ]
  };

  for (const [role, cases] of Object.entries(testCases)) {
    for (const c of cases) {
      const safePathName = c.path.replace(/\//g, '_');
      const caseName = `routing_${role}_accessing${safePathName}`;

      test(`Scenario Navigation: ${role} navigating to ${c.path}`, async ({ page, context }) => {
        // Start tracing
        await context.tracing.start({ screenshots: true, snapshots: true, sources: true });

        // Setup console logs
        const logPath = path.join(LOG_DIR, `${caseName}_console.log`);
        fs.writeFileSync(logPath, `--- Console Log for ${caseName} ---\n`);
        page.on('console', msg => {
          fs.appendFileSync(logPath, `[${msg.type()}] ${msg.text()}\n`);
        });

        console.log(`[Routing Consistency] Login as ${role}...`);
        await loginViaUI(page, role);

        console.log(`[Routing Consistency] Attempting direct navigation to ${c.path}...`);
        await page.goto(c.path);

        // Wait for redirect
        await page.waitForURL((url) => {
          if (c.expected === '/') {
            return url.pathname === '/' || url.pathname === '/landing';
          }
          return url.pathname.startsWith(c.expected);
        }, { timeout: 15000 });

        const finalUrl = page.url();
        console.log(`[Routing Consistency] Result: ${c.path} -> ${finalUrl}`);

        // Take screenshot of final page
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${caseName}.png`) });

        // Verify final url meets expectation
        const urlObj = new URL(finalUrl);
        if (c.expected === '/') {
          expect(urlObj.pathname === '/' || urlObj.pathname === '/landing').toBeTruthy();
        } else {
          expect(urlObj.pathname.startsWith(c.expected)).toBeTruthy();
        }

        // Clean up tracing
        await context.tracing.stop({ path: path.join(TRACE_DIR, `${caseName}_trace.zip`) });
      });
    }
  }
});
