import api, { setToken, clearToken, getToken } from './index.js';

export const authApi = {
  /**
   * Register a new user.
   * @param {string} firebaseIdToken - from Firebase SDK
   * @param {object} userData - { name, role, studentId?, facultyId?, department?, semester? }
   */
  register: async (firebaseIdToken, userData) => {
    const response = await fetch(
      `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/auth/register`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${firebaseIdToken}`,
        },
        body: JSON.stringify(userData),
      }
    );
    const data = await response.json();
    if (!response.ok) throw Object.assign(new Error(data.message), { errors: data.errors });
    if (data.token) setToken(data.token);
    return data;
  },

  /**
   * Sync Firebase user with MongoDB → get server JWT.
   * @param {string} firebaseIdToken - from Firebase SDK
   */
  sync: async (firebaseIdToken) => {
    const response = await fetch(
      `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/auth/sync`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${firebaseIdToken}`,
        },
      }
    );
    const data = await response.json();
    if (!response.ok) throw Object.assign(new Error(data.message), { code: data.code });
    if (data.token) setToken(data.token);
    return data;
  },

  /** Get current user from DB (uses server JWT) */
  getMe: () => api.get('/auth/me'),

  /** Clear stored tokens */
  logout: () => {
    clearToken();
    localStorage.removeItem('scholrboardUser');
    localStorage.removeItem('role');
    localStorage.removeItem('isAuthenticated');
  },

  /** Check if user is authenticated (has a token) */
  isAuthenticated: () => !!getToken(),
};

export default authApi;
