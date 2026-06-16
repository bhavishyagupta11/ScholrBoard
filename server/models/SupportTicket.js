/**
 * SupportTicket.js — Support ticket system for inter-role communication.
 *
 * Flows supported:
 *   student_to_faculty   — Student raises issue with their assigned faculty
 *   student_to_admin     — Student raises issue directly with admin
 *   faculty_to_admin     — Faculty raises issue with admin
 *   coordinator_to_admin — Department coordinator raises issue with admin
 *
 * Status lifecycle:
 *   open → in_progress → waiting_for_response → resolved → closed
 *
 * Relations:
 *   SupportTicket.createdBy  → User._id (ticket creator)
 *   SupportTicket.assignedTo → User._id (the user responsible for resolving)
 *   SupportTicket.resolvedBy → User._id (admin who resolved)
 */
import mongoose from 'mongoose';

const supportTicketSchema = new mongoose.Schema(
  {
    // --- Auto-generated human-readable ticket number ---
    ticketNumber: {
      type: String,
      unique: true,
      index: true,
    },

    // --- Core content ---
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
      maxlength: [200, 'Subject cannot exceed 200 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [5000, 'Description cannot exceed 5000 characters'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: [
        'Academic',
        'Technical',
        'Placement',
        'Administrative',
        'Activity',
        'OD Request',
        'Other',
      ],
      index: true,
    },

    // --- Status lifecycle ---
    status: {
      type: String,
      enum: ['unassigned', 'open', 'in_progress', 'waiting_for_response', 'resolved', 'closed'],
      default: 'open',
      index: true,
    },

    // --- Priority ---
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
      index: true,
    },

    // --- Participants ---
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator is required'],
      index: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },

    // --- Routing metadata ---
    // targetRole: who this ticket is directed at
    targetRole: {
      type: String,
      enum: ['faculty', 'admin'],
      required: [true, 'Target role is required'],
    },
    // flow: describes the communication direction
    flow: {
      type: String,
      enum: [
        'student_to_faculty',
        'student_to_admin',
        'faculty_to_admin',
        'coordinator_to_admin',
      ],
      required: [true, 'Flow is required'],
      index: true,
    },

    // --- Department scope (for coordinator visibility) ---
    department: {
      type: String,
      trim: true,
      index: true,
    },

    // --- Activity tracking ---
    lastActivityAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    // --- Resolution ---
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    closedAt: {
      type: Date,
      default: null,
    },
    resolutionNote: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// --- Auto-generate ticketNumber before save ---
supportTicketSchema.pre('save', async function (next) {
  if (this.ticketNumber) return next();
  // Format: TKT-YYYYMMDD-XXXX (4 digit random suffix)
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Math.floor(1000 + Math.random() * 9000);
  this.ticketNumber = `TKT-${today}-${suffix}`;
  next();
});

// --- Compound indexes for common access patterns ---
supportTicketSchema.index({ createdBy: 1, status: 1, createdAt: -1 });
supportTicketSchema.index({ assignedTo: 1, status: 1, createdAt: -1 });
supportTicketSchema.index({ flow: 1, status: 1, createdAt: -1 });
supportTicketSchema.index({ department: 1, status: 1, createdAt: -1 });
supportTicketSchema.index({ status: 1, lastActivityAt: -1 });

const SupportTicket = mongoose.model('SupportTicket', supportTicketSchema);
export default SupportTicket;
