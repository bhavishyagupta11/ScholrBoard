import express from 'express';
import auth from '../middleware/auth.js';
import requireRole from '../middleware/roleAuth.js';
import validateObjectId from '../middleware/validateObjectId.js';
import {
  createScholarship,
  publishScholarship,
  closeScholarship,
  getMatchingScholarships,
  applyToScholarship,
  getScholarshipApplications,
  reviewScholarshipApplication,
  getMyScholarshipHistory,
  getAllScholarships
} from '../controllers/scholarshipController.js';

const router = express.Router();

// All routes require authentication
router.use(auth);

// Student Endpoints
router.get('/matching', requireRole('student'), getMatchingScholarships);
router.post('/:id/apply', requireRole('student'), validateObjectId('id'), applyToScholarship);
router.get('/my', requireRole('student'), getMyScholarshipHistory);

// Admin-only Endpoints
router.post('/', requireRole('admin'), createScholarship);
router.put('/:id/publish', requireRole('admin'), validateObjectId('id'), publishScholarship);
router.put('/:id/close', requireRole('admin'), validateObjectId('id'), closeScholarship);
router.get('/scholarship/:id', requireRole('admin'), validateObjectId('id'), getScholarshipApplications);
router.put('/application/:id', requireRole('admin'), validateObjectId('id'), reviewScholarshipApplication);

// Universal Listings
router.get('/', getAllScholarships);

export default router;
