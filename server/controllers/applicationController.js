import Application from '../models/Application.js';
import Opportunity from '../models/Opportunity.js';
import Profile from '../models/Profile.js';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import Notification from '../models/Notification.js';
import { evaluatePlacementEligibility } from '../services/eligibilityService.js';
import { withTransaction } from '../utils/withTransaction.js';

const LEGAL_ADMIN_TRANSITIONS = {
  Applied: ['Shortlisted'],
  Interviewed: ['Selected', 'Rejected'],
};

// ─── STUDENT: Apply to Opportunity (placement drive) ──────────────────────────
export const applyToOpportunity = async (req, res) => {
  try {
    const { id } = req.params; // Opportunity ID
    const { resumeUrl } = req.body;

    if (!resumeUrl) {
      return res.status(400).json({ success: false, message: 'Resume URL is required to apply' });
    }

    const opportunity = await Opportunity.findById(id);
    if (!opportunity) {
      return res.status(404).json({ success: false, message: 'Opportunity not found' });
    }

    if (opportunity.status !== 'Published') {
      return res.status(400).json({ success: false, message: 'Applications are not open for this opportunity' });
    }

    if (new Date() > new Date(opportunity.deadline)) {
      return res.status(400).json({ success: false, message: 'Application deadline has passed' });
    }

    // Check if duplicate application exists
    const duplicate = await Application.findOne({ opportunityId: id, studentId: req.user._id });
    if (duplicate) {
      return res.status(400).json({ success: false, message: 'You have already applied for this opportunity' });
    }

    // Retrieve student profile details
    const studentProfile = await Profile.findOne({ userId: req.user._id });
    if (!studentProfile) {
      return res.status(404).json({ success: false, message: 'Student profile not found' });
    }

    // Evaluate eligibility using matching engine
    const evaluation = evaluatePlacementEligibility(req.user, studentProfile, opportunity);
    if (!evaluation.eligible) {
      return res.status(400).json({
        success: false,
        message: `Eligibility Check Failed: ${evaluation.reason}`,
      });
    }

    // Freeze snapshot data
    const eligibilitySnapshot = {
      cgpa: studentProfile.gpa || 0,
      semester: req.user.semester || 1,
      department: req.user.department || '',
      activeBacklogs: studentProfile.backlogs || 0,
      placementReadinessScore: studentProfile.placementReadinessScore || 0,
      developerScore: studentProfile.developerScore || 0,
      achievementPoints: studentProfile.achievementPoints || 0,
    };

    const application = await withTransaction(async (session) => {
      const [created] = await Application.create([{
        opportunityId: id,
        studentId: req.user._id,
        status: 'Applied',
        resumeUrl: resumeUrl.trim(),
        eligibilitySnapshot,
      }], { session });

      await AuditLog.create([{
        action: 'apply_opportunity',
        performedBy: req.user._id,
        role: req.user.role,
        targetModel: 'Application',
        targetId: created._id,
        details: { driveCode: opportunity.driveCode, company: opportunity.company, title: opportunity.title },
      }], { session });

      return created;
    });

    return res.status(201).json({
      success: true,
      message: 'Application submitted successfully',
      application,
    });
  } catch (error) {
    console.error('applyToOpportunity error:', error);
    return res.status(500).json({ success: false, message: 'Failed to submit application' });
  }
};

