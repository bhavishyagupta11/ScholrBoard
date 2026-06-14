import api from './index.js';

export const codingApi = {
  syncGithub: () => api.post('/developer/sync/github'),
  syncLeetcode: () => api.post('/developer/sync/leetcode'),
  syncCodeforces: () => api.post('/developer/sync/codeforces'),
  linkProfile: (platform, username) => api.post(`/coding/link/${platform}`, { username }),
};

export default codingApi;
