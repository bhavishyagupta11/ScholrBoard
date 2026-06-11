import { expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USERS_FILE = path.join(__dirname, '../.test-users.json');

export function loadTestUsers() {
  if (!fs.existsSync(USERS_FILE)) {
    throw new Error('Test users not seeded. Run: npm run seed');
  }
  return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
}

export async function injectAuth(page, role) {
  await loginViaUI(page, role);
}

export async function loginViaUI(page, role) {
  const data = loadTestUsers();
  const user = data.users[role];
  await page.goto(`/login/${role}`);
  await page.locator(`#${role}-login-email`).fill(user.email);
  await page.locator(`#${role}-login-password`).fill(data.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  const expectedPath = role === 'student' ? '/student/dashboard' : `/${role}`;
  await page.waitForURL((url) => url.pathname === expectedPath || url.pathname === `${expectedPath}/dashboard`, { timeout: 15_000 });
}
