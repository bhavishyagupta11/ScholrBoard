import { test, expect } from '@playwright/test';
import { injectAuth, loginViaUI, loadTestUsers } from '../helpers/auth.js';
import { resetDB } from '../helpers/db.js';

test.describe('V2 Features E2E Tests', () => {
  test.beforeEach(async () => {
    await resetDB();
  });

  test('Track system filters student sidebar modules', async ({ page }) => {
    // 1. Engineering student login (CSE resolves to engineering track)
    await injectAuth(page, 'student');
    await page.goto('/student/dashboard');
    
    // Engineering track has Coding and Developer Score enabled
    await expect(page.getByRole('link', { name: 'Coding', exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('link', { name: 'Developer Score', exact: true })).toBeVisible({ timeout: 10_000 });
  });

  test('Coordinator login routing & dashboard oversight', async ({ page }) => {
    const data = loadTestUsers();
    const coordinator = data.users.coordinator;

    // Login via Faculty portal (as per coordinator guidelines)
    await page.goto('/login/faculty');
    await page.locator('#faculty-login-email').fill(coordinator.email);
    await page.locator('#faculty-login-password').fill(data.password);
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Verify coordinator lands on faculty URL
    await page.waitForURL((url) => url.pathname === '/faculty' || url.pathname === '/faculty/dashboard', { timeout: 15_000 });

    // Verify coordinator-specific dashboard header is rendered
    await expect(page.getByText('Department Coordinator Portal')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Department Students')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Faculty Advisor Workload')).toBeVisible({ timeout: 10_000 });
  });

  test('Support ticket creation and faculty/coordinator assignment', async ({ page }) => {
    const data = loadTestUsers();
    
    // 1. Student creates support ticket
    await injectAuth(page, 'student');
    await page.goto('/student/support');
    
    await page.getByRole('button', { name: 'New Ticket' }).click();
    await page.locator('input[placeholder="Brief description of your issue"]').fill('E2E Support Test Ticket');
    await page.locator('select').nth(1).selectOption('faculty'); // Direct to: My Faculty Advisor
    await page.locator('textarea[placeholder="Describe your issue in detail..."]').fill('Detail explanation for E2E ticket.');
    
    await page.getByRole('button', { name: 'Submit Ticket' }).click();
    
    // Assert ticket is shown in the ticket list
    await expect(page.getByText('E2E Support Test Ticket')).toBeVisible({ timeout: 15_000 });
    
    // Log out student
    await page.goto('/student/dashboard');
    await page.getByRole('button', { name: 'Logout' }).click();
    await page.waitForURL('/');

    // 2. Coordinator views department tickets
    const coordinator = data.users.coordinator;
    await page.goto('/login/faculty');
    await page.locator('#faculty-login-email').fill(coordinator.email);
    await page.locator('#faculty-login-password').fill(data.password);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await page.waitForURL((url) => url.pathname === '/faculty' || url.pathname === '/faculty/dashboard', { timeout: 15_000 });
    
    await page.goto('/faculty/support');
    await expect(page.getByText('E2E Support Test Ticket')).toBeVisible({ timeout: 15_000 });
  });
});
