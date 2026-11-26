import { test, expect } from '@playwright/test';
import { loginViaUI, loadTestUsers } from '../helpers/auth.js';

test('a short study session updates the weekly total and persists after reload', async ({ page }) => {
  await loginViaUI(page, 'student');
  const weekly = page.getByText('Study This Week', { exact: true }).locator('..');
  await expect(weekly).toContainText(/\d+ min/);
  const before = Number((await weekly.innerText()).match(/(\d+) min/)[1]);
  await page.getByLabel('Study minutes').fill('3');
  await page.getByRole('button', { name: 'Log study session' }).click();
  await expect(weekly).toContainText(`${before + 3} min`);
  await page.reload();
  await expect(weekly).toContainText(`${before + 3} min`);
  await expect(page.getByText(/\d+ day streak/)).toBeVisible();
});

test('portfolio copies the configured address and offers a printable document', async ({ page, context }) => {
  const { users } = loadTestUsers();
  const endpoint = (process.env.E2E_API_URL || 'http://localhost:5000/api') + '/profile/me';
  const headers = { Authorization: `Bearer ${users.student.token}` };
  const original = (await (await page.request.get(endpoint, { headers })).json()).profile.socialLinks || {};
  const address = 'https://example.org/student-portfolio';
  try {
    expect((await page.request.put(endpoint, { headers, data: { socialLinks: { ...original, portfolio: address } } })).ok()).toBeTruthy();
    await loginViaUI(page, 'student');
    await page.goto('/student/portfolio');
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(page.url()).origin });
    await page.getByRole('button', { name: 'Copy Link' }).click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(address);
    await page.evaluate(() => { window.print = () => { document.documentElement.dataset.printRequested = 'true'; }; });
    await page.getByRole('button', { name: 'Print / Save PDF' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-print-requested', 'true');
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('aside')).toBeHidden();
    await expect(page.getByRole('heading', { name: 'My Portfolio' })).toBeVisible();
    expect((await page.pdf()).subarray(0, 5).toString()).toBe('%PDF-');
  } finally {
    expect((await page.request.put(endpoint, { headers, data: { socialLinks: original } })).ok()).toBeTruthy();
  }
});

for (const [role, destination] of [['student', 'Portfolio'], ['faculty', 'Student Tracker'], ['admin', 'Advisor Mappings']]) {
  test(`${role} mobile navigation closes after selection`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginViaUI(page, role);
    await page.getByRole('button', { name: 'Open navigation menu' }).click();
    const link = page.locator('aside nav').getByRole('link', { name: destination });
    const path = await link.getAttribute('href');
    await link.click();
    await expect(page).toHaveURL(url => url.pathname === path);
    await expect.poll(() => page.locator('aside').evaluate(el => el.getBoundingClientRect().right)).toBeLessThanOrEqual(1);
  });
}
