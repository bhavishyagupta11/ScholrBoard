import mongoose from 'mongoose';

const applicationSchema = new mongoose.Schema(
  {
    opportunityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Opportunity',
      required: [true, 'Opportunity ID is required'],
      index: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Student ID is required'],
      index: true,
    },
    status: {
      type: String,
      enum: ['Applied', 'Shortlisted', 'Interviewed', 'Selected', 'Rejected', 'Withdrawn'],
      default: 'Applied',
      index: true,
    },
    resumeUrl: {
      type: String,
      required: [true, 'Resume URL is required'],
    },
    appliedAt: {
      type: Date,
      default: Date.now,
    },
    eligibilitySnapshot: {
      cgpa: {
        type: Number,
        required: true,
      },
      semester: {
        type: Number,
        required: true,
      },
      department: {
        type: String,
        required: true,
      },
      activeBacklogs: {
        type: Number,
        required: true,
      },
      placementReadinessScore: {
        type: Number,
        default: 0,
      },
      developerScore: {
        type: Number,
        default: 0,
      },
      achievementPoints: {
        type: Number,
        default: 0,
      },
    },
    interviewDetails: {
      dateTime: {
        type: Date,
        default: null,
      },
      venue: {
        type: String,
        default: null,
      },
      instructions: {
        type: String,
        default: null,
      },
    },
    remarks: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate applications by same student for the same placement drive
applicationSchema.index({ opportunityId: 1, studentId: 1 }, { unique: true });
applicationSchema.index({ opportunityId: 1, status: 1 });
applicationSchema.index({ studentId: 1, status: 1 });
applicationSchema.index({ studentId: 1, appliedAt: -1 });

const Application = mongoose.model('Application', applicationSchema);
export default Application;
