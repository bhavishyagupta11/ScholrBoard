/**
 * tracks.api.js — Career Track API client
 * UI personalization only — track selection does not affect permissions.
 */
import api from './index.js';

const tracksApi = {
  /** Get all active career tracks (public) */
  getTracks: () => api.get('/tracks'),

  /**
   * Set the career track for the logged-in user.
   * Pass trackId=null to clear track (show all modules).
   * UI personalization ONLY — does not change any permissions.
   */
  setMyTrack: (trackId) => api.patch('/tracks/set', { trackId }),
};

export default tracksApi;
