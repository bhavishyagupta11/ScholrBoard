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
  publicRepos:              { type: Number, default: 0 },
  effectiveRepositoryCount: { type: Number, default: 0 },
  followers:                { type: Number, default: 0 },
  stars:                    { type: Number, default: 0 },
  forks:                    { type: Number, default: 0 },
  topLanguages:             [{ name: String, count: Number }],
  topics:                   [{ type: String }],
  mergedPRsCount:           { type: Number, default: null },
  qualifiedMergedPRsCount:  { type: Number, default: null },
  issuesCount:              { type: Number, default: null },
  qualifiedIssuesCount:     { type: Number, default: null },
  activeDaysLast365:        { type: Number, default: null },
  recentlyActiveRepos:      { type: Number, default: null },
}, { _id: false });

const leetcodeMetricsSchema = new mongoose.Schema({
  totalSolved:           { type: Number, default: null },
  easySolved:            { type: Number, default: null },
  mediumSolved:          { type: Number, default: null },
  hardSolved:            { type: Number, default: null },
  contestRating:         { type: Number, default: null },
  contestGlobalRanking:  { type: Number, default: null },
  attendedContestsCount: { type: Number, default: null },
  totalParticipants:     { type: Number, default: null },
  topPercentage:         { type: Number, default: null },
  streak:                { type: Number, default: null },
  longestStreak:         { type: Number, default: null },
  lastActivityDate:      { type: Date, default: null },
  submissionCalendarRaw: { type: mongoose.Schema.Types.Mixed, default: null },
  activeSubmitDays30d:   { type: Number, default: null },
  activeSubmitDays90d:   { type: Number, default: null },
  activeSubmitDays365d:  { type: Number, default: null },
  recencyLevel:          { type: String, enum: ['L1', 'L2', 'L3', null], default: null },
}, { _id: false });

const codeforcesMetricsSchema = new mongoose.Schema({
  rating:               { type: Number, default: null },
  maxRating:            { type: Number, default: null },
  rank:                 { type: String, default: null },
  maxRank:              { type: String, default: null },
  contribution:         { type: Number, default: null },
  lastContestAt:        { type: Date, default: null },
  contestsParticipated: { type: Number, default: null },
}, { _id: false });

const linkedinMetricsSchema = new mongoose.Schema({
  profileUrl:               { type: String, trim: true, default: null },
  vanityName:               { type: String, trim: true, default: null },
  memberId:                 { type: String, trim: true, default: null },
  identityVerified:         { type: Boolean, default: false },
  followers:                { type: Number, default: null },
  connections:              { type: Number, default: null },
  activityMetricsAvailable: { type: Boolean, default: false },
  scopeGranted:             { type: [String], default: [] },
  reason:                   { type: String, default: 'Activity and engagement metrics unavailable under current approved permissions' },
}, { _id: false });

const scoreBreakdownSchema = new mongoose.Schema({
  dsaScore:             { type: Number, default: null },
  engActivityScore:     { type: Number, default: null },
  repoQualityScore:     { type: Number, default: null },
  cpScore:              { type: Number, default: null },
  breadthScore:         { type: Number, default: null },
  dsaWeight:            { type: Number, default: 0 },
  engActivityWeight:    { type: Number, default: 0 },
  repoQualityWeight:    { type: Number, default: 0 },
  cpWeight:             { type: Number, default: 0 },
  breadthWeight:        { type: Number, default: 0 },
  githubWeight:         { type: Number, default: 0 },
  achievementBonus:     { type: Number, default: 0 },
  readinessBonus:       { type: Number, default: 0 },
  totalEffectiveWeight: { type: Number, default: 0 },
}, { _id: false });

const developerScoreMetaSchema = new mongoose.Schema({
  score:                       { type: Number, default: null },
  coverage:                    { type: Number, default: null },
  confidence:                  { type: String, enum: ['High', 'Medium', 'Low', null], default: null },
  freshness:                   { type: String, enum: ['Fresh', 'Aging', 'Stale', null], default: null },
  evidenceCount:               { type: Number, default: 0 },
  dimensions:                  { type: Map, of: mongoose.Schema.Types.Mixed, default: () => ({}) },
  developerMethodologyVersion: { type: String, default: null },
  calculatedAt:                { type: Date, default: null },
  sourceDataUpdatedAt:         { type: Date, default: null },
  lastVerifiedAt:              { type: Date, default: null },
  evaluationHash:              { type: String, default: null },
  lastSnapshotHash:            { type: String, default: null },
  snapshotSequence:            { type: Number, default: 0 },
  evaluationRevision:          { type: Number, default: 0 },
  activeMilestoneEventId:      { type: String, default: null },
}, { _id: false });

