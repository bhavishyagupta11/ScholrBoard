/**
 * Track.js — Career Track for UI personalization (NOT authorization).
 *
 * IMPORTANT: Tracks are UI personalization ONLY.
 * A user's trackId controls which sidebar items and dashboard widgets are
 * shown by default. It does NOT:
 *   - block any API
 *   - remove any route
 *   - change any permission
 *   - delete any data
 *
 * If a user has trackId = null, ALL modules are shown (default behavior).
 *
 * Seeded tracks: Engineering, Management, Medical, Commerce, Arts, Law
 */
import mongoose from 'mongoose';

const trackSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Track name is required'],
      trim: true,
      unique: true,
      maxlength: [100, 'Track name cannot exceed 100 characters'],
    },
    slug: {
      type: String,
      required: [true, 'Track slug is required'],
      trim: true,
      unique: true,
      lowercase: true,
      match: [/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    icon: {
      type: String,
      default: '📚',        // emoji icon for UI display
    },
    color: {
      type: String,
      default: '#3b82f6',  // hex color for UI theming
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

const Track = mongoose.model('Track', trackSchema);
export default Track;
