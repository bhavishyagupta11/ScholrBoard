import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: [true, 'Action description is required'],
      index: true,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User who performed action is required'],
      index: true,
    },
    role: {
      type: String,
      required: [true, 'Role is required'],
    },
    targetModel: {
      type: String,
      required: [true, 'Target model name is required'],
      enum: ['Activity', 'OdRequest', 'User', 'Opportunity', 'Application', 'Scholarship', 'ScholarshipApplication'],
      index: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'Target object ID is required'],
      index: true,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
  }
);

auditLogSchema.index({ targetModel: 1, targetId: 1 });
auditLogSchema.index({ performedBy: 1, createdAt: -1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export default AuditLog;
