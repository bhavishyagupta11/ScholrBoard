/**
 * Profile Model — Extended user data that grows over time.
 *
 * Why separate from User?
 *   User.js is queried on every single authenticated request (auth check).
 *   Keeping it lean matters for latency.  Profile data — bio, skills,
 *   projects, social links — is only needed on the profile/dashboard pages,
 *   so it lives in a separate collection that we JOIN only when needed.
 *
 * Scalability:
 *   One Profile document per user (1:1).  Sub-documents (skills, projects,
 *   education) use arrays so they stay embedded and avoid extra round-trips.
 *   Arrays are fine here because a student won't have thousands of entries.
 *
 * Relations:
 *   Profile.userId → User._id
 */
import mongoose from 'mongoose';

// ─── Sub-document schemas ────────────────────────────────────────────────────

const projectSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  description: { type: String, trim: true, maxlength: 500 },
  techStack:   [{ type: String, trim: true }],
  githubLink:  { type: String, trim: true },
  liveLink:    { type: String, trim: true },
  startDate:   { type: Date },
  endDate:     { type: Date },
  isFeatured:  { type: Boolean, default: false },
}, { _id: true });

const educationSchema = new mongoose.Schema({
  institution: { type: String, required: true, trim: true },
  degree:      { type: String, required: true, trim: true },  // e.g. "B.Tech"
  field:       { type: String, trim: true },                  // e.g. "CSE"
  startYear:   { type: Number },
  endYear:     { type: Number },
  grade:       { type: String, trim: true },                  // GPA or percentage
  isCurrent:   { type: Boolean, default: false },
}, { _id: true });

const certificationSchema = new mongoose.Schema({
  title:        { type: String, required: true, trim: true },
  issuedBy:     { type: String, trim: true },
  issuedDate:   { type: Date },
  expiryDate:   { type: Date },
  credentialId: { type: String, trim: true },
  credentialUrl:{ type: String, trim: true },
  skills:       [{ type: String, trim: true }],
  technologies: [{ type: String, trim: true }],
  sourceFileUrl:{ type: String, trim: true },
  extractionConfidence: { type: Number, min: 0, max: 100, default: null },
}, { _id: true });

const socialLinksSchema = new mongoose.Schema({
  github:    { type: String, trim: true },
  linkedin:  { type: String, trim: true },
  leetcode:  { type: String, trim: true },
  codeforces:{ type: String, trim: true },
  portfolio: { type: String, trim: true },
  twitter:   { type: String, trim: true },
}, { _id: false });

const githubMetricsSchema = new mongoose.Schema({
  publicRepos:   { type: Number, default: 0 },
  effectiveRepositoryCount: { type: Number, default: 0 },
  followers:     { type: Number, default: 0 },
  stars:         { type: Number, default: 0 },
  forks:         { type: Number, default: 0 },
  topLanguages:  [{ name: String, count: Number }],
  topics:        [{ type: String }],
}, { _id: false });

const leetcodeMetricsSchema = new mongoose.Schema({
  totalSolved:   { type: Number, default: 0 },
  easySolved:    { type: Number, default: 0 },
  mediumSolved:  { type: Number, default: 0 },
  hardSolved:    { type: Number, default: 0 },
  contestRating: { type: Number, default: 0 },
  contestGlobalRanking: { type: Number, default: null },
  attendedContestsCount: { type: Number, default: 0 },
}, { _id: false });

const codeforcesMetricsSchema = new mongoose.Schema({
  rating:        { type: Number, default: 0 },
  maxRating:     { type: Number, default: 0 },
  rank:          { type: String, default: null },
  maxRank:       { type: String, default: null },
  contribution:  { type: Number, default: 0 },
  lastContestAt: { type: Date, default: null },
}, { _id: false });

const scoreBreakdownSchema = new mongoose.Schema({
  githubWeight:     { type: Number, default: 0 },
  dsaWeight:        { type: Number, default: 0 },
  cpWeight:         { type: Number, default: 0 },
  achievementBonus: { type: Number, default: 0 },
  readinessBonus:   { type: Number, default: 0 },
}, { _id: false });

