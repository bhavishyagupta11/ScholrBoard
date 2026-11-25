/**
 * documentDelivery.js — Shared trusted URL validation, cache lookup, Cloudinary
 * signed/authenticated delivery fallback, and binary magic-byte verification.
 *
 * Eliminates duplication between uploadController endpoints (resumes, certificates,
 * generic authorized proxy) and aiController document ingestion while guaranteeing
 * that provider HTML/JSON errors can never be served as PDFs.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { v2 as cloudinary } from 'cloudinary';
import { documentBufferCache } from './documentBufferCache.js';
import { generateSignedCloudinaryUrl } from './cloudinaryHelper.js';

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const DEFAULT_TIMEOUT_MS = 15000;

/**
 * Determine whether real Cloudinary API credentials are configured in the environment.
 * Prevents unit tests without real credentials from attempting extra API-signed URL calls.
 */
export const hasCloudinaryCredentials = () => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  return Boolean(
    cloudName &&
      apiKey &&
      apiSecret &&
      cloudName !== 'your_cloud_name' &&
      apiKey !== 'your_api_key' &&
      apiSecret !== 'your_api_secret'
  );
};

/**
 * Validate a stored document reference before fetching.
 * Only permits:
 *   1. HTTPS URLs strictly hosted on `res.cloudinary.com` (standard port, no userinfo, configured cloud allowlist)
 *   2. Safe relative local paths rooted strictly under `uploads/`
 */
export const parseAndValidateDocumentSource = (rawUrl) => {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { valid: false, reason: 'Invalid document URL source' };
  }

  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
    if (!rawUrl.startsWith('https://')) {
      return { valid: false, reason: 'Invalid document URL source' };
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(rawUrl);
    } catch {
      return { valid: false, reason: 'Invalid document URL source' };
    }

    if (parsedUrl.username || parsedUrl.password) {
      return { valid: false, reason: 'Invalid document URL source' };
    }

    const hostname = parsedUrl.hostname.toLowerCase();
    if (hostname !== 'res.cloudinary.com') {
      return { valid: false, reason: 'Invalid document URL source' };
    }

    if (parsedUrl.port && parsedUrl.port !== '443') {
      return { valid: false, reason: 'Invalid document URL source' };
    }

    const expectedCloud = process.env.CLOUDINARY_CLOUD_NAME;
    const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
    const urlCloudName = pathSegments[0];
    const allowedClouds = ['demo', 'test-cloud', expectedCloud].filter(Boolean);
    if (expectedCloud && expectedCloud !== 'your_cloud_name' && !allowedClouds.includes(urlCloudName)) {
      return { valid: false, reason: 'Invalid document URL source' };
    }

    return { valid: true, isCloudinary: true, cleanLocalPath: null };
  }

  if (rawUrl.includes('://') || rawUrl.includes('..') || rawUrl.includes('\0')) {
    return { valid: false, reason: 'Invalid document URL source' };
  }

  const stripped = rawUrl.replace(/^\/+/, '');
  if (!stripped.startsWith('uploads/')) {
    return { valid: false, reason: 'Invalid document URL source' };
  }

  return { valid: true, isCloudinary: false, cleanLocalPath: stripped };
};

/**
 * Generate a time-limited authenticated `api.cloudinary.com/.../download` URL
 * via Cloudinary's private_download_url API when credentials are available.
 */
export const generateCloudinaryPrivateDownloadUrl = (rawUrl, expiresInSeconds = 600) => {
  if (!rawUrl || !rawUrl.startsWith('https://res.cloudinary.com')) {
    return null;
  }

  const match = rawUrl.match(
    /\/(raw|image|video)\/(authenticated|private|upload)\/(?:s--[a-zA-Z0-9_.-]+--\/)?(?:v\d+\/)?(.+)$/
  );
  if (!match) {
    return null;
  }

  const resourceType = match[1];
  const deliveryType = match[2] || 'authenticated';
  let publicId = decodeURIComponent(match[3]);
  const lastDot = publicId.lastIndexOf('.');
  const ext = lastDot > 0 ? publicId.slice(lastDot + 1) : 'pdf';

  // Cloudinary stores image/video public_id without the extension suffix
  if ((resourceType === 'image' || resourceType === 'video') && lastDot > 0) {
    publicId = publicId.slice(0, lastDot);
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });

  return cloudinary.utils.private_download_url(publicId, ext, {
    resource_type: resourceType,
    type: deliveryType,
    expires_at: Math.floor(Date.now() / 1000) + expiresInSeconds,
    secure: true,
  });
};

/**
 * Verify binary magic bytes for supported document types.
 * Prevents HTML/JSON provider errors from ever being treated as PDFs or images.
 */
