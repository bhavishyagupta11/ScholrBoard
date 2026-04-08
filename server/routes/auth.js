import express from 'express';
import { registerUser, syncUserData, getUserProfile } from '../controllers/authController.js';
import { verifyFirebaseToken } from '../middleware/verifyFirebaseToken.js';

const router = express.Router();

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Private (requires Firebase token)
router.post('/register', verifyFirebaseToken, registerUser);

// @route   POST /api/auth/sync
// @desc    Sync user data after Firebase authentication
// @access  Private (requires Firebase token)
router.post('/sync', verifyFirebaseToken, syncUserData);

// @route   GET /api/auth/profile
// @desc    Get user profile
// @access  Private (requires Firebase token)
router.get('/profile', verifyFirebaseToken, getUserProfile);

export default router;