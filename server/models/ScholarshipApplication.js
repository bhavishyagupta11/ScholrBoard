import mongoose from 'mongoose';

const scholarshipApplicationSchema = new mongoose.Schema(
  {
    scholarshipId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Scholarship',
      required: [true, 'Scholarship ID is required'],
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
      enum: ['Applied', 'Reviewed', 'Selected', 'Rejected'],
      default: 'Applied',
      index: true,
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
      department: {
        type: String,
        required: true,
      },
      achievementPoints: {
        type: Number,
        default: 0,
      },
      annualIncome: {
        type: Number,
        default: 0,
      },
    },
    incomeCertificateUrl: {
      type: String,
      default: null,
    },
    academicTranscriptUrl: {
      type: String,
      default: null,
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

// Prevent duplicate scholarship applications by the same student
scholarshipApplicationSchema.index({ scholarshipId: 1, studentId: 1 }, { unique: true });
scholarshipApplicationSchema.index({ scholarshipId: 1, status: 1 });
scholarshipApplicationSchema.index({ studentId: 1, appliedAt: -1 });

const ScholarshipApplication = mongoose.model('ScholarshipApplication', scholarshipApplicationSchema);
export default ScholarshipApplication;
