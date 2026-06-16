/**
 * api/index.js — Centralized API service base
 *
 * All frontend API calls go through this module.
 * It reads the JWT from localStorage, attaches it to every request,
 * and handles common error cases (401 → redirect to login, etc.)
 */

export const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const TOKEN_KEY = 'scholrmind_token';

// ─── Token management ─────────────────────────────────────────────────────────

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

/**
 * apiRequest — typed fetch wrapper with auth header injection and error normalization.
 *
 * @param {string} endpoint  - e.g. '/profile/me'
 * @param {object} options   - fetch options (method, body, signal, etc.)
 * @returns {Promise<any>}   - parsed JSON response
 * @throws {ApiError}        - normalized error with message + status
 */
export const apiRequest = async (endpoint, options = {}) => {
  const token = getToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  // Remove Content-Type for FormData (let browser set boundary)
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // Parse JSON body (even for error responses)
  let data;
  try {
    data = await response.json();
  } catch {
    data = { message: response.statusText };
  }

  if (!response.ok) {
    const code = data?.code;

    if (response.status === 401 || response.status === 403) {
      if (response.status === 401 && code === 'TOKEN_EXPIRED') {
        const refreshResult = await tryRefreshToken();
        if (refreshResult.success) {
          return apiRequest(endpoint, options);
        } else if (refreshResult.isNetworkError || (refreshResult.status && refreshResult.status !== 401 && refreshResult.status !== 403)) {
          console.warn('[API Interceptor] Token refresh failed due to infrastructure error. Preserving session.');
          throw Object.assign(new Error('Token refresh failed due to server/network issue'), {
            status: refreshResult.status || 503,
            code: 'REFRESH_TEMPORARY_FAILURE',
          });
        }
      }

      console.warn(`[API Interceptor] Session cleared due to genuine auth failure (${response.status})`);
      clearToken();
      localStorage.removeItem('scholrboardUser');
      localStorage.removeItem('role');
      localStorage.removeItem('isAuthenticated');
      window.dispatchEvent(new CustomEvent('auth:session-expired'));
    }

    throw Object.assign(new Error(data?.message || 'API request failed'), {
      status: response.status,
      code:   data?.code,
      errors: data?.errors,
    });
  }

  return data;
};

// ─── Blob fetch wrapper ────────────────────────────────────────────────────────

export const fetchBlob = async (endpoint, options = {}) => {
  const token = getToken();

  const headers = {
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      window.dispatchEvent(new CustomEvent('auth:session-expired'));
    }
    const err = new Error(`Failed to fetch secure document`);
    err.status = response.status;
    err.contentType = response.headers.get('content-type') || 'Unknown';
    throw err;
  }

  return {
    blob: await response.blob(),
    contentType: response.headers.get('content-type') || ''
  };
};

// ─── Token refresh ────────────────────────────────────────────────────────────

let isRefreshing = false;
let refreshPromise = null;

const tryRefreshToken = async () => {
  if (isRefreshing) return refreshPromise;

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const { token } = await res.json();
        setToken(token);
        return { success: true };
      }
      return { success: false, status: res.status };
    } catch (err) {
      return { success: false, isNetworkError: true, error: err };
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

// ─── HTTP method shortcuts ────────────────────────────────────────────────────

export const api = {
  get:    (endpoint, opts = {}) => apiRequest(endpoint, { method: 'GET',    ...opts }),
  post:   (endpoint, body, opts = {}) => apiRequest(endpoint, { method: 'POST',   body: JSON.stringify(body), ...opts }),
  put:    (endpoint, body, opts = {}) => apiRequest(endpoint, { method: 'PUT',    body: JSON.stringify(body), ...opts }),
  patch:  (endpoint, body, opts = {}) => apiRequest(endpoint, { method: 'PATCH',  body: JSON.stringify(body), ...opts }),
  delete: (endpoint, opts = {}) => apiRequest(endpoint, { method: 'DELETE',  ...opts }),

  // For multipart/form-data (file uploads)
  upload: (endpoint, formData, opts = {}) => apiRequest(endpoint, {
    method: 'POST',
    body:   formData,
    ...opts,
  }),
};

export default api;
