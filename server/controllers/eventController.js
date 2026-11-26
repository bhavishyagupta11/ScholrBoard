/**
 * eventController.js — University events management
 */
import Event from '../models/Event.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';

// Helper to notify matched users when an event is published
const notifyMatchedUsersForEvent = async (event, session) => {
  try {
    if (!event.isPublished || event.isCancelled) return;

    const userQuery = { isActive: true };
    if (event.targetRoles && !event.targetRoles.includes('all')) {
      userQuery.role = { $in: event.targetRoles };
    } else {
      userQuery.role = { $in: ['student', 'faculty', 'admin'] };
    }

    if (event.targetDepartments && event.targetDepartments.length > 0) {
      userQuery.department = { $in: event.targetDepartments };
    }

    if (event.targetSemesters && event.targetSemesters.length > 0) {
      userQuery.semester = { $in: event.targetSemesters };
    }

    const matchedUsers = await User.find(userQuery).select('_id');
    const notifications = matchedUsers.map((user) => ({
      userId: user._id,
      title: `New Event: ${event.title}`,
      message: `A new ${event.category} event "${event.title}" has been scheduled at ${event.venue || 'TBA'} for ${new Date(event.startDate).toLocaleDateString()}. Register now!`,
      type: 'event_new',
      relatedId: event._id,
      relatedModel: 'Event',
      actionUrl: '/student/dashboard',
      priority: 'medium',
    }));

    if (notifications.length > 0) {
      await Notification.insertMany(notifications, session ? { session } : undefined);
    }
    console.log(`[EVENT NOTIFICATION] Sent to ${notifications.length} matching users.`);
  } catch (error) {
    console.error('Error in notifyMatchedUsersForEvent:', error);
  }
};

const ALLOWED_EVENT_FIELDS = [
  'title',
  'description',
  'category',
  'bannerImage',
  'startDate',
  'endDate',
  'startTime',
  'venue',
  'isOnline',
  'meetingLink',
  'organizerName',
  'contactEmail',
  'targetRoles',
  'targetDepartments',
  'targetSemesters',
  'registrationDeadline',
  'maxAttendees',
  'requiresRegistration',
  'registrationLink',
  'tags',
  'isPublished',
  'isCancelled',
];

const pickEventPayload = (body = {}) => {
  const payload = {};
  for (const key of ALLOWED_EVENT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, key) && body[key] !== undefined) {
      payload[key] = body[key];
    }
  }
  return payload;
};

// ─── ADMIN/FACULTY: Create an event ──────────────────────────────────────────
export const createEvent = async (req, res) => {
  try {
    const payload = pickEventPayload(req.body);
    const event = await Event.create({ ...payload, createdBy: req.user._id });
    if (event.isPublished) {
      await notifyMatchedUsersForEvent(event);
    }
    return res.status(201).json({ success: true, message: 'Event created', event });
  } catch (error) {
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return res.status(400).json({
        success: false, message: 'Validation failed',
        errors: error.errors ? Object.values(error.errors).map((e) => e.message) : [error.message],
      });
    }
    console.error('createEvent error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create event' });
  }
};

