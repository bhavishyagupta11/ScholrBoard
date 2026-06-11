import mongoose from 'mongoose';

const announcementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Announcement title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    content: {
      type: String,
      required: [true, 'Announcement content is required'],
    },
    category: {
      type: String,
      enum: ['Placement', 'Scholarship', 'Event', 'Academic', 'General'],
      required: [true, 'Category is required'],
      index: true,
    },
    filters: {
      department: {
        type: String, // e.g. "CSE"
        default: null,
      },
      year: {
        type: Number, // e.g. 1 to 4
        default: null,
      },
      section: {
        type: String, // e.g. "A", "B"
        default: null,
      },
      role: {
        type: String,
        enum: ['student', 'faculty', 'all'],
        default: 'all',
      },
    },
    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Author ID is required'],
    },
    expiresAt: {
      type: Date,
      default: null, // null means never expires
    },
  },
  {
    timestamps: true,
  }
);

announcementSchema.index({ 'filters.role': 1, 'filters.department': 1, createdAt: -1 });

const Announcement = mongoose.model('Announcement', announcementSchema);
export default Announcement;
