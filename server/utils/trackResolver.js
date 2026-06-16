/**
 * trackResolver.js — Server-side career track resolution based on student department.
 */
import Track from '../models/Track.js';
import { getTrackCodeForDepartment } from '../config/trackMapping.js';

/**
 * Resolves the career track ObjectId for a given department string.
 *
 * @param {String} department - The student's department code/name.
 * @returns {Promise<mongoose.Types.ObjectId|null>} Resolves to the Track document _id, or null if not found.
 */
export const resolveTrackForDepartment = async (department) => {
  const trackCode = getTrackCodeForDepartment(department);
  
  try {
    const track = await Track.findOne({ code: trackCode });
    if (track) return track._id;
    
    // Fallback to core_engineering since general is removed in V2.2
    const fallbackTrack = await Track.findOne({ code: 'core_engineering' });
    return fallbackTrack ? fallbackTrack._id : null;
  } catch (err) {
    console.error('[trackResolver] Error resolving track:', err.message);
    return null;
  }
};
