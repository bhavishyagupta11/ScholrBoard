/**
 * Event Model — University events, workshops, and competitions.
 *
 * Why this collection exists:
 *   The dashboard currently shows hardcoded "Tech Fest 2025" and
 *   "Coding Competition" events.  This model makes events real and
 *   admin-manageable.  Students can register for events, get reminders,
 *   and the system can automatically prompt them to upload proof afterwards.
 *
 * Personalization hook:
 *   Events store target roles/departments.  Students only see events
 *   relevant to them.  Registration is tracked per-user.
 *
 * Relations:
 *   Event.createdBy        → User._id  (admin/faculty who created)
 *   Event.attendees[].userId → User._id (registered students)
 *
 * Collections:
 *   'events' — the main collection name
 */
import mongoose from 'mongoose';

const attendeeSchema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  registeredAt: { type: Date, default: Date.now },
  attended:     { type: Boolean, default: null },  // null = not yet confirmed
  feedbackScore: { type: Number, min: 1, max: 5, default: null },
}, { _id: false });

const eventSchema = new mongoose.Schema(
  {
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Created by is required'],
    },

    // --- Event details ---
    title: {
      type: String,
      required: [true, 'Event title is required'],
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 3000,
    },
    category: {
      type: String,
      enum: [
        'Technical',
        'Cultural',
        'Sports',
        'Workshop',
        'Seminar',
        'Hackathon',
        'Placement',
        'Guest Lecture',
        'Other',
      ],
      required: true,
      index: true,
    },
    bannerImage: {
      type: String,    // Cloudinary URL
      default: null,
    },

    // --- When & where ---
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
      index: true,
    },
    endDate: {
      type: Date,
    },
    startTime: {
      type: String,   // e.g. "09:00 AM"
    },
    venue: {
      type: String,
      trim: true,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    meetingLink: {
      type: String,
      trim: true,
    },

    // --- Organizer info ---
    organizerName: {
      type: String,
      trim: true,
    },
    contactEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },

    // --- Eligibility (for personalized feed) ---
    targetRoles: {
      type: [String],
      enum: ['student', 'faculty', 'admin', 'all'],
      default: ['all'],
    },
    targetDepartments: {
      type: [String],
      default: [],          // empty = all departments
    },
    targetSemesters: {
      type: [Number],
      default: [],          // empty = all semesters
    },

    // --- Registration ---
    registrationDeadline: {
      type: Date,
    },
    maxAttendees: {
      type: Number,
      default: null,
    },
    requiresRegistration: {
      type: Boolean,
      default: true,
    },
    registrationLink: {
      type: String,
      trim: true,
    },
    attendees: {
      type: [attendeeSchema],
      default: [],
    },

    // --- Tags for search and AI recommendations ---
    tags: {
      type: [String],
      default: [],
    },

    // --- State ---
    isPublished: {
      type: Boolean,
      default: false,
      index: true,
    },
    isCancelled: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Published upcoming events for student feed
eventSchema.index({ isPublished: 1, startDate: 1, isCancelled: 1 });
// Category-based filtering
eventSchema.index({ category: 1, isPublished: 1 });

// Virtual: seats remaining
eventSchema.virtual('seatsRemaining').get(function () {
  if (!this.maxAttendees) return null;
  const attendeeCount = Array.isArray(this.attendees) ? this.attendees.length : 0;
  return Math.max(0, this.maxAttendees - attendeeCount);
});

// Virtual: is registration open
eventSchema.virtual('isRegistrationOpen').get(function () {
  if (!this.requiresRegistration) return false;
  if (this.registrationDeadline && this.registrationDeadline < new Date()) return false;
  const attendeeCount = Array.isArray(this.attendees) ? this.attendees.length : 0;
  if (this.maxAttendees && attendeeCount >= this.maxAttendees) return false;
  return true;
});

const Event = mongoose.model('Event', eventSchema);
export default Event;
