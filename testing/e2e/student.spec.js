import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { injectAuth, loginViaUI, loadTestUsers } from '../helpers/auth.js';
import { resetDB } from '../helpers/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const certFixture = path.join(__dirname, '../fixtures/sample-certificate.txt');

test.describe('Student workflows', () => {
  test.beforeEach(async () => {
    await resetDB();
  });

  test('login via UI', async ({ page }) => {
    await loginViaUI(page, 'student');
    await expect(page.getByRole('heading', { name: /good (morning|afternoon|evening)/i })).toBeVisible({ timeout: 15_000 });
  });

  test('upload certificate', async ({ page }) => {
    await injectAuth(page, 'student');
    await page.goto('/student/certificates');
    await expect(page.getByRole('heading', { name: 'Certificates', exact: true, level: 1 })).toBeVisible();

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(certFixture);
    await expect(page.locator('text=sample-certificate')).toBeVisible({ timeout: 10_000 });
  });

  test('submit activity', async ({ page }) => {
    await injectAuth(page, 'student');
    await page.goto('/student/upload');

    await page.locator('input[name="title"]').fill(`E2E Workshop ${Date.now()}`);
    await page.locator('input[name="activityDate"]').fill('2026-03-01');
    await page.locator('select[name="category"]').selectOption('Workshops');
    await page.locator('textarea[name="description"]').fill('Automated E2E activity submission test.');
    await page.getByRole('button', { name: 'Submit Activity' }).click();

    await expect(page.getByText(/activity submitted/i)).toBeVisible({ timeout: 15_000 });
  });

  test('submit OD request', async ({ page }) => {
    await injectAuth(page, 'student');
    await page.goto('/student/od');

    await page.getByTestId('od-event-name').fill(`E2E Tech Summit ${Date.now()}`);
    await page.getByTestId('od-event-date').fill('2026-04-15');
    await page.getByTestId('od-submit').click();

    await expect(page.getByText(/submitted successfully|request submitted/i)).toBeVisible({ timeout: 15_000 });
  });

  test('apply for placement', async ({ page }) => {
    const users = loadTestUsers();
    const apiUrl = process.env.E2E_API_URL || 'http://localhost:5000/api';
    const unique = Date.now();

    const driveRes = await fetch(`${apiUrl}/opportunities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${users.users.admin.token}`,
      },
      body: JSON.stringify({
        driveCode: `DRIVE-${unique}`,
        title: 'E2E SDE Role',
        company: `SelectCorp-${unique}`,
        type: 'Full-time',
        description: 'E2E placement drive',
        deadline: new Date(Date.now() + 7 * 86400000).toISOString(),
        eligibility: {
          minCGPA: 6,
          eligibleDepartments: [users.department],
          minSemester: 5,
          passingYear: 2026,
          maxActiveBacklogs: 2,
        },
      }),
    });
    const drive = await driveRes.json();
    expect(driveRes.ok).toBeTruthy();

    await fetch(`${apiUrl}/opportunities/${drive.opportunity._id}/publish`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${users.users.admin.token}` },
    });

    await injectAuth(page, 'student');
    await page.goto('/student/placements');
    await expect(page.getByText(`SelectCorp-${unique}`)).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Apply Now' }).first().click();
    await page.getByTestId('apply-resume-url').fill('https://example.com/e2e-resume.pdf');
    await page.getByTestId('placement-apply').click();
    await expect(page.getByText(/application submitted|applied successfully/i)).toBeVisible({ timeout: 15_000 });
  });

  test('apply for scholarship', async ({ page }) => {
    const users = loadTestUsers();
    const apiUrl = process.env.E2E_API_URL || 'http://localhost:5000/api';
    const unique = Date.now();

    const schRes = await fetch(`${apiUrl}/scholarships`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${users.users.admin.token}`,
      },
      body: JSON.stringify({
        title: `SCHOLARSHIP-${unique}`,
        provider: 'E2E Foundation',
        amount: 50000,
        description: 'E2E scholarship test',
        deadline: new Date(Date.now() + 14 * 86400000).toISOString(),
        eligibility: { minCGPA: 6, eligibleDepartments: [users.department], minAchievementPoints: 0 },
      }),
    });
    const sch = await schRes.json();
    expect(schRes.ok).toBeTruthy();

    await fetch(`${apiUrl}/scholarships/${sch.scholarship._id}/publish`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${users.users.admin.token}` },
    });

    await injectAuth(page, 'student');
    await page.goto('/student/placements');
    await expect(page.getByText(`SCHOLARSHIP-${unique}`)).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Apply' }).first().click();
    await page.getByTestId('apply-annual-income').fill('200000');
    await page.getByTestId('scholarship-apply').click();
    await expect(page.getByText(/applied successfully|submitted successfully/i)).toBeVisible({ timeout: 15_000 });
  });
});
