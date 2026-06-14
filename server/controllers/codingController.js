import Profile from '../models/Profile.js';

const normalizeUsername = (value) => String(value || '').trim().replace(/^@/, '');

// Helper to update coding profile fields in Profile document
const updateCodingProfile = async (userId, update) => {
  const profile = await Profile.findOneAndUpdate(
    { userId },
    { $set: { ...update, 'codingStats.lastUpdated': new Date() } },
    { new: true, upsert: true, runValidators: true }
  );

  return profile.codingStats;
};

export const linkCodingProfile = async (req, res) => {
  try {
    const { platform } = req.params;
    const username = normalizeUsername(req.body.username);
    const supported = ['geeksforgeeks', 'hackerrank', 'codechef', 'linkedin', 'github', 'leetcode', 'codeforces'];

    if (!supported.includes(platform)) {
      return res.status(400).json({ success: false, message: 'Unsupported platform' });
    }
    if (!username) {
      return res.status(400).json({ success: false, message: 'Username or profile URL is required' });
    }

    const isLiveSync = ['github', 'leetcode', 'codeforces'].includes(platform);

    const codingStats = await updateCodingProfile(req.user._id, {
      [`codingStats.profiles.${platform}`]: username,
      [`codingStats.platformDetails.${platform}`]: {
        username,
        syncMode: isLiveSync ? 'synced' : 'linked',
        ...(!isLiveSync ? { note: 'Stored for profile analytics. Public API sync is not available for this platform yet.' } : {}),
        syncedAt: new Date(),
      },
      ...(platform === 'linkedin' ? { 'codingStats.linkedInConnected': true, 'socialLinks.linkedin': username } : {}),
      ...(platform === 'github' ? { 'socialLinks.github': `https://github.com/${username}` } : {}),
      ...(platform === 'leetcode' ? { 'socialLinks.leetcode': `https://leetcode.com/${username}` } : {}),
    });

    return res.json({ success: true, message: `${platform} profile linked`, codingStats });
  } catch (error) {
    console.error('linkCodingProfile error:', error);
    return res.status(500).json({ success: false, message: 'Unable to link coding profile' });
  }
};
