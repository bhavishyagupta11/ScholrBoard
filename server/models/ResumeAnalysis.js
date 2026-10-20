/**
 * ResumeAnalysis Model — Stores AI-powered resume analysis results.
 *
 * Why this collection exists:
 *   Resume analysis is expensive (Gemini API call + PDF parsing).  We store
 *   the result so the user can revisit their analysis without re-triggering
 *   the API call.  We also store the history so users can see how their
 *   resume improved across versions.
 *
 * Design:
 *   Each upload creates one document.  The user may upload multiple resumes
 *   over time — we keep all versions.  The latest one is marked isCurrent.
 *
 * Relations:
 *   ResumeAnalysis.userId → User._id
 */
import mongoose from 'mongoose';

const skillGapSchema = new mongoose.Schema({
  skill:       { type: String, required: true },
  importance:  { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
  suggestion:  { type: String, trim: true },
}, { _id: false });

const sectionFeedbackSchema = new mongoose.Schema({
  section:  { type: String, required: true },  // e.g. "Work Experience", "Projects"
  score:    { type: Number, min: 0, max: 10 },
  feedback: { type: String, trim: true, maxlength: 1000 },
  issues:   [{ type: String }],
  tips:     [{ type: String }],
}, { _id: false });

const resumeAnalysisSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },

    // --- The uploaded file ---
    fileUrl: {
      type: String,
      required: [true, 'Resume file URL is required'],
    },
    fileName: {
      type: String,
      trim: true,
    },
    fileSize: {
      type: Number,           // bytes
    },
    mimeType: {
      type: String,
      enum: ['application/pdf', 'application/msword',
             'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      default: 'application/pdf',
    },

    // --- Extracted text (for AI re-analysis without re-upload) ---
    extractedText: {
      type: String,
      maxlength: 20000,
      default: null,
    },

    // --- AI Analysis results ---
    overallScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
    atsScore: {
      type: Number,           // ATS compatibility score
      min: 0,
      max: 100,
      default: null,
    },
    summary: {
      type: String,           // AI-generated executive summary of the resume
      trim: true,
      maxlength: 2000,
    },
    strengths: {
      type: [String],
      default: [],
    },
    improvements: {
      type: [String],         // Actionable improvement suggestions
      default: [],
    },
    skillsDetected: {
      type: [String],
      default: [],
    },
    parsedData: {
      name: String,
      email: String,
      phone: String,
      links: [{ type: String }],
      education: [{ type: mongoose.Schema.Types.Mixed }],
      experience: [{ type: mongoose.Schema.Types.Mixed }],
      projects: [{ type: mongoose.Schema.Types.Mixed }],
      certifications: [{ type: mongoose.Schema.Types.Mixed }],
      achievements: [{ type: String }],
      technologies: [{ type: String }],
    },
    skillGaps: {
      type: [skillGapSchema],
      default: [],
    },
    sectionFeedback: {
      type: [sectionFeedbackSchema],
      default: [],
    },
    recommendedRoles: {
      type: [String],         // Job roles this resume fits best
      default: [],
    },
    keywordsToAdd: {
      type: [String],         // Missing keywords for target roles
      default: [],
    },

    // --- V13 Structured Evidence & Metadata (Parts 15.2, 7.4) ---
    model:                 { type: String, default: null },
    promptVersion:         { type: String, default: null },
    analysisVersion:       { type: String, default: null },
    evidenceSchemaVersion: { type: String, default: null },
    analysisTimestamp:     { type: Date, default: null },
    careerTrackAtAnalysis: { type: String, default: null },
    sections: {
      hasSummary:     { type: Boolean, default: null },
      hasEducation:   { type: Boolean, default: null },
      hasExperience:  { type: Boolean, default: null },
      hasProjects:    { type: Boolean, default: null },
      hasSkills:      { type: Boolean, default: null },
      hasContactInfo: { type: Boolean, default: null },
    },
    experience: [{
      role:           String,
      company:        String,
      durationMonths: Number,
      isTechnical:    Boolean,
    }],
    technicalSkills: [{ type: String }],
    projects: [{
      title:               String,
      techStack:           [{ type: String }],
      hasQuantifiedImpact: Boolean,
    }],
    qualitySignals: {
      hasQuantifiedItems: { type: Boolean, default: null },
      hasActionVerbs:     { type: Boolean, default: null },
    },
    keywordAlignment:      { type: Number, default: null },
    fieldConfidence: {
      sections:        { type: String, default: null },
      experience:      { type: String, default: null },
      technicalSkills: { type: String, default: null },
      projects:        { type: String, default: null },
      qualitySignals:  { type: String, default: null },
    },
    extractedEvidenceHash: { type: String, default: null },

    // --- State ---
    analysisStatus: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    analysisError: {
      type: String,
      default: null,
    },
    isCurrent: {
      type: Boolean,
      default: true,
      index: true,           // Query: user's current resume
    },
    analysisDurationMs: {
      type: Number,           // How long the AI analysis took (for monitoring)
    },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Get all analyses for a user, newest first
resumeAnalysisSchema.index({ userId: 1, createdAt: -1 });
// Get current resume for a user
resumeAnalysisSchema.index({ userId: 1, isCurrent: 1 });

const ResumeAnalysis = mongoose.model('ResumeAnalysis', resumeAnalysisSchema);
export default ResumeAnalysis;
