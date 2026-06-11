import express from 'express';
import auth from '../middleware/auth.js';
import requireRole from '../middleware/roleAuth.js';
import validateObjectId from '../middleware/validateObjectId.js';
import {
  createAnnouncement,
  getMyAnnouncements,
  deleteAnnouncement
} from '../controllers/announcementController.js';

const router = express.Router();

// All routes require authentication
router.use(auth);

// Admin Endpoints
router.post('/', requireRole('admin'), createAnnouncement);
router.delete('/:id', requireRole('admin'), validateObjectId('id'), deleteAnnouncement);

// Universal Endpoints
router.get('/my', getMyAnnouncements);

export default router;
