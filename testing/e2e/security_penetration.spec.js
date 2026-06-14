import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loginViaUI, loadTestUsers } from '../helpers/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = 'C:\\Users\\Sbhav\\.gemini\\antigravity\\brain\\130c8d93-91db-40e6-86d1-4bf98d79b24a\\screenshots';
const TRACE_DIR = 'C:\\Users\\Sbhav\\.gemini\\antigravity\\brain\\130c8d93-91db-40e6-86d1-4bf98d79b24a\\traces';
const LOG_DIR = 'C:\\Users\\Sbhav\\.gemini\\antigravity\\brain\\130c8d93-91db-40e6-86d1-4bf98d79b24a\\logs';

test.describe('Phase 4.4 Security Penetration Route Authorization Tests', () => {
  let users;

  test.beforeAll(() => {
    users = loadTestUsers();
  });

  const redirectScenarios = [
    {
      role: 'student',
      targetPath: '/admin/talent-discovery',
      expectedRedirect: '/student/dashboard',
      name: 'Student_to_AdminTalentDiscovery'
    },
    {
      role: 'student',
      targetPath: '/admin/dashboard',
      expectedRedirect: '/',
      name: 'Student_to_AdminDashboard'
    },
    {
      role: 'faculty',
      targetPath: '/admin/talent-discovery',
      expectedRedirect: '/faculty',
      name: 'Faculty_to_AdminTalentDiscovery'
    },
    {
      role: 'faculty',
      targetPath: '/admin/dashboard',
      expectedRedirect: '/',
      name: 'Faculty_to_AdminDashboard'
    },
    {
      role: 'admin',
      targetPath: '/student/developer',
      expectedRedirect: '/admin',
      name: 'Admin_to_StudentDeveloper'
    },
    {
      role: 'admin',
      targetPath: '/student/resume-analyzer',
      expectedRedirect: '/admin',
      name: 'Admin_to_StudentResumeAnalyzer'
    },
    {
      role: 'student',
      targetPath: '/faculty',
      expectedRedirect: '/student/dashboard',
      name: 'Student_to_Faculty'
    },
    {
      role: 'admin',
      targetPath: '/faculty',
      expectedRedirect: '/admin',
      name: 'Admin_to_Faculty'
    }
  ];

  for (const scenario of redirectScenarios) {
    test(`Scenario Navigation: ${scenario.role} accessing ${scenario.targetPath}`, async ({ page, context }) => {
      // Setup console logging
      const logPath = path.join(LOG_DIR, `security_penetration_${scenario.name}_console.log`);
      fs.writeFileSync(logPath, `--- Console Log for ${scenario.name} ---\n`);
      page.on('console', msg => {
        fs.appendFileSync(logPath, `[${msg.type()}] ${msg.text()}\n`);
      });

      console.log(`[Security Test] Logging in as ${scenario.role}...`);
      await loginViaUI(page, scenario.role);

      console.log(`[Security Test] Attempting direct navigation to ${scenario.targetPath}...`);
      
      // Navigate to unauthorized route
      await page.goto(scenario.targetPath);
      
      // Wait for URL redirect
      await page.waitForURL((url) => {
        if (scenario.expectedRedirect === '/') {
          return url.pathname === '/' || url.pathname === '/landing';
        }
        return url.pathname.startsWith(scenario.expectedRedirect);
      }, { timeout: 15000 });

      console.log(`[Security Test] Successfully redirected to: ${page.url()}`);
      
      // Capture screenshot at redirection state
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `security_penetration_${scenario.name}.png`) });

      // Assert no unauthorized component elements are visible
      if (scenario.targetPath.includes('/admin/')) {
        // Talent Discovery table or filters should not be visible
        await expect(page.locator('th:has-text("Dev Score")')).not.toBeVisible();
      }
      if (scenario.targetPath.includes('/student/')) {
        // Student Sync buttons or ATS score tags should not be visible
        await expect(page.locator('button:has-text("Sync Github")')).not.toBeVisible();
        await expect(page.locator('text=ATS Score')).not.toBeVisible();
      }
      if (scenario.targetPath.includes('/faculty')) {
        // Faculty student list or Mentor elements should not be visible
        await expect(page.locator('text=Mentor Panel')).not.toBeVisible();
      }
    });
  }
});
