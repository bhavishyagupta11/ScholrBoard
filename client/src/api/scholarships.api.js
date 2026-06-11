import api from './index.js';

export const scholarshipsApi = {
  /** Admin: Compose a new scholarship */
  create: (data) => api.post('/scholarships', data),

  /** Admin: Publish a scholarship */
  publish: (id) => api.put(`/scholarships/${id}/publish`, {}),

  /** Admin: Close a scholarship */
  close: (id) => api.put(`/scholarships/${id}/close`, {}),

  /** Student: Fetch open scholarships matching criteria */
  getMatching: (params = {}) => {
    const query = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([_, v]) => v !== undefined))
    ).toString();
    return api.get(`/scholarships/matching${query ? '?' + query : ''}`);
  },

  /** Student: Register/Apply for scholarship */
  apply: (scholarshipId, data) => api.post(`/scholarships/${scholarshipId}/apply`, data),

  /** Student: Fetch own application history */
  getMyHistory: () => api.get('/scholarships/my'),

  /** Admin: Get registered applications for a specific scholarship */
  getApplications: (scholarshipId, params = {}) => {
    const query = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([_, v]) => v !== undefined))
    ).toString();
    return api.get(`/scholarships/scholarship/${scholarshipId}${query ? '?' + query : ''}`);
  },

  /** Admin: Review scholarship status (Selected/Rejected) */
  reviewApplication: (id, data) => api.put(`/scholarships/application/${id}`, data),

  /** Universal: Fetch all scholarships list */
  getAll: (params = {}) => {
    const query = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([_, v]) => v !== undefined))
    ).toString();
    return api.get(`/scholarships${query ? '?' + query : ''}`);
  },
};

export default scholarshipsApi;
