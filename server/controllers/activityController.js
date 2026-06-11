/**
 * activityController.js — Student activity submission and approval workflow
 */
import Activity from '../models/Activity.js';
import AuditLog from '../models/AuditLog.js';
import Notification from '../models/Notification.js';
import { withTransaction } from '../utils/withTransaction.js';

// ─── STUDENT: Submit a new activity ──────────────────────────────────────────
export const createActivity = async (req, res) => {
  try {
    const { title, description, category, subCategory, activityDate, duration, externalLink } = req.body;

    if (!title || !category || !activityDate) {
      return res.status(400).json({
        success: false,
        message: 'Required fields missing: title, category, activityDate',
      });
    }

    const activity = await Activity.create({
      userId: req.user._id,
      title:        title.trim(),
      description:  description?.trim(),
      category,
      subCategory:  subCategory?.trim(),
      activityDate: new Date(activityDate),
      duration:     duration?.trim(),
      externalLink: externalLink?.trim(),
      proofUrl:     req.body.proofUrl || req.file?.cloudinaryUrl || null,
    });

    return res.status(201).json({
      success: true,
      message: 'Activity submitted successfully — awaiting review',
      activity,
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: Object.values(error.errors).map((e) => e.message),
      });
    }
    console.error('createActivity error:', error);
    return res.status(500).json({ success: false, message: 'Failed to submit activity' });
  }
};

// ─── STUDENT: Get own activities (with filtering + pagination) ─────────────────
export const getMyActivities = async (req, res) => {
  try {
    const { status, category, page = 1, limit = 20 } = req.query;

    const query = { userId: req.user._id, isArchived: false };
    if (status)   query.status   = status;
    if (category) query.category = category;

    const skip = (Number(page) - 1) * Number(limit);

    const [activities, total] = await Promise.all([
      Activity.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .select('-__v'),
      Activity.countDocuments(query),
    ]);

    // Compute summary counts for dashboard stat cards
    const summary = await Activity.aggregate([
      { $match: { userId: req.user._id, isArchived: false } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const counts = { Pending: 0, Approved: 0, Rejected: 0 };
    summary.forEach(({ _id, count }) => { if (_id in counts) counts[_id] = count; });

    return res.json({
      success: true,
      activities,
      counts,
      pagination: {
        currentPage: Number(page),
        totalPages:  Math.ceil(total / Number(limit)),
        totalItems:  total,
      },
    });
  } catch (error) {
    console.error('getMyActivities error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch activities' });
  }
};

// ─── STUDENT: Get a single activity ──────────────────────────────────────────
export const getActivityById = async (req, res) => {
  try {
    const activity = await Activity.findOne({
      _id: req.params.id,
      userId: req.user._id,
    }).populate('reviewedBy', 'name email');

    if (!activity) {
      return res.status(404).json({ success: false, message: 'Activity not found' });
    }

    return res.json({ success: true, activity });
  } catch (error) {
    console.error('getActivityById error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch activity' });
  }
};

// ─── STUDENT: Update a pending activity ──────────────────────────────────────
export const updateActivity = async (req, res) => {
  try {
    const activity = await Activity.findOne({ _id: req.params.id, userId: req.user._id });

    if (!activity) {
      return res.status(404).json({ success: false, message: 'Activity not found' });
    }
    if (activity.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending activities can be edited',
      });
    }

    const { title, description, category, subCategory, activityDate, duration, externalLink } = req.body;
    if (title)        activity.title        = title.trim();
    if (description)  activity.description  = description.trim();
    if (category)     activity.category     = category;
    if (subCategory)  activity.subCategory  = subCategory.trim();
    if (activityDate) activity.activityDate = new Date(activityDate);
    if (duration)     activity.duration     = duration.trim();
    if (externalLink) activity.externalLink = externalLink.trim();
    if (req.file?.cloudinaryUrl) activity.proofUrl = req.file.cloudinaryUrl;

    await activity.save();
    return res.json({ success: true, message: 'Activity updated', activity });
  } catch (error) {
    console.error('updateActivity error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update activity' });
  }
};

// ─── STUDENT: Archive (soft-delete) a pending activity ───────────────────────
export const archiveActivity = async (req, res) => {
  try {
    const activity = await Activity.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id, status: 'Pending' },
      { $set: { isArchived: true } },
      { new: true }
    );

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: 'Activity not found or cannot be archived (must be pending)',
      });
    }

    return res.json({ success: true, message: 'Activity archived' });
  } catch (error) {
    console.error('archiveActivity error:', error);
    return res.status(500).json({ success: false, message: 'Failed to archive activity' });
  }
};

