import Opportunity from '../models/Opportunity.js';
import User from '../models/User.js';
import Profile from '../models/Profile.js';
import AuditLog from '../models/AuditLog.js';
import Notification from '../models/Notification.js';
import { evaluatePlacementEligibility } from '../services/eligibilityService.js';
import { withTransaction } from '../utils/withTransaction.js';
import { excludeTestUsers } from '../utils/testFilters.js';
import { evaluateOpportunityDeadline, parseOpportunityDeadline } from '../utils/opportunityDeadline.js';

// ─── ADMIN: Create Opportunity ────────────────────────────────────────────────
export const createOpportunity = async (req, res) => {
  try {
    const {
      driveCode,
      title,
      company,
      location,
      type,
      description,
      requirements,
      eligibility,
      salaryPackage,
      deadline
    } = req.body;

    if (!driveCode || !title || !company || !type || !description || !deadline) {
      return res.status(400).json({
        success: false,
        message: 'Required fields missing: driveCode, title, company, type, description, deadline',
      });
    }

    const parsedDeadline = parseOpportunityDeadline(deadline);
    if (!parsedDeadline.valid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or unparseable application deadline',
      });
    }

    // Verify driveCode uniqueness
    const existing = await Opportunity.findOne({ driveCode: driveCode.trim().toUpperCase() });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Opportunity with drive code "${driveCode}" already exists.`,
      });
    }

    const opportunity = await withTransaction(async (session) => {
      const [created] = await Opportunity.create([{
        driveCode: driveCode.trim().toUpperCase(),
        title: title.trim(),
        company: company.trim(),
        location: location ? String(location).trim() : '',
        type,
        description,
        requirements: requirements || [],
        eligibility: eligibility || {},
        salaryPackage: salaryPackage || 0,
        deadline: parsedDeadline.date,
        postedBy: req.user._id,
        status: 'Draft',
      }], { session });

      await AuditLog.create([{
        action: 'create_opportunity',
        performedBy: req.user._id,
        role: req.user.role,
        targetModel: 'Opportunity',
        targetId: created._id,
        details: { driveCode: created.driveCode, company: created.company, title: created.title },
      }], { session });

      return created;
    });

    return res.status(201).json({
      success: true,
      message: 'Placement drive draft created successfully',
      opportunity,
    });
  } catch (error) {
    console.error('createOpportunity error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create opportunity' });
  }
};

// ─── ADMIN: Update Opportunity (Draft / Published / Closed safe edit) ─────────
export const updateOpportunity = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await Opportunity.findById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Opportunity not found' });
    }

    const {
      driveCode,
      title,
      company,
      location,
      type,
      description,
      requirements,
      eligibility,
      salaryPackage,
      deadline,
      status: requestedStatus,
    } = req.body;

    if (requestedStatus !== undefined && requestedStatus !== existing.status) {
      return res.status(400).json({
        success: false,
        message: 'Status transitions are not allowed via edit; use publish or close actions. Closed or expired drives cannot be reopened.',
      });
    }

    const nextTitle = title !== undefined ? String(title).trim() : existing.title;
    const nextCompany = company !== undefined ? String(company).trim() : existing.company;
    const nextType = type !== undefined ? type : existing.type;
    const nextDescription = description !== undefined ? String(description).trim() : existing.description;

    if (!nextTitle || !nextCompany || !nextType || !nextDescription) {
      return res.status(400).json({
        success: false,
        message: 'Required fields cannot be empty: title, company, type, description',
      });
    }

    if (!['Full-time', 'Internship', 'Part-time'].includes(nextType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid opportunity type. Must be Full-time, Internship, or Part-time',
      });
    }

    if (salaryPackage !== undefined && (!Number.isFinite(Number(salaryPackage)) || Number(salaryPackage) < 0)) {
      return res.status(400).json({
        success: false,
        message: 'Salary package must be a non-negative number',
      });
    }

    let nextDriveCode = existing.driveCode;
    if (driveCode !== undefined) {
      const normalizedCode = String(driveCode).trim().toUpperCase();
      if (!normalizedCode) {
        return res.status(400).json({ success: false, message: 'Drive code cannot be empty' });
      }
      if (normalizedCode !== existing.driveCode) {
        const conflict = await Opportunity.findOne({ driveCode: normalizedCode, _id: { $ne: existing._id } });
        if (conflict) {
          return res.status(400).json({
            success: false,
            message: `Opportunity with drive code "${normalizedCode}" already exists.`,
          });
        }
        nextDriveCode = normalizedCode;
      }
    }

    const now = new Date();
    const existingDeadlineEval = evaluateOpportunityDeadline(existing, now);
    let nextDeadline = existing.deadline;

    if (deadline !== undefined && deadline !== '') {
      const parsedDeadline = parseOpportunityDeadline(deadline);
      if (!parsedDeadline.valid) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or unparseable application deadline',
        });
      }

      const existingMs = existing.deadline instanceof Date ? existing.deadline.getTime() : NaN;
      const nextMs = parsedDeadline.date.getTime();
      const deadlineChanged = !Number.isFinite(existingMs) || Math.abs(nextMs - existingMs) > 1000;

      // Never allow an expired or closed drive to be reopened/extended by editing its deadline
      if (deadlineChanged && (existing.status === 'Closed' || existingDeadlineEval.isExpired)) {
        return res.status(400).json({
          success: false,
          message: 'Cannot extend or reopen the application deadline of an already expired or closed opportunity.',
        });
      }
      nextDeadline = parsedDeadline.date;
    }

    const updatedOp = await withTransaction(async (session) => {
      existing.driveCode = nextDriveCode;
      existing.title = nextTitle;
      existing.company = nextCompany;
      if (location !== undefined) existing.location = String(location || '').trim();
      existing.type = nextType;
      existing.description = nextDescription;
      if (requirements !== undefined) {
        existing.requirements = Array.isArray(requirements)
          ? requirements.map((r) => String(r).trim()).filter(Boolean)
          : String(requirements).split(',').map((r) => r.trim()).filter(Boolean);
      }
      if (eligibility !== undefined && typeof eligibility === 'object') {
        const baseElig = existing.eligibility?.toObject ? existing.eligibility.toObject() : (existing.eligibility || {});
        existing.eligibility = {
          ...baseElig,
          ...(eligibility.minCGPA !== undefined && { minCGPA: Number(eligibility.minCGPA) || 0 }),
          ...(eligibility.maxActiveBacklogs !== undefined && { maxActiveBacklogs: Number(eligibility.maxActiveBacklogs) || 0 }),
          ...(eligibility.minSemester !== undefined && { minSemester: Number(eligibility.minSemester) || 1 }),
          ...(eligibility.passingYear !== undefined && { passingYear: Number(eligibility.passingYear) || baseElig.passingYear || 2026 }),
          ...(eligibility.eligibleDepartments !== undefined && {
            eligibleDepartments: Array.isArray(eligibility.eligibleDepartments)
              ? eligibility.eligibleDepartments.map((d) => String(d).trim().toUpperCase()).filter(Boolean)
              : [],
          }),
          ...(eligibility.minPlacementReadinessScore !== undefined && {
            minPlacementReadinessScore: eligibility.minPlacementReadinessScore === null || eligibility.minPlacementReadinessScore === ''
              ? null
              : Number(eligibility.minPlacementReadinessScore),
          }),
        };
      }
      if (salaryPackage !== undefined) existing.salaryPackage = Number(salaryPackage) || 0;
      existing.deadline = nextDeadline;

      await existing.save({ session });

      await AuditLog.create([{
        action: 'update_opportunity',
        performedBy: req.user._id,
        role: req.user.role,
        targetModel: 'Opportunity',
        targetId: existing._id,
        details: {
          driveCode: existing.driveCode,
          company: existing.company,
          title: existing.title,
          status: existing.status,
        },
      }], { session });

      return existing;
    });

    const postEval = evaluateOpportunityDeadline(updatedOp, new Date());
    const plainOp = updatedOp.toObject ? updatedOp.toObject() : { ...updatedOp };
    plainOp.isExpired = postEval.isExpired;
    plainOp.deadlineStatus = postEval.deadlineStatus;
    plainOp.isDeadlineVerified = postEval.isDeadlineVerified;
    plainOp.isOpenForApplication = postEval.isOpenForApplication;

    return res.json({
      success: true,
      message: 'Placement drive updated successfully',
      opportunity: plainOp,
    });
  } catch (error) {
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error('updateOpportunity error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update opportunity' });
  }
};

// ─── ADMIN: Publish Opportunity & Notify Match Candidates ─────────────────────
export const publishOpportunity = async (req, res) => {
  try {
    const { id } = req.params;

    const opportunity = await Opportunity.findById(id);
    if (!opportunity) {
      return res.status(404).json({ success: false, message: 'Opportunity not found' });
    }

    if (opportunity.status !== 'Draft') {
      return res.status(400).json({ success: false, message: `Opportunity is already ${opportunity.status}` });
    }

    const students = await User.find({ role: 'student', isActive: true, ...excludeTestUsers() });
    const notifications = [];

    for (const student of students) {
      const profile = await Profile.findOne({ userId: student._id });
      if (profile) {
        const evalRes = evaluatePlacementEligibility(student, profile, opportunity);
        if (evalRes.eligible) {
          notifications.push({
            userId: student._id,
            title: `New Placement Match: ${opportunity.company}`,
            message: `You match the criteria for the "${opportunity.title}" drive by ${opportunity.company}. Apply before the deadline!`,
            type: 'opportunity_match',
            relatedId: opportunity._id,
            relatedModel: 'Opportunity',
            actionUrl: '/student/placements',
            priority: 'high',
          });
        }
      }
    }

    await withTransaction(async (session) => {
      opportunity.status = 'Published';
      await opportunity.save({ session });

      await AuditLog.create([{
        action: 'publish_opportunity',
        performedBy: req.user._id,
        role: req.user.role,
        targetModel: 'Opportunity',
        targetId: opportunity._id,
        details: { driveCode: opportunity.driveCode, company: opportunity.company, title: opportunity.title },
      }], { session });

      if (notifications.length > 0) {
        await Notification.insertMany(notifications, { session });
      }
    });

    return res.json({
      success: true,
      message: `Opportunity published successfully — notifications sent to ${notifications.length} matching students`,
      opportunity,
    });
  } catch (error) {
    console.error('publishOpportunity error:', error);
    return res.status(500).json({ success: false, message: 'Failed to publish opportunity' });
  }
};

// ─── ADMIN: Close Opportunity ─────────────────────────────────────────────────
export const closeOpportunity = async (req, res) => {
  try {
    const { id } = req.params;

    const opportunity = await Opportunity.findById(id);
    if (!opportunity) {
      return res.status(404).json({ success: false, message: 'Opportunity not found' });
    }

    opportunity.status = 'Closed';
    await opportunity.save();

    return res.json({
      success: true,
      message: 'Placement drive closed successfully',
      opportunity,
    });
  } catch (error) {
    console.error('closeOpportunity error:', error);
    return res.status(500).json({ success: false, message: 'Failed to close opportunity' });
  }
};

// ─── STUDENT: Get Eligible Matching Placements list ───────────────────────────
export const getMatchingOpportunities = async (req, res) => {
  try {
    // Find all active opportunities
    const openOpportunities = await Opportunity.find({ status: 'Published' })
      .sort({ deadline: 1 })
      .populate('postedBy', 'name email');

    const studentProfile = await Profile.findOne({ userId: req.user._id });
    if (!studentProfile) {
      return res.status(404).json({ success: false, message: 'Student profile not found' });
    }

    const now = new Date();

    // Evaluate eligibility and strict verified deadline status for each opportunity
    const opportunities = openOpportunities.map((op) => {
      const deadlineEval = evaluateOpportunityDeadline(op, now);
      const evaluation = evaluatePlacementEligibility(req.user, studentProfile, op);

      // Convert document to plain object to attach transient eligibility & deadline flags
      const plainOp = op.toObject();
      plainOp.isExpired = deadlineEval.isExpired;
      plainOp.deadlineStatus = deadlineEval.deadlineStatus;
      plainOp.isDeadlineVerified = deadlineEval.isDeadlineVerified;
      plainOp.isOpenForApplication = deadlineEval.isOpenForApplication;

      if (!deadlineEval.isOpenForApplication) {
        plainOp.isEligible = false;
        plainOp.ineligibilityReason = deadlineEval.reason || 'Application deadline has passed';
      } else {
        plainOp.isEligible = evaluation.eligible;
        plainOp.ineligibilityReason = evaluation.reason;
      }

      return plainOp;
    });

    return res.json({ success: true, opportunities });
  } catch (error) {
    console.error('getMatchingOpportunities error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch matching opportunities' });
  }
};

// ─── ADMIN/FACULTY/STUDENT: Get list of all Opportunities ──────────────────────
export const getAllOpportunities = async (req, res) => {
  try {
    const { status } = req.query;
    const query = {};
    if (status) query.status = status;

    const list = await Opportunity.find(query)
      .sort({ createdAt: -1 })
      .populate('postedBy', 'name email');

    const now = new Date();
    const opportunities = list.map((op) => {
      const deadlineEval = evaluateOpportunityDeadline(op, now);
      const plainOp = op.toObject();
      plainOp.isExpired = deadlineEval.isExpired;
      plainOp.deadlineStatus = deadlineEval.deadlineStatus;
      plainOp.isDeadlineVerified = deadlineEval.isDeadlineVerified;
      plainOp.isOpenForApplication = deadlineEval.isOpenForApplication;
      return plainOp;
    });

    return res.json({ success: true, opportunities });
  } catch (error) {
    console.error('getAllOpportunities error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch opportunities' });
  }
};

// ─── UNIVERSAL: Get Single Opportunity Details ────────────────────────────────
export const getOpportunityById = async (req, res) => {
  try {
    const opportunity = await Opportunity.findById(req.params.id)
      .populate('postedBy', 'name email');

    if (!opportunity) {
      return res.status(404).json({ success: false, message: 'Opportunity not found' });
    }

    const deadlineEval = evaluateOpportunityDeadline(opportunity, new Date());
    const plainOp = opportunity.toObject();
    plainOp.isExpired = deadlineEval.isExpired;
    plainOp.deadlineStatus = deadlineEval.deadlineStatus;
    plainOp.isDeadlineVerified = deadlineEval.isDeadlineVerified;
    plainOp.isOpenForApplication = deadlineEval.isOpenForApplication;

    return res.json({ success: true, opportunity: plainOp });
  } catch (error) {
    console.error('getOpportunityById error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch opportunity details' });
  }
};
