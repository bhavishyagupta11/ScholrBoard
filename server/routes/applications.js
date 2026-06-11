import express from 'express';
import auth from '../middleware/auth.js';
import requireRole from '../middleware/roleAuth.js';
import validateObjectId from '../middleware/validateObjectId.js';
import {
  applyToOpportunity,
  withdrawApplication,
  getOpportunityApplications,
  reviewApplicationStatus,
  scheduleInterview,
  getMyApplications
} from '../controllers/applicationController.js';

const router = express.Router();

// All routes require authentication
router.use(auth);

// Student Endpoints
router.post('/opportunity/:id/apply', requireRole('student'), validateObjectId('id'), applyToOpportunity);
router.post('/:id/withdraw', requireRole('student'), validateObjectId('id'), withdrawApplication);
router.get('/my', requireRole('student'), getMyApplications);

// Admin-only Endpoints
router.get('/opportunity/:id', requireRole('admin'), validateObjectId('id'), getOpportunityApplications);
router.put('/:id/status', requireRole('admin'), validateObjectId('id'), reviewApplicationStatus);
router.put('/:id/interview', requireRole('admin'), validateObjectId('id'), scheduleInterview);

export default router;
