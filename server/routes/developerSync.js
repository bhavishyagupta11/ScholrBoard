import express from 'express';
import auth from '../middleware/auth.js';
import requireRole from '../middleware/roleAuth.js';
import {
  syncGithub,
  syncLeetcode,
  syncCodeforces,
  syncAllPlatforms,
} from '../controllers/developerSyncController.js';

const router = express.Router();

// All developer sync endpoints require authentication and student role
router.use(auth);
router.use(requireRole('student'));

router.post('/sync/github', syncGithub);
router.post('/sync/leetcode', syncLeetcode);
router.post('/sync/codeforces', syncCodeforces);
router.post('/sync/all', syncAllPlatforms);

export default router;
