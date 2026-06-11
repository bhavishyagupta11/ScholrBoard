import Scholarship from '../models/Scholarship.js';
import ScholarshipApplication from '../models/ScholarshipApplication.js';
import User from '../models/User.js';
import Profile from '../models/Profile.js';
import AuditLog from '../models/AuditLog.js';
import Notification from '../models/Notification.js';
import { evaluateScholarshipEligibility } from '../services/eligibilityService.js';
import { withTransaction } from '../utils/withTransaction.js';

// ─── ADMIN: Create Scholarship ────────────────────────────────────────────────
export const createScholarship = async (req, res) => {
  try {
    const { title, provider, amount, description, eligibility, deadline } = req.body;

    if (!title || !provider || !amount || !description || !deadline) {
      return res.status(400).json({
        success: false,
        message: 'Required fields missing: title, provider, amount, description, deadline',
      });
    }

    const scholarship = await withTransaction(async (session) => {
      const [created] = await Scholarship.create([{
        title: title.trim(),
        provider: provider.trim(),
        amount: Number(amount),
        description: description.trim(),
        eligibility: eligibility || {},
        deadline: new Date(deadline),
        postedBy: req.user._id,
        status: 'Draft',
      }], { session });

      await AuditLog.create([{
        action: 'create_scholarship',
        performedBy: req.user._id,
        role: req.user.role,
        targetModel: 'Scholarship',
        targetId: created._id,
        details: { title: created.title, provider: created.provider, amount: created.amount },
      }], { session });

      return created;
    });

    return res.status(201).json({
      success: true,
      message: 'Scholarship draft created successfully',
      scholarship,
    });
  } catch (error) {
    console.error('createScholarship error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create scholarship' });
  }
};

// ─── ADMIN: Publish Scholarship & Send Notifications ──────────────────────────
export const publishScholarship = async (req, res) => {
  try {
    const { id } = req.params;

    const scholarship = await Scholarship.findById(id);
    if (!scholarship) {
      return res.status(404).json({ success: false, message: 'Scholarship not found' });
    }

    if (scholarship.status !== 'Draft') {
      return res.status(400).json({ success: false, message: `Scholarship is already ${scholarship.status}` });
    }

    const students = await User.find({ role: 'student', isActive: true });
    const notifications = [];

    for (const student of students) {
      const profile = await Profile.findOne({ userId: student._id });
      if (profile) {
        const evalRes = evaluateScholarshipEligibility(student, profile, scholarship, 0);
        if (evalRes.eligible) {
          notifications.push({
            userId: student._id,
            title: `New Scholarship Open: ${scholarship.title}`,
            message: `You are eligible to apply for the ₹${scholarship.amount.toLocaleString()} scholarship offered by ${scholarship.provider}!`,
            type: 'scholarship_match',
            relatedId: scholarship._id,
            relatedModel: 'Scholarship',
            actionUrl: '/student/placements',
            priority: 'high',
          });
        }
      }
    }

    await withTransaction(async (session) => {
      scholarship.status = 'Published';
      await scholarship.save({ session });

      await AuditLog.create([{
        action: 'publish_scholarship',
        performedBy: req.user._id,
        role: req.user.role,
        targetModel: 'Scholarship',
        targetId: scholarship._id,
        details: { title: scholarship.title, provider: scholarship.provider, amount: scholarship.amount },
      }], { session });

      if (notifications.length > 0) {
        await Notification.insertMany(notifications, { session });
      }
    });

    return res.json({
      success: true,
      message: `Scholarship published successfully — notifications sent to ${notifications.length} candidates`,
      scholarship,
    });
  } catch (error) {
    console.error('publishScholarship error:', error);
    return res.status(500).json({ success: false, message: 'Failed to publish scholarship' });
  }
};

