/**
 * eventController.js — University events management
 */
import Event from '../models/Event.js';
import Notification from '../models/Notification.js';

// ─── ADMIN/FACULTY: Create an event ──────────────────────────────────────────
export const createEvent = async (req, res) => {
  try {
    const event = await Event.create({ ...req.body, createdBy: req.user._id });
    return res.status(201).json({ success: true, message: 'Event created', event });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false, message: 'Validation failed',
        errors: Object.values(error.errors).map((e) => e.message),
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
      query.$or.push({});   // already handled above — just use general filter
      // Add dept match as additional OR condition
      query.$and = [
        {
          $or: [
            { targetDepartments: { $size: 0 } },       // no restriction
            { targetDepartments: req.user.department }, // or matches user's dept
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
        .populate('createdBy', 'name email')
        .select('-attendees'),      // don't send full attendee list to students
      Event.countDocuments(query),
    ]);

    return res.json({
      success: true, events,
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
    const event = await Event.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

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
