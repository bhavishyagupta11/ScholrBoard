/**
 * Placement Model — Job and internship postings managed by admin/faculty.
 *
 * Why this collection exists:
 *   Currently the dashboard shows hardcoded TCS/Microsoft/Infosys listings.
 *   This model replaces those with real admin-managed postings.
 *   Students can then see ONLY postings relevant to their department/year.
 *
 * Personalization hook:
 *   Postings store eligibility criteria (minGPA, eligible departments,
 *   eligible semesters).  The API filters postings per user so each student
 *   sees only the roles they qualify for — no more showing every student
 *   the same list.
 *
 * Relations:
 *   Placement.postedBy     → User._id  (admin who created the posting)
 *   Placement.applicants[] → User._id  (students who applied)
 *
 * Collections:
 *   'placements' — the main collection name
 */
import mongoose from 'mongoose';

const applicantSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  appliedAt: { type: Date, default: Date.now },
  status:    {
    type: String,
    enum: ['Applied', 'Shortlisted', 'Interviewed', 'Selected', 'Rejected'],
    default: 'Applied',
  },
  notes: { type: String, maxlength: 500 },
}, { _id: false });

const placementSchema = new mongoose.Schema(
  {
    // --- Who posted it ---
    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Posted by is required'],
    },

    // --- Company / role info ---
    company: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
      maxlength: 200,
    },
    companyLogo: {
      type: String,       // Cloudinary URL
      default: null,
    },
    role: {
      type: String,
      required: [true, 'Role / position title is required'],
      trim: true,
      maxlength: 200,
    },
    jobType: {
      type: String,
      enum: ['Full-time', 'Internship', 'Part-time', 'Contract'],
      required: true,
    },
    location: {
      type: String,
      trim: true,
    },
    isRemote: {
      type: Boolean,
      default: false,
    },

    // --- Compensation ---
    package: {
      type: String,        // "7.5 LPA" or "50,000/month" — stored as string for flexibility
      trim: true,
    },
    stipend: {
      type: String,        // for internships
      trim: true,
    },

    // --- Description ---
    description: {
      type: String,
      trim: true,
      maxlength: 5000,
    },
    requirements: {
      type: [String],
      default: [],
    },
    skills: {
      type: [String],
      default: [],
    },

    // --- Eligibility filters (used for personalized feed) ---
    eligibleDepartments: {
      type: [String],
      default: [],          // empty = all departments eligible
    },
    minGPA: {
      type: Number,
      min: 0,
      max: 10,
      default: 0,
    },
    minSemester: {
      type: Number,
      min: 1,
      max: 8,
      default: 1,
    },
    maxSemester: {
      type: Number,
      min: 1,
      max: 8,
      default: 8,
    },

    // --- Dates ---
    deadline: {
      type: Date,
      required: [true, 'Application deadline is required'],
      index: true,
    },
    driveDate: {
      type: Date,         // campus drive / interview date
    },

    // --- Application tracking ---
    applicationLink: {
      type: String,        // external URL or null for campus-only drive
      trim: true,
    },
    applicants: {
      type: [applicantSchema],
      default: [],
    },
    maxApplicants: {
      type: Number,
      default: null,       // null = unlimited
    },

    // --- Status ---
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Index for the student personalized feed query:
// Active postings → filter by department and deadline not passed
placementSchema.index({ isActive: 1, deadline: 1, eligibleDepartments: 1 });
placementSchema.index({ jobType: 1, isActive: 1 });

// Virtual: whether deadline has passed
placementSchema.virtual('isExpired').get(function () {
  return this.deadline && this.deadline < new Date();
});

const Placement = mongoose.model('Placement', placementSchema);
export default Placement;
