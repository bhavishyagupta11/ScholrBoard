import express from 'express';
import auth from '../middleware/auth.js';
import {
  linkCodingProfile,
  syncCodeforces,
  syncGithub,
  syncLeetcode,
} from '../controllers/codingController.js';

const router = express.Router();

router.use(auth);

router.post('/sync-github', syncGithub);
router.post('/sync-leetcode', syncLeetcode);
router.post('/sync-codeforces', syncCodeforces);
router.post('/link/:platform', linkCodingProfile);

export default router;