const profileEligibilityStatusSchema = new mongoose.Schema({
  status:         { type: String, enum: ['ELIGIBLE', 'INELIGIBLE', 'UNKNOWN', null], default: null },
  isEligible:     { type: Boolean, default: null },
  reasons:        [{ type: String }],
  conditions:     [{ type: mongoose.Schema.Types.Mixed }],
  ruleSetId:      { type: String, default: null },
  ruleSetVersion: { type: String, default: null },
  evaluatedAt:    { type: Date, default: null },
  notes:          { type: String, default: null },
}, { _id: false });

const placementReadinessMetaSchema = new mongoose.Schema({
  score:                       { type: Number, default: null },
  coverage:                    { type: Number, default: null },
  confidence:                  { type: String, enum: ['High', 'Medium', 'Low', null], default: null },
  freshness:                   { type: String, enum: ['Fresh', 'Aging', 'Stale', null], default: null },
  eligibilityStatus:           { type: profileEligibilityStatusSchema, default: () => ({}) },
  dimensions:                  { type: Map, of: mongoose.Schema.Types.Mixed, default: () => ({}) },
  placementMethodologyVersion: { type: String, default: null },
  calculatedAt:                { type: Date, default: null },
  sourceDataUpdatedAt:         { type: Date, default: null },
  lastVerifiedAt:              { type: Date, default: null },
  evaluationHash:              { type: String, default: null },
  lastSnapshotHash:            { type: String, default: null },
  snapshotSequence:            { type: Number, default: 0 },
  evaluationRevision:          { type: Number, default: 0 },
  activeMilestoneEventId:      { type: String, default: null },
}, { _id: false });

const singlePlatformSyncStateSchema = new mongoose.Schema({
  connectionStatus:           {
    type: String,
    enum: ['UNLINKED', 'LINKED'],
    default: 'UNLINKED',
  },
  syncStatus:                 {
    type: String,
    enum: ['NOT_CONNECTED', 'CONNECTED', 'SYNCING', 'SYNCED', 'SUCCESS', 'IDLE', 'PARTIAL', 'STALE', 'RATE_LIMITED', 'AUTH_EXPIRED', 'UNAVAILABLE', 'ERROR', null],
    default: 'NOT_CONNECTED',
  },
  activeMilestoneEventId:     { type: String, default: null },
  lastSyncAttempt:            { type: Date, default: null },
  lastSuccessfulSync:         { type: Date, default: null },
  lastVerifiedAt:             { type: Date, default: null },
  sourceDataUpdatedAt:        { type: Date, default: null },
  dataHash:                   { type: String, default: null },
  error:                      { type: String, default: null },
  consecutiveFailures:        { type: Number, default: 0 },
  calendarLastSuccessfulSync: { type: Date, default: null },
  calendarSyncError:          { type: String, default: null },
}, { _id: false });

const resumeSyncStateSchema = new mongoose.Schema({
  analysisId:            { type: mongoose.Schema.Types.ObjectId, ref: 'ResumeAnalysis', default: null },
  analysisTimestamp:     { type: Date, default: null },
  lastVerifiedAt:        { type: Date, default: null },
  sourceDataUpdatedAt:   { type: Date, default: null },
  extractedEvidenceHash: { type: String, default: null },
  syncStatus:            {
    type: String,
    enum: ['NOT_CONNECTED', 'CONNECTED', 'SYNCING', 'SYNCED', 'SUCCESS', 'IDLE', 'PARTIAL', 'STALE', 'RATE_LIMITED', 'AUTH_EXPIRED', 'UNAVAILABLE', 'ERROR', null],
    default: 'NOT_CONNECTED',
  },
  status:                {
    type: String,
    enum: ['NOT_CONNECTED', 'CONNECTED', 'SYNCING', 'SYNCED', 'SUCCESS', 'IDLE', 'PARTIAL', 'STALE', 'RATE_LIMITED', 'AUTH_EXPIRED', 'UNAVAILABLE', 'ERROR', null],
    default: 'NOT_CONNECTED',
  },
  error:                 { type: String, default: null },
}, { _id: false });

const platformSyncStatesSchema = new mongoose.Schema({
  github:     { type: singlePlatformSyncStateSchema, default: () => ({}) },
  leetcode:   { type: singlePlatformSyncStateSchema, default: () => ({}) },
  codeforces: { type: singlePlatformSyncStateSchema, default: () => ({}) },
  linkedin:   { type: singlePlatformSyncStateSchema, default: () => ({}) },
  resume:     { type: resumeSyncStateSchema, default: () => ({}) },
}, { _id: false });