const codingStatsSchema = new mongoose.Schema({
  // These are self-reported / imported from external platforms
  leetcodeProblemsSolved: { type: Number, default: 0, min: 0 },
  leetcodeContestRating:  { type: Number, default: 0, min: 0 },
  leetcodeStreak:         { type: Number, default: 0, min: 0 }, // days
  githubContributions:    { type: Number, default: 0, min: 0 }, // last 365 days
  githubRepos:            { type: Number, default: 0, min: 0 },
  githubFollowers:        { type: Number, default: 0, min: 0 },
  codeforcesRating:       { type: Number, default: 0, min: 0 },
  codeforcesMaxRating:    { type: Number, default: 0, min: 0 },
  codeforcesRank:         { type: String, trim: true },
  codechefRating:         { type: Number, default: 0, min: 0 },
  geeksforgeeksScore:     { type: Number, default: 0, min: 0 },
  hackerrankBadges:       { type: Number, default: 0, min: 0 },
  linkedInConnected:      { type: Boolean, default: false },
  
  // Platform Usernames
  profiles: {
    github:       { type: String, trim: true },
    leetcode:     { type: String, trim: true },
    codeforces:   { type: String, trim: true },
    geeksforgeeks:{ type: String, trim: true },
    hackerrank:   { type: String, trim: true },
    codechef:     { type: String, trim: true },
    linkedin:     { type: String, trim: true },
  },

  // Caching Metadata
  githubLastSyncedAt:     { type: Date, default: null },
  leetcodeLastSyncedAt:   { type: Date, default: null },
  codeforcesLastSyncedAt: { type: Date, default: null },
  lastSyncedAt:           { type: Date, default: null },

  // Sync Concurrency Protection
  isSyncing:              { type: Boolean, default: false },
  syncStartedAt:          { type: Date, default: null },

  // Raw platform metrics
  rawMetrics: {
    github:               { type: githubMetricsSchema,     default: () => ({}) },
    leetcode:             { type: leetcodeMetricsSchema,   default: () => ({}) },
    codeforces:           { type: codeforcesMetricsSchema, default: () => ({}) },
  },

  platformDetails: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: () => ({}),
  },
  lastUpdated:            { type: Date, default: Date.now },
}, { _id: false });

// ─── Main Profile schema ─────────────────────────────────────────────────────

const profileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      unique: true,      // 1:1 with User
      index: true,
    },

    // --- Bio & personal info ---
    bio: {
      type: String,
      trim: true,
      maxlength: [600, 'Bio cannot exceed 600 characters'],
    },
    phone: {
      type: String,
      trim: true,
      default: null,
      validate: {
        validator(value) {
          if (value == null || value === '') return true;
          return /^\+?[\d\s\-()]{7,15}$/.test(String(value));
        },
        message: 'Please provide a valid phone number',
      },
    },
    dateOfBirth: {
      type: Date,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'non-binary', 'prefer-not-to-say', null],
      default: null,
    },

    // --- Academic details (for students) ---
    gpa: {
      type: Number,
      min: [0, 'GPA cannot be negative'],
      max: [10, 'GPA cannot exceed 10'],
      default: null,
      index: true,
    },
    attendanceOverall: {
      type: Number,
      min: 0,
      max: 100,
      default: null,         // percentage
    },
    backlogs: {
      type: Number,
      default: 0,
      min: 0,
    },
    achievementPoints: {
      type: Number,
      default: 0,
      min: 0,
      index: true,
    },
    placementReadinessScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    developerScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
      index: true,
    },
    githubScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
      index: true,
    },
    dsaScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
      index: true,
    },
    cpScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
      index: true,
    },
    developerScoreVersion: {
      type: Number,
      default: 1,
    },
    scoringFormulaVersion: {
      type: String,
      default: 'v1.0.0',
    },
    lastScoreCalculatedAt: {
      type: Date,
      default: null,
    },
    lastScoreCalculationReason: {
      type: String,
      default: null,
    },
    scoreBreakdown: {
      type: scoreBreakdownSchema,
      default: () => ({}),
    },

    // --- Sync Status & Throttling Metadata ---
    lastSyncStatus: {
      type: String,
      enum: ['success', 'failed', 'cooldown', null],
      default: null,
    },
    lastSyncError: {
      type: String,
      default: null,
    },
    consecutiveSyncFailures: {
      type: Number,
      default: 0,
    },
    lastFailedSyncAt: {
      type: Date,
      default: null,
    },

    // --- Skills (free-form tags) ---
    skills: {
      type: [String],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 50,
        message: 'Cannot store more than 50 skills',
      },
      index: true,
    },

    // --- Goals ---
    careerGoal: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    learningGoalMinutesPerDay: {
      type: Number,
      default: 30,
      min: 0,
    },
    targetCompanies: {
      type: [String],
      default: [],
    },
    interests: {
      type: [String],
      default: [],
    },

    // --- Content arrays (sub-documents) ---
    projects:       { type: [projectSchema],       default: [] },
    education:      { type: [educationSchema],     default: [] },
    certifications: { type: [certificationSchema], default: [] },
    socialLinks:    { type: socialLinksSchema,     default: () => ({}) },
    codingStats:    { type: codingStatsSchema,     default: () => ({}) },

    // --- Resume ---
    resumeUrl: {
      type: String,     // Cloudinary URL of the latest uploaded resume
      default: null,
    },
    resumeUpdatedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound index for Talent Discovery sorting by developerScore and GPA
profileSchema.index({ developerScore: -1, gpa: -1 });

const Profile = mongoose.model('Profile', profileSchema);
export default Profile;
