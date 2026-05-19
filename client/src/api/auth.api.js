import api, { setToken, clearToken } from './index.js';

export const authApi = {
  /**
   * Register a new user
   * @param {Object} userData - User details including email and password
   */
  register: async (userData) => {
    const response = await api.post('/auth/register', userData);
    if (response.token) {
      setToken(response.token);
    }
    return response;
  },

  /**
   * Login user with email and password
   * @param {Object} credentials - { email, password }
   */
  login: async (credentials) => {
    const response = await api.post('/auth/login', credentials);
    if (response.token) {
      setToken(response.token);
    }
    return response;
  },

  /**
   * Get current user profile based on stored JWT
   */
  getMe: () => api.get('/auth/me'),

  /**
   * Refresh server JWT
   */
  refreshToken: async () => {
    const response = await api.post('/auth/refresh');
    if (response.token) {
      setToken(response.token);
    }
    return response;
  },

  /**
   * Clear local token
   */
  logout: () => {
    clearToken();
  },
};

export default authApi;
