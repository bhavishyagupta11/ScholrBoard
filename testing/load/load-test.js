import autocannon from 'autocannon';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../server/.env') });

const API_URL = process.env.E2E_API_URL || 'http://localhost:5000/api';
const CONCURRENCY_LEVELS = [50, 100, 250];
const DURATION = 15;

async function login(email, password) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message);
  return data.token;
}

function runLoad({ name, url, connections, headers = {} }) {
  return new Promise((resolve, reject) => {
    const instance = autocannon({
      url,
      connections,
      duration: DURATION,
      headers,
    }, (err, result) => {
      if (err) reject(err);
      else resolve({ name, connections, result });
    });
    autocannon.track(instance, { renderProgressBar: true });
  });
}

async function main() {
  const usersPath = path.join(__dirname, '../.test-users.json');
  if (!fs.existsSync(usersPath)) {
    console.error('Run npm run seed first');
    process.exit(1);
  }
  const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
  const token = await login(users.users.student.email, users.password);

  const endpoints = [
    { name: 'Login', url: `${API_URL}/auth/login`, method: 'POST', body: JSON.stringify({ email: users.users.student.email, password: users.password }), auth: false },
    { name: 'Dashboard', url: `${API_URL}/analytics/dashboard`, auth: true },
    { name: 'Notifications', url: `${API_URL}/notifications`, auth: true },
    { name: 'Opportunities', url: `${API_URL}/opportunities/matching`, auth: true },
    { name: 'Scholarships', url: `${API_URL}/scholarships/matching?annualIncome=300000`, auth: true },
  ];

  const report = [];

  for (const level of CONCURRENCY_LEVELS) {
    console.log(`\n=== Load test: ${level} concurrent users ===\n`);
    for (const ep of endpoints) {
      const headers = { 'Content-Type': 'application/json' };
      if (ep.auth) headers.Authorization = `Bearer ${token}`;

      const result = await runLoad({
        name: ep.name,
        url: ep.url,
        connections: level,
        headers,
      });

      const r = result.result;
      report.push({
        endpoint: ep.name,
        concurrentUsers: level,
        requestsTotal: r.requests.total,
        throughputRps: Number(r.requests.average).toFixed(2),
        latencyAvgMs: Number(r.latency.average).toFixed(2),
        latencyP99Ms: Number(r.latency.p99).toFixed(2),
        errors: r.errors,
        timeouts: r.timeouts,
        non2xx: r.non2xx,
      });

      console.log(`${ep.name} @ ${level}: avg ${r.latency.average}ms, p99 ${r.latency.p99}ms, errors ${r.errors}`);
    }
  }

  const outPath = path.join(__dirname, '../load-test-results.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nResults written to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
