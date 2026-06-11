process.env.NODE_ENV = 'test';
import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 90_000,
  expect: {
    timeout: 20_000,
  },
  globalSetup: path.join(__dirname, 'global-setup.js'),
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    headless: true,
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: process.env.CI ? undefined : [
    {
      command: 'npm run server',
      cwd: path.join(__dirname, '../server'),
      url: 'http://localhost:5000/api/health',
      reuseExistingServer: true,
      timeout: 120_000,
      env: {
        NODE_ENV: 'test',
      },
    },
    {
      command: 'npm run dev',
      cwd: path.join(__dirname, '../client'),
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 120_000,
      env: {
        NODE_ENV: 'test',
      },
    },
  ],
});
