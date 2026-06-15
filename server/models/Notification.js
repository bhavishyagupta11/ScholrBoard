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
        'activity_approved',
        'activity_rejected',
        'activity_submitted',
        'placement_new',
        'event_new',
        'event_reminder',
        'event_cancelled',
        'ai_insight',
        'system',
        'profile_incomplete',
        // Phase 2 additions:
        'verification_approved',
        'verification_rejected',
        'revision_requested',
        'od_approved',
        'od_rejected',
        'announcement',
        // Phase 3 additions:
        'opportunity_match',
        'application_status_changed',
        'scholarship_match',
        // V2 — Support Ticket notifications (additive):
        'ticket_created',
        'ticket_assigned',
        'ticket_replied',
        'ticket_resolved',
        'ticket_closed',
        'ticket_status_changed',
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
      enum: [
        'Activity', 'Placement', 'Event', 'AiChatHistory', 'OdRequest', 
        'Announcement', 'Opportunity', 'Application', 'Scholarship', 
        'ScholarshipApplication',
        // V2 addition:
        'SupportTicket',
        null
      ],
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
notificationSchema.index({ relatedId: 1, relatedModel: 1 });
notificationSchema.index({ userId: 1, type: 1, createdAt: -1 });

// TTL index: auto-delete READ notifications older than 180 days to control collection growth.
// Unread notifications are never auto-deleted (readAt is null until explicitly read).
// Change 180 days to match your retention policy before deploying.
notificationSchema.index(
  { readAt: 1 },
  {
    expireAfterSeconds: 180 * 24 * 60 * 60,  // 180 days
    partialFilterExpression: { isRead: true }, // only delete already-read notifications
    name: 'notification_read_ttl',
  }
);

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;

