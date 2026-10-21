import express from 'express';
import auth from '../middleware/auth.js';
import {
  linkCodingProfile,
  unlinkCodingProfile,
} from '../controllers/codingController.js';

const router = express.Router();

router.use(auth);

router.post('/link/:platform', linkCodingProfile);
router.delete('/link/:platform', unlinkCodingProfile);
router.post('/unlink/:platform', unlinkCodingProfile);

export default router;
