import api from './index.js';

export const aiApi = {
  /** Send a chat message and get AI response */
  chat: (message, conversationId = null, type = 'general') =>
    api.post('/ai/chat', { message, conversationId, type }),

  /** Get personalized recommendations */
  getRecommendations: () => api.get('/ai/recommendations'),

  /** Generate a learning roadmap */
  generateRoadmap: (goal, timeframeWeeks = 12) =>
    api.post('/ai/roadmap', { goal, timeframeWeeks }),

  /** List conversation history */
  listChats: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return api.get(`/ai/chats${query ? '?' + query : ''}`);
  },

  /** Get a specific conversation */
  getChat: (id) => api.get(`/ai/chats/${id}`),

  /** Archive a conversation */
  archiveChat: (id) => api.delete(`/ai/chats/${id}`),

  /** Run AI analysis on an uploaded resume */
  analyzeResume: (analysisId) => api.post('/ai/analyze-resume', { analysisId }),

  /** Extract structured data from an uploaded certificate */
  extractCertificate: (fileUrl, mimeType) =>
    api.post('/ai/extract-certificate', { fileUrl, mimeType }),
};

export default aiApi;