// ─── FACULTY/ADMIN: Get all activities pending review ─────────────────────────
export const getPendingActivities = async (req, res) => {
  try {
    const { category, page = 1, limit = 20 } = req.query;

    const query = { status: 'Pending', isArchived: false };

    // Faculty only see activities from assigned advisees.
    if (req.user.role === 'faculty') {
      const { default: User } = await import('../models/User.js');
      const assignedStudents = await User.find({ role: 'student', advisorId: req.user._id }).select('_id');
      query.userId = { $in: assignedStudents.map((student) => student._id) };
    }

    if (category) query.category = category;

    const skip = (Number(page) - 1) * Number(limit);

    const [activities, total] = await Promise.all([
      Activity.find(query)
        .populate('userId', 'name email studentId department semester advisorId')
        .sort({ createdAt: 1 })   // oldest first (FIFO review queue)
        .skip(skip)
        .limit(Number(limit))
        .select('-__v'),
      Activity.countDocuments(query),
    ]);

    return res.json({
      success: true,
      activities,
      pagination: {
        currentPage: Number(page),
        totalPages:  Math.ceil(total / Number(limit)),
        totalItems:  total,
      },
    });
  } catch (error) {
    console.error('getPendingActivities error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch pending activities' });
  }
};

// ─── FACULTY/ADMIN: Approve or reject an activity / request revision ──────────
export const reviewActivity = async (req, res) => {
  try {
    const { status, reviewComments, rejectionReason } = req.body;

    if (!['Approved', 'Rejected', 'Needs Revision'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be one of: "Approved", "Rejected", "Needs Revision"',
      });
    }
    if (status === 'Rejected' && !rejectionReason) {
      return res.status(400).json({
        success: false,
        message: 'A rejection reason is required when rejecting an activity',
      });
    }
    if (status === 'Needs Revision' && !reviewComments) {
      return res.status(400).json({
        success: false,
        message: 'Comments detailing the required changes are required when requesting revision',
      });
    }

    // Load active activity
    const activity = await Activity.findOne({ _id: req.params.id, status: 'Pending' });
    if (!activity) {
      return res.status(404).json({
        success: false,
        message: 'Activity not found or already reviewed',
      });
    }

    // Faculty may only review submissions from assigned advisees.
    if (req.user.role === 'faculty') {
      const { default: User } = await import('../models/User.js');
      const student = await User.findById(activity.userId);
      if (!student) {
        return res.status(404).json({ success: false, message: 'Student account not found' });
      }

      const isAdvisor = student.advisorId && student.advisorId.toString() === req.user._id.toString();

      if (!isAdvisor) {
        return res.status(403).json({
          success: false,
          message: 'Access denied — you do not have permission to review this student\'s submissions',
        });
      }
    }

    // Points calculation: system-controlled, advisors cannot override
    let calculatedPoints = 0;
    if (status === 'Approved') {
      const { calculateActivityPoints } = await import('../services/scoringService.js');
      calculatedPoints = calculateActivityPoints(activity);
    }

    const studentId = activity.userId;

    await withTransaction(async (session) => {
      activity.status = status;
      activity.reviewedBy = req.user._id;
      activity.reviewedAt = new Date();
      activity.reviewComments = reviewComments?.trim() || null;
      activity.rejectionReason = status === 'Rejected' ? rejectionReason?.trim() : null;
      activity.points = calculatedPoints;

      await activity.save({ session });

      if (status === 'Approved') {
        const { updateStudentPoints } = await import('../services/scoringService.js');
        await updateStudentPoints(studentId, session);
      }

      await AuditLog.create([{
        action: status === 'Approved' ? 'approve_activity' : status === 'Rejected' ? 'reject_activity' : 'revision_requested_activity',
        performedBy: req.user._id,
        role: req.user.role,
        targetModel: 'Activity',
        targetId: activity._id,
        details: {
          title: activity.title,
          points: calculatedPoints,
          comments: reviewComments || rejectionReason,
        },
      }], { session });

      const notificationTitle = `Activity ${status}: ${activity.title}`;
      const notificationMessage = status === 'Approved'
        ? `Your activity "${activity.title}" has been approved! System points allocated: ${calculatedPoints} points.`
        : status === 'Rejected'
        ? `Your activity "${activity.title}" was rejected. Reason: ${rejectionReason}`
        : `Your activity "${activity.title}" requires revision. Comments: ${reviewComments}`;

      await Notification.create([{
        userId: studentId,
        title: notificationTitle,
        message: notificationMessage,
        type: status === 'Approved' ? 'activity_approved' : status === 'Rejected' ? 'activity_rejected' : 'system',
        relatedId: activity._id,
        relatedModel: 'Activity',
        actionUrl: '/student/activities',
        priority: status === 'Approved' ? 'medium' : 'high',
      }], { session });
    });

    await activity.populate('userId', 'name email');

    return res.json({
      success: true,
      message: `Activity ${status.toLowerCase()} successfully`,
      activity,
    });
  } catch (error) {
    console.error('reviewActivity error:', error);
    return res.status(500).json({ success: false, message: 'Failed to review activity' });
  }
};
