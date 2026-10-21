# ScholrBoard V13 Production Runbook: Cloudinary Legacy Asset Privacy Migration, CDN Invalidation & Partial Failure Recovery

## 1. Overview & Security Architecture

In ScholrBoard V13 Phase 8, all resume uploads are strictly hardened to use Cloudinary's authenticated delivery tier (`type: 'authenticated'`, `resource_type: 'raw'`), preventing unauthorized access to confidential candidate documents.

However, historical resumes uploaded prior to Phase 8 remain stored under Cloudinary's public delivery tier (`type: 'upload'`). This runbook provides the operational procedure for migrating historical assets securely using the utility script:
`server/scripts/migrateLegacyCloudinaryAssets.js`

### Supported Cloudinary API Operation
Legacy assets are migrated using Cloudinary's supported `uploader.rename()` API:
```javascript
await cloudinary.uploader.rename(publicId, publicId, {
  resource_type: asset.resourceType || 'raw', // Dynamically confirmed from actual asset metadata
  type: asset.deliveryType || 'upload',       // Source delivery tier ('upload')
  to_type: 'authenticated',                   // Target private delivery tier
  invalidate: true,                           // Requests asynchronous CDN edge cache purge
  overwrite: true,                            // In-place delivery tier update
});
```

### Application Reference Synchronization
Upon successful storage rename, all corresponding MongoDB document references are updated atomically:
- `ResumeAnalysis.fileUrl`: Updated from `.../raw/upload/...` to `.../raw/authenticated/...`
- `Profile.resumeUrl`: Updated from `.../raw/upload/...` to `.../raw/authenticated/...`

### Internal Canonical Locators vs. Signed Delivery URLs
- The database stores canonical asset URIs (e.g. `https://res.cloudinary.com/<cloud>/raw/authenticated/v12345/scholrmind/resumes/...`).
- **These database URLs are internal locators only**; the application never serves raw unsigned `/raw/authenticated/` links to the browser.
- Delivery to students, recruiters, and backend AI analysis occurs exclusively via authenticated server endpoints:
  - `GET /api/upload/resume/signed-url/:id`: Returns a time-limited signed URL (`private_download_url` with 300s expiration and HMAC signature).
  - `GET /api/upload/resume/view/:id`: Validates application ownership and streams inline PDF binary.
  - `GET /api/upload/proxy?url=...`: Validates user-tenant ownership and streams inline PDF binary.
- Cloudinary API secrets and signing credentials **never leak to the frontend**.

---

## 2. Five Distinct Migration & Privacy Verification States

Operators and auditors must distinguish these 5 operational tiers. Never conflate an initial API call with complete verification:

1. **Storage Delivery-Type Migration (`migrated`)**:
   - Cloudinary acknowledges `uploader.rename(..., { to_type: 'authenticated' })`.
   - Asset origin is immediately protected from unsigned requests.
2. **Database Reference Synchronization (`migrated` / `reconciled`)**:
   - MongoDB `ResumeAnalysis.fileUrl` and `Profile.resumeUrl` references are updated to `/raw/authenticated/`.
   - Both Cloudinary and MongoDB point to the authenticated tier.
3. **Database Reference Reconciliation (`reconciled`)**:
   - Identifies assets already authenticated in Cloudinary whose database references remained stale (e.g., from prior partial failures).
   - Reconciles MongoDB records without executing redundant Cloudinary renames.
4. **CDN Invalidation Request (`invalidationRequested`) vs. Propagation Pending (`pendingCdnVerification`)**:
   - `invalidation: true` dispatches an asynchronous purge to global CDN edge nodes (Fastly/Akamai/CloudFront).
   - Edge nodes continue serving cached copies during the propagation window (typically 5 to 30 minutes, up to 1 hour).
   - Newly migrated assets are placed in `pendingCdnVerification`.
5. **Confirmed CDN Verification (`confirmedCdnVerified`)**:
   - Active HTTP checks confirm that the legacy unsigned public URL returns HTTP 404, 401, or 403.
   - An asset is **never** declared verified until this check passes.

