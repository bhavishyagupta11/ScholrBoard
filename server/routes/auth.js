import express from 'express';
import {
  registerUser,
  loginUser,
  getMe,
  refreshToken,
} from '../controllers/authController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// @route   POST /api/auth/register
// @desc    Register a new user
router.post('/register', registerUser);

// @route   POST /api/auth/login
// @desc    Login and get JWT
router.post('/login', loginUser);

// @route   GET /api/auth/me
// @desc    Get current user profile
router.get('/me', auth, getMe);

// @route   POST /api/auth/refresh
// @desc    Refresh server JWT
router.post('/refresh', auth, refreshToken);

export default router;