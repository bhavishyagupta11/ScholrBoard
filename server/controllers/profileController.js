/**
 * profileController.js — Full CRUD for user profiles
 *
 * Profile is stored in a separate document from User (see models/Profile.js).
 * All mutations go through here — no direct writes from other controllers.
 *
 * Endpoints:
 *   GET    /api/profile/me          → get current user's profile
 *   GET    /api/profile/:userId     → get any user's profile (for faculty 360 view)
 *   PUT    /api/profile/me          → update profile fields
 *   POST   /api/profile/me/skills   → add/remove a skill
 *   PUT    /api/profile/me/coding   → update coding platform stats
 */
import Profile from '../models/Profile.js';
import User from '../models/User.js';

// ─── GET current user's own profile ──────────────────────────────────────────
export const getMyProfile = async (req, res) => {
  try {
    // Find profile and populate user fields needed by the UI
    let profile = await Profile.findOne({ userId: req.user._id })
      .populate('userId', 'name email role department semester studentId facultyId avatar verified lastLogin');

    // If profile doesn't exist yet (shouldn't happen — created on register), create it
    if (!profile) {
      profile = await Profile.create({ userId: req.user._id });
      profile = await profile.populate('userId', 'name email role department semester studentId facultyId avatar verified lastLogin');
    }

    return res.json({ success: true, profile });
  } catch (error) {
    console.error('getMyProfile error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
};

// ─── GET any user's profile (Faculty / Admin use) ────────────────────────────
export const getProfileByUserId = async (req, res) => {
  try {
    const { userId } = req.params;

    const profile = await Profile.findOne({ userId })
      .populate('userId', 'name email role department semester studentId facultyId avatar verified');

    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    // Faculty can only view student profiles in their own department
    if (req.user.role === 'faculty') {
      const targetUser = profile.userId;
      if (
        targetUser.role !== 'student' ||
        (targetUser.department && targetUser.department !== req.user.department)
      ) {
        return res.status(403).json({
          success: false,
          message: 'Access denied — you can only view student profiles in your department',
        });
      }
    }

    return res.json({ success: true, profile });
  } catch (error) {
    console.error('getProfileByUserId error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
};

// ─── UPDATE current user's profile ───────────────────────────────────────────
export const updateMyProfile = async (req, res) => {
  try {
    const {
      bio, phone, dateOfBirth, gender,
      gpa, attendanceOverall,
      skills, interests, careerGoal, learningGoalMinutesPerDay, targetCompanies,
      socialLinks,
      projects, education, certifications,
    } = req.body;

    // Build update object — only include fields actually provided
    const updates = {};
    if (bio                  !== undefined) updates.bio                  = bio;
    // Empty phone must not be stored as "" (fails regex validator on Profile schema)
    if (phone                !== undefined) updates.phone                = phone === '' || phone == null ? null : phone;
    if (dateOfBirth          !== undefined) updates.dateOfBirth          = dateOfBirth;
    if (gender               !== undefined) updates.gender               = gender;
    if (gpa                  !== undefined) updates.gpa                  = gpa === '' || gpa == null ? null : gpa;
    if (attendanceOverall    !== undefined) updates.attendanceOverall    = attendanceOverall === '' || attendanceOverall == null ? null : attendanceOverall;
    if (skills               !== undefined) updates.skills               = skills;
    if (interests            !== undefined) updates.interests            = interests;
    if (careerGoal           !== undefined) updates.careerGoal           = careerGoal;
    if (learningGoalMinutesPerDay !== undefined) updates.learningGoalMinutesPerDay = learningGoalMinutesPerDay;
    if (targetCompanies      !== undefined) updates.targetCompanies      = targetCompanies;
    if (socialLinks          !== undefined) updates.socialLinks          = socialLinks;
    if (projects             !== undefined) updates.projects             = projects;
    if (education            !== undefined) updates.education            = education;
    if (certifications       !== undefined) updates.certifications       = certifications;

    const profile = await Profile.findOneAndUpdate(
      { userId: req.user._id },
      { $set: updates },
      { new: true, runValidators: true, upsert: true }
    ).populate('userId', 'name email role department semester studentId facultyId avatar verified');

    return res.json({
      success: true,
      message: 'Profile updated successfully',
      profile,
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: 'Validation error', errors: messages });
    }
    console.error('updateMyProfile error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
};

// ─── UPDATE user's basic info (name, department — stored on User doc) ─────────
export const updateMyBasicInfo = async (req, res) => {
  try {
    const { name, avatar } = req.body;

    const allowedUpdates = {};
    if (name   !== undefined) allowedUpdates.name   = name.trim();
    if (avatar !== undefined) allowedUpdates.avatar = avatar;

    if (Object.keys(allowedUpdates).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: allowedUpdates },
      { new: true, runValidators: true }
    ).select('-__v -password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.json({ success: true, message: 'Basic info updated', user });
  } catch (error) {
    console.error('updateMyBasicInfo error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update user info' });
  }
};

// ─── UPDATE coding platform stats ────────────────────────────────────────────
export const updateCodingStats = async (req, res) => {
  try {
    const { leetcodeProblemsSolved, leetcodeContestRating, leetcodeStreak,
            githubContributions, codeforcesRating, hackerrankBadges } = req.body;

    const codingUpdate = { 'codingStats.lastUpdated': new Date() };
    if (leetcodeProblemsSolved !== undefined) codingUpdate['codingStats.leetcodeProblemsSolved'] = leetcodeProblemsSolved;
    if (leetcodeContestRating  !== undefined) codingUpdate['codingStats.leetcodeContestRating']  = leetcodeContestRating;
    if (leetcodeStreak         !== undefined) codingUpdate['codingStats.leetcodeStreak']         = leetcodeStreak;
    if (githubContributions    !== undefined) codingUpdate['codingStats.githubContributions']    = githubContributions;
    if (codeforcesRating       !== undefined) codingUpdate['codingStats.codeforcesRating']       = codeforcesRating;
    if (hackerrankBadges       !== undefined) codingUpdate['codingStats.hackerrankBadges']       = hackerrankBadges;

    const profile = await Profile.findOneAndUpdate(
      { userId: req.user._id },
      { $set: codingUpdate },
      { new: true, upsert: true }
    );

    return res.json({ success: true, message: 'Coding stats updated', codingStats: profile.codingStats });
  } catch (error) {
    console.error('updateCodingStats error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update coding stats' });
  }
};
