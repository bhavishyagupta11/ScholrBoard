/**
 * tickets.api.js — Support ticket API client
 * All ticket CRUD operations for the frontend.
 */
import api from './index.js';

const ticketsApi = {
  /** Create a new support ticket */
  createTicket: (data) => api.post('/tickets', data),

  /** Get tickets created by the logged-in user */
  getMyTickets: (params = {}) => {
    const q = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined))
    ).toString();
    return api.get(`/tickets${q ? '?' + q : ''}`);
  },

  /** Get tickets assigned to logged-in faculty/coordinator */
  getAssignedTickets: (params = {}) => {
    const q = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined))
    ).toString();
    return api.get(`/tickets/assigned${q ? '?' + q : ''}`);
  },

  /** Get all tickets (Admin only) */
  getAllTickets: (params = {}) => {
    const q = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined))
    ).toString();
    return api.get(`/tickets/all${q ? '?' + q : ''}`);
  },

  /** Get summary stats for dashboard widgets */
  getTicketSummary: () => api.get('/tickets/summary'),

  /** Get a single ticket with message thread */
  getTicketById: (id) => api.get(`/tickets/${id}`),

  /** Reply to a ticket */
  replyToTicket: (id, data) => api.post(`/tickets/${id}/reply`, data),

  /** Assign a ticket (Admin only) */
  assignTicket: (id, assignedToId) => api.patch(`/tickets/${id}/assign`, { assignedToId }),

  /** Update ticket status (Admin only) */
  updateTicketStatus: (id, status, resolutionNote) =>
    api.patch(`/tickets/${id}/status`, { status, resolutionNote }),
};

export default ticketsApi;
