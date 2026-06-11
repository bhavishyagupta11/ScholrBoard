import api from './index.js';

export const usersApi = {
  /** Get all users (Admin) or all students in department (Faculty) */
  getUsers: (params = {}) => {
    const query = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([_, v]) => v !== undefined))).toString();
    return api.get(`/users${query ? '?' + query : ''}`);
  },

  /** Get a specific user by ID */
  getUserById: (id) => api.get(`/users/${id}`),

  /** Update user roles/verification (Admin only) */
  updateUser: (id, data) => api.put(`/users/${id}`, data),

  /** Soft delete user (Admin only) */
  deleteUser: (id) => api.delete(`/users/${id}`),

  /** Assign students to an advisor (Admin only) */
  assignAdvisor: (studentIds, advisorId) => api.put('/users/assign-advisor', { studentIds, advisorId }),

  /** Get advisor's assigned students (Faculty only) */
  getAssignedStudents: () => api.get('/users/advisor/students'),
};

export default usersApi;
