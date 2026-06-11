import { test, expect } from '@playwright/test';
import { injectAuth, loadTestUsers } from '../helpers/auth.js';
import { resetDB } from '../helpers/db.js';

const apiUrl = () => process.env.E2E_API_URL || 'http://localhost:5000/api';

async function seedPendingActivity(studentToken) {
  const res = await fetch(`${apiUrl()}/activities`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({
      title: `Faculty Review Activity ${Date.now()}`,
      category: 'Workshops',
      subCategory: 'Workshop',
      activityDate: '2026-02-10',
      description: 'Pending activity for faculty E2E review',
    }),
  });
  const data = await res.json();
  expect(res.ok).toBeTruthy();
  return data.activity._id;
}

async function seedPendingOd(studentToken) {
  const res = await fetch(`${apiUrl()}/od/request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({
      eventName: `Faculty OD Review ${Date.now()}`,
      eventDate: '2026-03-20',
    }),
  });
  const data = await res.json();
  expect(res.ok).toBeTruthy();
  return data.odRequest._id;
}

test.describe('Faculty workflows', () => {
  test.beforeEach(async () => {
    await resetDB();
  });

  test('review activity — request revision', async ({ page }) => {
    const users = loadTestUsers();
    await seedPendingActivity(users.users.student.token);

    page.on('dialog', async (dialog) => {
      await dialog.accept('Please add certificate proof URL.');
    });

    await injectAuth(page, 'faculty');
    await page.goto('/faculty/approvals');
    await expect(page.getByRole('heading', { name: /activity approvals/i })).toBeVisible();

    const revisionBtn = page.getByRole('button', { name: 'Request Revision' }).first();
    await revisionBtn.click();
    await expect(revisionBtn).not.toBeVisible({ timeout: 10_000 });
  });

  test('approve activity', async ({ page }) => {
    const users = loadTestUsers();
    await seedPendingActivity(users.users.student.token);

    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    await injectAuth(page, 'faculty');
    await page.goto('/faculty/approvals');

    const approveBtn = page.getByRole('button', { name: /^approve$/i }).first();
    await approveBtn.click();
    await expect(page.getByText(/approved successfully|no pending/i)).toBeVisible({ timeout: 15_000 });
  });

  test('review OD request', async ({ page }) => {
    const users = loadTestUsers();
    await seedPendingOd(users.users.student.token);

    await injectAuth(page, 'faculty');
    await page.goto('/faculty/od-approvals');
    await expect(page.getByRole('heading', { name: /on-duty.*od.*approvals/i })).toBeVisible({ timeout: 15_000 });

    // Click "Approve Exempt" (using data-testid)
    await page.getByTestId('approve-od').first().click();

    // Fill Remarks textarea
    await page.locator('textarea').first().fill('Approved for E2E test.');

    // Click "Submit Approved" (using data-testid)
    await page.getByTestId('submit-od-review').click();

    await expect(page.getByText(/approved successfully|no pending/i)).toBeVisible({ timeout: 15_000 });
  });
});
