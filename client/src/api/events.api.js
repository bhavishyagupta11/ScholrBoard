import api from './index.js';

export const eventsApi = {
  /** Get events for current user (personalized feed) */
  getMyEvents: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return api.get(`/events/my${query ? '?' + query : ''}`);
  },

  /** Register for an event */
  register: (id) => api.post(`/events/${id}/register`, {}),

  /** Cancel registration for an event */
  cancelRegistration: (id) => api.delete(`/events/${id}/register`),

  /** Admin: get registered students list for a specific event */
  getRegistrations: (id, params = {}) => {
    const query = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([_, v]) => v !== undefined && v !== ''))
    ).toString();
    return api.get(`/events/${id}/registrations${query ? '?' + query : ''}`);
  },

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
