import api from './index.js';

export const applicationsApi = {
  /** Student: Register for a placement drive */
  apply: (opportunityId, data) => api.post(`/applications/opportunity/${opportunityId}/apply`, data),

  /** Student: Withdraw application */
  withdraw: (id) => api.post(`/applications/${id}/withdraw`, {}),

  /** Student: Get own application history list */
  getMyHistory: () => api.get('/applications/my'),

  /** Admin: Get registered applications for a specific drive */
  getOpportunityApplicants: (opportunityId, params = {}) => {
    const query = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([_, v]) => v !== undefined))
    ).toString();
    return api.get(`/applications/opportunity/${opportunityId}${query ? '?' + query : ''}`);
  },

  /** Admin: Review status (Shortlist, Select, Reject) */
  reviewStatus: (id, data) => api.put(`/applications/${id}/status`, data),

  /** Admin: Schedule candidate interview */
  scheduleInterview: (id, data) => api.put(`/applications/${id}/interview`, data),
};

export default applicationsApi;
