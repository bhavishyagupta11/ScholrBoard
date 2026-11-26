import api from './index.js';

export const announcementsApi = {
  /** Admin: Fetch all announcements (published & drafts) */
  getAll: (params = {}) => {
    const query = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([_, v]) => v !== undefined && v !== ''))
    ).toString();
    return api.get(`/announcements${query ? '?' + query : ''}`);
  },

  /** Admin: Post or save draft announcement */
  create: (data) => api.post('/announcements', data),

  /** Admin: Update / publish / edit an announcement */
  update: (id, data) => api.put(`/announcements/${id}`, data),

  /** Student/Faculty: Fetch matched announcements for feed */
  getMyAnnouncements: () => api.get('/announcements/my'),

  /** Admin: Delete an announcement */
  delete: (id) => api.delete(`/announcements/${id}`),
};

export default announcementsApi;
