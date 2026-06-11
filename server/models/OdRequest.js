import mongoose from 'mongoose';

const odRequestSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Student ID is required'],
      index: true,
    },
    eventName: {
      type: String,
      required: [true, 'Event name is required'],
      trim: true,
      maxlength: [200, 'Event name cannot exceed 200 characters'],
    },
    eventDate: {
      type: Date,
      required: [true, 'Event date is required'],
    },
    proofUrl: {
      type: String, // Cloudinary URL for invitation/certificate proof
      default: null,
    },
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected', 'Needs Revision'],
      default: 'Pending',
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // Faculty Advisor who reviewed this request
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    remarks: {
      type: String,
      trim: true,
      maxlength: [1000, 'Remarks cannot exceed 1000 characters'],
    },
    attendanceExemptionGranted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for common queries:
// - Advisor querying pending ODs
// - Student tracking own OD requests
odRequestSchema.index({ studentId: 1, status: 1 });
odRequestSchema.index({ status: 1, createdAt: -1 });

const OdRequest = mongoose.model('OdRequest', odRequestSchema);
export default OdRequest;
