import express from 'express';
import auth from '../middleware/auth.js';
import requireRole from '../middleware/roleAuth.js';
import validateObjectId from '../middleware/validateObjectId.js';
import {
  createOpportunity,
  publishOpportunity,
  closeOpportunity,
  getMatchingOpportunities,
  getAllOpportunities,
  getOpportunityById
} from '../controllers/opportunityController.js';

const router = express.Router();

// All routes require authentication
router.use(auth);

// Student Endpoint
router.get('/matching', requireRole('student'), getMatchingOpportunities);

// Admin / Faculty Universal Lists
router.get('/', getAllOpportunities);
router.get('/:id', validateObjectId('id'), getOpportunityById);

// Admin-only drive management
router.post('/', requireRole('admin'), createOpportunity);
router.put('/:id/publish', requireRole('admin'), validateObjectId('id'), publishOpportunity);
router.put('/:id/close', requireRole('admin'), validateObjectId('id'), closeOpportunity);

export default router;
