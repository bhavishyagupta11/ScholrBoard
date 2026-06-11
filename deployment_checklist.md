# ScholrBoard Production Deployment Checklist

## Release Gate

- [ ] Security re-audit passes with no Critical or High findings.
- [ ] `npm run lint` completes with zero errors and zero warnings.
- [ ] `npm run build` completes successfully.
- [ ] Phase 3 workflow regression audit passes.
- [ ] A release owner approves the deployment.

## Environment Variables

- [ ] Set `NODE_ENV=production`.
- [ ] Set a strong, unique `JWT_SECRET` and store it in a secrets manager.
- [ ] Set `JWT_EXPIRES_IN` according to the session policy.
- [ ] Set the production `MONGODB_URI`.
- [ ] Set `CLIENT_ORIGIN` to the exact production frontend origins.
- [ ] Set `PUBLIC_API_URL` to the public HTTPS API URL.
- [ ] Set Cloudinary credentials if production uploads use Cloudinary.
- [ ] Set `GEMINI_API_KEY` only if approved AI routes are enabled.
- [ ] Set frontend `VITE_API_URL` to the production HTTPS API URL.
- [ ] Confirm no `.env`, service-account, or secret files are committed or included in build artifacts.

## MongoDB Setup

- [ ] Use a dedicated production database and least-privilege application user.
- [ ] Restrict network access to approved application hosts.
- [ ] Confirm TLS is required.
- [ ] Verify unique indexes for users, profiles, applications, and scholarship applications.
- [ ] Verify query indexes for activities, notifications, OD requests, opportunities, and scholarships.
- [ ] Confirm automated backups are enabled before deployment.
- [ ] Run a restore test in a non-production environment.

## Security Settings

- [ ] Confirm public registration creates Student accounts only.
- [ ] Confirm Faculty provisioning requires an Admin token.
- [ ] Confirm no public `/api/test-audit/*` route exists.
- [ ] Confirm deactivated users receive `401` on existing tokens.
- [ ] Confirm Faculty receives `403` for system and placement analytics.
- [ ] Confirm Faculty can review assigned advisees only.
- [ ] Confirm malformed ObjectId parameters return `400`.
- [ ] Confirm legal placement state transitions are enforced.
- [ ] Confirm HTTPS termination and HSTS behavior.
- [ ] Confirm CORS allows only production origins.
- [ ] Confirm rate limits match expected production traffic.
- [ ] Rotate any secrets that were ever shared outside the production secrets manager.

## Production Build And Deployment

- [ ] Install dependencies from lockfiles with a clean environment.
- [ ] Build the frontend with `npm run build`.
- [ ] Start the backend with `NODE_ENV=production`.
- [ ] Serve frontend static assets through the approved CDN/web server.
- [ ] Configure SPA fallback routing to `index.html`.
- [ ] Verify `/api/health` through the production load balancer.
- [ ] Verify student, faculty, and admin login through production URLs.
- [ ] Run smoke tests for OD, activity approval, placements, scholarships, announcements, and notifications.

## Backup Strategy

- [ ] Enable daily automated MongoDB snapshots.
- [ ] Define retention periods for daily, weekly, and monthly backups.
- [ ] Store backups in a separate account/region from the primary database.
- [ ] Encrypt backups at rest and in transit.
- [ ] Restrict backup access and audit all restore operations.

## Recovery Plan

- [ ] Document the recovery-time objective and recovery-point objective.
- [ ] Document database restore steps and responsible owners.
- [ ] Document rollback steps for backend and frontend releases.
- [ ] Keep the previous known-good application artifact available.
- [ ] Test restore and rollback procedures before launch.
- [ ] Define the incident communication and escalation process.

## Monitoring Plan

- [ ] Monitor API availability, latency, and `5xx` rates.
- [ ] Alert on repeated `401`, `403`, and rate-limit events.
- [ ] Alert on registration spikes and admin/faculty provisioning.
- [ ] Monitor MongoDB connections, slow queries, storage, and replication health.
- [ ] Monitor upload failures and external provider failures.
- [ ] Centralize structured application logs without secrets or passwords.
- [ ] Track deployment version and environment in monitoring events.
- [ ] Define on-call ownership and alert response targets.

## Post-Deployment Verification

- [ ] Confirm public admin and faculty registration return `403`.
- [ ] Confirm `/api/test-audit/run` returns `404`.
- [ ] Confirm a deactivated account token returns `401`.
- [ ] Confirm Faculty placement analytics returns `403`.
- [ ] Confirm invalid IDs return `400`, not `500`.
- [ ] Confirm desktop, tablet, and mobile landing/login pages render.
- [ ] Confirm audit logs are retained and no test route can delete them.

