import api from './index.js';

export const supportApi = {
  /**
   * Submit a contact message (Public)
   * @param {Object} data - { name, email, subject, message }
   */
  submitContact: (data) => api.post('/support/contact', data),

  /**
   * Get all contact messages (Admin only)
   * @param {Object} params - { page, limit }
   */
  getContactMessages: (params = {}) => {
    const query = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params).filter(([_, v]) => v !== undefined)
      )
    ).toString();
    return api.get(`/support/contact${query ? '?' + query : ''}`);
  },
};

export default supportApi;
