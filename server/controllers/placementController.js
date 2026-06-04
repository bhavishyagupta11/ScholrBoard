/**
 * placementController.js — Job and internship posting management
 */
import Placement from '../models/Placement.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';

// ─── ADMIN: Create a placement ────────────────────────────────────────────────
export const createPlacement = async (req, res) => {
  try {
    const placement = await Placement.create({
      ...req.body,
      postedBy: req.user._id,
    });
    return res.status(201).json({ success: true, message: 'Placement posted', placement });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false, message: 'Validation failed',
        errors: Object.values(error.errors).map((e) => e.message),
      });
    }
    console.error('createPlacement error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create placement' });
  }
};

// ─── GET personalized placements for a student ────────────────────────────────
export const getMyPlacements = async (req, res) => {
  try {
    const { jobType, page = 1, limit = 10 } = req.query;

    // Build query matching the student's profile
    const query = {
      isActive: true,
      deadline: { $gte: new Date() },   // only future deadlines
      $or: [
        { eligibleDepartments: { $size: 0 } },          // no restriction = all departments
        { eligibleDepartments: req.user.department },    // or matches student's dept
      ],
    };

    if (req.user.semester) {
      query.minSemester = { $lte: req.user.semester };
      query.maxSemester = { $gte: req.user.semester };
    }

    if (jobType) query.jobType = jobType;

    const skip = (Number(page) - 1) * Number(limit);

    const [placements, total] = await Promise.all([
      Placement.find(query)
        .sort({ deadline: 1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('postedBy', 'name email')
        .select('-applicants'),        // don't expose other applicants to students
      Placement.countDocuments(query),
    ]);

    return res.json({
      success: true, placements,
      pagination: { currentPage: Number(page), totalPages: Math.ceil(total / Number(limit)), totalItems: total },
    });
  } catch (error) {
    console.error('getMyPlacements error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch placements' });
  }
};

// ─── STUDENT: Apply to a placement ───────────────────────────────────────────
export const applyToPlacement = async (req, res) => {
  try {
    const placement = await Placement.findById(req.params.id);
    if (!placement || !placement.isActive) {
      return res.status(404).json({ success: false, message: 'Placement not found or no longer active' });
    }
    if (placement.deadline < new Date()) {
      return res.status(400).json({ success: false, message: 'Application deadline has passed' });
    }

    // Check already applied
    const alreadyApplied = placement.applicants.some(
      (a) => a.userId.toString() === req.user._id.toString()
    );
    if (alreadyApplied) {
      return res.status(409).json({ success: false, message: 'You have already applied for this placement' });
    }

    placement.applicants.push({ userId: req.user._id });
    await placement.save();

    return res.json({ success: true, message: 'Application submitted successfully' });
  } catch (error) {
    console.error('applyToPlacement error:', error);
    return res.status(500).json({ success: false, message: 'Failed to submit application' });
  }
};

// ─── ADMIN: Get all placements with applicants ────────────────────────────────
export const getAllPlacements = async (req, res) => {
  try {
    const { isActive, jobType, page = 1, limit = 20 } = req.query;
    const query = {};
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (jobType) query.jobType = jobType;

    const skip = (Number(page) - 1) * Number(limit);

    const [placements, total] = await Promise.all([
      Placement.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('postedBy', 'name email'),
      Placement.countDocuments(query),
    ]);

    return res.json({
      success: true, placements,
      pagination: { currentPage: Number(page), totalPages: Math.ceil(total / Number(limit)), totalItems: total },
    });
  } catch (error) {
    console.error('getAllPlacements error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch placements' });
  }
};

// ─── ADMIN: Update placement ──────────────────────────────────────────────────
export const updatePlacement = async (req, res) => {
  try {
    const placement = await Placement.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!placement) return res.status(404).json({ success: false, message: 'Placement not found' });
    return res.json({ success: true, message: 'Placement updated', placement });
  } catch (error) {
    console.error('updatePlacement error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update placement' });
  }
};

// ─── ADMIN: Delete a placement ────────────────────────────────────────────────
export const deletePlacement = async (req, res) => {
  try {
    await Placement.findByIdAndDelete(req.params.id);
    return res.json({ success: true, message: 'Placement deleted' });
  } catch (error) {
    console.error('deletePlacement error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete placement' });
  }
};
