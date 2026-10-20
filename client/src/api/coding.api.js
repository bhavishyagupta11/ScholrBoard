import api from './index.js';

export const codingApi = {
  syncGithub: () => api.post('/developer/sync/github'),
  syncLeetcode: () => api.post('/developer/sync/leetcode'),
  syncCodeforces: () => api.post('/developer/sync/codeforces'),
  syncLinkedin: () => api.post('/developer/sync/linkedin'),
  linkProfile: (platform, username) => api.post(`/coding/link/${platform}`, { username }),
  unlinkProfile: (platform) => api.delete(`/coding/link/${platform}`),
};

export default codingApi;
