import mongoose from 'mongoose';

const opportunitySchema = new mongoose.Schema(
  {
    driveCode: {
      type: String,
      required: [true, 'Drive code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Opportunity title is required'],
      trim: true,
    },
    company: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
    },
    type: {
      type: String,
      enum: ['Full-time', 'Internship', 'Part-time'],
      required: [true, 'Opportunity type is required'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
    },
    requirements: [
      {
        type: String,
        trim: true,
      },
    ],
    eligibility: {
      minCGPA: {
        type: Number,
        default: 0.0,
        min: 0.0,
        max: 10.0,
      },
      eligibleDepartments: [
        {
          type: String,
          uppercase: true,
          trim: true,
        },
      ],
      minSemester: {
        type: Number,
        default: 1,
        min: 1,
        max: 8,
      },
      passingYear: {
        type: Number,
        required: [true, 'Eligible passing year is required'],
      },
      maxActiveBacklogs: {
        type: Number,
        default: 0,
        min: 0,
      },
      minPlacementReadinessScore: {
        type: Number,
        default: null,
        min: 0,
        max: 100,
      },
    },
    salaryPackage: {
      type: Number,
      default: 0, // In INR (e.g. 1200000 for 12 LPA)
    },
    deadline: {
      type: Date,
      required: [true, 'Application deadline is required'],
    },
    status: {
      type: String,
      enum: ['Draft', 'Published', 'Closed'],
      default: 'Draft',
      index: true,
    },
    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator ID is required'],
    },
  },
  {
    timestamps: true,
  }
);

opportunitySchema.index({ status: 1, deadline: 1 });
opportunitySchema.index({ company: 'text', title: 'text' });

const Opportunity = mongoose.model('Opportunity', opportunitySchema);
export default Opportunity;
