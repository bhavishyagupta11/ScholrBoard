# ScholrBoard Phase 3.5 Production Readiness Audit

Audit date: June 9, 2026  
Decision: **NOT READY**  
Readiness score: **38/100**

## Executive Release Decision

Reject the production release.

Core OD, announcement, placement, scholarship, notification, and audit-log workflows have working paths. However, the current server allows any unauthenticated caller to create an admin account. It also exposes an unauthenticated database-mutating audit endpoint, continues accepting tokens from deactivated users, and returns uncontrolled `500` responses for malformed authenticated IDs.

The server's own public audit endpoint reports `95 / READY FOR DEPLOYMENT`; that result is not trustworthy because the endpoint directly mutates models, bypasses real UI workflows, manually forces invalid state transitions, and hardcodes the score.

## Evidence Artifacts

- `audit-evidence/landing-desktop.png`
- `audit-evidence/landing-mobile.png`
- `audit-evidence/login-tablet.png`
- Real HTTP requests against `http://localhost:5000/api`
- Real writes, reads, index inspection, and cleanup against the configured MongoDB database
- Frontend production build and lint execution

## Critical Findings

### CRITICAL: Public admin and faculty self-registration

`POST /api/auth/register` is public and accepts the requested role. Supplying `role: "admin"` requires no invite, approval, or existing-admin authorization.

Real HTTP proof:

| Step | Result |
| --- | --- |
| Register unauthenticated user with `role=admin` | `201`, response role `admin` |
| Use returned token on `GET /api/users` | `200` |
| Deactivate test account | `200` |

Relevant code:

- `server/controllers/authController.js:86`
- `server/controllers/authController.js:101`
- `server/routes/auth.js:14`

Impact: complete platform takeover.

### CRITICAL: Unauthenticated privileged database audit endpoint

`GET /api/test-audit/run` has no authentication or role check and is mounted in the main server.

Real HTTP proof:

| Request | Result |
| --- | --- |
| Unauthenticated `GET /api/test-audit/run` | `200` |
| Runtime | approximately 8.96 seconds average |
| Returned claim | `95`, `READY FOR DEPLOYMENT` |

The route creates privileged accounts, deletes matching users, writes workflow records, directly changes statuses, and performs cleanup. It also hardcodes its readiness score.

Relevant code:

- `server/server.js:172`
- `server/routes/testAudit.js:50`
- `server/routes/testAudit.js:75`
- `server/routes/testAudit.js:405`
- `server/routes/testAudit.js:587`

Impact: unauthenticated database mutation, denial of service, audit pollution, and misleading release evidence.

### HIGH: Deactivated account tokens remain authorized

The JWT middleware verifies the signature and trusts the embedded role without loading the current user or checking `isActive`.

Real HTTP proof:

| Step | Result |
| --- | --- |
| Admin deactivates student | `200` |
| Deactivated student's existing token calls `GET /api/profile/me` | `200` |

Relevant code:

- `server/middleware/auth.js:44`
- `server/middleware/auth.js:48`

Impact: account deactivation does not revoke access for up to the configured JWT lifetime.

### HIGH: Faculty placement analytics access contradicts required policy

Real HTTP proof:

| Request | Result |
| --- | --- |
| Faculty `GET /api/analytics/placements` | `200` |

The audit requirement states faculty must not access placement analytics.

Relevant code: `server/routes/analytics.js:39`

### HIGH: Activity review authorization is broader than assignment

A faculty member can review any pending activity from a student in the same department, even when they are not the assigned advisor.

Relevant code:

- `server/controllers/activityController.js:249`
- `server/controllers/activityController.js:267`
- `server/controllers/activityController.js:269`

This differs from OD review, which correctly enforces assigned-advisor ownership.

## Working Features

Verified with real HTTP APIs and configured MongoDB:

- Authentication issues working JWTs for valid accounts.
- Missing token and invalid JWT return `401`.
- Student cannot create opportunities or scholarships: `403`.
- Student cannot approve activities: `403`.
- Faculty cannot create opportunities: `403`.
- Admin advisor assignment works.
- OD workflow works: `Pending -> Needs Revision -> Pending -> Approved`.
- Non-assigned faculty OD review is blocked: `403`.
- OD approval sets `attendanceExemptionGranted=true`.
- OD revision and approval write audit logs and notifications.
- Notification unread count, mark-read, and mark-all-read work.
- Targeted announcements reached CSE Year 3 and excluded CSE Year 4 / ECE Year 3.
- Placement eligibility, publish, matching notification, apply, withdraw, shortlist, interview, select, analytics, snapshots, and duplicate prevention passed.
- Scholarship eligibility, publish, apply, selection, snapshots, notifications, and audit logs passed.
- Actual MongoDB unique indexes exist for user identifiers, profiles, placement applications, and scholarship applications.
- Production frontend build passed.
- Unknown API route returns `404`.

## Broken Features And Behavior