---

## 3. Pre-Migration Checklist & Safety Mandates

- [ ] **SAFETY MANDATE**: **NEVER USE AN EXISTING PRODUCTION RESUME AS A TEST ASSET**. Under no circumstances should operator smoke tests mutate or publicize an existing user's resume.
- [ ] Database backup: Verify that MongoDB snapshot/backup is current.
- [ ] Verify environment variables:
  - `CLOUDINARY_CLOUD_NAME`
  - `CLOUDINARY_API_KEY`
  - `CLOUDINARY_API_SECRET`
  - `MONGODB_URI`

---

## 4. Execution Step 1: Pre-Migration Inventory (DRY-RUN)

The migration script executes in **read-only DRY-RUN mode by default**. It performs no mutations on Cloudinary or MongoDB:

```bash
cd server
node scripts/migrateLegacyCloudinaryAssets.js
```

### Expected Dry-Run Output:
```text
[migration] Starting Cloudinary legacy asset privacy migration in DRY_RUN mode...
[migration] Notice: Running in read-only DRY-RUN mode. No assets or database records will be modified.
[migration] To execute real migration, rerun with explicit --apply flag.
[migration] Database inventory: found N ResumeAnalysis and M Profile records with legacy /upload/ URLs.
[migration] Total distinct asset targets identified: X
[migration] [DRY-RUN PLAN] Would migrate scholrmind/resumes/... (resource_type: raw, type: 'upload' -> 'authenticated', invalidate: true)
================================================================================
Cloudinary Asset Privacy Migration Summary (DRY_RUN)
Total Assets Scanned:             X
Eligible for Action:              X
Successfully Migrated (Storage):  0
Database References Reconciled:   0
CDN Invalidation Requested:       0
CDN Edge Purge Pending:           0
CDN Edge Purge Confirmed:         0
CDN Invalidation Failures:        0
Skipped (Already Synchronized):   0
Failed Operations:                0
================================================================================
```

---

## 5. Execution Step 2: Apply Migration (`--apply`)

Once dry-run results are approved, execute the migration with explicit mutation authorization:

```bash
cd server
node scripts/migrateLegacyCloudinaryAssets.js --apply
```

### Operational Behavior:
- Queries assets in batches (default 50) using cursor-based pagination (`next_cursor`).
- Queries each asset's metadata via `cloudinary.api.resource()` to confirm actual `resource_type` and `type`.
- If an asset is already `type: 'authenticated'` and its database references are up to date, it is safely skipped (`skipped++`).
- If an asset is already `type: 'authenticated'` but has stale database references, it executes reference reconciliation (`reconciled++`).
- Applies bounded rate limiting (100ms throttle between calls) and exponential backoff on HTTP 429.
- Dispatches `uploader.rename()` with `to_type: 'authenticated'` and `invalidate: true`.
- Updates MongoDB references atomically.
- If an asset fails, the script captures the error in `failures` and continues processing remaining assets without aborting.

### Summary Metrics Output:
```text
================================================================================
Cloudinary Asset Privacy Migration Summary (APPLY)
Total Assets Scanned:             X
Eligible for Action:              X
Successfully Migrated (Storage):  X
Database References Reconciled:   0
CDN Invalidation Requested:       X
CDN Edge Purge Pending:           X (Awaiting edge propagation window)
CDN Edge Purge Confirmed:         0 (Requires post-propagation verification)
CDN Invalidation Failures:        0
Skipped (Already Synchronized):   0
Failed Operations:                0
Duration:                         ...ms
================================================================================
```

---

## 6. Execution Step 3: Partial Failure Recovery & Reference Reconciliation

Cloudinary and MongoDB do not participate in a single atomic two-phase commit. Network interruptions or database timeouts can cause partial failures:
- **Case**: Cloudinary rename succeeds, but the subsequent MongoDB `updateMany` fails.

