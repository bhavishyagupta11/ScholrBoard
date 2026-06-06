/**
 * LearningProgress Model — Daily study tracking, streaks, and topic mastery.
 *
 * Why this collection exists:
 *   This is the engine behind personalized analytics and AI recommendations.
 *   Instead of storing one giant "total hours" field on the user, we store
 *   one document per day per user.  This lets us build time-series charts,
 *   calculate streaks, detect peak study hours, and identify weak topics.
 *
 * Design decision:
 *   We use a "date + userId" compound unique index so there is exactly
 *   ONE document per student per calendar day.  An API call at 9am and
 *   another at 8pm on the same day update the SAME document (via upsert).
 *
 * Scalability:
 *   With ~1000 students × 365 days = ~365,000 documents/year.
 *   TTL index set to 2 years to auto-purge very old data.
 *   Compound index on (userId, date) covers 100% of common queries.
 *
 * Relations:
 *   LearningProgress.userId → User._id
 */
import mongoose from 'mongoose';

const topicProgressSchema = new mongoose.Schema({
  topic:      { type: String, required: true, trim: true },  // e.g. "Data Structures"
  subject:    { type: String, trim: true },                  // e.g. "Computer Science"
  minutesSpent: { type: Number, default: 0, min: 0 },
  confidence: {                                               // self-reported: 1=low, 5=high
    type: Number,
    min: 1,
    max: 5,
    default: null,
  },
  resourcesConsumed: { type: Number, default: 0 },          // videos / articles read
  questionsAttempted: { type: Number, default: 0 },
  questionsCorrect:   { type: Number, default: 0 },
}, { _id: false });

const learningProgressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },

    // --- The specific calendar date this record covers ---
    date: {
      type: Date,
      required: [true, 'Date is required'],
      // We strip time component when saving so this is always midnight UTC
    },

    // --- Study session data ---
    totalMinutesStudied: {
      type: Number,
      default: 0,
      min: 0,
    },
    sessionsCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // --- Topic breakdown ---
    topics: {
      type: [topicProgressSchema],
      default: [],
    },

    // --- Goals ---
    dailyGoalMinutes:   { type: Number, default: 30 },
    goalAchieved:       { type: Boolean, default: false },

    // --- Mood / energy (optional self-report for AI personalization) ---
    moodScore: {
      type: Number,
      min: 1,
      max: 5,
      default: null,
    },

    // --- Gamification ---
    streakDay: {
      type: Number,
      default: 1,
      min: 1,
    },
    pointsEarned: {
      type: Number,
      default: 0,
      min: 0,
    },

    // --- Coding platform sync ---
    leetcodeSolvedToday:    { type: Number, default: 0 },
    githubCommitsToday:     { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

// One record per user per day — enforced at the DB level
learningProgressSchema.index({ userId: 1, date: 1 }, { unique: true });

// For streak calculation: get last 30 days for a user efficiently
learningProgressSchema.index({ userId: 1, date: -1 });

// Auto-delete records older than 2 years (730 days)
learningProgressSchema.index({ date: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 730 });

const LearningProgress = mongoose.model('LearningProgress', learningProgressSchema);
export default LearningProgress;
