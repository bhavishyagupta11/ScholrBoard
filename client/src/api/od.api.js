import api from './index.js';

export const odApi = {
  /** Student: Submit a new OD attendance request */
  requestOd: (data) => api.post('/od/request', data),

  /** Student: Fetch own OD requests */
  getMyOds: () => api.get('/od/my'),

  /** Student: Update/Resubmit a request */
  updateOd: (id, data) => api.put(`/od/request/${id}`, data),

  /** Faculty: Fetch advisees pending OD requests */
  getPendingOds: (params = {}) => {
    const query = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([_, v]) => v !== undefined))
    ).toString();
    return api.get(`/od/pending${query ? '?' + query : ''}`);
  },

  /** Faculty: Approve, Reject, or Request Revision on an OD */
  reviewOd: (id, reviewData) => api.put(`/od/review/${id}`, reviewData),

  /** Admin: Fetch all OD requests */
  getAllOds: (params = {}) => {
    const query = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([_, v]) => v !== undefined))
    ).toString();
    return api.get(`/od${query ? '?' + query : ''}`);
  },
};

export default odApi;
