/**
 * ticketController.js — Support ticket CRUD and workflow operations.
 *
 * Permission matrix:
 *   student:               create, view own, reply to own
 *   faculty:               create (to admin), view assigned, reply
 *   coordinator: create (to admin), view dept tickets, reply
 *   admin:                 view all, assign, update status, resolve, close
 *
 * Notifications are fired after each state change.
 * Failures in notification creation never affect the main operation.
 */
import SupportTicket from '../models/SupportTicket.js';
import SupportTicketMessage from '../models/SupportTicketMessage.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { escapeHtml } from '../utils/sanitize.js';

// ─── Helper: create notification (fire-and-forget style) ─────────────────────

export const notifyTicketEvent = async (userId, eventName, title, message, ticketId) => {
  try {
    await Notification.create({
      userId,
      type: eventName,
      title,
      message,
      relatedId: ticketId,
      relatedModel: 'SupportTicket',
      actionUrl: '/support',
      priority: 'medium',
    });
  } catch (err) {
    console.error(`[ticketController] Failed to create notification (${eventName}):`, err.message);
  }
};

// ─── Determine flow from creator role and targetRole ─────────────────────────

const determineFlow = (creator, targetRole) => {
  const creatorRole = creator.role;
  if (creatorRole === 'student' && targetRole === 'faculty') return 'student_to_faculty';
  if (creatorRole === 'student' && targetRole === 'admin')   return 'student_to_admin';
  if (creatorRole === 'faculty' && targetRole === 'admin') {
    if (creator.facultyLevel === 'coordinator') return 'coordinator_to_admin';
    return 'faculty_to_admin';
  }
  return null;
};

// ─── CREATE TICKET ────────────────────────────────────────────────────────────

/**
 * @desc    Create a new support ticket
 * @route   POST /api/tickets
 * @access  Private — student, faculty
 */
export const createTicket = async (req, res) => {
  try {
    const { subject, description, category, priority, targetRole, assignedToId } = req.body;
    const creator = req.user;

    if (!subject || !description || !category || !targetRole) {
      return res.status(400).json({
        success: false,
        message: 'subject, description, category, and targetRole are required.',
      });
    }

    // Validate targetRole for this creator
    const flow = determineFlow(creator, targetRole);
    if (!flow) {
      return res.status(400).json({
        success: false,
        message: `Invalid targetRole '${targetRole}' for role '${creator.role}'.`,
      });
    }

    // Build ticket document
    const ticketData = {
      subject:     escapeHtml(subject.trim()),
      description: escapeHtml(description.trim()),
      category,
      priority:    priority || 'medium',
      createdBy:   creator._id,
      targetRole,
      flow,
      department:  creator.department || undefined,
    };

    // V2 fallback assignment chain: Advisor -> Coordinator -> Admin
    if (flow === 'student_to_faculty') {
      if (creator.advisorId) {
        ticketData.assignedTo = creator.advisorId;
      } else {
        // Find coordinator in student's department
        const coordinator = await User.findOne({
          department: creator.department,
          role: 'faculty', 
          facultyLevel: 'coordinator',
          isActive: true
        });

        if (coordinator) {
          ticketData.assignedTo = coordinator._id;
        } else {
          // Find any active admin
          const admin = await User.findOne({ role: 'admin', isActive: true });
          if (admin) {
            ticketData.assignedTo = admin._id;
          } else {
            ticketData.status = 'unassigned';
          }
        }
      }
    } else if (assignedToId) {
      // Optional: admin can pre-assign, or allow explicit assignedToId
      const assignee = await User.findById(assignedToId).select('_id role');
      if (assignee) ticketData.assignedTo = assignee._id;
    }

    const ticket = await SupportTicket.create(ticketData);

    // Auto-create first message from the description
    await SupportTicketMessage.create({
      ticketId:  ticket._id,
      senderId:  creator._id,
      message:   escapeHtml(description.trim()),
      isInternal: false,
    });

    // Notify admin if targetRole is admin
    if (targetRole === 'admin') {
      const admins = await User.find({ role: 'admin', isActive: true }).select('_id email name');
      for (const admin of admins) {
        await notifyTicketEvent(
          admin._id,
          'TicketCreated',
          `New support ticket: ${ticket.ticketNumber}`,
          `${creator.name} opened a ticket: "${subject}"`,
          ticket._id
        );
      }
    }

    // Notify the assigned faculty if flow is student_to_faculty
    if (targetRole === 'faculty' && ticket.assignedTo) {
      await notifyTicketEvent(
        ticket.assignedTo,
        'TicketCreated',
        `New support ticket from ${creator.name}`,
        `Ticket ${ticket.ticketNumber}: "${subject}"`,
        ticket._id
      );
    }

    return res.status(201).json({
      success: true,
      message: 'Support ticket created successfully.',
      ticket,
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: Object.values(error.errors).map((e) => e.message),
      });
    }
    console.error('createTicket error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create ticket.' });
  }
};

