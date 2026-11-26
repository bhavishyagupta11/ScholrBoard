import express from 'express';
import auth from '../middleware/auth.js';
import requireRole from '../middleware/roleAuth.js';
import validateObjectId from '../middleware/validateObjectId.js';
import {
  createAnnouncement,
  getAllAnnouncements,
  updateAnnouncement,
  getMyAnnouncements,
  deleteAnnouncement
} from '../controllers/announcementController.js';

const router = express.Router();

// All routes require authentication
router.use(auth);

// Admin Endpoints
router.get('/', requireRole('admin'), getAllAnnouncements);
router.post('/', requireRole('admin'), createAnnouncement);
router.put('/:id', requireRole('admin'), validateObjectId('id'), updateAnnouncement);
router.delete('/:id', requireRole('admin'), validateObjectId('id'), deleteAnnouncement);

// Universal Endpoints
router.get('/my', getMyAnnouncements);

export default router;
