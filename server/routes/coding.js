import express from 'express';
import auth from '../middleware/auth.js';
import {
  linkCodingProfile,
} from '../controllers/codingController.js';

const router = express.Router();

router.use(auth);

router.post('/link/:platform', linkCodingProfile);

export default router;
