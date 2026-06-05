/**
 * AiChatHistory Model — Persistent storage for all Gemini AI conversations.
 *
 * Why this collection exists:
 *   Without storing chat history, every AI session starts fresh.  Storing
 *   history lets us:
 *     1. Show users their past conversations
 *     2. Send conversation context back to Gemini for continuity
 *     3. Analyse what topics users ask about (feeds recommendations)
 *     4. Let faculty/admin audit AI usage patterns (privacy-compliant)
 *
 * Design:
 *   One "Conversation" document contains an array of messages (multi-turn).
 *   This matches how the Gemini API expects context: as a messages array.
 *   Conversations are logically grouped by "type" (general, roadmap, resume).
 *
 * Scalability:
 *   Messages are capped at 100 per conversation to prevent unbounded growth.
 *   Old conversations are archived (isArchived) rather than deleted.
 *   Index on (userId, type, createdAt) covers all common access patterns.
 *
 * Relations:
 *   AiChatHistory.userId → User._id
 */
import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'model'],    // 'model' = Gemini's response (matches Gemini API)
    required: true,
  },
  content: {
    type: String,
    required: true,
    maxlength: [8000, 'Message content cannot exceed 8000 characters'],
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  // Metadata for user messages (helps personalize future AI prompts)
  contextSnapshot: {
    skills:       [String],        // user's skills at message time
    currentTopic: String,          // what topic they were studying
    recentActivity: String,        // last completed activity
  },
}, { _id: true });

const aiChatHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },

    // --- Conversation grouping ---
    title: {
      type: String,
      trim: true,
      maxlength: 200,
      default: 'New Conversation',
    },
    type: {
      type: String,
      enum: [
        'general',        // general Q&A / study help
        'roadmap',        // learning roadmap generation
        'career',         // career guidance / job prep
        'resume',         // resume analysis / feedback
        'code_review',    // code review / debugging help
      ],
      default: 'general',
      index: true,
    },

    // --- The actual conversation ---
    messages: {
      type: [messageSchema],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 100,
        message: 'A conversation cannot exceed 100 messages. Start a new chat.',
      },
    },

    // --- AI model used (future-proofing for multi-model support) ---
    modelUsed: {
      type: String,
      default: 'gemini-2.0-flash',
    },

    // --- Stats ---
    totalTokensUsed: {
      type: Number,
      default: 0,
    },
    messageCount: {
      type: Number,
      default: 0,
    },

    // --- State ---
    isArchived: {
      type: Boolean,
      default: false,
    },
    isPinned: {
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

// Fetch user's recent chats by type
aiChatHistorySchema.index({ userId: 1, type: 1, createdAt: -1 });
// Fetch all non-archived chats for a user (chat history sidebar)
aiChatHistorySchema.index({ userId: 1, isArchived: 1, updatedAt: -1 });

const AiChatHistory = mongoose.model('AiChatHistory', aiChatHistorySchema);
export default AiChatHistory;
