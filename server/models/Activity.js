/**
 * Activity Model — Student extra-curricular and academic submissions.
 *
 * Why this collection exists:
 *   Every student can upload activities (hackathons, workshops, certifications,
 *   volunteer work) that go through a faculty/admin approval workflow.
 *   This is the core workflow of the platform — the complete audit trail from
 *   submission → pending → approved/rejected lives here.
 *
 * Scalability:
 *   Indexed on (userId, status) because the most common queries are:
 *     - "Give me all PENDING activities for student X"
 *     - "Give me all activities awaiting approval for faculty Y's students"
 *   Soft-delete support via isArchived flag.
 *
 * Relations:
 *   Activity.userId     → User._id   (the student who submitted)
 *   Activity.reviewedBy → User._id   (the faculty/admin who reviewed)
 */
import mongoose from 'mongoose';

const activitySchema = new mongoose.Schema(
  {
    // --- Ownership ---
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },

    // --- Activity details ---
    title: {
      type: String,
      required: [true, 'Activity title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: [
        'Competitions',
        'Certifications',
        'Workshops',
        'Volunteering',
        'Research',
        'Internship',
        'Sports',
        'Cultural',
        'Technical',
        'Leadership',
        'Other',
      ],
      index: true,
    },
    subCategory: {
      type: String,
      trim: true,   // e.g. "National Level", "Online", "Inter-College"
    },

    // --- Timing ---
    activityDate: {
      type: Date,
      required: [true, 'Activity date is required'],
    },
    duration: {
      type: String,   // e.g. "2 days", "3 hours"
      trim: true,
    },

    // --- Evidence ---
    proofUrl: {
      type: String,        // Cloudinary URL for certificate / photo / document
      default: null,
    },
    externalLink: {
      type: String,        // GitHub repo, competition link, etc.
      trim: true,
    },

    // --- Approval workflow ---
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected', 'Needs Revision'],
      default: 'Pending',
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',        // faculty or admin who reviewed this
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewComments: {
      type: String,
      trim: true,
      maxlength: [1000, 'Review comments cannot exceed 1000 characters'],
    },
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    // --- Scoring / points (for gamification) ---
    points: {
      type: Number,
      default: 0,
      min: 0,
    },

    // --- Soft delete ---
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound indexes for the most common access patterns
activitySchema.index({ userId: 1, status: 1 });           // student's activities by status
activitySchema.index({ userId: 1, category: 1 });          // student's activities by category
activitySchema.index({ status: 1, createdAt: -1 });        // admin/faculty: recent pending items
activitySchema.index({ userId: 1, isArchived: 1, status: 1 }); // main activity list query

const Activity = mongoose.model('Activity', activitySchema);
export default Activity;
