import { test, expect } from '@playwright/test';
import { injectAuth, loadTestUsers } from '../helpers/auth.js';
import { resetDB } from '../helpers/db.js';

const apiUrl = () => process.env.E2E_API_URL || 'http://localhost:5000/api';

test.describe('Admin workflows', () => {
  test.beforeAll(async () => {
    await resetDB();
  });

  test('create announcement', async ({ page }) => {
    await injectAuth(page, 'admin');
    await page.goto('/admin/announcements');

    const title = `E2E Announcement ${Date.now()}`;
    await page.getByTestId('announcement-title').fill(title);
    await page.getByTestId('announcement-content').fill('This is an automated E2E announcement test message.');
    await page.getByTestId('announcement-submit').click();

    await expect(page.getByTestId('announcement-success-alert')).toBeVisible({ timeout: 15_000 });
  });

  test('create opportunity and scholarship', async ({ page }) => {
    await injectAuth(page, 'admin');
    await page.goto('/admin/placements');

    await page.getByRole('button', { name: /Compose Drive/i }).click();
    const unique = Date.now();
    await page.getByTestId('drive-code').fill(`DRIVE-${unique}`);
    await page.getByTestId('drive-title').fill('Admin E2E Drive');
    await page.getByTestId('drive-company').fill(`SelectCorp-${unique}`);
    await page.getByTestId('drive-description').fill('Admin composed placement drive for E2E.');
    await page.getByTestId('drive-salary').fill('700000');
    await page.getByTestId('drive-deadline').fill('2026-12-31T23:59');
    await page.getByRole('button', { name: 'Compose Drive Draft' }).click();
    await expect(page.getByTestId('placement-success-alert')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: /Compose Scholarship/i }).click();
    await page.getByTestId('scholarship-title').fill(`SCHOLARSHIP-${unique}`);
    await page.getByTestId('scholarship-provider').fill('Admin Foundation');
    await page.getByTestId('scholarship-amount').fill('75000');
    await page.getByTestId('scholarship-description').fill('Admin composed scholarship for E2E.');
    await page.getByTestId('scholarship-deadline').fill('2026-12-31T23:59');
    await page.getByRole('button', { name: 'Compose Scholarship Draft' }).click();
    await expect(page.getByTestId('placement-success-alert')).toBeVisible({ timeout: 15_000 });
  });

  test('shortlist, schedule interview, and select candidate', async ({ page }) => {
    const users = loadTestUsers();
    const unique = Date.now();
    const adminToken = users.users.admin.token;
    const studentToken = users.users.student.token;
    const companyName = `SelectCorp-${unique}`;

    const driveRes = await fetch(`${apiUrl()}/opportunities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        driveCode: `DRIVE-${unique}`,
        title: 'Selection E2E Drive',
        company: companyName,
        type: 'Full-time',
        description: 'Admin selection workflow E2E',
        deadline: new Date(Date.now() + 30 * 86400000).toISOString(),
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
    const oppId = drive.opportunity._id;

    await fetch(`${apiUrl()}/opportunities/${oppId}/publish`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const appRes = await fetch(`${apiUrl()}/applications/opportunity/${oppId}/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({ resumeUrl: 'https://example.com/e2e-resume.pdf' }),
    });
    const app = await appRes.json();
    const appId = app.application._id;

    await fetch(`${apiUrl()}/applications/${appId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'Shortlisted', remarks: 'E2E shortlist' }),
    });

    await fetch(`${apiUrl()}/applications/${appId}/interview`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        dateTime: new Date(Date.now() + 3 * 86400000).toISOString(),
        venue: 'E2E Interview Hall',
        instructions: 'Bring resume',
      }),
    });

    await fetch(`${apiUrl()}/applications/${appId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'Interviewed', remarks: 'E2E interviewed' }),
    });

    const selectRes = await fetch(`${apiUrl()}/applications/${appId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'Selected', remarks: 'E2E selected' }),
    });
    expect(selectRes.ok).toBeTruthy();

    await injectAuth(page, 'admin');
    await page.goto('/admin/placements');
    await page.getByRole('button', { name: /open lists/i }).click();
    await expect(page.getByText(companyName)).toBeVisible({ timeout: 15_000 });
  });
});