// ─── GET events relevant to the current user ──────────────────────────────────
export const getMyEvents = async (req, res) => {
  try {
    const { category, upcoming = 'true', page = 1, limit = 10 } = req.query;

    const query = {
      isPublished: true,
      isCancelled: false,
      $or: [
        { targetRoles: 'all' },
        { targetRoles: req.user.role },
      ],
    };

    // Department filter
    if (req.user.department) {
      const deptTrimmed = req.user.department.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$and = [
        {
          $or: [
            { targetDepartments: { $size: 0 } },       // no restriction
            { targetDepartments: new RegExp(`^${deptTrimmed}$`, 'i') }, // or matches user's dept
          ],
        },
      ];
    }

    if (upcoming === 'true') {
      query.startDate = { $gte: new Date() };
    }
    if (category) query.category = category;

    const skip = (Number(page) - 1) * Number(limit);

    const [events, total] = await Promise.all([
      Event.find(query)
        .sort({ startDate: 1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('createdBy', 'name email'),
      Event.countDocuments(query),
    ]);

    const eventsWithRegisteredFlag = events.map(event => {
      const isRegistered = event.attendees ? event.attendees.some(a => a.userId.toString() === req.user._id.toString()) : false;
      const eventObj = event.toObject();
      delete eventObj.attendees;
      return { ...eventObj, isRegistered };
    });

    return res.json({
      success: true,
      events: eventsWithRegisteredFlag,
      pagination: { currentPage: Number(page), totalPages: Math.ceil(total / Number(limit)), totalItems: total },
    });
  } catch (error) {
    console.error('getMyEvents error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch events' });
  }
};

// ─── STUDENT: Register for an event ──────────────────────────────────────────
export const registerForEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event || !event.isPublished || event.isCancelled) {
      return res.status(404).json({ success: false, message: 'Event not found or not available' });
    }
    if (!event.requiresRegistration) {
      return res.status(400).json({ success: false, message: 'This event does not require registration' });
    }
    if (event.registrationDeadline && event.registrationDeadline < new Date()) {
      return res.status(400).json({ success: false, message: 'Registration deadline has passed' });
    }
    if (event.maxAttendees && event.attendees.length >= event.maxAttendees) {
      return res.status(400).json({ success: false, message: 'Event is full' });
    }

    const alreadyRegistered = event.attendees.some(
      (a) => a.userId.toString() === req.user._id.toString()
    );
    if (alreadyRegistered) {
      return res.status(409).json({ success: false, message: 'You are already registered for this event' });
    }

    event.attendees.push({ userId: req.user._id });
    await event.save();

    return res.json({ success: true, message: 'Registered for event successfully' });
  } catch (error) {
    console.error('registerForEvent error:', error);
    return res.status(500).json({ success: false, message: 'Failed to register for event' });
  }
};

// ─── STUDENT/USER: Cancel registration for an event ──────────────────────────
export const cancelEventRegistration = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const beforeCount = Array.isArray(event.attendees) ? event.attendees.length : 0;
    const isRegistered = event.attendees.some(
      (a) => a.userId.toString() === req.user._id.toString()
    );
    if (!isRegistered) {
      return res.status(404).json({ success: false, message: 'You are not registered for this event' });
    }

    await Event.updateOne(
      { _id: event._id },
      { $pull: { attendees: { userId: req.user._id } } }
    );

    return res.json({
      success: true,
      message: 'Event registration cancelled successfully',
      totalRegistrations: Math.max(0, beforeCount - 1),
    });
  } catch (error) {
    console.error('cancelEventRegistration error:', error);
    return res.status(500).json({ success: false, message: 'Failed to cancel registration' });
  }
};

