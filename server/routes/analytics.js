import express from 'express';
import auth from '../middleware/auth.js';
import requireRole from '../middleware/roleAuth.js';
import {
  logStudySession,
  getLearningProgress,
  getDashboardAnalytics,
  updateAcademicData,
  getSystemAnalytics,
  getPlacementAnalytics,
} from '../controllers/analyticsController.js';

const router = express.Router();

router.use(auth);

// @route   POST /api/analytics/study-session
// @desc    Log a study session for today
router.post('/study-session', logStudySession);

// @route   GET /api/analytics/progress
// @desc    Get daily learning progress (last N days)
router.get('/progress', getLearningProgress);

// @route   GET /api/analytics/dashboard
// @desc    Get aggregated dashboard analytics for current user
router.get('/dashboard', getDashboardAnalytics);

// @route   PUT /api/analytics/academic
// @desc    Update GPA, attendance, and subject breakdown
router.put('/academic', updateAcademicData);

// @route   GET /api/analytics/system
// @desc    System-wide analytics for admin
router.get('/system', requireRole('admin'), getSystemAnalytics);

// @route   GET /api/analytics/placements
// @desc    Placement analytics for admin and faculty
router.get('/placements', requireRole('admin'), getPlacementAnalytics);

export default router;
