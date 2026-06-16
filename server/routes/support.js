import express from 'express';
import auth from '../middleware/auth.js';
import requireRole from '../middleware/roleAuth.js';
import { createContactMessage, getContactMessages } from '../controllers/supportController.js';
import rateLimit from 'express-rate-limit';

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many requests. Please try again later.' }
});

const router = express.Router();

// @route   POST /api/support/contact
// @desc    Submit a contact query
// @access  Public
router.post('/contact', contactLimiter, createContactMessage);

// @route   GET /api/support/contact
// @desc    Get all contact queries (paginated, sorted by newest)
// @access  Private — Admin only
router.get('/contact', auth, requireRole('admin'), getContactMessages);

export default router;
