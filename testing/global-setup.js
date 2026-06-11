import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default async function globalSetup() {
  execSync('node scripts/seed-test-users.js', {
    cwd: __dirname,
    stdio: 'inherit',
    env: process.env,
  });
}
