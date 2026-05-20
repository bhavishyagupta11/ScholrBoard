import { apiRequest } from './index.js';

export const uploadApi = {
  /** Upload profile avatar */
  uploadAvatar: (file) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return apiRequest('/upload/avatar', { method: 'POST', body: formData });
  },

  /** Upload resume PDF */
  uploadResume: (file) => {
    const formData = new FormData();
    formData.append('resume', file);
    return apiRequest('/upload/resume', { method: 'POST', body: formData });
  },

  /** Upload activity proof */
  uploadProof: (file) => {
    const formData = new FormData();
    formData.append('proof', file);
    return apiRequest('/upload/proof', { method: 'POST', body: formData });
  },

  /** Upload certificate for OCR extraction */
  uploadCertificate: (file) => {
    const formData = new FormData();
    formData.append('certificate', file);
    return apiRequest('/upload/certificate', { method: 'POST', body: formData });
  },

  /** Get list of resume analyses */
  getResumeAnalyses: () => apiRequest('/upload/resume/analyses'),

  /** Get a specific analysis */
  getResumeAnalysis: (id) => apiRequest(`/upload/resume/analyses/${id}`),
};

export default uploadApi;
