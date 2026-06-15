/**
 * tracks.js — Career track routes
 *
 * UI personalization routes for the Career Track system.
 * Tracks are cosmetic only — no authorization impact.
 */
import express from 'express';
import auth from '../middleware/auth.js';
import { getTracks, setMyTrack } from '../controllers/trackController.js';

const router = express.Router();

// @route   GET /api/tracks
// @desc    Get all active career tracks
// @access  Public (needed for onboarding before login)
router.get('/', getTracks);

// @route   PATCH /api/tracks/set
// @desc    Set the career track for the logged-in user (UI personalization only)
// @access  Private — authenticated user
router.patch('/set', auth, setMyTrack);

export default router;
