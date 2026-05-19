import api from './index.js';

export const codingApi = {
  syncGithub: (username) => api.post('/coding/sync-github', { username }),
  syncLeetcode: (username) => api.post('/coding/sync-leetcode', { username }),
  syncCodeforces: (username) => api.post('/coding/sync-codeforces', { username }),
  linkProfile: (platform, username) => api.post(`/coding/link/${platform}`, { username }),
};

export default codingApi;
