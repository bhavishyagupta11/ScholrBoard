import OdRequest from '../models/OdRequest.js';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import Notification from '../models/Notification.js';
import { withTransaction } from '../utils/withTransaction.js';

// ─── STUDENT: Create OD Request ──────────────────────────────────────────────
export const createOdRequest = async (req, res) => {
  try {
    const { eventName, eventDate, proofUrl } = req.body;

    if (!eventName || !eventDate) {
      return res.status(400).json({
        success: false,
        message: 'Required fields missing: eventName, eventDate',
      });
    }

    // Fetch student's assigned advisor
    const student = await User.findById(req.user._id);
    if (!student || student.role !== 'student') {
      return res.status(404).json({ success: false, message: 'Student account not found' });
    }

    if (!student.advisorId) {
      return res.status(400).json({
        success: false,
        message: 'No Faculty Advisor has been assigned to your account. Please contact Administration.',
      });
    }

    const odRequest = await OdRequest.create({
      studentId: req.user._id,
      eventName: eventName.trim(),
      eventDate: new Date(eventDate),
      proofUrl: proofUrl || null,
      status: 'Pending',
    });

    return res.status(201).json({
      success: true,
      message: 'OD Attendance Request submitted successfully — routed to your advisor',
      odRequest,
    });
  } catch (error) {
    console.error('createOdRequest error:', error);
    return res.status(500).json({ success: false, message: 'Failed to submit OD request' });
  }
};

// ─── STUDENT: Get own OD Requests ─────────────────────────────────────────────
export const getMyOds = async (req, res) => {
  try {
    const ods = await OdRequest.find({ studentId: req.user._id })
      .sort({ createdAt: -1 })
      .populate('reviewedBy', 'name email');

    return res.json({ success: true, ods });
  } catch (error) {
    console.error('getMyOds error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch OD requests' });
  }
};

// ─── STUDENT: Update/Resubmit OD Request ──────────────────────────────────────
export const updateOdRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { eventName, eventDate, proofUrl } = req.body;

    const od = await OdRequest.findOne({ _id: id, studentId: req.user._id });
    if (!od) {
      return res.status(404).json({ success: false, message: 'OD request not found' });
    }

    if (!['Pending', 'Needs Revision'].includes(od.status)) {
      return res.status(400).json({
        success: false,
        message: 'Only requests that are Pending or require Revision can be updated',
      });
    }

    if (eventName) od.eventName = eventName.trim();
    if (eventDate) od.eventDate = new Date(eventDate);
    if (proofUrl !== undefined) od.proofUrl = proofUrl;

    // Reset status to Pending for re-review, clear review details
    od.status = 'Pending';
    od.remarks = null;
    od.reviewedBy = null;
    od.reviewedAt = null;

    await od.save();

    return res.json({
      success: true,
      message: 'OD request updated and resubmitted successfully',
      odRequest: od,
    });
  } catch (error) {
    console.error('updateOdRequest error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update OD request' });
  }
};

// ─── FACULTY: Get pending OD requests from assigned students ──────────────────
export const getPendingOds = async (req, res) => {
  try {
    const { scope = 'assigned' } = req.query;
    const query = { status: 'Pending' };

    // Find targeted advisees list
    const studentQuery = { role: 'student' };
    const isCoordinator = (req.user.role === 'faculty' && req.user.facultyLevel === 'coordinator');
    if (isCoordinator) {
      studentQuery.department = new RegExp(`^${req.user.department}$`, 'i');
    } else if (scope === 'all') {
      if (req.user.department) {
        studentQuery.department = new RegExp(`^${req.user.department}$`, 'i');
      }
    } else {
      // Default: only assigned advisees
      studentQuery.advisorId = req.user._id;
    }

    const students = await User.find(studentQuery).select('_id');
    query.studentId = { $in: students.map((s) => s._id) };

    const ods = await OdRequest.find(query)
      .populate('studentId', 'name studentId department semester')
      .sort({ createdAt: 1 });

    return res.json({ success: true, ods });
  } catch (error) {
    console.error('getPendingOds error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch pending OD requests' });
  }
};

