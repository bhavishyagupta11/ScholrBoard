import express from 'express';
import auth from '../middleware/auth.js';
import {
  getMyProfile,
  getProfileByUserId,
  updateMyProfile,
  updateMyBasicInfo,
  updateCodingStats,
  deleteCertification,
} from '../controllers/profileController.js';
import requireRole from '../middleware/roleAuth.js';
import validateObjectId from '../middleware/validateObjectId.js';

const router = express.Router();

// All routes require authentication
router.use(auth);

// @route   GET /api/profile/me
// @desc    Get current user's full profile
router.get('/me', getMyProfile);

// @route   PUT /api/profile/me
// @desc    Update current user's extended profile (bio, skills, projects, etc.)
router.put('/me', updateMyProfile);

// @route   PUT /api/profile/me/basic
// @desc    Update name and avatar on the User document
router.put('/me/basic', updateMyBasicInfo);

// @route   PUT /api/profile/me/coding
// @desc    Update coding platform statistics
router.put('/me/coding', updateCodingStats);

// @route   DELETE /api/profile/certifications/:certId
// @desc    Remove a certification from user's profile
router.delete('/certifications/:certId', validateObjectId('certId'), deleteCertification);

// @route   GET /api/profile/:userId
// @desc    Get any user's profile (faculty 360 view / admin)
// @access  Faculty or Admin only
router.get('/:userId', requireRole('faculty', 'admin'), validateObjectId('userId'), getProfileByUserId);

export default router;
