/**
 * tickets.js — Support ticket routes
 *
 * All routes require authentication (auth middleware).
 * Role-specific access is enforced in the controller functions.
 */
import express from 'express';
import auth from '../middleware/auth.js';
import requireRole from '../middleware/roleAuth.js';
import validateObjectId from '../middleware/validateObjectId.js';
import {
  createTicket,
  getMyTickets,
  getAssignedTickets,
  getAllTickets,
  getTicketById,
  replyToTicket,
  assignTicket,
  updateTicketStatus,
  getTicketSummary,
} from '../controllers/ticketController.js';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';

const ticketCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Ticket creation limit exceeded. Please try again later.' },
  keyGenerator: (req, res) => req.user?._id?.toString() || ipKeyGenerator(req, res)
});

const router = express.Router();

// All ticket routes require authentication
router.use(auth);

// @route   GET /api/tickets/summary
// @desc    Quick stats for dashboard widgets
// @access  Private — all authenticated roles
router.get('/summary', getTicketSummary);

// @route   GET /api/tickets/all
// @desc    Get all tickets (admin only)
// @access  Private — Admin
router.get('/all', requireRole('admin'), getAllTickets);

// @route   GET /api/tickets/assigned
// @desc    Get tickets assigned to logged-in faculty/coordinator
// @access  Private — faculty, admin
router.get(
  '/assigned',
  requireRole('faculty', 'admin'),
  getAssignedTickets
);

// @route   POST /api/tickets
// @desc    Create a new support ticket
// @access  Private — student, faculty
router.post(
  '/',
  requireRole('student', 'faculty'),
  ticketCreateLimiter,
  createTicket
);

// @route   GET /api/tickets
// @desc    Get tickets created by logged-in user
// @access  Private — all authenticated roles
router.get('/', getMyTickets);

// @route   GET /api/tickets/:id
// @desc    Get single ticket with message thread
// @access  Private — ticket creator, assignee, or admin (enforced in controller)
router.get('/:id', validateObjectId('id'), getTicketById);

// @route   POST /api/tickets/:id/reply
// @desc    Add reply to a ticket
// @access  Private — ticket creator, assignee, or admin (enforced in controller)
router.post('/:id/reply', validateObjectId('id'), replyToTicket);

// @route   PATCH /api/tickets/:id/assign
// @desc    Assign a ticket to a user
// @access  Private — Admin only
router.patch('/:id/assign', requireRole('admin'), validateObjectId('id'), assignTicket);

// @route   PATCH /api/tickets/:id/status
// @desc    Update ticket status
// @access  Private — Admin only
router.patch('/:id/status', requireRole('admin'), validateObjectId('id'), updateTicketStatus);

export default router;
