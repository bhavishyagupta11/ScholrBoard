import express from 'express';
import auth from '../middleware/auth.js';
import requireRole from '../middleware/roleAuth.js';
import validateObjectId from '../middleware/validateObjectId.js';
import {
  createOdRequest,
  getMyOds,
  updateOdRequest,
  getPendingOds,
  reviewOdRequest,
  getAllOds
} from '../controllers/odController.js';

const router = express.Router();

// All OD routes require authentication
router.use(auth);

// Student Endpoints
router.post('/request', requireRole('student'), createOdRequest);
router.get('/my', requireRole('student'), getMyOds);
router.put('/request/:id', requireRole('student'), validateObjectId('id'), updateOdRequest);

// Faculty Endpoints
router.get('/pending', requireRole('faculty'), getPendingOds);
router.put('/review/:id', requireRole('faculty'), validateObjectId('id'), reviewOdRequest);

// Admin Endpoints (Read-only lookup)
router.get('/', requireRole('admin'), getAllOds);

export default router;
