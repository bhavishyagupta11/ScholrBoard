import express from 'express';
import auth from '../middleware/auth.js';
import requireRole from '../middleware/roleAuth.js';
import validateObjectId from '../middleware/validateObjectId.js';
import {
  createPlacement,
  getMyPlacements,
  applyToPlacement,
  getAllPlacements,
  updatePlacement,
  deletePlacement,
} from '../controllers/placementController.js';

const router = express.Router();

router.use(auth);

// @route   GET /api/placements/my
// @desc    Get placements personalized for current student (filtered by dept, semester, etc.)
router.get('/my', requireRole('student'), getMyPlacements);

// @route   POST /api/placements/:id/apply
// @desc    Apply to a placement
router.post('/:id/apply', requireRole('student'), validateObjectId('id'), applyToPlacement);

// @route   GET /api/placements
// @desc    Admin: get all placements
router.get('/', requireRole('admin', 'faculty'), getAllPlacements);

// @route   POST /api/placements
// @desc    Admin: create a placement
router.post('/', requireRole('admin'), createPlacement);

// @route   PUT /api/placements/:id
// @desc    Admin: update a placement
router.put('/:id', requireRole('admin'), validateObjectId('id'), updatePlacement);

// @route   DELETE /api/placements/:id
// @desc    Admin: delete a placement
router.delete('/:id', requireRole('admin'), validateObjectId('id'), deletePlacement);

export default router;