- Public users can create admin and faculty accounts.
- Public `/api/test-audit/run` mutates production data.
- Deactivated tokens remain usable.
- Authenticated malformed opportunity ID returns `500`, not controlled `400/404`.
- Landing page is visually blank below the header in desktop and mobile Chrome screenshots.
- Faculty can access placement analytics despite the stated role policy.
- Faculty activity approval is department-wide rather than assigned-student-only.
- Placement state changes are not constrained by a transition graph; admins can move non-withdrawn applications directly among allowed target statuses.
- The tested "apply again" path is not supported by the unique application index; an audit script manually changes a withdrawn application's status instead of exercising a real re-apply request.

## Missing Or Incomplete Coverage

- No automated frontend unit, integration, or browser E2E test scripts exist in `package.json`.
- No verified authenticated browser screenshots for student/faculty/admin workflows.
- No real network-failure UI test.
- No full certificate upload/revision browser workflow was executed.
- Internship proof is not represented as a distinct audited workflow.
- Scholarship `Reviewed` state was not exercised by the supplied workflow audit.
- Placement final rejection and scholarship rejection were not exercised end-to-end in the supplied audit scripts.
- No notification evidence was found for every requested event variant through browser UI.
- No load, concurrency, or race-condition test was present.

## UI Problems

- Desktop and mobile landing screenshots show the header but no visible hero/content.
- Tablet login modal renders and is usable.
- Several UI actions swallow API failures, including dashboard placement/event actions, leaving users without feedback.
- Many flows use blocking `alert()` calls rather than consistent in-app error handling.
- Four React hook dependency warnings can cause stale data or inconsistent refresh behavior.
- The mobile student navigation has a horizontal overflow strategy, but authenticated mobile workflows were not browser-verified.

## Security Risks

- Critical unauthenticated privilege escalation through registration.
- Critical unauthenticated database-mutating audit route.
- No immediate token revocation on account deactivation or role change.
- JWT stored in `localStorage`, increasing token theft impact if any XSS is introduced.
- Development error responses expose stack traces; production safety depends entirely on correct `NODE_ENV`.
- MIME/extension checks exist for uploads, but no malware scanning or content validation beyond claimed MIME was verified.
- Public audit route can consume database and CPU repeatedly despite general rate limiting.

## Performance Risks

- Health endpoint timings: `152 ms`, `5 ms`, `4 ms` (warm average `53.7 ms` including first request).
- Public audit endpoint average: approximately `8,963.7 ms`; it performs many sequential database operations and is callable by anyone.
- Placement analytics aggregates across collections and returned real database-wide counts; no load test was performed.
- Charts bundle is approximately `331 kB` before gzip and AI chat is approximately `125 kB`; route lazy loading helps.
- No query profiling, explain plans, production dataset benchmark, or N+1 instrumentation exists.

## Database Risks

- Unique indexes correctly prevent duplicate opportunity and scholarship applications.
- Referential integrity relies on application code; MongoDB references have no cascade or foreign-key enforcement.
- Audit logs can be deleted by the public audit route and therefore are not immutable.
- User soft deletion leaves related records and active JWTs.
- The audit endpoint directly deletes records and can undermine compliance history.
- No transaction boundaries protect multi-document workflow updates, audit logs, notifications, and point recalculation from partial failure.

## Technical Debt

- Duplicate/legacy route structures exist (`client/src/routes/AppRoutes.jsx` and active routes in `client/src/App.jsx`).
- Existing audit scripts mix real HTTP tests with direct controller/model calls and manual state manipulation.
- Audit scripts hardcode test passwords and one production-mounted route hardcodes a readiness result.
- Frontend lint reports four hook dependency warnings.
- Browser compatibility metadata is stale.
- Client includes `firebase-admin`, a server-side package, despite native JWT auth.

## Deployment Risks

- Release would expose immediate admin takeover.
- A production-mounted test route can mutate and delete live records.
- Deactivated accounts remain active until token expiry.
- Landing page can appear blank to users.
- There is no CI-enforced test suite or release gate.
- Production environment correctness, backups, restore procedure, monitoring, alerting, and secret rotation were not demonstrated.

## Verification Summary

| Check | Result |
| --- | --- |
| Frontend production build | PASS |
| Frontend lint | PASS with 4 warnings |
| API health | PASS |
| OD workflow | PASS |
| Notifications | PASS for tested OD cases |
| Announcement filtering | PASS |
| Placement workflow | PASS with re-apply caveat |
| Scholarship workflow | PASS for selection path |
| Role blocks | PARTIAL; faculty analytics policy fails |
| Invalid IDs | FAIL; authenticated invalid ID returned `500` |
| Deactivated token | FAIL; retained access |
| Public privilege escalation | FAIL; admin registration succeeded |
| Public audit route | FAIL; unauthenticated privileged execution succeeded |
| Desktop/mobile landing render | FAIL in captured Chrome screenshots |

## Final Classification

**38/100 - NOT READY**

Phase 4 should not start and production deployment should not proceed until the critical and high findings are remediated and the complete role-based browser workflows are rerun.
