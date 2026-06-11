import api from './index.js';

export const announcementsApi = {
  /** Admin: Post a new filtered announcement */
  create: (data) => api.post('/announcements', data),

  /** Student/Faculty: Fetch matched announcements for feed */
  getMyAnnouncements: () => api.get('/announcements/my'),

  /** Admin: Delete an announcement */
  delete: (id) => api.delete(`/announcements/${id}`),
};

export default announcementsApi;
