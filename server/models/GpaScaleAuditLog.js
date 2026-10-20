/**
 * GpaScaleAuditLog.js
 *
 * Implements V13 Part 21 audit logging for gpaScale administration.
 * Authority: Admin-controlled student-level override is audit logged.
 * Student self-report is strictly prohibited.
 */
import mongoose from 'mongoose';

const gpaScaleAuditLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  field: {
    type: String,
    default: 'gpaScale',
  },
  oldValue: {
    type: Number,
    default: null,
  },
  newValue: {
    type: Number,
    required: true,
  },
  changedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  changedAt: {
    type: Date,
    default: Date.now,
  },
  reason: {
    type: String,
    trim: true,
    default: null,
  },
}, { timestamps: true });

const GpaScaleAuditLog = mongoose.model('GpaScaleAuditLog', gpaScaleAuditLogSchema);
export default GpaScaleAuditLog;
