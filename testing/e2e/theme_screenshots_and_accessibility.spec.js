import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import path from 'node:path';
import { loginViaUI } from '../helpers/auth.js';
import { resetDB } from '../helpers/db.js';

const SCREENSHOT_DIR = 'C:\\Users\\Sbhav\\.gemini\\antigravity\\brain\\f7d2714d-19e0-480f-94ba-037f43495a5c';
const REPORT_JSON_PATH = path.join(SCREENSHOT_DIR, 'accessibility_report.json');
const REPORT_MD_PATH = path.join(SCREENSHOT_DIR, 'accessibility_report.md');

async function setTheme(page, targetTheme) {
  const currentTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  if (currentTheme !== targetTheme) {
    const toggleBtn = page.locator('button[aria-label="Toggle dark and light theme"]');
    if (await toggleBtn.count() > 0) {
      await toggleBtn.click();
      await page.waitForTimeout(600); // Allow transition
      const newTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      console.log(`Switched theme from ${currentTheme} to ${newTheme}`);
    } else {
      console.log(`Theme toggle button not found on ${page.url()}`);
    }
  }
}

test.describe('Theme Hardening Visual and Accessibility Audit', () => {
  const auditResults = {};

  test.beforeEach(async () => {
    await resetDB();
  });

  test.afterAll(() => {
    // Write JSON report
    fs.writeFileSync(REPORT_JSON_PATH, JSON.stringify(auditResults, null, 2));
    console.log(`\nAccessibility report JSON saved to: ${REPORT_JSON_PATH}`);

    // Generate markdown report
    let md = `# Theme & Accessibility Audit Report (axe-core)\n\n`;
    md += `Generated: ${new Date().toISOString()}\n\n`;
    md += `## Visual Screen Mappings\n\n`;
    md += `| Page | Light Theme (Restored Warm Cream) | Dark Theme (Premium Matte Black) |\n`;
    md += `|---|---|---|\n`;
    md += `| **Landing Page** | [Light Screen](file:///${SCREENSHOT_DIR.replace(/\\/g, '/')}/landing-page-light.png) | [Dark Screen](file:///${SCREENSHOT_DIR.replace(/\\/g, '/')}/landing-page-dark.png) |\n`;
    md += `| **Student Dashboard** | [Light Screen](file:///${SCREENSHOT_DIR.replace(/\\/g, '/')}/student-dashboard-light.png) | [Dark Screen](file:///${SCREENSHOT_DIR.replace(/\\/g, '/')}/student-dashboard-dark.png) |\n`;
    md += `| **Faculty Dashboard** | [Light Screen](file:///${SCREENSHOT_DIR.replace(/\\/g, '/')}/faculty-dashboard-light.png) | [Dark Screen](file:///${SCREENSHOT_DIR.replace(/\\/g, '/')}/faculty-dashboard-dark.png) |\n`;
    md += `| **Admin Dashboard** | [Light Screen](file:///${SCREENSHOT_DIR.replace(/\\/g, '/')}/admin-dashboard-light.png) | [Dark Screen](file:///${SCREENSHOT_DIR.replace(/\\/g, '/')}/admin-dashboard-dark.png) |\n`;
    md += `| **Developer Dashboard** | [Light Screen](file:///${SCREENSHOT_DIR.replace(/\\/g, '/')}/developer-dashboard-light.png) | [Dark Screen](file:///${SCREENSHOT_DIR.replace(/\\/g, '/')}/developer-dashboard-dark.png) |\n`;
    md += `| **Talent Discovery** | [Light Screen](file:///${SCREENSHOT_DIR.replace(/\\/g, '/')}/talent-discovery-light.png) | [Dark Screen](file:///${SCREENSHOT_DIR.replace(/\\/g, '/')}/talent-discovery-dark.png) |\n`;
    md += `| **Student360** | [Light Screen](file:///${SCREENSHOT_DIR.replace(/\\/g, '/')}/student360-light.png) | [Dark Screen](file:///${SCREENSHOT_DIR.replace(/\\/g, '/')}/student360-dark.png) |\n`;
    md += `| **Candidate Drawer** | [Light Screen](file:///${SCREENSHOT_DIR.replace(/\\/g, '/')}/candidate-drawer-light.png) | [Dark Screen](file:///${SCREENSHOT_DIR.replace(/\\/g, '/')}/candidate-drawer-dark.png) |\n\n`;

    md += `## Accessibility Audit Outcomes\n\n`;

    for (const [pageName, data] of Object.entries(auditResults)) {
      md += `### Page: ${pageName}\n`;
      md += `* **URL**: \`${data.url}\`\n`;
      md += `* **Theme**: \`${data.theme}\`\n`;
      md += `* **Total Violations**: ${data.violationsCount}\n`;
      md += `* **Passes**: ${data.passesCount}\n\n`;

      if (data.violationsCount === 0) {
        md += `✅ **PASS** — No accessibility violations found in this mode!\n\n`;
      } else {
        md += `⚠️ **FAIL** — Accessibility violations found!\n\n`;
        md += `#### Violations Details\n\n`;
        md += `| ID | Impact | Description | Help URL | Affected Nodes Count |\n`;
        md += `|---|---|---|---|---|\n`;
        for (const v of data.violations) {
          md += `| \`${v.id}\` | **${v.impact}** | ${v.description} | [Learn More](${v.helpUrl}) | ${v.nodes.length} |\n`;
        }
        md += `\n`;

        md += `#### Affected Elements & Recommendations\n\n`;
        for (const v of data.violations) {
          md += `##### Rule: \`${v.id}\` (${v.impact})\n`;
          md += `* **Description**: ${v.description}\n`;
          md += `* **Fix Recommendation**: ${v.help}\n`;
          md += `* **Target Elements**:\n`;
          for (const node of v.nodes.slice(0, 5)) {
            md += `  * Selector: \`${node.target.join(' > ')}\`\n`;
            if (node.failureSummary) {
              md += `    * Summary: *${node.failureSummary.replace(/\n/g, ' ')}*\n`;
            }
          }
          if (v.nodes.length > 5) {
            md += `  * *...and ${v.nodes.length - 5} more elements.*\n`;
          }
          md += `\n`;
        }
      }
      md += `---\n\n`;
    }

    fs.writeFileSync(REPORT_MD_PATH, md);
    console.log(`Accessibility report Markdown saved to: ${REPORT_MD_PATH}`);
  });

  test('1. Landing Page Screenshots & Accessibility', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    // Light Theme
    await setTheme(page, 'light');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'landing-page-light.png') });
    let results = await new AxeBuilder({ page }).analyze();
    auditResults['Landing Page (Light Theme)'] = {
      url: page.url(),
      theme: 'light',
      violationsCount: results.violations.length,
      passesCount: results.passes.length,
      violations: results.violations
    };

    // Dark Theme
    await setTheme(page, 'dark');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'landing-page-dark.png') });
    results = await new AxeBuilder({ page }).analyze();
    auditResults['Landing Page (Dark Theme)'] = {
      url: page.url(),
      theme: 'dark',
      violationsCount: results.violations.length,
      passesCount: results.passes.length,
      violations: results.violations
    };
  });

  test('2. Student Dashboard Screenshots & Accessibility', async ({ page }) => {
    await loginViaUI(page, 'student');
    await page.goto('/student/dashboard');
    await page.waitForTimeout(1500);

    // Light Theme
    await setTheme(page, 'light');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'student-dashboard-light.png') });
    let results = await new AxeBuilder({ page }).analyze();
    auditResults['Student Dashboard (Light Theme)'] = {
      url: page.url(),
      theme: 'light',
      violationsCount: results.violations.length,
      passesCount: results.passes.length,
      violations: results.violations
    };

    // Dark Theme
    await setTheme(page, 'dark');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'student-dashboard-dark.png') });
    results = await new AxeBuilder({ page }).analyze();
    auditResults['Student Dashboard (Dark Theme)'] = {
      url: page.url(),
      theme: 'dark',
      violationsCount: results.violations.length,
      passesCount: results.passes.length,
      violations: results.violations
    };
  });

  test('3. Faculty Dashboard Screenshots & Accessibility', async ({ page }) => {
    await loginViaUI(page, 'faculty');
    await page.goto('/faculty');
    await page.waitForTimeout(1500);

    // Light Theme
    await setTheme(page, 'light');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'faculty-dashboard-light.png') });
    let results = await new AxeBuilder({ page }).analyze();
    auditResults['Faculty Dashboard (Light Theme)'] = {
      url: page.url(),
      theme: 'light',
      violationsCount: results.violations.length,
      passesCount: results.passes.length,
      violations: results.violations
    };

    // Dark Theme
    await setTheme(page, 'dark');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'faculty-dashboard-dark.png') });
    results = await new AxeBuilder({ page }).analyze();
    auditResults['Faculty Dashboard (Dark Theme)'] = {
      url: page.url(),
      theme: 'dark',
      violationsCount: results.violations.length,
      passesCount: results.passes.length,
      violations: results.violations
    };
  });

  test('4. Admin Dashboard Screenshots & Accessibility', async ({ page }) => {
    await loginViaUI(page, 'admin');
    await page.goto('/admin');
    await page.waitForTimeout(1500);

    // Light Theme
    await setTheme(page, 'light');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'admin-dashboard-light.png') });
    let results = await new AxeBuilder({ page }).analyze();
    auditResults['Admin Dashboard (Light Theme)'] = {
      url: page.url(),
      theme: 'light',
      violationsCount: results.violations.length,
      passesCount: results.passes.length,
      violations: results.violations
    };

    // Dark Theme
    await setTheme(page, 'dark');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'admin-dashboard-dark.png') });
    results = await new AxeBuilder({ page }).analyze();
    auditResults['Admin Dashboard (Dark Theme)'] = {
      url: page.url(),
      theme: 'dark',
      violationsCount: results.violations.length,
      passesCount: results.passes.length,
      violations: results.violations
    };
  });

  test('5. Student Developer Dashboard Screenshots & Accessibility', async ({ page }) => {
    await loginViaUI(page, 'student');
    await page.goto('/student/developer');
    await page.waitForTimeout(2000);

    // Light Theme
    await setTheme(page, 'light');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'developer-dashboard-light.png') });
    let results = await new AxeBuilder({ page }).analyze();
    auditResults['Developer Dashboard (Light Theme)'] = {
      url: page.url(),
      theme: 'light',
      violationsCount: results.violations.length,
      passesCount: results.passes.length,
      violations: results.violations
    };

    // Dark Theme
    await setTheme(page, 'dark');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'developer-dashboard-dark.png') });
    results = await new AxeBuilder({ page }).analyze();
    auditResults['Developer Dashboard (Dark Theme)'] = {
      url: page.url(),
      theme: 'dark',
      violationsCount: results.violations.length,
      passesCount: results.passes.length,
      violations: results.violations
    };
  });

  test('6. Admin Talent Discovery Screenshots & Accessibility', async ({ page }) => {
    await loginViaUI(page, 'admin');
    await page.goto('/admin/talent-discovery');
    await page.waitForSelector('table', { timeout: 15000 });
    await page.waitForTimeout(1500);

    // Light Theme
    await setTheme(page, 'light');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'talent-discovery-light.png') });
    let results = await new AxeBuilder({ page }).analyze();
    auditResults['Talent Discovery (Light Theme)'] = {
      url: page.url(),
      theme: 'light',
      violationsCount: results.violations.length,
      passesCount: results.passes.length,
      violations: results.violations
    };

    // Dark Theme
    await setTheme(page, 'dark');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'talent-discovery-dark.png') });
    results = await new AxeBuilder({ page }).analyze();
    auditResults['Talent Discovery (Dark Theme)'] = {
      url: page.url(),
      theme: 'dark',
      violationsCount: results.violations.length,
      passesCount: results.passes.length,
      violations: results.violations
    };
  });

  test('7. Student360 Screenshots & Accessibility', async ({ page }) => {
    page.on('console', msg => console.log(`[PAGE CONSOLE] ${msg.text()}`));
    page.on('requestfailed', request => console.log(`[PAGE REQ FAILED] ${request.url()} - ${request.failure()?.errorText}`));
    page.on('response', response => {
      if (response.status() >= 400) {
        console.log(`[PAGE REQ ERROR] ${response.url()} - Status ${response.status()}`);
      }
    });

    await loginViaUI(page, 'faculty');
    await page.goto('/faculty/mentor');
    await page.waitForTimeout(1500);

    // Light Theme
    await setTheme(page, 'light');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'student360-light.png') });
    let results = await new AxeBuilder({ page }).analyze();
    auditResults['Student360 (Light Theme)'] = {
      url: page.url(),
      theme: 'light',
      violationsCount: results.violations.length,
      passesCount: results.passes.length,
      violations: results.violations
    };

    // Dark Theme
    await setTheme(page, 'dark');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'student360-dark.png') });
    results = await new AxeBuilder({ page }).analyze();
    auditResults['Student360 (Dark Theme)'] = {
      url: page.url(),
      theme: 'dark',
      violationsCount: results.violations.length,
      passesCount: results.passes.length,
      violations: results.violations
    };
  });

  test('8. Candidate Drawer Screenshots & Accessibility', async ({ page }) => {
    await loginViaUI(page, 'admin');
    await page.goto('/admin/talent-discovery');
    await page.waitForSelector('table button', { timeout: 15000 });
    
    // Open candidate drawer
    await page.locator('table button').first().click();
    await page.waitForSelector('text=Candidate Details', { timeout: 5000 });
    await page.waitForTimeout(1000);

    // Light Theme
    await setTheme(page, 'light');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'candidate-drawer-light.png') });
    let results = await new AxeBuilder({ page }).analyze();
    auditResults['Candidate Drawer (Light Theme)'] = {
      url: page.url(),
      theme: 'light',
      violationsCount: results.violations.length,
      passesCount: results.passes.length,
      violations: results.violations
    };

    // Dark Theme
    await setTheme(page, 'dark');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'candidate-drawer-dark.png') });
    results = await new AxeBuilder({ page }).analyze();
    auditResults['Candidate Drawer (Dark Theme)'] = {
      url: page.url(),
      theme: 'dark',
      violationsCount: results.violations.length,
      passesCount: results.passes.length,
      violations: results.violations
    };
  });
});
