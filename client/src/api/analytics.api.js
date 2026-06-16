import api from './index.js';

export const analyticsApi = {
  /** Log a study session for today */
  logStudySession: (data) => api.post('/analytics/study-session', data),

  /** Get daily learning progress (last N days) */
  getProgress: (days = 14) => api.get(`/analytics/progress?days=${days}`),

  /** Get dashboard analytics (activity counts, weekly study, streak) */
  getDashboard: () => api.get('/analytics/dashboard'),

  /** Update GPA, attendance, subject breakdown */
  updateAcademic: (data) => api.put('/analytics/academic', data),

  /** Admin: system-wide analytics */
  getSystemAnalytics: () => api.get('/analytics/system'),

  /** Faculty: faculty activity stats */
  getFacultyActivityStats: () => api.get('/analytics/faculty-activity-stats'),

  /** Coordinator: coordinator-scoped analytics */
  getCoordinatorAnalytics: () => api.get('/analytics/coordinator'),
};

export default analyticsApi;
