/**
 * SupportTicketMessage.js — Individual messages within a support ticket thread.
 *
 * Each SupportTicket has a thread of messages stored here.
 * isInternal: true marks admin-only notes not visible to the ticket creator.
 *
 * Relations:
 *   SupportTicketMessage.ticketId  → SupportTicket._id
 *   SupportTicketMessage.senderId  → User._id
 */
import mongoose from 'mongoose';

const supportTicketMessageSchema = new mongoose.Schema(
  {
    // --- Ticket reference ---
    ticketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SupportTicket',
      required: [true, 'Ticket ID is required'],
      index: true,
    },

    // --- Message sender ---
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sender ID is required'],
      index: true,
    },

    // --- Content ---
    message: {
      type: String,
      required: [true, 'Message content is required'],
      trim: true,
      maxlength: [5000, 'Message cannot exceed 5000 characters'],
    },

    // --- Optional attachment (Cloudinary URL or external link) ---
    attachmentUrl: {
      type: String,
      trim: true,
      default: null,
    },

    // --- Admin-only internal note (not visible to ticket creator) ---
    isInternal: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// --- Index for fetching all messages in a ticket (chronological) ---
supportTicketMessageSchema.index({ ticketId: 1, createdAt: 1 });
// --- Index for fetching all messages by a user ---
supportTicketMessageSchema.index({ senderId: 1, createdAt: -1 });

const SupportTicketMessage = mongoose.model('SupportTicketMessage', supportTicketMessageSchema);
export default SupportTicketMessage;
