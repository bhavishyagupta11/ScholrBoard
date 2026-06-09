import express from 'express';
import auth from '../middleware/auth.js';
import requireRole from '../middleware/roleAuth.js';
import {
  createEvent,
  getMyEvents,
  registerForEvent,
  getAllEvents,
  updateEvent,
  deleteEvent,
} from '../controllers/eventController.js';

const router = express.Router();

router.use(auth);

// @route   GET /api/events/my
// @desc    Get events relevant to current user
router.get('/my', getMyEvents);

// @route   POST /api/events/:id/register
// @desc    Register for an event
router.post('/:id/register', registerForEvent);

// @route   GET /api/events
// @desc    Admin/Faculty: get all events
router.get('/', requireRole('admin', 'faculty'), getAllEvents);

// @route   POST /api/events
// @desc    Admin/Faculty: create an event
router.post('/', requireRole('admin', 'faculty'), createEvent);

// @route   PUT /api/events/:id
// @desc    Admin: update an event
router.put('/:id', requireRole('admin'), updateEvent);

// @route   DELETE /api/events/:id
// @desc    Admin: delete an event
router.delete('/:id', requireRole('admin'), deleteEvent);

export default router;
