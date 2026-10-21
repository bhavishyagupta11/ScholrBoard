/**
 * ScoreHistory Model — Append-only immutable historical milestone ledger.
 *
 * Implements ScholrBoard V13 Part 18 specifications.
 * Enforces strict immutability, cryptographic provenance, and unique compound indexes.
 */
import mongoose from 'mongoose';

const { Schema } = mongoose;
const { ObjectId } = Schema.Types;

const eligibilitySnapshotSchema = new Schema({
  status: {
    type: String,
    enum: ['ELIGIBLE', 'INELIGIBLE', 'UNKNOWN', null],
    default: null,
    immutable: true,
  },
  isEligible: {
    type: Boolean,
    default: null,
    immutable: true,
  },
  reasons: [{
    type: String,
    immutable: true,
  }],
  conditions: [{
    type: Schema.Types.Mixed,
    immutable: true,
  }],
  ruleSetId: {
    type: String,
    default: null,
    immutable: true,
  },
  ruleSetVersion: {
    type: String,
    default: null,
    immutable: true,
  },
  evaluatedAt: {
    type: Date,
    default: null,
    immutable: true,
  },
  notes: {
    type: String,
    default: null,
    immutable: true,
  },
}, { _id: false });

const scoreHistorySchema = new Schema({
  userId: {
    type: ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true,
    immutable: true,
  },
  profileId: {
    type: ObjectId,
    ref: 'Profile',
    required: [true, 'Profile ID is required'],
    immutable: true,
  },
  scoreType: {
    type: String,
    enum: ['developer', 'placement_readiness'],
    required: [true, 'Score type is required'],
    immutable: true,
  },

  // Durable logical event identifier for retry idempotency (Generated at logical event boundary)
  milestoneEventId: {
    type: String,
    required: [true, 'Milestone event ID is required'],
    immutable: true,
  },

  // Strictly monotonic sequence number per userId + scoreType for concurrency-safe pointer ordering
  snapshotSequence: {
    type: Number,
    required: [true, 'Snapshot sequence is required'],
    immutable: true,
  },

  // score: Number | null — null = insufficient evidence; explicitly NOT required:true
  score: {
    type: Number,
    default: null,
    immutable: true,
  },

  coverage: {
    type: Number,
    default: null,
    immutable: true,
  },
  confidence: {
    type: String,
    enum: ['High', 'Medium', 'Low', null],
    default: null,
    immutable: true,
  },
  freshness: {
    type: String,
    enum: ['Fresh', 'Aging', 'Stale', null],
    default: null,
    immutable: true,
  },
  evidenceCount: {
    type: Number,
    default: 0,
    immutable: true,
  },

  // Eligibility snapshot (placement_readiness records only - all fields strictly immutable)
  eligibilitySnapshot: {
    type: eligibilitySnapshotSchema,
    default: null,
  },

  dimensions: {
    type: Map,
    of: Schema.Types.Mixed,
    default: () => ({}),
    immutable: true,
  },

  // Canonical calculation inputs & effective configuration snapshot
  evidenceSnapshot: {
    type: Schema.Types.Mixed,
    default: null,
    immutable: true,
  },
  configSnapshot: {
    type: Schema.Types.Mixed,
    default: null,
    immutable: true,
  },

  // Immutably persisted effective configuration digest (SHA-256 of canonicalJSON(configSnapshot))
  configHash: {
    type: String,
    required: [true, 'Config hash is required'],
    immutable: true,
  },

  developerMethodologyVersion: {
    type: String,
    default: null,
    immutable: true,
  },
  placementMethodologyVersion: {
    type: String,
    default: null,
    immutable: true,
  },

  // Evidence-based idempotency key
  snapshotHash: {
    type: String,
    required: [true, 'Snapshot hash is required'],
    immutable: true,
  },

  // Preceding snapshot hash to preserve timeline progression across recurring milestone states (A -> B -> A)
  priorSnapshotHash: {
    type: String,
    required: true,
    default: 'GENESIS',
    immutable: true,
  },

  // Raw evidence composite fingerprint to distinguish same-score milestones triggered by fresh source evidence
  evidenceFingerprint: {
    type: String,
    default: null,
    immutable: true,
  },

  // Cryptographic audit provenance (SHA-256 digest of canonical inputs; excludes calculatedAtUtc)
  calculationFingerprint: {
    type: String,
    required: [true, 'Calculation fingerprint is required'],
    immutable: true,
  },

  calculatedAt: {
    type: Date,
    default: Date.now,
    immutable: true,
  },
  sourceDataUpdatedAt: {
    type: Date,
    default: null,
    immutable: true, // Strictly null if unknown, NEVER fabricated as now!
  },
  triggerReason: {
    type: String,
    default: null,
    immutable: true,
  },
}, {
  timestamps: false,
  versionKey: false,
});

// Append-only contract: strictly prohibit update and delete mutations across all Mongoose access paths

// 1. Prohibit updates to existing documents via doc.save()
scoreHistorySchema.pre('save', function() {
  if (!this.isNew) {
    throw new Error('ScoreHistory is strictly append-only: document mutations via save() are prohibited by architecture.');
  }
});

// 2. Prohibit document-level and query-level updateOne
scoreHistorySchema.pre('updateOne', { document: true, query: true }, function() {
  throw new Error('ScoreHistory is strictly append-only: update operations are prohibited by architecture.');
});

// 3. Prohibit query-level batch and atomic update operations
scoreHistorySchema.pre(['updateMany', 'findOneAndUpdate', 'replaceOne', 'findOneAndReplace'], function() {
  throw new Error('ScoreHistory is strictly append-only: update operations are prohibited by architecture.');
});

// 4. Prohibit document-level and query-level deleteOne
scoreHistorySchema.pre('deleteOne', { document: true, query: true }, function() {
  throw new Error('ScoreHistory is strictly append-only: delete operations are prohibited by architecture.');
});

// 5. Prohibit query-level batch delete operations
scoreHistorySchema.pre(['deleteMany', 'findOneAndDelete'], function() {
  throw new Error('ScoreHistory is strictly append-only: delete operations are prohibited by architecture.');
});

// Query index
scoreHistorySchema.index({ userId: 1, scoreType: 1, calculatedAt: -1 });

// Unique compound indexes
scoreHistorySchema.index(
  { userId: 1, scoreType: 1, milestoneEventId: 1 },
  { unique: true }
);

scoreHistorySchema.index(
  { userId: 1, scoreType: 1, snapshotHash: 1 },
  { unique: true }
);

scoreHistorySchema.index(
  { userId: 1, scoreType: 1, snapshotSequence: 1 },
  { unique: true }
);

const ScoreHistory = mongoose.model('ScoreHistory', scoreHistorySchema);
export default ScoreHistory;