// ─── ADMIN: Get registered students list & details for a specific event ──────
export const getEventRegistrations = async (req, res) => {
  try {
    const { search = '', department = '', status = 'all', page = 1, limit = 50 } = req.query;

    const event = await Event.findById(req.params.id)
      .populate('attendees.userId', 'name email studentId department semester role isActive')
      .select('title category startDate endDate startTime venue maxAttendees requiresRegistration isPublished isCancelled attendees');

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const rawAttendees = Array.isArray(event.attendees) ? event.attendees : [];
    const normalizedSearch = String(search || '').trim().toLowerCase();
    const normalizedDept = String(department || '').trim().toUpperCase();
    const normalizedStatus = String(status || 'all').trim().toLowerCase();

    const mapped = rawAttendees
      .filter((entry) => entry && entry.userId)
      .map((entry) => {
        const u = entry.userId;
        const regStatus =
          entry.attended === true
            ? 'Attended'
            : entry.attended === false
              ? 'Absent'
              : 'Registered';

        return {
          userId: String(u._id),
          name: u.name || 'Unknown Student',
          email: u.email || '',
          studentId: u.studentId || '—',
          department: u.department || '—',
          semester: u.semester ?? null,
          role: u.role || 'student',
          registeredAt: entry.registeredAt || event.createdAt,
          attended: entry.attended ?? null,
          status: regStatus,
          feedbackScore: entry.feedbackScore ?? null,
        };
      })
      .sort((a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime());

    const departments = Array.from(
      new Set(mapped.map((r) => r.department).filter((d) => d && d !== '—'))
    ).sort();

    const filtered = mapped.filter((r) => {
      if (normalizedDept && normalizedDept !== 'ALL' && r.department.toUpperCase() !== normalizedDept) {
        return false;
      }
      if (normalizedStatus && normalizedStatus !== 'all' && r.status.toLowerCase() !== normalizedStatus) {
        return false;
      }
      if (normalizedSearch) {
        const haystack = `${r.name} ${r.email} ${r.studentId} ${r.department}`.toLowerCase();
        if (!haystack.includes(normalizedSearch)) return false;
      }
      return true;
    });

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(200, Math.max(1, Number(limit) || 50));
    const startIdx = (pageNum - 1) * limitNum;
    const paged = filtered.slice(startIdx, startIdx + limitNum);

    return res.json({
      success: true,
      event: {
        _id: event._id,
        title: event.title,
        category: event.category,
        startDate: event.startDate,
        endDate: event.endDate,
        startTime: event.startTime,
        venue: event.venue,
        maxAttendees: event.maxAttendees,
        requiresRegistration: event.requiresRegistration,
        isPublished: event.isPublished,
        isCancelled: event.isCancelled,
      },
      summary: {
        totalRegistrations: mapped.length,
        filteredCount: filtered.length,
        maxAttendees: event.maxAttendees ?? null,
        departments,
      },
      registrations: paged,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.max(1, Math.ceil(filtered.length / limitNum)),
        totalItems: filtered.length,
      },
    });
  } catch (error) {
    console.error('getEventRegistrations error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load event registrations' });
  }
};

// ─── ADMIN: Get all events ────────────────────────────────────────────────────
export const getAllEvents = async (req, res) => {
  try {
    const { isPublished, category, page = 1, limit = 20 } = req.query;
    const query = {};
    if (isPublished !== undefined) query.isPublished = isPublished === 'true';
    if (category) query.category = category;

    const skip = (Number(page) - 1) * Number(limit);

    const [events, total] = await Promise.all([
      Event.find(query)
        .sort({ startDate: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('createdBy', 'name email'),
      Event.countDocuments(query),
    ]);

    return res.json({
      success: true, events,
      pagination: { currentPage: Number(page), totalPages: Math.ceil(total / Number(limit)), totalItems: total },
    });
  } catch (error) {
    console.error('getAllEvents error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch events' });
  }
};

// ─── ADMIN: Update an event ───────────────────────────────────────────────────
export const updateEvent = async (req, res) => {
  try {
    const beforeEvent = await Event.findById(req.params.id);
    if (!beforeEvent) return res.status(404).json({ success: false, message: 'Event not found' });

    const payload = pickEventPayload(req.body);
    const event = await Event.findByIdAndUpdate(
      req.params.id,
      { $set: payload },
      { new: true, runValidators: true }
    );

    // If it changed from unpublished to published, send notifications
    if (!beforeEvent.isPublished && event.isPublished) {
      await notifyMatchedUsersForEvent(event);
    }

    // If cancelled, notify registered attendees
    if (req.body.isCancelled && event.attendees.length > 0) {
      const notifications = event.attendees.map((a) => ({
        userId:    a.userId,
        title:     `Event Cancelled: ${event.title}`,
        message:   `The event "${event.title}" scheduled for ${event.startDate?.toDateString()} has been cancelled.`,
        type:      'event_cancelled',
        relatedId: event._id,
        relatedModel: 'Event',
        priority:  'high',
      }));
      await Notification.insertMany(notifications);
    }

    return res.json({ success: true, message: 'Event updated', event });
  } catch (error) {
    console.error('updateEvent error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update event' });
  }
};

// ─── ADMIN: Delete an event ───────────────────────────────────────────────────
export const deleteEvent = async (req, res) => {
  try {
    await Event.findByIdAndDelete(req.params.id);
    return res.json({ success: true, message: 'Event deleted' });
  } catch (error) {
    console.error('deleteEvent error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete event' });
  }
};
