/**
 * Notification Model — In-app notification system.
 *
 * Why this collection exists:
 *   Users need to know when their activity is approved/rejected, when a
 *   new placement is posted, when an event they registered for is cancelled,
 *   or when an AI insight is ready.  This model powers that system.
 *
 * Design:
 *   Each notification has a "type" and an optional "relatedId" that links to
 *   the document that triggered it (an Activity, Placement, etc).
 *   This lets the frontend render "View Activity" buttons inside notifications.
 *
 * Scalability:
 *   TTL index auto-deletes notifications older than 90 days.
 *   Unread count is computed by counting docs where isRead=false for a userId.
 *   Index on (userId, isRead) makes unread count queries O(1) with index.
 *
 * Relations:
 *   Notification.userId    → User._id  (the recipient)
 *   Notification.relatedId → any collection (polymorphic — stored as ObjectId)
 */
import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },

    // --- Content ---
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
      maxlength: 200,
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true,
      maxlength: 1000,
    },

    // --- Type categorizes the notification for styling + grouping ---
    type: {
      type: String,
      enum: [
        'activity_approved',    // faculty approved a student's activity
        'activity_rejected',    // faculty rejected a student's activity
        'activity_submitted',   // student submitted (notifies faculty)
        'placement_new',        // new job posting relevant to this student
        'event_new',            // new event of interest
        'event_reminder',       // event starting soon
        'event_cancelled',      // event was cancelled
        'ai_insight',           // AI generated a new insight or recommendation
        'system',               // general system announcement
        'profile_incomplete',   // reminder to complete profile
      ],
      required: true,
      index: true,
    },

    // --- Deep-link to the relevant resource ---
    relatedId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,      // ObjectId of Activity, Placement, Event, etc.
    },
    relatedModel: {
      type: String,
      enum: ['Activity', 'Placement', 'Event', 'AiChatHistory', null],
      default: null,
    },
    actionUrl: {
      type: String,       // Frontend route to navigate on click e.g. /student/activities
      trim: true,
    },

    // --- Read status ---
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },

    // --- Priority ---
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
  },
  {
    timestamps: true,
  }
);

// Most common query: unread notifications for a user (unread badge count)
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

// Auto-delete after 90 days to keep the collection lean
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
