import api from './index.js';

export const talentDiscoveryApi = {
  /**
   * Search, filter, and page students for Talent Discovery
   * @param {Object} params - filter query params
   * @param {Object} opts - fetch options (e.g. signal)
   */
  getTalentDiscovery: (params = {}, opts = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query.append(key, value);
      }
    });
    const queryString = query.toString();
    return api.get(`/users/talent-discovery${queryString ? `?${queryString}` : ''}`, opts);
  }
};

export default talentDiscoveryApi;
