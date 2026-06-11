import Opportunity from '../models/Opportunity.js';
import User from '../models/User.js';
import Profile from '../models/Profile.js';
import AuditLog from '../models/AuditLog.js';
import Notification from '../models/Notification.js';
import { evaluatePlacementEligibility } from '../services/eligibilityService.js';
import { withTransaction } from '../utils/withTransaction.js';

// ─── ADMIN: Create Opportunity ────────────────────────────────────────────────
export const createOpportunity = async (req, res) => {
  try {
    const {
      driveCode,
      title,
      company,
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
        type,
        description,
        requirements: requirements || [],
        eligibility: eligibility || {},
        salaryPackage: salaryPackage || 0,
        deadline: new Date(deadline),
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

    const students = await User.find({ role: 'student', isActive: true });
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

    // Evaluate eligibility for each opportunity
    const opportunities = openOpportunities.map((op) => {
      const evaluation = evaluatePlacementEligibility(req.user, studentProfile, op);
      
      // Convert document to plain object to attach transient eligibility flags
      const plainOp = op.toObject();
      plainOp.isEligible = evaluation.eligible;
      plainOp.ineligibilityReason = evaluation.reason;
      
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

    return res.json({ success: true, opportunities: list });
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

    return res.json({ success: true, opportunity });
  } catch (error) {
    console.error('getOpportunityById error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch opportunity details' });
  }
};
