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

import { normalizeLinkedInInput } from '../services/providers/linkedinProvider.js';

export const linkCodingProfile = async (req, res) => {
  try {
    const { platform } = req.params;
    const rawInput = req.body.username;
    const supported = ['geeksforgeeks', 'hackerrank', 'codechef', 'linkedin', 'github', 'leetcode', 'codeforces'];

    if (!supported.includes(platform)) {
      return res.status(400).json({ success: false, message: 'Unsupported platform' });
    }
    if (!rawInput || (typeof rawInput === 'string' && !rawInput.trim())) {
      return res.status(400).json({ success: false, message: 'Username or profile URL is required' });
    }

    let username = normalizeUsername(rawInput);
    let linkedInProfileUrl = null;
    let linkedInVanity = username;

    if (platform === 'linkedin') {
      try {
        const norm = normalizeLinkedInInput(rawInput);
        linkedInProfileUrl = norm.profileUrl;
        linkedInVanity = norm.vanityName;
        username = linkedInVanity;
      } catch (err) {
        return res.status(400).json({ success: false, message: err.message });
      }
    }

    const isLiveSync = ['github', 'leetcode', 'codeforces'].includes(platform);
    const now = new Date();

    const codingStats = await updateCodingProfile(req.user._id, {
      [`codingStats.profiles.${platform}`]: username,
      [`codingStats.platformDetails.${platform}`]: {
        username,
        syncMode: isLiveSync ? 'synced' : 'linked',
        ...(!isLiveSync ? { note: platform === 'linkedin' ? 'User-provided LinkedIn profile reference. Identity and activity metrics are unverified by OAuth provider.' : 'Stored for profile analytics. Public API sync is not available for this platform yet.' } : {}),
        syncedAt: now,
        ...(platform === 'linkedin' ? { profileUrl: linkedInProfileUrl, connectionStatus: 'LINKED', syncStatus: 'UNAVAILABLE' } : {}),
      },
      ...(platform === 'linkedin' ? {
        'codingStats.linkedInConnected': true,
        'socialLinks.linkedin': linkedInProfileUrl,
        'platformSyncStates.linkedin.connectionStatus': 'LINKED',
        'platformSyncStates.linkedin.syncStatus': 'UNAVAILABLE',
        'platformSyncStates.linkedin.error': 'Activity metrics unavailable. Profile reference is user-provided (unverified by provider).',
        'codingStats.rawMetrics.linkedin': {
          profileUrl: linkedInProfileUrl,
          vanityName: linkedInVanity,
          memberId: null,
          identityVerified: false,
          followers: null,
          connections: null,
          activityMetricsAvailable: false,
          reason: 'User-provided profile reference. OAuth identity verification and activity metrics are unavailable.',
        },
      } : {}),
      ...(platform === 'github' ? { 'socialLinks.github': `https://github.com/${username}` } : {}),
      ...(platform === 'leetcode' ? { 'socialLinks.leetcode': `https://leetcode.com/${username}` } : {}),
    });

    return res.json({ success: true, message: `${platform} profile linked`, codingStats });
  } catch (error) {
    console.error('linkCodingProfile error:', error);
    return res.status(500).json({ success: false, message: 'Unable to link coding profile' });
  }
};

export const unlinkCodingProfile = async (req, res) => {
  try {
    const { platform } = req.params;
    const supported = ['geeksforgeeks', 'hackerrank', 'codechef', 'linkedin', 'github', 'leetcode', 'codeforces'];

    if (!supported.includes(platform)) {
      return res.status(400).json({ success: false, message: 'Unsupported platform' });
    }

    const unsets = {
      [`codingStats.profiles.${platform}`]: 1,
      [`codingStats.platformDetails.${platform}`]: 1,
      [`socialLinks.${platform}`]: 1,
      ...(platform === 'linkedin' ? { 'codingStats.linkedInConnected': 1, 'codingStats.rawMetrics.linkedin': 1 } : {}),
    };

    const sets = {
      'codingStats.lastUpdated': new Date(),
      ...(platform === 'linkedin' ? {
        'platformSyncStates.linkedin.connectionStatus': 'UNLINKED',
        'platformSyncStates.linkedin.syncStatus': 'NOT_CONNECTED',
        'platformSyncStates.linkedin.error': null,
      } : {}),
    };

    const profile = await Profile.findOneAndUpdate(
      { userId: req.user._id },
      { $unset: unsets, $set: sets },
      { new: true, runValidators: true }
    );

    return res.json({ success: true, message: `${platform} profile unlinked`, codingStats: profile?.codingStats });
  } catch (error) {
    console.error('unlinkCodingProfile error:', error);
    return res.status(500).json({ success: false, message: 'Unable to unlink coding profile' });
  }
};
