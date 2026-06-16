/**
 * User Model — Core identity and auth record for every platform user.
 *
 * Why this collection exists:
 *   Every action in the system (activity upload, AI chat, analytics) is
 *   linked to a User via their MongoDB _id.  This is the single source of
 *   truth for authentication + basic identity.  Extended profile information
 *   lives in the separate Profile collection to keep this document lean and
 *   fast to query during auth checks.
 *
 * Relations:
 *   User._id ← referenced by Profile, Activity, LearningProgress,
 *              AiChatHistory, Analytics, Notification, ResumeAnalysis,
 *              SupportTicket, Track
 *
 * V2 Changes (additive only — no migration required):
 *   - role enum: 'department_coordinator' removed in V2.2 (unified to faculty + facultyLevel)
 *   - trackId: new optional field, default null (existing docs unaffected)
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    // --- Auth identifiers ---
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters long'],
      select: false, // Don't return password by default
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,4})+$/,
        'Please provide a valid email address',
      ],
      index: true,
    },

    // --- Basic identity ---
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    avatar: {
      type: String,          // Cloudinary URL for profile picture
      default: null,
    },

    // --- Role + verification ---
    role: {
      type: String,
      enum: {
        // V2.2: 'department_coordinator' removed — unified under 'faculty' + facultyLevel
        values: ['student', 'faculty', 'admin'],
        message: 'Role must be one of: student, faculty, admin',
      },
      required: [true, 'Role is required'],
      index: true,
    },
    verified: {
      type: Boolean,
      default: false,
      index: true,           // admin queries often filter by verified status
    },
    facultyLevel: {
      type: String,
      enum: {
        values: ['faculty', 'coordinator'],
        message: 'facultyLevel must be one of: faculty, coordinator',
      },
      default: 'faculty',
      index: true,
    },

    // --- Role-specific identifiers ---
    studentId: {
      type: String,
      validate: {
        validator: function (v) {
          // Only required when role is 'student'
          if (this.role === 'student') return !!v;
          return true;
        },
        message: 'Student ID is required for student accounts',
      },
    },
    facultyId: {
      type: String,
      validate: {
        validator: function (v) {
          if (this.role === 'faculty') return !!v;
          return true;
        },
        message: 'Faculty ID is required for faculty accounts',
      },
    },

    // --- Academic metadata ---
    department: {
      type: String,
      trim: true,
      validate: {
        validator: function (v) {
          if (this.role === 'student' || this.role === 'faculty') return !!v;
          return true;
        },
        message: 'Department is required for student and faculty accounts',
      },
    },
    semester: {
      type: Number,
      min: [1, 'Semester must be between 1 and 8'],
      max: [8, 'Semester must be between 1 and 8'],
      validate: {
        validator: function (v) {
          if (this.role === 'student') return v >= 1 && v <= 8;
          return true;
        },
        message: 'Valid semester (1–8) is required for student accounts',
      },
    },
    advisorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },

    // --- V2: Career Track (UI personalization only — NOT authorization) ---
    // null = show all modules (default behavior preserved for all existing users)
    trackId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Track',
      default: null,
    },

    // --- Account status ---
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,         // adds createdAt + updatedAt automatically
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// --- Compound indexes for common query patterns ---
userSchema.index({ role: 1, department: 1 });   // admin: filter by role + dept
userSchema.index({ role: 1, verified: 1 });      // faculty: list unverified students
userSchema.index({ email: 1, role: 1 });         // login flow
userSchema.index(
  { studentId: 1 },
  { unique: true, partialFilterExpression: { studentId: { $type: 'string' } } }
);
userSchema.index(
  { facultyId: 1 },
  { unique: true, partialFilterExpression: { facultyId: { $type: 'string' } } }
);

// --- Virtual: profile picture URL with fallback ---
userSchema.virtual('avatarUrl').get(function () {
  return this.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(this.name)}&background=3b82f6&color=fff`;
});

// --- Pre-save hook to hash passwords ---
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// --- Method to compare passwords ---
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;
