# ScholrBoard Phase 3.6 Security Re-Audit

Audit date: June 9, 2026  
Previous score: **38/100 - NOT READY**  
Updated score: **88/100 - MOSTLY READY**  
Critical findings remaining: **0**

## Executive Result

All requested Critical and High severity findings were remediated and passed the dedicated real-HTTP security re-audit: **17/17 checks passed**.

Phase 4 remains blocked until the deployment checklist is completed and a production-like staging smoke test is approved. The score is not marked READY because transaction integrity, full authenticated browser E2E coverage, production monitoring, backup restore proof, and load testing remain outstanding.

## Fix 1 - Public Admin And Faculty Registration

**Root cause:** The public registration controller trusted the caller-provided `role` and treated `admin` as a valid public role.

**Security impact:** Any unauthenticated caller could obtain an Admin JWT and take over the platform.

**Implementation:**

- Public `POST /api/auth/register` now accepts Student accounts only and returns `403` for Faculty/Admin roles.
- Added Admin-only `POST /api/users/faculty` for Faculty provisioning.
- No public Admin creation endpoint exists.

**Migration impact:** Existing accounts are unchanged. Faculty onboarding must now be performed by an authenticated Admin. Existing frontend Faculty/Admin signup attempts receive a controlled authorization error.

**Modified files:** `server/controllers/authController.js`, `server/routes/users.js`

**Code change:**

```js
if (role !== 'student') {
  return res.status(403).json({
    success: false,
    message: 'Public registration is available for student accounts only',
  });
}
```

**Evidence:** Public Admin registration `403`; public Faculty registration `403`; Admin-only Faculty creation `201`.

## Fix 2 - Public Audit Endpoint Removal

**Root cause:** The main server mounted a database-mutating test route without authentication.

**Security impact:** Unauthenticated callers could create/delete records, pollute audit data, consume resources, and receive a misleading hardcoded readiness result.

**Implementation:** Removed the test-audit import and `/api/test-audit` route registration from the main server.

**Modified file:** `server/server.js`

**Evidence:** Unauthenticated `GET /api/test-audit/run` returns `404`.

## Fix 3 - JWT Authorization Revalidation

**Root cause:** Authentication trusted role and active-state claims embedded in a long-lived JWT.

**Security impact:** Deactivated users and users with stale roles retained authorization until token expiry.

**Implementation:** Every authenticated request now loads the current User record, verifies existence and `isActive`, and attaches the current database user/role to `req.user`.

**Modified file:** `server/middleware/auth.js`

**Evidence:** Existing token used after account deactivation returns `401`.

## Fix 4 - Faculty Analytics Restriction

**Root cause:** System and placement analytics routes allowed both Admin and Faculty roles.

**Security impact:** Faculty could access placement reports and broad readiness/system analytics contrary to policy.

**Implementation:**

- `/api/analytics/system` and `/api/analytics/placements` are Admin-only.
- Faculty dashboard now uses permitted assigned-student and assigned-activity APIs.

**Modified files:** `server/routes/analytics.js`, `client/src/pages/FacultyDashboard.jsx`

**Evidence:** Faculty placement analytics request returns `403`.

## Fix 5 - Activity Review Ownership

**Root cause:** Activity review authorized either assigned advisors or any Faculty member in the student's department.

**Security impact:** Faculty could approve or reject submissions outside their assigned advisees.

**Implementation:** Faculty queues and review actions now require `student.advisorId === req.user._id`. The department-wide scope was removed from the OD Faculty UI.

**Modified files:** `server/controllers/activityController.js`, `client/src/pages/FacultyOdApprovals.jsx`

**Evidence:** Assigned activity review returns `200`; unassigned activity review returns `403`.

## Fix 6 - Invalid ObjectId Handling

**Root cause:** Controllers passed malformed route parameters into Mongoose, producing CastErrors and `500` responses.

**Security impact:** Uncontrolled server errors exposed unstable behavior and created noisy denial-of-service/error paths.

**Implementation:** Added reusable `validateObjectId` middleware returning `400` before controllers execute.

**Modified files:**

- `server/middleware/validateObjectId.js`
- `server/routes/activities.js`
- `server/routes/applications.js`
- `server/routes/announcements.js`
- `server/routes/ai.js`
- `server/routes/events.js`
- `server/routes/notifications.js`
- `server/routes/od.js`
- `server/routes/opportunities.js`
- `server/routes/placements.js`
- `server/routes/profile.js`
- `server/routes/scholarships.js`
- `server/routes/upload.js`
- `server/routes/users.js`

