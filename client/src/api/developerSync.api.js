import api from './index.js';

export const developerSyncApi = {
  /** Trigger synchronization for GitHub metrics */
  syncGithub: () => api.post('/developer/sync/github'),

  /** Trigger synchronization for LeetCode metrics */
  syncLeetcode: () => api.post('/developer/sync/leetcode'),

  /** Trigger synchronization for Codeforces metrics */
  syncCodeforces: () => api.post('/developer/sync/codeforces'),

  /** Trigger verification for LinkedIn profile */
  syncLinkedin: () => api.post('/developer/sync/linkedin'),

  /** Trigger synchronization for all connected platform profiles */
  syncAll: () => api.post('/developer/sync/all'),
};

export default developerSyncApi;
