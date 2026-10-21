/**
 * linkedinProvider.js — ScholrBoard V13 Phase 7
 *
 * Provider client for LinkedIn API integration and data normalization.
 * Follows strict V13 Part 3.2, Part 13, and Phase 7 specifications:
 *   1. Distinguishes connection status from activity metric retrieval.
 *   2. Only extracts verified identity fields under approved basic scopes (openid, profile, email).
 *   3. Restricted activity metrics (followers, connections, posts, impressions) are represented
 *      strictly as null (never fabricated, never converted to 0) when unavailable under approved scopes.
 *   4. Zero exposure of access tokens or client secrets in logs or API responses.
 *   5. Robust handling of 401 (AUTH_EXPIRED), 403 (INSUFFICIENT_SCOPE), 429 (RATE_LIMITED), and timeouts.
 */

/**
 * Normalizes user input (handle or URL) into a canonical LinkedIn vanity handle and profile URL.
 *
 * @param {string} input - User handle or LinkedIn profile URL
 * @returns {{ vanityName: string, profileUrl: string }}
 * @throws {Error} If input is invalid, empty, or not a recognized LinkedIn handle/URL
 */
export function normalizeLinkedInInput(input) {
  if (!input || typeof input !== 'string' || !input.trim()) {
    throw new Error('LinkedIn username or profile URL is required');
  }

  const trimmed = input.trim();

  // If it's a URL
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      const host = parsed.hostname.toLowerCase();
      if (!host.includes('linkedin.com')) {
        throw new Error('Invalid LinkedIn URL domain. Expected linkedin.com');
      }

      // Extract vanity from pathname (e.g. /in/john-doe/ or /company/acme/)
      const segments = parsed.pathname.split('/').filter(Boolean);
      if (segments.length === 0) {
        throw new Error('Invalid LinkedIn URL: missing profile path');
      }

      let vanity = segments[segments.length - 1];
      if (segments[0] === 'in' && segments.length >= 2) {
        vanity = segments[1];
      }

      // Clean vanity
      vanity = decodeURIComponent(vanity).replace(/^@/, '').replace(/\/$/, '').trim();
      if (!vanity) {
        throw new Error('Unable to extract LinkedIn profile handle from URL');
      }

      return {
        vanityName: vanity,
        profileUrl: `https://www.linkedin.com/in/${encodeURIComponent(vanity)}`,
      };
    } catch (err) {
      if (err.message.startsWith('Invalid LinkedIn') || err.message.startsWith('Unable to')) throw err;
      throw new Error(`Malformed LinkedIn URL: ${err.message}`);
    }
  }

  // Handle provided directly
  const cleanHandle = trimmed.replace(/^@/, '').replace(/\/$/, '').trim();
  if (!cleanHandle || cleanHandle.length < 2) {
    throw new Error('Invalid LinkedIn handle: handle must be at least 2 characters');
  }

  // Basic sanity check on vanity characters
  if (!/^[a-zA-Z0-9_\-.]+$/.test(cleanHandle)) {
    throw new Error('Invalid LinkedIn handle: contains invalid characters');
  }

  return {
    vanityName: cleanHandle,
    profileUrl: `https://www.linkedin.com/in/${encodeURIComponent(cleanHandle)}`,
  };
}

/**
 * Fetches LinkedIn profile data using an authorized access token.
 *
 * @param {string} accessToken - OAuth access token
 * @param {object} [options={}] - Optional configurations and mock injection
 * @returns {Promise<object>} Normalized LinkedIn profile and activity metrics
 */
