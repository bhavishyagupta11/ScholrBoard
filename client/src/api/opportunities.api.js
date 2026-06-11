import api from './index.js';

export const opportunitiesApi = {
  /** Admin: Create a new draft opportunity */
  create: (data) => api.post('/opportunities', data),

  /** Admin: Publish a draft opportunity */
  publish: (id) => api.put(`/opportunities/${id}/publish`, {}),

  /** Admin: Close a published opportunity */
  close: (id) => api.put(`/opportunities/${id}/close`, {}),

  /** Student: Fetch open opportunities matching candidate eligibility */
  getMatching: () => api.get('/opportunities/matching'),

  /** Admin/Faculty: Fetch all opportunities */
  getAll: (params = {}) => {
    const query = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([_, v]) => v !== undefined))
    ).toString();
    return api.get(`/opportunities${query ? '?' + query : ''}`);
  },

  /** Universal: Fetch specific opportunity details */
  getById: (id) => api.get(`/opportunities/${id}`),
};

export default opportunitiesApi;