// ─── GET MY TICKETS (creator view) ───────────────────────────────────────────

/**
 * @desc    Get tickets created by the logged-in user
 * @route   GET /api/tickets
 * @access  Private — all authenticated users
 */
export const getMyTickets = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = { createdBy: req.user._id };
    if (status && typeof status === 'string') query.status = status;

    const skip = (Number(page) - 1) * Number(limit);

    const [tickets, total] = await Promise.all([
      SupportTicket.find(query)
        .sort({ lastActivityAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('assignedTo', 'name role')
        .select('-__v'),
      SupportTicket.countDocuments(query),
    ]);

    return res.json({
      success: true,
      tickets,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
        totalItems: total,
      },
    });
  } catch (error) {
    console.error('getMyTickets error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch tickets.' });
  }
};

// ─── GET ASSIGNED TICKETS (faculty / coordinator view) ───────────────────────

/**
 * @desc    Get tickets assigned to the logged-in faculty or coordinator
 * @route   GET /api/tickets/assigned
 * @access  Private — faculty, admin
 */
export const getAssignedTickets = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const user = req.user;

    let query = {};

    const isCoordinator = (user.role === 'faculty' && user.facultyLevel === 'coordinator');

    if (user.role === 'admin') {
      // Admin sees all
      if (status && typeof status === 'string') query.status = status;
    } else if (isCoordinator) {
      // Coordinator sees department-level tickets
      query.department = user.department;
      if (status && typeof status === 'string') query.status = status;
    } else {
      // Faculty sees tickets assigned to them
      query.assignedTo = user._id;
      if (status && typeof status === 'string') query.status = status;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [tickets, total] = await Promise.all([
      SupportTicket.find(query)
        .sort({ lastActivityAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('createdBy', 'name role department studentId')
        .populate('assignedTo', 'name role')
        .select('-__v'),
      SupportTicket.countDocuments(query),
    ]);

    return res.json({
      success: true,
      tickets,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
        totalItems: total,
      },
    });
  } catch (error) {
    console.error('getAssignedTickets error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch assigned tickets.' });
  }
};

// ─── GET ALL TICKETS (admin view) ─────────────────────────────────────────────

/**
 * @desc    Get all tickets with filters
 * @route   GET /api/tickets/all
 * @access  Private — Admin only
 */
export const getAllTickets = async (req, res) => {
  try {
    const { status, flow, priority, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status && typeof status === 'string')   query.status   = status;
    if (flow)     query.flow     = flow;
    if (priority) query.priority = priority;

    const skip = (Number(page) - 1) * Number(limit);

    const [tickets, total] = await Promise.all([
      SupportTicket.find(query)
        .sort({ lastActivityAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('createdBy', 'name role department studentId facultyId')
        .populate('assignedTo', 'name role')
        .populate('resolvedBy', 'name role')
        .select('-__v'),
      SupportTicket.countDocuments(query),
    ]);

    // Summary counts for dashboard widget
    const [openCount, inProgressCount, resolvedCount, closedCount] = await Promise.all([
      SupportTicket.countDocuments({ status: 'open' }),
      SupportTicket.countDocuments({ status: 'in_progress' }),
      SupportTicket.countDocuments({ status: 'resolved' }),
      SupportTicket.countDocuments({ status: 'closed' }),
    ]);

    return res.json({
      success: true,
      tickets,
      summary: { open: openCount, in_progress: inProgressCount, resolved: resolvedCount, closed: closedCount },
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
        totalItems: total,
      },
    });
  } catch (error) {
    console.error('getAllTickets error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch tickets.' });
  }
};

// ─── GET TICKET BY ID ─────────────────────────────────────────────────────────

/**
 * @desc    Get a single ticket with its full message thread
 * @route   GET /api/tickets/:id
 * @access  Private — ticket creator, assignee, or admin
 */