export async function fetchLinkedInProfile(accessToken, options = {}) {
  if (!accessToken || typeof accessToken !== 'string' || !accessToken.trim()) {
    const err = new Error('LinkedIn access token is missing or invalid');
    err.code = 'AUTH_EXPIRED';
    err.statusCode = 401;
    throw err;
  }

  const timeoutMs = options.timeoutMs || 8000;
  const fetchFn = options.fetchImpl || fetch;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const endpoint = options.endpoint || 'https://api.linkedin.com/v2/userinfo';
    const res = await fetchFn(endpoint, {
      headers: {
        Authorization: `Bearer ${accessToken.trim()}`,
        Accept: 'application/json',
        'User-Agent': 'ScholrBoard-Sync/1.0',
      },
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    if (res.status === 401) {
      const err = new Error('LinkedIn authorization expired or token is invalid');
      err.code = 'AUTH_EXPIRED';
      err.statusCode = 401;
      throw err;
    }

    if (res.status === 403) {
      const err = new Error('Insufficient LinkedIn API scopes for requested resource');
      err.code = 'INSUFFICIENT_SCOPE';
      err.statusCode = 403;
      throw err;
    }

    if (res.status === 429) {
      const err = new Error('LinkedIn API rate limit exceeded');
      err.code = 'RATE_LIMITED';
      err.statusCode = 429;
      throw err;
    }

    if (!res.ok) {
      const err = new Error(`LinkedIn provider returned HTTP ${res.status}`);
      err.code = 'PROVIDER_ERROR';
      err.statusCode = res.status;
      throw err;
    }

    const data = typeof res.json === 'function' ? await res.json() : {};

    // Determine scopes granted
    const scopesGranted = Array.isArray(options.scopes)
      ? options.scopes
      : (options.scope ? String(options.scope).split(' ') : ['openid', 'profile', 'email']);

    const hasRestrictedSocialScope = scopesGranted.some(s =>
      ['r_organization_social', 'r_member_social', 'r_compliance'].includes(s)
    );

    // Extract legitimate identity fields
    const memberId = data.sub || data.id || null;
    const vanityName = data.vanityName || data.preferred_username || (data.name ? data.name.toLowerCase().replace(/\s+/g, '-') : null);
    const profileUrl = vanityName ? `https://www.linkedin.com/in/${vanityName}` : (data.profileUrl || null);

    // Activity metrics: only populated if legitimately verified through authorized scopes
    let followers = null;
    let connections = null;
    let activityMetricsAvailable = false;
    let reason = 'Activity and engagement metrics unavailable under current approved permissions';

    if (hasRestrictedSocialScope && (data.followers !== undefined || data.connections !== undefined)) {
      followers = data.followers !== undefined ? Number(data.followers) : null;
      connections = data.connections !== undefined ? Number(data.connections) : null;
      activityMetricsAvailable = true;
      reason = null;
    }

    return {
      memberId,
      vanityName,
      profileUrl,
      followers,
      connections,
      activityMetricsAvailable,
      isPartial: !activityMetricsAvailable,
      scopeGranted: scopesGranted,
      reason,
      rawIdentity: {
        name: data.name || `${data.given_name || ''} ${data.family_name || ''}`.trim() || null,
        email: data.email || null,
        picture: data.picture || null,
      },
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      const timeoutErr = new Error('LinkedIn API request timed out');
      timeoutErr.code = 'TIMEOUT';
      timeoutErr.statusCode = 504;
      throw timeoutErr;
    }
    // Re-throw structured provider errors
    if (err.code) throw err;
    const wrapped = new Error(`LinkedIn fetch failed: ${err.message}`);
    wrapped.code = 'PROVIDER_ERROR';
    wrapped.statusCode = 500;
    throw wrapped;
  }
}

/**
 * Performs a safe, read-only smoke verification of live LinkedIn integration credentials if configured.
 *
 * @param {object} [options={}]
 * @returns {Promise<object>} Status report (VERIFIED or UNVERIFIED with detailed explanation)
 */
export async function verifyLiveLinkedInIntegration(options = {}) {
  const env = options.env || process.env;
  const token = env.LINKEDIN_ACCESS_TOKEN || env.LINKEDIN_TOKEN;
  const clientId = env.LINKEDIN_CLIENT_ID;

  if (!token && !clientId) {
    return {
      status: 'UNVERIFIED',
      verified: false,
      reason: 'No LinkedIn credentials or access token configured in environment (.env). Standard approved scope operates as social link reference.',
    };
  }

  if (token) {
    try {
      const result = await fetchLinkedInProfile(token, { timeoutMs: 5000 });
      return {
        status: 'VERIFIED',
        verified: true,
        memberId: result.memberId,
        vanityName: result.vanityName,
        activityMetricsAvailable: result.activityMetricsAvailable,
        scopes: result.scopeGranted,
      };
    } catch (err) {
      return {
        status: 'UNVERIFIED',
        verified: false,
        reason: `Live LinkedIn token check failed: ${err.message} (code: ${err.code || 'UNKNOWN'})`,
      };
    }
  }

  return {
    status: 'UNVERIFIED',
    verified: false,
    reason: 'LINKEDIN_CLIENT_ID is set, but no active bearer token available for non-interactive live check.',
  };
}
