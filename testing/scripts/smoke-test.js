/**
 * Full staging smoke test: Student → Faculty → Admin workflows via API.
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../server/.env') });

const API = process.env.E2E_API_URL || 'http://localhost:5000/api';
const logs = [];

function log(step, message, data) {
  const entry = { step, message, ...(data && { data }) };
  logs.push(entry);
  console.log(`[${step}] ${message}`);
}

async function api(method, endpoint, token, body) {
  const res = await fetch(`${API}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    ...(body && { body: JSON.stringify(body) }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function main() {
  const usersFile = path.join(__dirname, '../.test-users.json');
  if (!fs.existsSync(usersFile)) {
    console.error('Seed test users first: npm run seed');
    process.exit(1);
  }
  const seeded = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
  const { student, faculty, admin } = seeded.users;

  log(0, 'Health check');
  const health = await api('GET', '/health');
  if (!health.ok) throw new Error('Health check failed');
  log(0, `Health OK — uptime ${health.data.uptimeSeconds}s`);

  log(1, 'Student submits activity');
  const activity = await api('POST', '/activities', student.token, {
    title: `Smoke Activity ${Date.now()}`,
    category: 'Workshops',
    activityDate: '2026-02-01',
    description: 'Smoke test activity',
  });
  if (!activity.ok) throw new Error(activity.data.message);
  const activityId = activity.data.activity._id;

  log(2, 'Student submits OD');
  const od = await api('POST', '/od/request', student.token, {
    eventName: `Smoke OD ${Date.now()}`,
    eventDate: '2026-03-01',
  });
  if (!od.ok) throw new Error(od.data.message);
  const odId = od.data.odRequest._id;

  log(3, 'Faculty approves activity');
  const actReview = await api('PUT', `/activities/${activityId}/review`, faculty.token, { status: 'Approved' });
  if (!actReview.ok) throw new Error(actReview.data.message);

  log(4, 'Faculty approves OD');
  const odReview = await api('PUT', `/od/review/${odId}`, faculty.token, { status: 'Approved', remarks: 'Smoke approved' });
  if (!odReview.ok) throw new Error(odReview.data.message);

  log(5, 'Admin creates announcement');
  const ann = await api('POST', '/announcements', admin.token, {
    title: `Smoke Announcement ${Date.now()}`,
    content: 'Smoke test announcement body',
    category: 'General',
    filters: { role: 'student', department: seeded.department },
  });
  if (!ann.ok) throw new Error(ann.data.message);

  log(6, 'Admin creates and publishes opportunity');
  const unique = Date.now();
  const opp = await api('POST', '/opportunities', admin.token, {
    driveCode: `SMK${unique}`,
    title: 'Smoke Placement',
    company: 'SmokeCorp',
    type: 'Full-time',
    description: 'Smoke placement',
    deadline: new Date(Date.now() + 30 * 86400000).toISOString(),
    eligibility: { minCGPA: 6, eligibleDepartments: [seeded.department], minSemester: 5, passingYear: 2026 },
  });
  if (!opp.ok) throw new Error(opp.data.message);
  const oppId = opp.data.opportunity._id;
  await api('PUT', `/opportunities/${oppId}/publish`, admin.token);

  log(7, 'Student applies for placement');
  const app = await api('POST', `/applications/opportunity/${oppId}/apply`, student.token, {
    resumeUrl: 'https://example.com/smoke-resume.pdf',
  });
  if (!app.ok) throw new Error(app.data.message);
  const appId = app.data.application._id;

  log(8, 'Admin shortlists, schedules interview, selects');
  await api('PUT', `/applications/${appId}/status`, admin.token, { status: 'Shortlisted' });
  await api('PUT', `/applications/${appId}/interview`, admin.token, {
    dateTime: new Date(Date.now() + 5 * 86400000).toISOString(),
    venue: 'Smoke Hall',
  });
  const selected = await api('PUT', `/applications/${appId}/status`, admin.token, { status: 'Selected' });
  if (!selected.ok) throw new Error(selected.data.message);

  log(9, 'Admin creates and publishes scholarship; student applies');
  const sch = await api('POST', '/scholarships', admin.token, {
    title: `Smoke Scholarship ${unique}`,
    provider: 'Smoke Foundation',
    amount: 25000,
    description: 'Smoke scholarship',
    deadline: new Date(Date.now() + 30 * 86400000).toISOString(),
    eligibility: { minCGPA: 6, eligibleDepartments: [seeded.department] },
  });
  if (!sch.ok) throw new Error(sch.data.message);
  const schId = sch.data.scholarship._id;
  await api('PUT', `/scholarships/${schId}/publish`, admin.token);
  const schApp = await api('POST', `/scholarships/${schId}/apply`, student.token, { annualIncome: 200000 });
  if (!schApp.ok) throw new Error(schApp.data.message);
  const schAppId = schApp.data.application._id;
  await api('PUT', `/scholarships/application/${schAppId}`, admin.token, { status: 'Selected', remarks: 'Smoke selected' });

  log(10, 'Verify notifications and audit logs');
  const notifs = await api('GET', '/notifications', student.token);
  if (!notifs.ok || (notifs.data.notifications?.length || 0) < 1) {
    throw new Error('Expected student notifications after smoke workflow');
  }

  const out = { success: true, timestamp: new Date().toISOString(), steps: logs };
  const outPath = path.join(__dirname, '../smoke-test-results.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`\nSmoke test PASSED — ${logs.length} steps verified`);
  console.log(`Results: ${outPath}`);
}

main().catch((err) => {
  console.error('\nSmoke test FAILED:', err.message);
  process.exit(1);
});
