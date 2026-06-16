/**
 * Track.js — Career Track for UI personalization
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
    code: {
      type: String,
      required: [true, 'Track code is required'],
      trim: true,
      unique: true,
      lowercase: true,
      index: true,
    },
    slug: {
      type: String,
      required: [true, 'Track slug is required'],
      trim: true,
      unique: true,
      lowercase: true,
    },
    dashboardType: {
      type: String,
      required: [true, 'Dashboard type is required'],
      enum: ['engineering', 'core_engineering'],
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    icon: {
      type: String,
      default: '📚',
    },
    color: {
      type: String,
      default: '#3b82f6',
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    // --- Feature Toggles ---
    enableCodingModule: {
      type: Boolean,
      default: true,
    },
    enableDeveloperScore: {
      type: Boolean,
      default: true,
    },
    enableTalentDiscovery: {
      type: Boolean,
      default: true,
    },
    enableInternships: {
      type: Boolean,
      default: true,
    },
    enableResearch: {
      type: Boolean,
      default: true,
    },
    enablePlacements: {
      type: Boolean,
      default: true,
    },
    enableActivities: {
      type: Boolean,
      default: true,
    },
    enableCertifications: {
      type: Boolean,
      default: true,
    },
    enableProjects: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const Track = mongoose.model('Track', trackSchema);
export default Track;