export const getTicketById = async (req, res) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id)
      .populate('createdBy', 'name role department studentId facultyId')
      .populate('assignedTo', 'name role')
      .populate('resolvedBy', 'name role')
      .select('-__v');

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found.' });
    }

    // Access check: admin can see all; others can only see tickets they created or are assigned to
    const userId = String(req.user._id);
    const isAdmin = req.user.role === 'admin';
    const isCreator = String(ticket.createdBy._id) === userId;
    const isAssignee = ticket.assignedTo && String(ticket.assignedTo._id) === userId;
    const isCoordinator = (req.user.role === 'faculty' && req.user.facultyLevel === 'coordinator') &&
      ticket.department === req.user.department;

    if (!isAdmin && !isCreator && !isAssignee && !isCoordinator) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    // Fetch messages (hide internal notes from non-admins)
    const messageQuery = { ticketId: ticket._id };
    if (!isAdmin) messageQuery.isInternal = false;

    const messages = await SupportTicketMessage.find(messageQuery)
      .sort({ createdAt: 1 })
      .populate('senderId', 'name role avatar')
      .select('-__v');

    return res.json({ success: true, ticket, messages });
  } catch (error) {
    console.error('getTicketById error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch ticket.' });
  }
};

// ─── REPLY TO TICKET ──────────────────────────────────────────────────────────

/**
 * @desc    Add a message/reply to an existing ticket
 * @route   POST /api/tickets/:id/reply
 * @access  Private — ticket creator, assignee, or admin
 */
export const replyToTicket = async (req, res) => {
  try {
    const { message, isInternal } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message is required.' });
    }

    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found.' });
    }

    if (ticket.status === 'closed') {
      return res.status(400).json({ success: false, message: 'Cannot reply to a closed ticket.' });
    }

    // Access check
    const userId = String(req.user._id);
    const isAdmin = req.user.role === 'admin';
    const isCreator = String(ticket.createdBy) === userId;
    const isAssignee = ticket.assignedTo && String(ticket.assignedTo) === userId;
    const isCoordinator = (req.user.role === 'faculty' && req.user.facultyLevel === 'coordinator') &&
      ticket.department === req.user.department;

    if (!isAdmin && !isCreator && !isAssignee && !isCoordinator) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    // isInternal only allowed for admin
    const msgInternal = isAdmin && isInternal === true;

    const ticketMessage = await SupportTicketMessage.create({
      ticketId:   ticket._id,
      senderId:   req.user._id,
      message:    escapeHtml(message.trim()),
      isInternal: msgInternal,
    });

    // Update lastActivityAt and status
    const updates = { lastActivityAt: new Date() };
    // If creator replied, set to waiting_for_response for assignee; if assignee replied, set to in_progress
    if (ticket.status === 'open' && isCreator) updates.status = 'open';
    if (ticket.status === 'open' && (isAdmin || isAssignee)) updates.status = 'in_progress';
    if (!isCreator && ticket.status !== 'resolved') updates.status = 'waiting_for_response';
    if (isCreator && ticket.status === 'waiting_for_response') updates.status = 'open';

    await SupportTicket.findByIdAndUpdate(ticket._id, updates);

    // Notify the other party (skip internal notes)
    if (!msgInternal) {
      const notifyTarget = isCreator ? ticket.assignedTo : ticket.createdBy;
      if (notifyTarget) {
        await notifyTicketEvent(
          notifyTarget,
          'TicketReply',
          `New reply on ticket ${ticket.ticketNumber}`,
          `${req.user.name} replied to your ticket: "${ticket.subject}"`,
          ticket._id
        );
      }
    }

    const populated = await SupportTicketMessage.findById(ticketMessage._id)
      .populate('senderId', 'name role avatar');

    return res.status(201).json({
      success: true,
      message: 'Reply added successfully.',
      ticketMessage: populated,
    });
  } catch (error) {
    console.error('replyToTicket error:', error);
    return res.status(500).json({ success: false, message: 'Failed to add reply.' });
  }
};

// ─── ASSIGN TICKET (Admin only) ───────────────────────────────────────────────

/**
 * @desc    Assign a ticket to a user
 * @route   PATCH /api/tickets/:id/assign
 * @access  Private — Admin only
 */
