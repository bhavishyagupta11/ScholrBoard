# ScholrBoard Deployment Guide

Step-by-step guide for deploying ScholrBoard to staging and production.

---

## Architecture Overview

| Component | Recommended Host | Notes |
|-----------|------------------|-------|
| React frontend | Vercel | Static SPA with `vite build` |
| Express API | Render or Railway | Node 20+, `npm start` |
| MongoDB | MongoDB Atlas | M10+ for production; replica set required for transactions |
| File uploads | Local disk (Render/Railway volume) or Cloudinary | Configure `CLOUDINARY_*` for cloud storage |

---

## Prerequisites

- Node.js 20+
- MongoDB Atlas cluster (replica set enabled)
- Domain names for frontend and API
- Secrets manager or platform env var UI

---

## 1. MongoDB Atlas Setup

1. Create a cluster (M0 acceptable for staging; M10+ for production).
2. Create a database user with `readWrite` on the `scholrboard` database.
3. Network Access: allow `0.0.0.0/0` for cloud hosts, or restrict to Render/Railway egress IPs.
4. Copy the connection string:
   ```
   mongodb+srv://<user>:<password>@cluster.mongodb.net/scholrboard?retryWrites=true&w=majority
   ```
5. Enable automated backups (Cloud Backup) before production launch.
6. On first deploy, indexes sync automatically via `connectDB()` → `syncIndexes()`.

---

## 2. Backend Deployment (Render / Railway)

### Environment Variables

| Variable | Required | Example |
|----------|----------|---------|
| `NODE_ENV` | Yes | `production` |
| `PORT` | Auto-set by host | `5000` |
| `MONGODB_URI` | Yes | Atlas connection string |
| `JWT_SECRET` | Yes | 64+ char random string |
| `JWT_EXPIRES_IN` | No | `7d` |
| `CLIENT_ORIGIN` | Yes | `https://app.scholrboard.edu` |
| `PUBLIC_API_URL` | Yes | `https://api.scholrboard.edu/api` |
| `CLOUDINARY_CLOUD_NAME` | If using Cloudinary | — |
| `CLOUDINARY_API_KEY` | If using Cloudinary | — |
| `CLOUDINARY_API_SECRET` | If using Cloudinary | — |
| `GEMINI_API_KEY` | Only if AI routes enabled | — |

### Render

1. New **Web Service** → connect GitHub repo.
2. Root directory: `server`
3. Build command: `npm install`
4. Start command: `npm start`
5. Add all environment variables above.
6. Health check path: `/api/health`

### Railway

1. New project → deploy from GitHub.
2. Set root to `server/`.
3. Start command: `node server.js`
4. Add environment variables.
5. Configure custom domain + HTTPS.

### Verify

```bash
curl https://api.scholrboard.edu/api/health
```

Expected response:
```json
{
  "success": true,
  "status": "ok",
  "database": { "connected": true, "state": "connected", "pingMs": 12 },
  "uptimeSeconds": 120,
  "environment": "production"
}
```

---

## 3. Frontend Deployment (Vercel)

1. Import GitHub repo → set root directory to `client`.
2. Framework preset: **Vite**.
3. Build command: `npm run build`
4. Output directory: `dist`
5. Environment variables:

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://api.scholrboard.edu/api` |

6. Deploy. Vercel handles SPA routing via `vercel.json` rewrite (create if needed):

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

---

## 4. Secrets Setup

- Generate `JWT_SECRET`: `openssl rand -base64 48`
- Store in platform secrets manager — never commit to git.
- Rotate secrets if ever exposed.
- Do not log request bodies containing passwords (handled by `requestLogger` middleware).

---

## 5. Post-Deploy Smoke Test

From the `testing/` directory on a machine with network access to staging:

```bash
cd testing
npm install
E2E_API_URL=https://api.staging.scholrboard.edu/api npm run seed
E2E_API_URL=https://api.staging.scholrboard.edu/api npm run test:smoke
```

Or run the full Playwright suite against staging:

```bash
E2E_BASE_URL=https://app.staging.scholrboard.edu \
E2E_API_URL=https://api.staging.scholrboard.edu/api \
npm run test:e2e
```

---

## 6. Rollback Instructions

### Backend (Render / Railway)

1. Open the service dashboard → **Deployments**.
2. Select the last known-good deployment.
3. Click **Rollback** / **Redeploy**.
4. Verify `/api/health` returns `200`.

### Frontend (Vercel)

1. Project → **Deployments** → find previous deployment.
2. Click **⋯** → **Promote to Production**.
3. Verify login and dashboard load.

### Database

1. Atlas → **Backup** → select snapshot before failed deploy.
2. Restore to a new cluster or point-in-time.
3. Update `MONGODB_URI` if cluster endpoint changes.
4. Re-run smoke test.

---

## 7. Monitoring Checklist

- [ ] `/api/health` monitored every 60s (UptimeRobot, Better Stack, etc.)
- [ ] Alert on `5xx` rate > 1% for 5 minutes
- [ ] Alert on health check `503`
- [ ] MongoDB Atlas alerts: connections, disk, replication lag
- [ ] Centralized logs (Render/Railway log drains) — no secrets in logs

---

## 8. Local Production Build Verification

```bash
# Backend
cd server && npm install && NODE_ENV=production npm start

# Frontend
cd client && npm install && npm run build && npm run preview
```

---

## 9. Known Constraints

- **MongoDB transactions** require a replica set. Standalone local MongoDB will fail transactional writes; use Atlas or `mongod --replSet rs0` for local transaction testing.
- **`/api/test-audit/*`** is not mounted in production `server.js` — do not enable in production.
- Rate limits: 300 req/15min general, 20 req/15min auth — adjust via env if needed.