const contributionCalendarDaySchema = new mongoose.Schema({
  date:              { type: String, required: true },
  contributionCount: { type: Number, default: 0 },
  count:             { type: Number, default: 0 }, // convenience alias for UI
  contributionLevel: {
    type: String,
    enum: ['NONE', 'FIRST_QUARTILE', 'SECOND_QUARTILE', 'THIRD_QUARTILE', 'FOURTH_QUARTILE', null],
    default: null,
  },
  color:             { type: String, default: null },
  weekday:           { type: Number, default: null },
}, { _id: false });

const contributionCalendarWeekSchema = new mongoose.Schema({
  contributionDays:  { type: [contributionCalendarDaySchema], default: [] },
}, { _id: false });

const githubContributionCalendarSchema = new mongoose.Schema({
  source:                        { type: String, default: 'github_graphql' },
  calendarTotalContributions:    { type: Number, default: 0 },
  restrictedContributionsCount:  { type: Number, default: 0 },
  hasAnyRestrictedContributions: { type: Boolean, default: false },
  weeks:                         { type: [contributionCalendarWeekSchema], default: [] },
  currentStreak:                 { type: Number, default: 0 },
  longestStreak:                 { type: Number, default: 0 },
  totalCommitContributions:      { type: Number, default: 0 },
  totalPullRequestContributions: { type: Number, default: 0 },
  totalIssueContributions:       { type: Number, default: 0 },
  fetchedAt:                     { type: Date, default: null },
  lastSuccessfulSync:            { type: Date, default: null },
  syncStatus:                    {
    type: String,
    enum: ['NOT_CONNECTED', 'CONNECTED', 'SYNCING', 'SYNCED', 'SUCCESS', 'IDLE', 'PARTIAL', 'STALE', 'RATE_LIMITED', 'AUTH_EXPIRED', 'UNAVAILABLE', 'ERROR', null],
    default: 'NOT_CONNECTED',
  },
  syncError:                     { type: String, default: null },
}, { _id: false });

// ─── Legacy Placement Invalidation & Scoring Lock Subschemas (V13 Part 26.1) ─
const placementReadinessLegacySchema = new mongoose.Schema({
  score:          { type: Number, default: null },
  markedLegacyAt: { type: Date, default: null },
  reason:         { type: String, default: null },
}, { _id: false });

const lockDetailSchema = new mongoose.Schema({
  lockedAt:        { type: Date, default: null },
  lockedBy:        { type: String, default: null },
  leaseExpiresAt:  { type: Date, default: null },
  lastHeartbeatAt: { type: Date, default: null },
}, { _id: false });

const scoringLockSchema = new mongoose.Schema({
  developer:          { type: lockDetailSchema, default: () => ({}) },
  placementReadiness: { type: lockDetailSchema, default: () => ({}) },
}, { _id: false });


const codingStatsSchema = new mongoose.Schema({
  // These are self-reported / imported from external platforms
  leetcodeProblemsSolved: { type: Number, default: 0, min: 0 },
  leetcodeContestRating:  { type: Number, default: null },
  leetcodeStreak:         { type: Number, default: null }, // days (null when unknown)
  leetcodeLongestStreak:  { type: Number, default: null },
  githubContributions:    { type: Number, default: 0, min: 0 }, // last 365 days
  githubRepos:            { type: Number, default: 0, min: 0 },
  githubFollowers:        { type: Number, default: 0, min: 0 },
  codeforcesRating:       { type: Number, default: null },
  codeforcesMaxRating:    { type: Number, default: null },
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
    linkedin:             { type: linkedinMetricsSchema,   default: () => ({}) },
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
    gpaScale: {
      type: Number,
      min: [0.1, 'GPA scale must be greater than 0'],
      max: [10, 'GPA scale cannot exceed 10.0'],
      default: 10.0,
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
    careerTrack: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    achievementPoints: {
      type: Number,
      default: 0,
      min: 0,
      index: true,
    },
    placementReadinessScore: {
      type: Number,
      default: null,
      min: 0,
      max: 100,
    },
    developerScore: {
      type: Number,
      default: null,
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
      default: null,
    },
    scoringFormulaVersion: {
      type: String,
      default: null,
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

    // --- ScholrBoard V13 Scoring & Platform Sync Metadata ---
    developerScoreMeta: {
      type: developerScoreMetaSchema,
      default: () => ({}),
    },
    placementReadinessMeta: {
      type: placementReadinessMetaSchema,
      default: () => ({}),
    },
    platformSyncStates: {
      type: platformSyncStatesSchema,
      default: () => ({}),
    },
    githubContributionCalendar: {
      type: githubContributionCalendarSchema,
      default: () => ({}),
    },
    placementReadinessLegacy: {
      type: placementReadinessLegacySchema,
      default: () => ({}),
    },
    scoringLock: {
      type: scoringLockSchema,
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
