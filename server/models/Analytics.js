/**
 * Analytics Model — Aggregated performance snapshot per user per period.
 *
 * Why this collection exists:
 *   LearningProgress stores raw daily entries.  Analytics stores COMPUTED
 *   summaries (weekly, monthly) so dashboard charts don't have to run
 *   expensive aggregation queries on every page load.
 *
 *   Think of it as a pre-computed cache of insights.  A background job
 *   (or a triggered computation after daily activity) writes here.
 *
 * Scalability:
 *   One document per user per period (week/month).  Much smaller than
 *   LearningProgress.  Charts are read from here → fast dashboard loads.
 *
 * Relations:
 *   Analytics.userId → User._id
 */
import mongoose from 'mongoose';

const subjectBreakdownSchema = new mongoose.Schema({
  subject:        { type: String, required: true },
  minutesStudied: { type: Number, default: 0 },
  tasksCompleted: { type: Number, default: 0 },
  avgScore:       { type: Number, min: 0, max: 100, default: null },
  strength:       { type: String, enum: ['weak', 'average', 'strong'], default: null },
}, { _id: false });

const analyticsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },

    // --- Period ---
    period: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'semester'],
      required: true,
      index: true,
    },
    periodStart: {
      type: Date,
      required: [true, 'Period start date is required'],
    },
    periodEnd: {
      type: Date,
      required: [true, 'Period end date is required'],
    },

    // --- Learning summary ---
    totalMinutesStudied: { type: Number, default: 0, min: 0 },
    totalDaysActive:     { type: Number, default: 0, min: 0 },
    longestStreak:       { type: Number, default: 0, min: 0 },
    currentStreak:       { type: Number, default: 0, min: 0 },
    totalPointsEarned:   { type: Number, default: 0, min: 0 },

    // --- Activity metrics ---
    activitiesSubmitted: { type: Number, default: 0 },
    activitiesApproved:  { type: Number, default: 0 },
    activitiesRejected:  { type: Number, default: 0 },
    activitiesPending:   { type: Number, default: 0 },

    // --- Academic ---
    currentGPA:          { type: Number, min: 0, max: 10, default: null },
    overallAttendance:   { type: Number, min: 0, max: 100, default: null },

    // --- Coding ---
    problemsSolvedThisPeriod: { type: Number, default: 0 },
    contestsParticipated:     { type: Number, default: 0 },
    githubCommitsThisPeriod:  { type: Number, default: 0 },

    // --- Subject breakdown ---
    subjectBreakdown: {
      type: [subjectBreakdownSchema],
      default: [],
    },

    // --- AI-generated insight summary ---
    aiInsight: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: null,    // e.g. "You improved 15% in DS this week!"
    },

    // --- Percentile vs peers (same dept/semester) ---
    percentileRank: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },

    // --- Computation metadata ---
    computedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// One record per user per period start date
analyticsSchema.index({ userId: 1, period: 1, periodStart: -1 }, { unique: true });
// Admin: get analytics for all users of a period
analyticsSchema.index({ period: 1, periodStart: -1 });

const Analytics = mongoose.model('Analytics', analyticsSchema);
export default Analytics;
