import express from 'express';
import {
  registerUser,
  loginUser,
  getMe,
  refreshToken,
  forgotPassword,
  resetPassword,
} from '../controllers/authController.js';
import auth from '../middleware/auth.js';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many requests. Please try again later.' },
  keyGenerator: (req, res) => ipKeyGenerator(req, res),
});

const router = express.Router();

// @route   POST /api/auth/register
// @desc    Register a new user
router.post('/register', registerUser);

// @route   POST /api/auth/login
// @desc    Login and get JWT
router.post('/login', loginUser);

// @route   POST /api/auth/forgot-password
// @desc    Send password reset email (student and faculty only)
// @access  Public
router.post('/forgot-password', authLimiter, forgotPassword);

// @route   POST /api/auth/reset-password
// @desc    Reset password using token
// @access  Public
router.post('/reset-password', authLimiter, resetPassword);

// @route   GET /api/auth/me
// @desc    Get current user profile
router.get('/me', auth, getMe);

// @route   POST /api/auth/refresh
// @desc    Refresh server JWT
router.post('/refresh', auth, refreshToken);

export default router;