import mongoose from 'mongoose';

const scholarshipSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Scholarship title is required'],
      trim: true,
    },
    provider: {
      type: String,
      required: [true, 'Provider name is required'],
      trim: true,
    },
    amount: {
      type: Number,
      required: [true, 'Award amount is required'],
      min: 0,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
    },
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
      minAchievementPoints: {
        type: Number,
        default: 0,
        min: 0,
      },
      maxAnnualIncome: {
        type: Number,
        default: null, // null means no income limit
        min: 0,
      },
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

scholarshipSchema.index({ status: 1, deadline: 1 });

const Scholarship = mongoose.model('Scholarship', scholarshipSchema);
export default Scholarship;