### Recovery Mechanism
The script is designed for safe, idempotent rerun:
1. When rerunning `node scripts/migrateLegacyCloudinaryAssets.js --apply`:
2. The script discovers the asset via its remaining legacy MongoDB reference.
3. It queries `cloudinary.api.resource(publicId)` and detects that Cloudinary is already `type: 'authenticated'`.
4. It detects that MongoDB still contains stale `/upload/` references (`hasStaleDbReferences === true`).
5. It **skips the redundant Cloudinary rename** and directly executes database reference reconciliation.
6. Upon successful DB update, the asset is recorded under `Database References Reconciled (`reconciled: 1`)`.
7. If the DB update fails again, the asset remains recorded under `failed: 1` and is **never** reported as migrated or verified.

---

## 7. Execution Step 4: Post-Propagation CDN Invalidation Verification

### Propagation Wait Period
**Wait at least 15 to 30 minutes** after migration completion to allow Cloudinary CDN edge nodes worldwide to flush their cached copies.

### Verification Procedure
1. **Automated Verification**:
   Run the migration utility with the `--verify-cdn` flag:
   ```bash
   cd server
   node scripts/migrateLegacyCloudinaryAssets.js --apply --verify-cdn
   ```
   The script performs HTTP HEAD checks on legacy URLs:
   - If the legacy URL returns HTTP 404, 401, or 403: the asset is confirmed purged (`confirmedCdnVerified++`).
   - If the legacy URL still returns HTTP 200: it remains flagged under `pendingCdnVerification`.

2. **Manual Spot-Check (Synthetic Assets Only)**:
   ```bash
   curl -I "https://res.cloudinary.com/<cloud_name>/raw/upload/v12345/scholrmind/resumes/throwaway_test_user/test.pdf"
   ```
   - **Expected Result**: `HTTP/1.1 404 Not Found` (or `401 Unauthorized`).
   - **If HTTP 200 is returned**: CDN edge propagation is still ongoing. Allow an additional 15 minutes and re-verify.

3. **Signed Access Verification**:
   Verify that authorized users can obtain signed URLs via:
   - `GET /api/upload/resume/signed-url/:analysisId` (returns signed URL with 300s expiry)
   - `GET /api/upload/resume/view/:applicationId` (streams inline PDF)

---

## 8. Troubleshooting Matrix

| Scenario | Root Cause | Remediation Procedure |
| :--- | :--- | :--- |
| **Partial Failure (Network Timeout / 429)** | Transient Cloudinary network glitch or rate throttling. | The migration script is completely **idempotent**. Simply rerun `node scripts/migrateLegacyCloudinaryAssets.js --apply`. Assets already migrated to `authenticated` are skipped without duplicate mutations. |
| **MongoDB Update Failed on Run 1** | Database network interruption after Cloudinary rename. | Run 2 detects asset is already authenticated in Cloudinary and reconciles MongoDB references (`reconciled++`) without duplicate rename. |
| **Legacy URL Returns 200 after 1 hour** | CDN edge caching issue or invalidation request delayed. | Verify asset in Cloudinary console. Run targeted explicit invalidation via Cloudinary API: `cloudinary.uploader.explicit(publicId, { type: 'upload', invalidate: true })`. |
| **Existing Asset Shows Resource Type 'image'** | Legacy PDF or image uploaded under image resource type. | The script dynamically confirms actual resource type via `api.resource()` and passes the correct `resource_type` to `uploader.rename()`. |

---

## 9. Compliance & Security Invariants

1. **Dry-Run by Default**: Never execute `--apply` without explicit operator confirmation.
2. **Never Test on Production User Resumes**: All testing must use synthetic throwaway fixtures created exclusively for testing.
3. **Honest Invalidation Reporting**: Never report an asset as `confirmedCdnVerified` until active HTTP checks confirm the legacy public URL is completely inaccessible.
4. **Zero Credential Leakage**: Signed URLs are generated strictly server-side; Cloudinary API secrets are never delivered to the client.