// ─── FACULTY: Approve, Reject, or Request Revision ────────────────────────────
export const reviewOdRequest = async (req, res) => {
  try {
    const { status, remarks } = req.body;
    const { id } = req.params;

    if (!['Approved', 'Rejected', 'Needs Revision'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be one of: "Approved", "Rejected", "Needs Revision"',
      });
    }

    if (status === 'Rejected' && !remarks) {
      return res.status(400).json({
        success: false,
        message: 'Remarks explaining the rejection are required',
      });
    }

    if (status === 'Needs Revision' && !remarks) {
      return res.status(400).json({
        success: false,
        message: 'Remarks explaining required changes are required',
      });
    }

    const od = await OdRequest.findOne({ _id: id, status: 'Pending' });
    if (!od) {
      return res.status(404).json({ success: false, message: 'Pending OD request not found' });
    }

    // Verify advisor permission
    const student = await User.findById(od.studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student account not found' });
    }

    const isAdvisor = student.advisorId && student.advisorId.toString() === req.user._id.toString();

    if (!isAdvisor) {
      return res.status(403).json({
        success: false,
        message: 'Access denied — you do not have permission to review this OD request',
      });
    }

    const studentId = od.studentId;

    await withTransaction(async (session) => {
      od.status = status;
      od.reviewedBy = req.user._id;
      od.reviewedAt = new Date();
      od.remarks = remarks?.trim() || null;
      od.attendanceExemptionGranted = (status === 'Approved');

      await od.save({ session });

      let actionName = 'reject_od';
      if (status === 'Approved') actionName = 'approve_od';
      if (status === 'Needs Revision') actionName = 'revision_requested_od';

      await AuditLog.create([{
        action: actionName,
        performedBy: req.user._id,
        role: req.user.role,
        targetModel: 'OdRequest',
        targetId: od._id,
        details: {
          eventName: od.eventName,
          eventDate: od.eventDate,
          remarks: remarks,
        },
      }], { session });

      let notificationType = 'od_rejected';
      if (status === 'Approved') notificationType = 'od_approved';
      if (status === 'Needs Revision') notificationType = 'revision_requested';

      await Notification.create([{
        userId: studentId,
        title: `OD Exemption ${status}: ${od.eventName}`,
        message: status === 'Approved'
          ? `Your OD attendance request for "${od.eventName}" was approved!`
          : status === 'Rejected'
          ? `Your OD attendance request for "${od.eventName}" was rejected. Remarks: ${remarks}`
          : `Your OD attendance request for "${od.eventName}" requires revision. Remarks: ${remarks}`,
        type: notificationType,
        relatedId: od._id,
        relatedModel: 'OdRequest',
        actionUrl: '/student/activities',
        priority: status === 'Approved' ? 'medium' : 'high',
      }], { session });
    });

    await od.populate('studentId', 'name email');

    return res.json({ success: true, message: `OD request ${status.toLowerCase()} successfully`, od });
  } catch (error) {
    console.error('reviewOdRequest error:', error);
    return res.status(500).json({ success: false, message: 'Failed to review OD request' });
  }
};

// ─── ADMIN: Get all OD Requests (Read-only visibility) ────────────────────────
export const getAllOds = async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;

    const query = {};
    if (status) query.status = status;

    const skip = (Number(page) - 1) * Number(limit);

    const [ods, total] = await Promise.all([
      OdRequest.find(query)
        .populate('studentId', 'name studentId department semester advisorId')
        .populate('reviewedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      OdRequest.countDocuments(query),
    ]);

    return res.json({
      success: true,
      ods,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
        totalItems: total,
      },
    });
  } catch (error) {
    console.error('getAllOds error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch OD requests' });
  }
};
