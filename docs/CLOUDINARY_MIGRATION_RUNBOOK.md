# ScholrBoard V13 Production Runbook: Cloudinary Legacy Asset Privacy Migration & CDN Invalidation

## 1. Overview & Migration Architecture

In ScholrBoard V13 Phase 8, all resume uploads are strictly hardened to use Cloudinary's authenticated delivery tier (`type: 'authenticated'`, `resource_type: 'raw'`), preventing unauthorized access to confidential candidate documents.

However, historical resumes uploaded prior to Phase 8 remain stored under Cloudinary's public delivery tier (`type: 'upload'`). This runbook provides the operational procedure for migrating historical assets securely using the utility script:
`server/scripts/migrateLegacyCloudinaryAssets.js`

### Supported Cloudinary API Operation
Legacy assets are migrated using Cloudinary's supported `uploader.rename()` API:
```javascript
await cloudinary.uploader.rename(publicId, publicId, {
  resource_type: asset.resourceType || 'raw',
  type: asset.deliveryType || 'upload',
  to_type: 'authenticated',
  invalidate: true,  // Requests CDN edge cache purge
  overwrite: true,
});
```

### Application Reference Synchronization
Upon successful storage rename, all corresponding MongoDB document references are updated atomically:
- `ResumeAnalysis.fileUrl`: Updated from `.../upload/...` to `.../authenticated/...`
- `Profile.resumeUrl`: Updated from `.../upload/...` to `.../authenticated/...`

---

## 2. Storage Migration vs. Asynchronous CDN Cache Invalidation

A critical distinction must be maintained between **storage migration** and **CDN edge cache purge**:

1. **Storage-Tier Migration (Immediate)**:
   - When Cloudinary returns HTTP 200 for `uploader.rename(..., { to_type: 'authenticated' })`, the asset is immediately moved into authenticated storage in Cloudinary.
   - Cloudinary will reject any new unsigned requests that hit the origin server.
   - The asset is recorded in migration metrics as `migrated` and `invalidationRequested`.

2. **CDN Cache Invalidation (Asynchronous Propagation)**:
   - Specifying `invalidate: true` instructs Cloudinary to dispatch cache invalidation requests across its global Content Delivery Network (CDN edge servers).
   - **CDN invalidation does NOT take effect instantaneously**. CDN edge caches may continue to serve cached copies of the old unsigned public URL until edge nodes receive the purge command and edge TTL expires (typically 5 to 30 minutes, up to 1 hour depending on global CDN edge distribution).
   - Therefore, the migration utility records newly migrated assets under `pendingCdnVerification`.
   - **Operators must NOT claim that legacy URLs are immediately inaccessible upon script completion**.

---

## 3. Pre-Migration Checklist & Safety Requirements

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
Eligible for Update:              X
Successfully Migrated (Storage):  0
CDN Invalidation Requested:       0
CDN Edge Purge Pending:           0
CDN Edge Purge Confirmed:         0
CDN Invalidation Failures:        0
Skipped (Already Protected):      0
Failed Migrations:                0
================================================================================
```

Review the dry-run summary. Confirm that the total assets scanned and eligible match anticipated production volume.

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
- If an asset is already `type: 'authenticated'`, it is safely skipped (`skipped++`).
- Applies bounded rate limiting (100ms throttle between calls) and exponential backoff on HTTP 429.
- Dispatches `uploader.rename()` with `to_type: 'authenticated'` and `invalidate: true`.
- Updates MongoDB references atomically.
- If an asset fails, the script captures the error in `failures` and continues processing remaining assets without aborting.

### Summary Metrics Output:
```text
================================================================================
Cloudinary Asset Privacy Migration Summary (APPLY)
Total Assets Scanned:             X
Eligible for Update:              X
Successfully Migrated (Storage):  X
CDN Invalidation Requested:       X
CDN Edge Purge Pending:           X (Awaiting edge propagation window)
CDN Edge Purge Confirmed:         0 (Requires post-propagation verification)
CDN Invalidation Failures:        0
Skipped (Already Protected):      0
Failed Migrations:                0
Duration:                         ...ms
================================================================================
```

---

## 6. Execution Step 3: Post-Propagation CDN Invalidation Verification

### Propagation Wait Period
**Wait at least 15 to 30 minutes** after migration completion to allow Cloudinary CDN edge nodes worldwide to flush their cached copies.

### Verification Procedure
Operators can verify that old unsigned public delivery URLs are no longer accessible:

1. **Automated Verification**:
   Run the migration utility with the `--verify-cdn` flag:
   ```bash
   cd server
   node scripts/migrateLegacyCloudinaryAssets.js --apply --verify-cdn
   ```
   The script performs HTTP HEAD checks on legacy URLs. For each asset:
   - If the legacy URL returns HTTP 404, 401, or 403: the asset is confirmed purged (`confirmedCdnVerified++`).
   - If the legacy URL still returns HTTP 200: it remains flagged under `pendingCdnVerification`.

2. **Manual Spot-Check (Synthetic Assets Only)**:
   If manually spot-checking, inspect the old public URL of a throwaway test asset:
   ```bash
   curl -I "https://res.cloudinary.com/<cloud_name>/raw/upload/v12345/scholrmind/resumes/throwaway_test_user/test.pdf"
   ```
   - **Expected Result**: `HTTP/1.1 404 Not Found` (or `401 Unauthorized`).
   - **If HTTP 200 is returned**: CDN edge propagation is still ongoing. Allow an additional 15 minutes and re-verify.

3. **Signed Download Verification**:
   Verify that authorized users can access the migrated resume via ScholrBoard application endpoints:
   - `GET /api/resumes/view-url/:analysisId` returns a signed private download URL (`/raw/authenticated/...`) that expires in 300 seconds.

---

## 7. Troubleshooting & Recovery Runbook

| Scenario | Root Cause | Remediation Procedure |
| :--- | :--- | :--- |
| **Partial Failure (Network Timeout / 429)** | Transient Cloudinary network glitch or rate throttling. | The migration script is completely **idempotent**. Simply rerun `node scripts/migrateLegacyCloudinaryAssets.js --apply`. Assets already migrated to `authenticated` are skipped without duplicate mutations. |
| **Legacy URL Returns 200 after 1 hour** | CDN edge caching issue or invalidation request not acknowledged. | Verify the asset in Cloudinary console. Run targeted explicit invalidation via Cloudinary API: `cloudinary.uploader.explicit(publicId, { type: 'upload', invalidate: true })`. |
| **MongoDB Update Fails after Rename** | Database connection dropped during migration. | Asset is already secured in Cloudinary storage (`type: 'authenticated'`). Rerunning the migration script will detect the asset, skip the rename, and synchronize the MongoDB URLs. |
| **Existing Asset Shows Resource Type 'image'** | Legacy PDF or image uploaded under image resource type. | The script dynamically confirms actual resource type via `api.resource()` and passes the correct `resource_type` to `uploader.rename()`. |

---

## 8. Compliance & Security Invariants

1. **Dry-Run by Default**: Never execute `--apply` without explicit operator confirmation.
2. **Never Test on Production User Resumes**: All testing must use synthetic throwaway fixtures created exclusively for testing.
3. **Honest Invalidation Reporting**: Never report an asset as `confirmedCdnVerified` until active HTTP checks confirm the legacy public URL is completely inaccessible.
