/**
 * trackController.js — Career Track management.
 *
 * Tracks are UI personalization only — NOT authorization.
 * A user's trackId controls sidebar/widget visibility only.
 * If trackId is null, all modules are shown.
 */
import Track from '../models/Track.js';
import User from '../models/User.js';

/**
 * @desc    Get all active career tracks (for UI dropdowns / onboarding)
 * @route   GET /api/tracks
 * @access  Public (used in onboarding — no auth required)
 */
export const getTracks = async (req, res) => {
  try {
    const tracks = await Track.find({ isActive: true })
      .select('-__v')
      .sort({ name: 1 });

    return res.json({ success: true, tracks });
  } catch (error) {
    console.error('getTracks error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch tracks.' });
  }
};

/**
 * @desc    Set the career track for the logged-in user
 * @route   PATCH /api/tracks/set
 * @access  Private — authenticated user
 *
 * NOTE: This is UI personalization ONLY. Setting a track does NOT:
 *   - change permissions
 *   - block routes
 *   - alter API access
 */
export const setMyTrack = async (req, res) => {
  try {
    const { trackId } = req.body;

    if (trackId) {
      const track = await Track.findById(trackId);
      if (!track || !track.isActive) {
        return res.status(404).json({ success: false, message: 'Track not found.' });
      }
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { trackId: trackId || null },
      { new: true }
    ).select('-__v -password');

    return res.json({
      success: true,
      message: trackId ? 'Career track updated.' : 'Career track cleared.',
      trackId: user.trackId,
    });
  } catch (error) {
    console.error('setMyTrack error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update track.' });
  }
};