export const detectDocumentMagicType = (buffer, { allowImages = false } = {}) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) {
    return { valid: false };
  }

  const isPdf = buffer.subarray(0, 4).toString('ascii') === '%PDF';
  if (isPdf) {
    return { valid: true, isPdf: true, isImage: false, contentType: 'application/pdf', extension: 'pdf' };
  }

  if (allowImages) {
    const isJpg = buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    if (isJpg) {
      return { valid: true, isPdf: false, isImage: true, contentType: 'image/jpeg', extension: 'jpg' };
    }

    const isPng =
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47;
    if (isPng) {
      return { valid: true, isPdf: false, isImage: true, contentType: 'image/png', extension: 'png' };
    }

    const isWebp =
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP';
    if (isWebp) {
      return { valid: true, isPdf: false, isImage: true, contentType: 'image/webp', extension: 'webp' };
    }
  }

  return { valid: false };
};

/**
 * Inspect Cloudinary HTTP headers & payload snippet for provider delivery restrictions.
 */
export const inspectCloudinaryFailure = ({ status = 200, headers, buffer }) => {
  const cldError = headers?.get?.('x-cld-error') || '';
  const contentType = (headers?.get?.('content-type') || '').toLowerCase();
  const snippet = Buffer.isBuffer(buffer) ? buffer.subarray(0, 512).toString('utf-8') : '';

  if (
    cldError.toLowerCase().includes('untrusted') ||
    snippet.includes('show_original_customer_untrusted') ||
    snippet.includes('Customer is marked as untrusted')
  ) {
    return {
      isProviderError: true,
      status: 502,
      code: 'CLOUDINARY_ACCOUNT_UNTRUSTED',
      providerCode: 'show_original_customer_untrusted',
      cldError: cldError || undefined,
      message:
        'Document delivery is blocked by Cloudinary account trust policy (show_original_customer_untrusted). Contact Cloudinary support or review Security settings.',
    };
  }

  if (cldError.toLowerCase().includes('deny') || cldError.toLowerCase().includes('acl')) {
    return {
      isProviderError: true,
      status: 502,
      code: 'CLOUDINARY_DELIVERY_BLOCKED',
      providerCode: 'deny_or_acl_failure',
      cldError,
      message:
        'Document delivery is blocked by Cloudinary PDF/asset ACL security settings (deny or ACL failure). Enable PDF/ZIP delivery in Cloudinary Settings > Security or use authenticated downloads.',
    };
  }

  if (contentType.includes('application/json') && snippet.includes('"error"')) {
    return {
      isProviderError: true,
      status: 502,
      code: 'CLOUDINARY_DELIVERY_BLOCKED',
      providerCode: 'cloudinary_error_payload',
      message: 'Storage provider returned a JSON error payload instead of valid document bytes.',
    };
  }

  if (status >= 400 && cldError) {
    return {
      isProviderError: true,
      status: 502,
      code: 'CLOUDINARY_DELIVERY_BLOCKED',
      providerCode: 'cloudinary_header_error',
      cldError,
      message: `Storage provider blocked document delivery (${cldError}).`,
    };
  }

  return { isProviderError: false };
};

/**
 * Resolve validated binary bytes for an already-authorized user/asset across:
 *   1. Ephemeral in-memory process cache (keyed by ownerUserId)
 *   2. Safe local `uploads/` file
 *   3. Cloudinary remote storage with signed URL & authenticated download fallback
 */