**Updated route parameters:** activity IDs, application IDs, opportunity IDs, announcement IDs, chat IDs, event IDs, notification IDs, OD IDs, placement IDs, profile/certification IDs, scholarship/application IDs, resume-analysis IDs, and Admin user-update/delete IDs.

**Evidence:** Authenticated malformed opportunity ID returns `400`, not `500`.

## Fix 7 - Placement State Transition Validation

**Root cause:** Admin review actions validated only the target status, not the current-to-target transition.

**Security impact:** Applications could skip required review stages and undermine workflow/audit integrity.

**Implementation:**

- `Applied -> Shortlisted`
- `Shortlisted -> Interviewed`
- `Interviewed -> Selected | Rejected`
- `Applied | Shortlisted | Interviewed -> Withdrawn`
- All other transitions return `400`.

**Modified file:** `server/controllers/applicationController.js`

**Evidence:** `Applied -> Selected` returns `400`; legal shortlist, interview, select, reject, and all three withdrawal transitions return `200`.

## Fix 8 - Landing Page Rendering Failure

**Root cause:** Scroll-animation hooks set content opacity to zero before IntersectionObserver confirmation and had no fail-open behavior when observer events were delayed or absent.

**Impact:** Desktop and mobile landing pages could show only the header with blank content.

**Implementation:**

- Added reduced-motion and missing-observer handling.
- Added guaranteed reveal fallbacks.
- Added landing-page overflow/min-width hardening and responsive metric cards.

**Modified files:** `client/src/hooks/useScrollAnimation.js`, `client/src/pages/LandingPage.jsx`

**Evidence:**

- Before: `audit-evidence/landing-desktop.png`, `audit-evidence/landing-mobile.png`
- After: `audit-evidence/landing-desktop-after.png`, `audit-evidence/landing-mobile-after-500.png`

## Fix 9 - Error Handling

**Root cause:** Several UI actions used `alert()` or empty catches, hiding failures from durable page state.

**Impact:** Users received inconsistent feedback or no feedback after failed operations.

**Implementation:** Replaced identified alerts and swallowed catches with existing inline error-state patterns.

**Affected files:** `client/src/components/Topbar.jsx`, `client/src/pages/ActivitiesPage.jsx`, `client/src/pages/AdminAnnouncements.jsx`, `client/src/pages/AdminPlacementDashboard.jsx`, `client/src/pages/DashboardPage.jsx`, `client/src/pages/FacultyApprovals.jsx`, `client/src/pages/FacultyDashboard.jsx`, `client/src/pages/FacultyOdApprovals.jsx`, `client/src/pages/StudentPlacementDashboard.jsx`

**Evidence:** Repository search finds no `alert()` calls or empty `.catch(() => {})` handlers in `client/src`.

## Fix 10 - React Warnings

**Root cause:** Effects depended on functions or user fields not represented safely in dependency arrays.

**Implementation:** Stabilized fetch functions with `useCallback` and corrected dependencies.

**Modified files:** `client/src/contexts/ProfileContext.jsx`, `client/src/pages/AdminAnnouncements.jsx`, `client/src/pages/FacultyOdApprovals.jsx`, `client/src/pages/StudentPlacementDashboard.jsx`

**Evidence:** `npm run lint` completes with zero errors and zero warnings.

## Fix 11 - Audit Log Protection

**Root cause:** The public test route could delete AuditLog records during cleanup.

**Implementation:** Removed the public test route from application routing. No production API exposes AuditLog deletion.

**Evidence:** `/api/test-audit/run` returns `404`; no audit deletion route is mounted.

## Fix 12 - Deployment Checklist

Created `deployment_checklist.md` covering environment variables, MongoDB, builds, security, backups, recovery, monitoring, and post-deployment verification.

## Test Results

| Test | Result |
| --- | --- |
| Phase 3.6 real HTTP security re-audit | PASS, 17/17 |
| Existing placement/scholarship regression audit | PASS |
| Frontend lint | PASS, zero warnings |
| Frontend production build | PASS |
| Backend syntax checks | PASS |
| Temporary audit account cleanup | PASS, zero remaining |
| Landing desktop after screenshot | PASS |
| Landing mobile after screenshot | PASS |

## Remaining Non-Blocking Risks

- Multi-document workflow writes are not transactionally atomic.
- Full authenticated browser E2E automation is not yet part of CI.
- Load testing and production query profiling remain outstanding.
- Production backup restore, monitoring, alerting, and incident response require operational proof.
- JWTs remain in browser localStorage, so XSS prevention remains important.

## Final Classification

**88/100 - MOSTLY READY**

No Critical findings remain. Production deployment should occur only after staging smoke tests and every required item in `deployment_checklist.md` is approved.
