import api from './index.js';

export const notificationsApi = {
  /** Get notifications (optionally unread-only) */
  getAll: (unreadOnly = false, page = 1) =>
    api.get(`/notifications?unreadOnly=${unreadOnly}&page=${page}`),

  /** Mark a specific notification as read */
  markRead: (id) => api.put(`/notifications/${id}/read`, {}),

  /** Mark all notifications as read */
  markAllRead: () => api.put('/notifications/read-all', {}),

  /** Delete a notification */
  delete: (id) => api.delete(`/notifications/${id}`),
};

export default notificationsApi;
