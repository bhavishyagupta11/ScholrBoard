import api from './index.js';

export const placementsApi = {
  /** Student: get personalized placements feed */
  getMyPlacements: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return api.get(`/placements/my${query ? '?' + query : ''}`);
  },

  /** Student: apply to a placement */
  apply: (id) => api.post(`/placements/${id}/apply`, {}),

  /** Admin/Faculty: get all placements */
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return api.get(`/placements${query ? '?' + query : ''}`);
  },

  /** Admin: create a placement */
  create: (data) => api.post('/placements', data),

  /** Admin: update a placement */
  update: (id, data) => api.put(`/placements/${id}`, data),

  /** Admin: delete a placement */
  delete: (id) => api.delete(`/placements/${id}`),
};

export default placementsApi;