// ─── ADMIN: Close Scholarship ─────────────────────────────────────────────────
export const closeScholarship = async (req, res) => {
  try {
    const { id } = req.params;

    const scholarship = await Scholarship.findById(id);
    if (!scholarship) {
      return res.status(404).json({ success: false, message: 'Scholarship not found' });
    }

    scholarship.status = 'Closed';
    await scholarship.save();

    return res.json({
      success: true,
      message: 'Scholarship closed successfully',
      scholarship,
    });
  } catch (error) {
    console.error('closeScholarship error:', error);
    return res.status(500).json({ success: false, message: 'Failed to close scholarship' });
  }
};

// ─── STUDENT: Get Matching Scholarships list ──────────────────────────────────
export const getMatchingScholarships = async (req, res) => {
  try {
    const annualIncome = Number(req.query.annualIncome || 0);

    const openScholarships = await Scholarship.find({ status: 'Published' })
      .sort({ deadline: 1 })
      .populate('postedBy', 'name email');

    const studentProfile = await Profile.findOne({ userId: req.user._id });
    if (!studentProfile) {
      return res.status(404).json({ success: false, message: 'Student profile not found' });
    }

    const scholarships = openScholarships.map((s) => {
      const evaluation = evaluateScholarshipEligibility(req.user, studentProfile, s, annualIncome);

      const plainS = s.toObject();
      plainS.isEligible = evaluation.eligible;
      plainS.ineligibilityReason = evaluation.reason;

      return plainS;
    });

    return res.json({ success: true, scholarships });
  } catch (error) {
    console.error('getMatchingScholarships error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch matching scholarships' });
  }
};

// ─── STUDENT: Apply for Scholarship ───────────────────────────────────────────
export const applyToScholarship = async (req, res) => {
  try {
    const { id } = req.params; // Scholarship ID
    const { incomeCertificateUrl, academicTranscriptUrl, annualIncome = 0 } = req.body;

    const scholarship = await Scholarship.findById(id);
    if (!scholarship) {
      return res.status(404).json({ success: false, message: 'Scholarship not found' });
    }

    if (scholarship.status !== 'Published') {
      return res.status(400).json({ success: false, message: 'Applications are closed for this scholarship' });
    }

    if (new Date() > new Date(scholarship.deadline)) {
      return res.status(400).json({ success: false, message: 'Application deadline has passed' });
    }

    const duplicate = await ScholarshipApplication.findOne({ scholarshipId: id, studentId: req.user._id });
    if (duplicate) {
      return res.status(400).json({ success: false, message: 'You have already applied for this scholarship' });
    }

    const studentProfile = await Profile.findOne({ userId: req.user._id });
    if (!studentProfile) {
      return res.status(404).json({ success: false, message: 'Student profile not found' });
    }

    // Run eligibility matcher
    const evaluation = evaluateScholarshipEligibility(req.user, studentProfile, scholarship, Number(annualIncome));
    if (!evaluation.eligible) {
      return res.status(400).json({
        success: false,
        message: `Eligibility Check Failed: ${evaluation.reason}`,
      });
    }

    // Capture frozen snapshot
    const eligibilitySnapshot = {
      cgpa: studentProfile.gpa || 0,
      department: req.user.department || '',
      achievementPoints: studentProfile.achievementPoints || 0,
      annualIncome: Number(annualIncome),
    };

    const application = await withTransaction(async (session) => {
      const [created] = await ScholarshipApplication.create([{
        scholarshipId: id,
        studentId: req.user._id,
        status: 'Applied',
        incomeCertificateUrl: incomeCertificateUrl || null,
        academicTranscriptUrl: academicTranscriptUrl || null,
        eligibilitySnapshot,
      }], { session });

      await AuditLog.create([{
        action: 'apply_scholarship',
        performedBy: req.user._id,
        role: req.user.role,
        targetModel: 'ScholarshipApplication',
        targetId: created._id,
        details: { title: scholarship.title, provider: scholarship.provider, amount: scholarship.amount },
      }], { session });

      return created;
    });

    return res.status(201).json({
      success: true,
      message: 'Scholarship application submitted successfully',
      application,
    });
  } catch (error) {
    console.error('applyToScholarship error:', error);
    return res.status(500).json({ success: false, message: 'Failed to submit scholarship application' });
  }
};