// ─── STUDENT: Withdraw Application ────────────────────────────────────────────
export const withdrawApplication = async (req, res) => {
  try {
    const { id } = req.params; // Application ID

    const application = await Application.findOne({ _id: id, studentId: req.user._id })
      .populate('opportunityId', 'company title driveCode');

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    if (!['Applied', 'Shortlisted', 'Interviewed'].includes(application.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot withdraw an application that is already ${application.status}`,
      });
    }

    await withTransaction(async (session) => {
      application.status = 'Withdrawn';
      await application.save({ session });

      await AuditLog.create([{
        action: 'withdraw_application',
        performedBy: req.user._id,
        role: req.user.role,
        targetModel: 'Application',
        targetId: application._id,
        details: {
          driveCode: application.opportunityId?.driveCode,
          company: application.opportunityId?.company,
          title: application.opportunityId?.title,
        },
      }], { session });
    });

    return res.json({
      success: true,
      message: 'Application withdrawn successfully',
      application,
    });
  } catch (error) {
    console.error('withdrawApplication error:', error);
    return res.status(500).json({ success: false, message: 'Failed to withdraw application' });
  }
};

// ─── ADMIN: Get Applications for specific Opportunity ─────────────────────────
export const getOpportunityApplications = async (req, res) => {
  try {
    const { id } = req.params; // Opportunity ID
    const { status } = req.query;

    const query = { opportunityId: id };
    if (status) query.status = status;

    const list = await Application.find(query)
      .populate('studentId', 'name studentId department semester email')
      .sort({ appliedAt: -1 });

    return res.json({ success: true, applications: list });
  } catch (error) {
    console.error('getOpportunityApplications error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch applicants' });
  }
};

// ─── ADMIN: Review Application Status (Shortlist, Select, Reject) ──────────────
export const reviewApplicationStatus = async (req, res) => {
  try {
    const { id } = req.params; // Application ID
    const { status, remarks } = req.body;

    if (!['Shortlisted', 'Rejected', 'Selected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be one of: "Shortlisted", "Rejected", "Selected"',
      });
    }

    const application = await Application.findById(id)
      .populate('opportunityId', 'company title driveCode')
      .populate('studentId', 'name email');

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    const allowedTargets = LEGAL_ADMIN_TRANSITIONS[application.status] || [];
    if (!allowedTargets.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Illegal application transition: ${application.status} -> ${status}`,
      });
    }

    const prevStatus = application.status;
    const studentId = application.studentId._id;

    await withTransaction(async (session) => {
      application.status = status;
      application.remarks = remarks?.trim() || null;
      await application.save({ session });

      await AuditLog.create([{
        action: 'transition_application_status',
        performedBy: req.user._id,
        role: req.user.role,
        targetModel: 'Application',
        targetId: application._id,
        details: {
          driveCode: application.opportunityId?.driveCode,
          company: application.opportunityId?.company,
          title: application.opportunityId?.title,
          previousStatus: prevStatus,
          newStatus: status,
          remarks,
        },
      }], { session });

      let titleStr = `Application Updated: ${application.opportunityId?.company}`;
      let msgStr = `Your application for "${application.opportunityId?.title}" status changed to: ${status}.`;
      if (status === 'Selected') {
        titleStr = `🎉 Placement Offer Selected: ${application.opportunityId?.company}`;
        msgStr = `Congratulations! You have been selected for the "${application.opportunityId?.title}" offer by ${application.opportunityId?.company}!`;
      }

      await Notification.create([{
        userId: studentId,
        title: titleStr,
        message: msgStr,
        type: 'application_status_changed',
        relatedId: application._id,
        relatedModel: 'Application',
        actionUrl: '/student/placements',
        priority: status === 'Selected' ? 'high' : 'medium',
      }], { session });
    });

    return res.json({
      success: true,
      message: `Candidate application ${status.toLowerCase()} successfully`,
      application,
    });
  } catch (error) {
    console.error('reviewApplicationStatus error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update candidate status' });
  }
};

// ─── ADMIN: Schedule Interview Details ─────────────────────────────────────────
export const scheduleInterview = async (req, res) => {
  try {
    const { id } = req.params; // Application ID
    const { dateTime, venue, instructions } = req.body;

    if (!dateTime || !venue) {
      return res.status(400).json({ success: false, message: 'Required fields missing: dateTime, venue' });
    }

    const application = await Application.findById(id)
      .populate('opportunityId', 'company title driveCode')
      .populate('studentId', 'name email');

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    if (application.status !== 'Shortlisted') {
      return res.status(400).json({
        success: false,
        message: `Illegal application transition: ${application.status} -> Interviewed`,
      });
    }

    const prevStatus = application.status;
    const studentId = application.studentId._id;
    const interviewInstructions = instructions?.trim() || 'Please attend with professional attire and a copy of your resume.';

    await withTransaction(async (session) => {
      application.status = 'Interviewed';
      application.interviewDetails = {
        dateTime: new Date(dateTime),
        venue: venue.trim(),
        instructions: interviewInstructions,
      };
      await application.save({ session });

      await AuditLog.create([{
        action: 'schedule_interview',
        performedBy: req.user._id,
        role: req.user.role,
        targetModel: 'Application',
        targetId: application._id,
        details: {
          driveCode: application.opportunityId?.driveCode,
          company: application.opportunityId?.company,
          title: application.opportunityId?.title,
          previousStatus: prevStatus,
          newStatus: 'Interviewed',
          dateTime,
          venue,
        },
      }], { session });

      await Notification.create([{
        userId: studentId,
        title: `Interview Scheduled: ${application.opportunityId?.company}`,
        message: `Interview scheduled on ${new Date(dateTime).toLocaleString()} at ${venue}. Instructions: ${interviewInstructions}`,
        type: 'application_status_changed',
        relatedId: application._id,
        relatedModel: 'Application',
        actionUrl: '/student/placements',
        priority: 'high',
      }], { session });
    });

    return res.json({
      success: true,
      message: 'Interview details recorded and student notified successfully',
      application,
    });
  } catch (error) {
    console.error('scheduleInterview error:', error);
    return res.status(500).json({ success: false, message: 'Failed to schedule interview' });
  }
};

// ─── STUDENT: Get own Placement Applications list ─────────────────────────────
export const getMyApplications = async (req, res) => {
  try {
    const list = await Application.find({ studentId: req.user._id })
      .populate('opportunityId', 'company title driveCode salaryPackage deadline status')
      .sort({ appliedAt: -1 });

    return res.json({ success: true, applications: list });
  } catch (error) {
    console.error('getMyApplications error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch application history' });
  }
};
