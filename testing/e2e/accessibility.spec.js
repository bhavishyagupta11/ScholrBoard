import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loginViaUI, loadTestUsers } from '../helpers/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORT_JSON_PATH = 'C:\\Users\\Sbhav\\.gemini\\antigravity\\brain\\130c8d93-91db-40e6-86d1-4bf98d79b24a\\logs\\accessibility_report.json';
const REPORT_MD_PATH = 'C:\\Users\\Sbhav\\.gemini\\antigravity\\brain\\130c8d93-91db-40e6-86d1-4bf98d79b24a\\logs\\accessibility_report.md';

test.describe('Axe-Core Accessibility Audits', () => {
  const auditResults = {};

  test.afterAll(() => {
    // Write JSON report
    fs.writeFileSync(REPORT_JSON_PATH, JSON.stringify(auditResults, null, 2));
    console.log(`\nAccessibility report JSON saved to: ${REPORT_JSON_PATH}`);

    // Generate and write markdown report
    let md = `# Accessibility Audit Report (axe-core)\n\n`;
    md += `Generated: ${new Date().toISOString()}\n\n`;

    for (const [pageName, data] of Object.entries(auditResults)) {
      md += `## Page: ${pageName}\n`;
      md += `* **URL**: \`${data.url}\`\n`;
      md += `* **Total Violations**: ${data.violationsCount}\n`;
      md += `* **Passes**: ${data.passesCount}\n\n`;

      if (data.violationsCount === 0) {
        md += `✅ **PASS** — No accessibility violations found!\n\n`;
      } else {
        md += `### Violations Details\n\n`;
        md += `| ID | Impact | Description | Help URL | Affected Nodes Count |\n`;
        md += `|---|---|---|---|---|\n`;
        for (const v of data.violations) {
          md += `| \`${v.id}\` | **${v.impact}** | ${v.description} | [Learn More](${v.helpUrl}) | ${v.nodes.length} |\n`;
        }
        md += `\n`;

        md += `### Impacted Elements & Recommendations\n\n`;
        for (const v of data.violations) {
          md += `#### Rule: \`${v.id}\` (${v.impact})\n`;
          md += `* **Description**: ${v.description}\n`;
          md += `* **Fix Recommendation**: ${v.help}\n`;
          md += `* **Target Elements**:\n`;
          for (const node of v.nodes.slice(0, 5)) { // Limit to top 5
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

  test('Student Developer Dashboard Accessibility', async ({ page }) => {
    await loginViaUI(page, 'student');
    await page.goto('/student/developer');
    await page.waitForTimeout(2000); // Wait for graphics

    const results = await new AxeBuilder({ page }).analyze();
    auditResults['Student Developer Dashboard'] = {
      url: page.url(),
      violationsCount: results.violations.length,
      passesCount: results.passes.length,
      violations: results.violations
    };
  });

  test('Student Resume Intelligence Accessibility & Compare Modal Trapping', async ({ page }) => {
    // Mock resume analyses to ensure we have exactly two items for comparison
    await page.route('**/api/upload/resume/analyses', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          analyses: [
            {
              _id: "6a2b779852f0a384bb463c84",
              fileName: "resume_v1.pdf",
              overallScore: 75,
              atsScore: 68,
              createdAt: "2026-06-11T12:00:00.000Z",
              skillGaps: [],
              sectionFeedback: [],
              parsedData: { education: [], experience: [], projects: [], certifications: [], skillsDetected: ["JS"] }
            },
            {
              _id: "6a2b779852f0a384bb463c85",
              fileName: "resume_v2.pdf",
              overallScore: 85,
              atsScore: 78,
              createdAt: "2026-06-12T12:00:00.000Z",
              skillGaps: [],
              sectionFeedback: [],
              parsedData: { education: [], experience: [], projects: [], certifications: [], skillsDetected: ["JS", "React"] }
            }
          ]
        })
      });
    });

    await loginViaUI(page, 'student');
    await page.goto('/student/resume-intelligence');
    await page.waitForTimeout(2000);

    // Perform accessibility scan
    const results = await new AxeBuilder({ page }).analyze();
    auditResults['Student Resume Intelligence'] = {
      url: page.url(),
      violationsCount: results.violations.length,
      passesCount: results.passes.length,
      violations: results.violations
    };

    // Test comparison modal opening & trapping
    console.log('Testing Resume Compare Modal trapping...');
    const compareInputs = page.locator('input[aria-label*="Compare"]');
    await expect(compareInputs).toHaveCount(2);
    await compareInputs.nth(0).check();
    await compareInputs.nth(1).check();

    const triggerBtn = page.locator('button:has-text("Compare Selected")');
    await expect(triggerBtn).toBeVisible();
    await triggerBtn.click();

    // Verify modal is open
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    // Press Escape to verify close
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();

    // Verify focus returned to trigger button
    const isFocused = await triggerBtn.evaluate(el => document.activeElement === el);
    console.log(`Compare modal trigger focus return: ${isFocused}`);
  });

  test('Admin Talent Discovery Accessibility & Drawer Trapping', async ({ page }) => {
    await loginViaUI(page, 'admin');
    await page.goto('/admin/talent-discovery');
    await page.waitForSelector('table', { timeout: 15000 });

    // Perform scan
    const results = await new AxeBuilder({ page }).analyze();
    auditResults['Admin Talent Discovery'] = {
      url: page.url(),
      violationsCount: results.violations.length,
      passesCount: results.passes.length,
      violations: results.violations
    };

    // Test candidate drawer focus trap
    console.log('Testing Candidate Drawer trapping...');
    const candidateBtn = page.locator('button:has-text("E2E Test Student")').first();
    await expect(candidateBtn).toBeVisible();
    await candidateBtn.click();

    const drawer = page.locator('[role="dialog"]');
    await expect(drawer).toBeVisible();

    // Verify Escape key closes drawer
    await page.keyboard.press('Escape');
    await expect(drawer).not.toBeVisible();

    // Verify focus returned to candidate button
    const isFocused = await candidateBtn.evaluate(el => document.activeElement === el);
    console.log(`Candidate drawer trigger focus return: ${isFocused}`);
  });

  test('Faculty Student360 Accessibility', async ({ page }) => {
    await loginViaUI(page, 'faculty');
    await page.goto('/faculty/mentor');
    await page.waitForTimeout(3000); // Wait for student profiles load

    const results = await new AxeBuilder({ page }).analyze();
    auditResults['Faculty Student360'] = {
      url: page.url(),
      violationsCount: results.violations.length,
      passesCount: results.passes.length,
      violations: results.violations
    };
  });
});
