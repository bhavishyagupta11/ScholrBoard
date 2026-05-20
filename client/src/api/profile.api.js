import api from './index.js';

export const profileApi = {
  /** Get the current user's extended profile */
  getMyProfile: () => api.get('/profile/me'),

  /** Update extended profile data (bio, skills, projects, education, etc.) */
  updateMyProfile: (data) => api.put('/profile/me', data),

  /** Update name and avatar on User document */
  updateBasicInfo: (data) => api.put('/profile/me/basic', data),

  /** Update coding platform stats */
  updateCodingStats: (stats) => api.put('/profile/me/coding', stats),

  /** Get any user's profile (faculty/admin) */
  getUserProfile: (userId) => api.get(`/profile/${userId}`),
};

export default profileApi;
