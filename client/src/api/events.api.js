import api from './index.js';

export const eventsApi = {
  /** Get events for current user (personalized feed) */
  getMyEvents: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return api.get(`/events/my${query ? '?' + query : ''}`);
  },

  /** Register for an event */
  register: (id) => api.post(`/events/${id}/register`, {}),

  /** Admin/Faculty: get all events */
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return api.get(`/events${query ? '?' + query : ''}`);
  },

  /** Admin/Faculty: create an event */
  create: (data) => api.post('/events', data),

  /** Admin: update an event */
  update: (id, data) => api.put(`/events/${id}`, data),

  /** Admin: delete an event */
  delete: (id) => api.delete(`/events/${id}`),
};

export default eventsApi;