export const resolveValidatedDocumentBuffer = async ({
  ownerUserId,
  identifierKeys = [],
  assetUrl,
  allowImages = false,
  preferPrivateDownload = false,
  preserveHttpStatus = false,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxBytes = DEFAULT_MAX_BYTES,
}) => {
  // 1. Check ephemeral owner-scoped in-memory cache first
  const candidateKeys = [...new Set([...identifierKeys, assetUrl].filter(Boolean))];
  if (ownerUserId) {
    for (const key of candidateKeys) {
      const cached = documentBufferCache.get(ownerUserId, key);
      if (cached?.buffer) {
        const magic = detectDocumentMagicType(cached.buffer, { allowImages });
        if (magic.valid) {
          return {
            ok: true,
            source: 'cache',
            buffer: cached.buffer,
            ...magic,
          };
        }
      }
    }
  }

  // 2. Validate source URL / path
  const sourceCheck = parseAndValidateDocumentSource(assetUrl);
  if (!sourceCheck.valid) {
    return {
      ok: false,
      status: 400,
      text: sourceCheck.reason,
      code: 'INVALID_DOCUMENT_SOURCE',
    };
  }

  // 3. Handle local file path safely inside uploads/
  if (!sourceCheck.isCloudinary) {
    const uploadsDir = path.resolve(process.cwd(), 'uploads');
    const filePath = path.resolve(process.cwd(), sourceCheck.cleanLocalPath);
    if (!filePath.startsWith(uploadsDir + path.sep) && filePath !== uploadsDir) {
      return { ok: false, status: 400, text: 'Invalid local document path', code: 'INVALID_LOCAL_PATH' };
    }

    try {
      const stats = await fs.stat(filePath);
      if (!stats.isFile()) {
        return { ok: false, status: 404, text: 'Local document not found', code: 'DOCUMENT_NOT_FOUND' };
      }
      if (stats.size > maxBytes) {
        return { ok: false, status: 413, text: 'Document exceeds maximum size limit (10MB)', code: 'DOCUMENT_TOO_LARGE' };
      }
      const buffer = await fs.readFile(filePath);
      const magic = detectDocumentMagicType(buffer, { allowImages });
      if (!magic.valid) {
        return {
          ok: false,
          status: 400,
          text: allowImages
            ? 'Invalid document format: expected PDF or supported proof image'
            : 'Invalid document format: expected valid PDF file',
          code: 'INVALID_DOCUMENT_FORMAT',
        };
      }
      return {
        ok: true,
        source: 'local',
        filePath,
        buffer,
        ...magic,
      };
    } catch {
      return { ok: false, status: 404, text: 'Local document not found', code: 'DOCUMENT_NOT_FOUND' };
    }
  }

  // 4. Handle Cloudinary remote storage with signed URL & private_download_url fallback
  let primaryUrl = assetUrl;
  let privateUrl = null;
  try {
    if (hasCloudinaryCredentials() || preferPrivateDownload) {
      privateUrl = generateCloudinaryPrivateDownloadUrl(assetUrl, 600);
    }
  } catch (err) {
    console.warn('[documentDelivery] Private download URL generation warning:', err.message);
  }

  if (preferPrivateDownload && privateUrl) {
    primaryUrl = privateUrl;
  } else {
    try {
      const signed = generateSignedCloudinaryUrl(assetUrl, { expiresIn: 300 });
      if (signed?.signedUrl) {
        primaryUrl = signed.signedUrl;
      }
    } catch (err) {
      console.warn('[documentDelivery] Signed URL generation warning:', err.message);
    }
  }

  let response;
  try {
    response = await fetch(primaryUrl, {
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
      return { ok: false, status: 504, text: 'Storage gateway timeout', code: 'STORAGE_TIMEOUT' };
    }
    return { ok: false, status: 502, text: 'Failed to proxy storage document', code: 'STORAGE_FETCH_FAILED' };
  }

  if (response.status >= 300 && response.status < 400) {
    return { ok: false, status: 400, text: 'Redirects are not permitted', code: 'REDIRECTS_NOT_PERMITTED' };
  }

  // Fallback to authenticated Cloudinary API download URL if CDN returned 401/403 (e.g. deny or ACL failure)
  if (
    (response.status === 401 || response.status === 403) &&
    hasCloudinaryCredentials() &&
    privateUrl &&
    privateUrl !== primaryUrl
  ) {
    try {
      const fallbackResp = await fetch(privateUrl, {
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (fallbackResp && !(fallbackResp.status >= 300 && fallbackResp.status < 400) && fallbackResp.ok) {
        response = fallbackResp;
      }
    } catch {
      // Preserve original response when fallback download attempt fails
    }
  }

  const contentLength = response.headers?.get?.('content-length');
  if (contentLength && parseInt(contentLength, 10) > maxBytes) {
    return { ok: false, status: 413, text: 'Document exceeds maximum size limit (10MB)', code: 'DOCUMENT_TOO_LARGE' };
  }

  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength > maxBytes) {
    return { ok: false, status: 413, text: 'Document exceeds maximum size limit (10MB)', code: 'DOCUMENT_TOO_LARGE' };
  }

  const buffer = Buffer.from(arrayBuffer);

  // Reject provider-level JSON/header error blocks before anything treats them as files
  const cldFailure = inspectCloudinaryFailure({
    status: response.status,
    headers: response.headers,
    buffer,
  });
  if (cldFailure.isProviderError) {
    return {
      ok: false,
      status: cldFailure.status,
      json: {
        success: false,
        code: cldFailure.code,
        message: cldFailure.message,
        providerCode: cldFailure.providerCode,
        ...(cldFailure.cldError ? { cldError: cldFailure.cldError } : {}),
      },
      code: cldFailure.code,
    };
  }

  if (!response.ok) {
    const mappedStatus = response.status === 404 ? 404 : preserveHttpStatus ? response.status : 502;
    return {
      ok: false,
      status: mappedStatus,
      text: preserveHttpStatus
        ? 'Failed to fetch file from storage'
        : `Storage proxy error (${response.status}): Unable to retrieve document`,
      code: 'STORAGE_FETCH_ERROR',
    };
  }

  const magic = detectDocumentMagicType(buffer, { allowImages });
  if (!magic.valid) {
    return {
      ok: false,
      status: 400,
      text: allowImages
        ? 'Invalid document format: expected PDF or supported proof image'
        : 'Invalid document format: expected valid PDF file',
      code: 'INVALID_DOCUMENT_FORMAT',
    };
  }

  return {
    ok: true,
    source: 'cloudinary',
    buffer,
    ...magic,
  };
};
