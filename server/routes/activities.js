import express from 'express';
import auth from '../middleware/auth.js';
import requireRole from '../middleware/roleAuth.js';
import {
  createActivity,
  getMyActivities,
  getActivityById,
  updateActivity,
  archiveActivity,
  getPendingActivities,
  reviewActivity,
} from '../controllers/activityController.js';

const router = express.Router();

router.use(auth); // all routes require authentication

// ─── Student routes ───────────────────────────────────────────────────────────

// @route   POST /api/activities
// @desc    Submit a new activity
router.post('/', createActivity);

// @route   GET /api/activities/my
// @desc    Get current student's activities
router.get('/my', getMyActivities);

// ─── Faculty / Admin routes ───────────────────────────────────────────────────

// @route   GET /api/activities/pending/all
// @desc    Get all pending activities for review
router.get('/pending/all', requireRole('faculty', 'admin'), getPendingActivities);

// @route   GET /api/activities/:id
// @desc    Get a specific activity (student sees their own, faculty sees all)
router.get('/:id', getActivityById);

// @route   PUT /api/activities/:id
// @desc    Update a pending activity (student only)
router.put('/:id', updateActivity);

// @route   DELETE /api/activities/:id
// @desc    Archive (soft-delete) a pending activity
router.delete('/:id', archiveActivity);

// @route   PUT /api/activities/:id/review
// @desc    Approve or reject an activity
router.put('/:id/review', requireRole('faculty', 'admin'), reviewActivity);

export default router;