// ─── ADMIN: Get Applications for specific Scholarship ────────────────────────
export const getScholarshipApplications = async (req, res) => {
  try {
    const { id } = req.params; // Scholarship ID
    const { status } = req.query;

    const query = { scholarshipId: id };
    if (status) query.status = status;

    const list = await ScholarshipApplication.find(query)
      .populate('studentId', 'name studentId department semester email')
      .sort({ appliedAt: -1 });

    return res.json({ success: true, applications: list });
  } catch (error) {
    console.error('getScholarshipApplications error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch scholarship applications' });
  }
};

// ─── ADMIN: Review/Award Scholarship (Selected, Rejected) ────────────────────
export const reviewScholarshipApplication = async (req, res) => {
  try {
    const { id } = req.params; // ScholarshipApplication ID
    const { status, remarks } = req.body;

    if (!['Selected', 'Rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be one of: "Selected", "Rejected"',
      });
    }

    const application = await ScholarshipApplication.findById(id)
      .populate('scholarshipId', 'title provider amount')
      .populate('studentId', 'name email');

    if (!application) {
      return res.status(404).json({ success: false, message: 'Scholarship application not found' });
    }

    const prevStatus = application.status;
    const studentId = application.studentId._id;

    await withTransaction(async (session) => {
      application.status = status;
      application.remarks = remarks?.trim() || null;
      await application.save({ session });

      await AuditLog.create([{
        action: 'approve_scholarship',
        performedBy: req.user._id,
        role: req.user.role,
        targetModel: 'ScholarshipApplication',
        targetId: application._id,
        details: {
          title: application.scholarshipId?.title,
          provider: application.scholarshipId?.provider,
          amount: application.scholarshipId?.amount,
          previousStatus: prevStatus,
          newStatus: status,
          remarks,
        },
      }], { session });

      await Notification.create([{
        userId: studentId,
        title: status === 'Selected' ? `🎉 Scholarship Selected: ${application.scholarshipId?.title}` : `Scholarship Application Rejected: ${application.scholarshipId?.title}`,
        message: status === 'Selected'
          ? `Congratulations! You have been selected for the ₹${application.scholarshipId?.amount.toLocaleString()} scholarship award by ${application.scholarshipId?.provider}!`
          : `Your application for the "${application.scholarshipId?.title}" scholarship was rejected. Remarks: ${remarks || 'None'}`,
        type: 'scholarship_match',
        relatedId: application._id,
        relatedModel: 'ScholarshipApplication',
        actionUrl: '/student/placements',
        priority: status === 'Selected' ? 'high' : 'medium',
      }], { session });
    });

    return res.json({
      success: true,
      message: `Scholarship application ${status.toLowerCase()} successfully`,
      application,
    });
  } catch (error) {
    console.error('reviewScholarshipApplication error:', error);
    return res.status(500).json({ success: false, message: 'Failed to review scholarship application' });
  }
};

// ─── STUDENT: Get own Scholarship Application history ────────────────────────
export const getMyScholarshipHistory = async (req, res) => {
  try {
    const list = await ScholarshipApplication.find({ studentId: req.user._id })
      .populate('scholarshipId', 'title provider amount deadline status')
      .sort({ appliedAt: -1 });

    return res.json({ success: true, applications: list });
  } catch (error) {
    console.error('getMyScholarshipHistory error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch scholarship history' });
  }
};

// ─── UNIVERSAL: Get all Scholarships list ─────────────────────────────────────
export const getAllScholarships = async (req, res) => {
  try {
    const { status } = req.query;
    const query = {};
    if (status) query.status = status;

    const list = await Scholarship.find(query)
      .sort({ createdAt: -1 })
      .populate('postedBy', 'name email');

    return res.json({ success: true, scholarships: list });
  } catch (error) {
    console.error('getAllScholarships error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch scholarships' });
  }
};