export const assignTicket = async (req, res) => {
  try {
    const { assignedToId } = req.body;

    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });

    const assignee = await User.findById(assignedToId).select('_id name role email');
    if (!assignee) return res.status(404).json({ success: false, message: 'Assignee not found.' });

    const updated = await SupportTicket.findByIdAndUpdate(
      req.params.id,
      { assignedTo: assignee._id, status: 'in_progress', lastActivityAt: new Date() },
      { new: true }
    ).populate('createdBy assignedTo', 'name role');

    // Notify assignee
    await notifyTicketEvent(
      assignee._id,
      'TicketAssigned',
      `Ticket assigned to you: ${ticket.ticketNumber}`,
      `You have been assigned ticket "${ticket.subject}"`,
      ticket._id
    );

    // Notify creator
    await notifyTicketEvent(
      ticket.createdBy,
      'TicketAssigned',
      `Your ticket has been assigned`,
      `Ticket ${ticket.ticketNumber} is now assigned to ${assignee.name}`,
      ticket._id
    );

    return res.json({ success: true, message: 'Ticket assigned.', ticket: updated });
  } catch (error) {
    console.error('assignTicket error:', error);
    return res.status(500).json({ success: false, message: 'Failed to assign ticket.' });
  }
};

// ─── UPDATE TICKET STATUS (Admin only) ───────────────────────────────────────

/**
 * @desc    Update ticket status (admin: resolve, close, reopen)
 * @route   PATCH /api/tickets/:id/status
 * @access  Private — Admin only
 */
export const updateTicketStatus = async (req, res) => {
  try {
    const { status, resolutionNote } = req.body;
    const validStatuses = ['open', 'in_progress', 'waiting_for_response', 'resolved', 'closed'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });

    const updates = { status, lastActivityAt: new Date() };

    if (status === 'resolved') {
      updates.resolvedBy = req.user._id;
      updates.resolvedAt = new Date();
      if (resolutionNote) updates.resolutionNote = resolutionNote.trim();
    }
    if (status === 'closed') {
      updates.closedAt = new Date();
      if (!ticket.resolvedAt) {
        updates.resolvedBy = req.user._id;
        updates.resolvedAt = new Date();
      }
    }

    const updated = await SupportTicket.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true }
    ).populate('createdBy assignedTo resolvedBy', 'name role');

    // Map status to notification type
    const notifType = status === 'resolved' ? 'TicketResolved' : 'TicketReply';

    const notifTitle = status === 'resolved' ? `Ticket ${ticket.ticketNumber} resolved`
      : status === 'closed' ? `Ticket ${ticket.ticketNumber} closed`
      : `Ticket ${ticket.ticketNumber} status updated`;

    // Notify creator
    await notifyTicketEvent(
      ticket.createdBy,
      notifType,
      notifTitle,
      `Your ticket "${ticket.subject}" has been ${status}.`,
      ticket._id
    );

    return res.json({ success: true, message: `Ticket status updated to ${status}.`, ticket: updated });
  } catch (error) {
    console.error('updateTicketStatus error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update ticket status.' });
  }
};

// ─── GET TICKET SUMMARY (for dashboard widgets) ───────────────────────────────

/**
 * @desc    Get quick ticket summary stats
 * @route   GET /api/tickets/summary
 * @access  Private — authenticated users
 */
export const getTicketSummary = async (req, res) => {
  try {
    const user = req.user;
    let query = {};

    if (user.role === 'student') {
      query.createdBy = user._id;
    } else if (user.role === 'faculty' && user.facultyLevel !== 'coordinator') {
      query.assignedTo = user._id;
    } else if ((user.role === 'faculty' && user.facultyLevel === 'coordinator')) {
      query.department = user.department;
    }
    // admin: no filter = all tickets

    const [open, in_progress, resolved, recent] = await Promise.all([
      SupportTicket.countDocuments({ ...query, status: 'open' }),
      SupportTicket.countDocuments({ ...query, status: 'in_progress' }),
      SupportTicket.countDocuments({ ...query, status: 'resolved' }),
      SupportTicket.find(query)
        .sort({ lastActivityAt: -1 })
        .limit(3)
        .populate('createdBy', 'name role')
        .select('ticketNumber subject status priority lastActivityAt createdBy'),
    ]);

    return res.json({
      success: true,
      summary: { open, in_progress, resolved, total: open + in_progress + resolved },
      recentTickets: recent,
    });
  } catch (error) {
    console.error('getTicketSummary error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch ticket summary.' });
  }
};
