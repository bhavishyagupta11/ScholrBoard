import api from './index.js';

export const activitiesApi = {
  /** Submit a new activity */
  create: (data) => api.post('/activities', data),

  /** Get current student's activities (with optional filters) */
  getMyActivities: (params = {}) => {
    const query = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined))
    ).toString();
    return api.get(`/activities/my${query ? '?' + query : ''}`);
  },

  /** Get a single activity by ID */
  getById: (id) => api.get(`/activities/${id}`),

  /** Update a pending activity */
  update: (id, data) => api.put(`/activities/${id}`, data),

  /** Archive (soft-delete) a pending activity */
  archive: (id) => api.delete(`/activities/${id}`),

  /** Faculty/Admin: get pending activities for review */
  getPending: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return api.get(`/activities/pending/all${query ? '?' + query : ''}`);
  },

  /** Faculty/Admin: approve or reject an activity */
  review: (id, reviewData) => api.put(`/activities/${id}/review`, reviewData),
};

export default activitiesApi;
